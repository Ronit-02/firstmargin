const User = require('../schemas/user.schema');
const Publication = require('../schemas/publication.schema');
const Save = require('../schemas/save.schema');
const Appreciation = require('../schemas/appreciation.schema');
const Profile = require('../schemas/profile.schema');
const mongoose = require('mongoose');
const fs = require('fs');
const { createProfileForUser } = require('../services/profile.service');
const { uploadProfileAvatar, profileAvatarPublicIdFromUrl, removeProfileAvatar } = require('../utils/cloudinary');
const { uploadProfileCover, profileCoverPublicIdFromUrl, removeProfileCover } = require('../utils/cloudinary');
const { isSafeHttpUrl } = require('../utils/safe-url');
const InteractionEvent = require('../schemas/interaction-event.schema');
const { hasCapability } = require('../services/entitlement.service');
const { toggleFollow: toggleFollowWorkflow, toggleSave: toggleSaveWorkflow } = require('../services/user-relationship.service');
const { setLike, addComment: addCommentWorkflow } = require('../services/engagement.service');
const { presentDiscoveryPosts } = require('../services/publication-presenter.service');

const isValidId = (id) => mongoose.isValidObjectId(id);

const getMe = async (req, res) => {
  try {
    const [user, profile, postCount] = await Promise.all([
      User.findById(req.auth.userId).select('username picture bio role followersCount followingCount createdAt'),
      Profile.findOne({ userId: req.auth.userId }).select('handle displayName bio avatarUrl coverImageUrl websiteUrl writerStatus membershipEnabled directRequestsEnabled'),
      Publication.countDocuments({ author: req.auth.userId }),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        displayName: profile?.displayName || user.username,
        handle: profile?.handle || null,
        bio: profile?.bio ?? user.bio ?? '',
        avatarUrl: profile?.avatarUrl || user.picture || null,
        coverImageUrl: profile?.coverImageUrl || null,
        websiteUrl: profile?.websiteUrl || null,
        writerStatus: profile?.writerStatus || 'reader',
        membershipEnabled: Boolean(profile?.membershipEnabled),
        directRequestsEnabled: Boolean(profile?.directRequestsEnabled),
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        postCount,
        joinedAt: user.createdAt,
      },
    });
  } catch {
    return res.status(500).json({ message: 'Unable to load your profile' });
  }
};

const getMyPosts = async (req, res) => {
  try {
    const posts = await Publication.find({ author: req.auth.userId })
      .select('title coverImage format tags appreciationsCount commentsCount metadata publicationStatus currentRevision publicAt createdAt author body')
      .populate({ path: 'author', select: 'username picture' })
      .sort({ createdAt: -1 });
    const summaries = await presentDiscoveryPosts(posts, req.auth.userId);
    return res.status(200).json({ data: posts.map((post, index) => {
      const record = post.toObject();
      delete record.body;
      return { ...record, ...summaries[index] };
    }) });
  } catch {
    return res.status(500).json({ message: 'Unable to load your posts' });
  }
};

/* GET /api/user — fetch a public user profile */
const fetchUser = async (req, res) => {
  try {
    const { id, username } = req.query;
    if (!id && !username) {
      return res.status(400).json({ message: 'User id or username is required' });
    }
    if (id && !isValidId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const query = id ? { _id: id } : { username };
    const user = await User.findOne(query)
      .select('picture username bio followersCount followingCount role createdAt');
    if (!user) return res.status(404).send({ message: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).send({ message: 'Cannot fetch user' });
  }
};

/* PUT /api/user/profile — update own profile (auth required) */
const updateProfile = async (req, res) => {
  try {
    const { username, bio, directRequestsEnabled } = req.body;
    const userId = req.auth.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).send({ message: 'Not found' });

    if (username) {
      const taken = await User.findOne({ username, _id: { $ne: userId } });
      if (taken) return res.status(400).send({ message: 'Username already taken' });
      user.username = username;
    }
    if (bio !== undefined) user.bio = bio;
    await user.save();

    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = await createProfileForUser({
        userId,
        username: user.username,
        picture: user.picture,
        bio: user.bio,
      });
    } else {
      if (username) profile.displayName = user.username;
      if (bio !== undefined) profile.bio = user.bio;
      if (typeof directRequestsEnabled === 'boolean') profile.directRequestsEnabled = directRequestsEnabled;
      await profile.save();
    }

    return res.status(200).json({
      message: 'Profile updated',
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        directRequestsEnabled: profile.directRequestsEnabled,
      },
    });
  } catch (err) {
    return res.status(500).send({ message: 'Error updating profile' });
  }
};

const updateProfileAvatar = async (req, res) => {
  let uploadedPublicId = null;
  let saved = false;
  try {
    const avatarUrl = String(req.body.avatarUrl || '').trim();
    const removeAvatar = req.body.removeAvatar === 'true';
    if (!req.file && !avatarUrl && !removeAvatar) return res.status(400).json({ message: 'Choose a profile picture to upload' });
    if (Number(Boolean(req.file)) + Number(Boolean(avatarUrl)) + Number(removeAvatar) > 1) return res.status(400).json({ message: 'Choose one profile picture action' });
    if (avatarUrl) { try { const url = new URL(avatarUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.toString().length > 2000) throw new Error('Invalid URL'); } catch { return res.status(400).json({ message: 'Profile picture must be a valid HTTP(S) URL' }); } }
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = await Profile.findOne({ userId: user._id }) || await createProfileForUser({
      userId: user._id, username: user.username, picture: user.picture, bio: user.bio,
    });
    const previousAvatarUrl = profile.avatarUrl;
    const previousUserPicture = user.picture;
    const upload = req.file ? await uploadProfileAvatar(req.file.path, user._id) : null;
    if (req.file && (!upload?.secure_url || !upload?.public_id)) throw new Error('Avatar upload returned no image');
    uploadedPublicId = upload?.public_id || null;
    const nextAvatarUrl = removeAvatar ? '' : upload?.secure_url || avatarUrl;

    user.picture = nextAvatarUrl;
    await user.save();
    try {
      profile.avatarUrl = nextAvatarUrl;
      await profile.save();
    } catch (error) {
      user.picture = previousUserPicture;
      await user.save().catch(() => console.error(`[${req.requestId}] Avatar user-picture rollback failed`));
      throw error;
    }
    saved = true;

    const previousPublicId = profileAvatarPublicIdFromUrl(previousAvatarUrl, user._id);
    if (previousPublicId && previousPublicId !== uploadedPublicId) {
      await removeProfileAvatar(previousPublicId).catch(() => console.error(`[${req.requestId}] Previous profile avatar cleanup failed`));
    }
    return res.status(200).json({ profile: { avatarUrl: nextAvatarUrl } });
  } catch {
    if (uploadedPublicId && !saved) {
      await removeProfileAvatar(uploadedPublicId).catch(() => console.error(`[${req.requestId}] Failed avatar upload cleanup failed`));
    }
    return res.status(500).json({ message: 'Profile picture could not be saved' });
  } finally {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
  }
};

const updateProfileCover = async (req, res) => {
  let uploadedPublicId = null;
  let saved = false;
  try {
    const coverImageUrl = String(req.body.coverImageUrl || '').trim();
    const removeCover = req.body.removeCover === 'true';
    if (!req.file && !coverImageUrl && !removeCover) return res.status(400).json({ message: 'Choose a cover image to upload' });
    if (Number(Boolean(req.file)) + Number(Boolean(coverImageUrl)) + Number(removeCover) > 1) return res.status(400).json({ message: 'Choose one cover image action' });
    if (coverImageUrl && (coverImageUrl.length > 2000 || !isSafeHttpUrl(coverImageUrl))) return res.status(400).json({ message: 'Cover image must be a valid HTTP(S) URL' });
    const user = await User.findById(req.auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = await Profile.findOne({ userId: user._id }) || await createProfileForUser({ userId: user._id, username: user.username, picture: user.picture, bio: user.bio });
    const previousUrl = profile.coverImageUrl;
    const upload = req.file ? await uploadProfileCover(req.file.path, user._id) : null;
    uploadedPublicId = upload?.public_id || null;
    if (req.file && (!upload?.secure_url || !upload?.public_id)) throw new Error('Cover upload returned no image');
    profile.coverImageUrl = removeCover ? null : upload?.secure_url || coverImageUrl;
    await profile.save();
    saved = true;
    const previousPublicId = profileCoverPublicIdFromUrl(previousUrl, user._id);
    if (previousPublicId && previousPublicId !== uploadedPublicId) {
      await removeProfileCover(previousPublicId).catch(() => console.error(`[${req.requestId}] Previous profile cover cleanup failed`));
    }
    return res.status(200).json({ profile: { coverImageUrl: profile.coverImageUrl } });
  } catch {
    if (uploadedPublicId && !saved) await removeProfileCover(uploadedPublicId).catch(() => console.error(`[${req.requestId}] Failed cover upload cleanup failed`));
    return res.status(500).json({ message: 'Cover image could not be saved' });
  } finally {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
  }
};

/* POST /api/user/follow/:id — toggle follow */
const toggleFollow = async (req, res) => {
  try {
    const followerId = req.auth.userId;
    const followingId = req.params.id;

    if (!isValidId(followingId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    if (followerId === followingId)
      return res.status(400).send({ message: 'Cannot follow yourself' });

    const [me, target] = await Promise.all([
      User.findById(followerId).select('_id'),
      User.findById(followingId).select('_id followersCount'),
    ]);
    if (!me) return res.status(401).send({ message: 'User not found' });
    if (!target) return res.status(404).send({ message: 'User not found' });

    return res.status(200).json(await toggleFollowWorkflow({ followerId, followingId }));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).send({ message: 'Follow state already changed' });
    }
    return res.status(500).send({ message: 'Error' });
  }
};

/* POST /api/user/bookmark/:publicationId — toggle bookmark */
const toggleBookmark = async (req, res) => {
  try {
    const { publicationId } = req.params;
    if (!isValidId(publicationId)) return res.status(400).json({ message: 'Invalid post id' });

    const user = await User.findById(req.auth.userId);
    if(!user) return res.status(404).json({ message: 'User not found' });

    const post = await Publication.findById(publicationId);
    if (!post) return res.status(404).json({ message: 'Publication not found' });

    return res.status(200).json({ success: true, ...(await toggleSaveWorkflow({ userId: user._id, publicationId: post._id })) });
  } 
  catch (err) {
    console.error(`[${req.requestId}] Bookmark mutation failed`);
    return res.status(500).json({ 
      success: false,
      message: 'Error toggling bookmark' 
    });
  }
};

/* GET /api/user/bookmarks — get user's saved posts */
const getBookmarks = async (req, res) => {
  try {
    const saves = await Save.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'publicationId',
        populate: { path: 'author', select: 'picture username bio' },
      });
    const posts = saves.map(save => save.publicationId).filter(Boolean);
    const summaries = await presentDiscoveryPosts(posts, req.auth.userId);
    return res.status(200).json(posts.map((post, index) => ({ ...post.toObject(), ...summaries[index], author: { ...post.author?.toObject(), ...summaries[index].author } })));
  } catch (err) {
    return res.status(500).send({ message: 'Error' });
  }
};

/* GET /api/user/analytics — basic analytics for current user */
const getAnalytics = async (req, res) => {
  try {
    if (!await hasCapability(req.auth.userId, 'writer_analytics')) {
      return res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'Writer analytics require an active membership' });
    }
    const posts = await Publication.find({ author: req.auth.userId }).select('title appreciationsCount commentsCount createdAt');
    const publicationIds = posts.map(post => post._id);
    const grouped = await InteractionEvent.aggregate([
      { $match: { publicationId: { $in: publicationIds }, eventType: { $in: ['open', 'complete'] } } },
      { $group: { _id: { publicationId: '$publicationId', eventType: '$eventType' }, count: { $sum: 1 } } },
    ]);
    const eventCounts = new Map(grouped.map(item => [`${item._id.publicationId}:${item._id.eventType}`, item.count]));
    const rows = posts.map(post => ({
      id: post._id,
      title: post.title,
      opens: eventCounts.get(`${post._id}:open`) || 0,
      completions: eventCounts.get(`${post._id}:complete`) || 0,
      likes: post.appreciationsCount || 0,
      comments: post.commentsCount || 0,
      date: post.createdAt,
    }));
    const totalViews = rows.reduce((sum, post) => sum + post.opens, 0);
    const totalCompletions = rows.reduce((sum, post) => sum + post.completions, 0);
    return res.status(200).json({
      data: {
        totalPosts: posts.length,
        totalViews,
        totalCompletions,
        completionRate: totalViews ? Math.round((totalCompletions / totalViews) * 1000) / 10 : 0,
        posts: rows.sort((left, right) => right.opens - left.opens),
      },
    });
  } catch (err) {
    return res.status(500).send({ message: 'Unable to load writer analytics' });
  }
};

/* POST /api/user/like/:publicationId — toggle like on a post */
const toggleLike = async (req, res) => {
  try {
    const { publicationId } = req.params;
    if (!isValidId(publicationId)) return res.status(400).json({ message: 'Invalid post id' });

    const post = await Publication.findById(publicationId).select('_id appreciationsCount');
    if (!post) return res.status(404).send({ message: 'Publication not found' });

    const userId = req.auth.userId;
    const liked = !(await Appreciation.exists({ userId, publicationId }));
    const result = await setLike({ publicationId, userId, liked });
    return res.status(200).json({ liked: result.isAppreciated, appreciationsCount: result.appreciationsCount });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).send({ message: 'Appreciation state already changed' });
    }
    return res.status(500).send({ message: 'Error' });
  }
};

/* POST /api/user/comment/:publicationId — add comment to post */
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).send({ message: 'Comment text required' });
    const content = text.trim();
    if (!content) return res.status(400).send({ message: 'Comment text required' });
    if (content.length > 1000) return res.status(400).send({ message: 'Comment is too long' });
    if (!isValidId(req.params.publicationId)) return res.status(400).send({ message: 'Invalid post id' });

    const post = await Publication.findById(req.params.publicationId).select('_id');
    if (!post) return res.status(404).send({ message: 'Publication not found' });

    const comment = await addCommentWorkflow({ publicationId: post._id, userId: req.auth.userId, content });
    return res.status(201).json({ message: 'Comment added', commentId: comment.id });
  } catch (err) {
    return res.status(500).send({ message: 'Error adding comment' });
  }
};

module.exports = { getMe, getMyPosts, fetchUser, updateProfile, updateProfileAvatar, updateProfileCover, toggleFollow, toggleBookmark, getBookmarks, getAnalytics, toggleLike, addComment };
