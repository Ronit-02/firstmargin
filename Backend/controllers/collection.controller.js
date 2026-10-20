const mongoose = require('mongoose');
const Collection = require('../schemas/collection.schema');
const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const { encodeCursor, decodeCursor } = require('../utils/cursor');
const { presentDiscoveryPosts } = require('../services/publication-presenter.service');
const { uploadOnCloudinary } = require('../utils/cloudinary');
const fs = require('fs');

const isValidId = value => mongoose.isValidObjectId(value);
const effectiveVisibility = collection => collection.isPublic === false
  ? 'private'
  : collection.visibility || 'public';
const getOrderedItems = collection => collection.items?.length
  ? [...collection.items].sort((left, right) => left.position - right.position)
  : (collection.publications || []).map((post, position) => ({ publication: post, position, addedAt: collection.createdAt }));

const parsePostIds = input => {
  if (!Array.isArray(input) || input.length > 100) return null;
  const values = input.map(String);
  if (values.some(value => !isValidId(value)) || new Set(values).size !== values.length) return null;
  return values;
};

const presentCollections = async (collections, actorId, includePosts = false, publicationId = null) => {
  const ownerIds = collections.map(collection => collection.author?._id).filter(Boolean);
  const profiles = await Profile.find({ userId: { $in: ownerIds } }).select('userId handle displayName avatarUrl');
  const profileByOwner = new Map(profiles.map(profile => [profile.userId.toString(), profile]));
  const postDocuments = includePosts
    ? collections.flatMap(collection => getOrderedItems(collection).map(item => item.publication).filter(Boolean))
    : [];
  const postData = includePosts ? await presentDiscoveryPosts(postDocuments, actorId) : [];
  const postById = new Map(postData.map(post => [post.id.toString(), post]));

  return collections.map(collection => {
    const orderedItems = getOrderedItems(collection);
    const profile = collection.author?._id ? profileByOwner.get(collection.author._id.toString()) : null;
    const firstPost = orderedItems.find(item => item.publication)?.publication;
    const visiblePosts = orderedItems.map(item => item.publication).filter(Boolean);
    const shortsCount = visiblePosts.filter(post => post.format === 'short').length;
    const isOwner = Boolean(actorId && collection.author?._id?.toString() === actorId);
    const data = {
      id: collection._id,
      title: collection.title,
      description: collection.description,
      coverImage: collection.coverImage || firstPost?.coverImage || null,
      visibility: effectiveVisibility(collection),
      postsCount: visiblePosts.length,
      storiesCount: visiblePosts.length - shortsCount,
      shortsCount,
      savedCount: collection.savedCount || collection.savedBy?.length || 0,
      isSaved: Boolean(actorId && collection.savedBy?.some(id => id.toString() === actorId)),
      followersCount: collection.followersCount || collection.followers?.length || 0,
      isFollowing: Boolean(actorId && collection.followers?.some(id => id.toString() === actorId)),
      isOwner,
      ...(publicationId ? { containsPost: orderedItems.some(item => item.publication?._id?.toString() === publicationId) } : {}),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      author: {
        id: collection.author?._id || null,
        username: profile?.displayName || collection.author?.username || 'Unknown curator',
        picture: profile?.avatarUrl || collection.author?.picture || null,
        handle: profile?.handle || null,
      },
    };
    if (includePosts) data.posts = orderedItems
      .map(item => item.publication ? postById.get(item.publication._id.toString()) : null)
      .filter(Boolean);
    return data;
  });
};

const getCollections = async (req, res) => {
  try {
    const mine = req.query.mine === 'true';
    const saved = req.query.saved === 'true';
    if ((mine || saved) && !req.auth) return res.status(401).json({ message: 'Sign in to view your collections' });
    if (mine && saved) return res.status(400).json({ message: 'Choose owned or saved collections, not both' });
    const sort = String(req.query.sort || 'latest').toLowerCase();
    if (!['latest', 'popular'].includes(sort)) return res.status(400).json({ message: 'Invalid collection sort' });
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 24) : 12;
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    const publicationId = req.query.publicationId ? String(req.query.publicationId) : null;
    if (publicationId && !isValidId(publicationId)) return res.status(400).json({ message: 'Invalid post id' });
    if (req.query.cursor && !cursor) return res.status(400).json({ message: 'Invalid collection cursor' });
    const filter = saved
      ? { savedBy: req.auth.userId, $or: [{ visibility: 'public' }, { visibility: 'unlisted' }, { visibility: { $exists: false }, isPublic: true }] }
      : mine
        ? { author: req.auth.userId }
        : { $or: [{ visibility: 'public' }, { visibility: { $exists: false }, isPublic: true }] };
    if (req.query.authorId) {
      if (!isValidId(req.query.authorId)) return res.status(400).json({ message: 'Invalid author id' });
      if (mine && req.query.authorId !== req.auth.userId) return res.status(403).json({ message: 'Cannot view another user’s private collections' });
      filter.author = req.query.authorId;
    }
    if (cursor) {
      if (!isValidId(cursor.id)) return res.status(400).json({ message: 'Invalid collection cursor' });
      if (sort === 'popular') {
        if (!Number.isInteger(cursor.savedCount) || cursor.savedCount < 0) return res.status(400).json({ message: 'Invalid collection cursor' });
        filter.$and = [{ $or: [
          { savedCount: { $lt: cursor.savedCount } },
          { savedCount: cursor.savedCount, _id: { $lt: cursor.id } },
        ] }];
      } else {
        const createdAt = new Date(cursor.createdAt);
        if (Number.isNaN(createdAt.getTime())) return res.status(400).json({ message: 'Invalid collection cursor' });
        filter.$and = [{ $or: [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: cursor.id } },
        ] }];
      }
    }
    const documents = await Collection.find(filter)
      .populate({ path: 'author', select: 'picture username' })
      .populate({ path: 'items.publication', match: { publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] }, select: 'title coverImage format' })
      .populate({ path: 'publications', match: { publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] }, select: 'title coverImage format' })
      .sort(sort === 'popular' ? { savedCount: -1, _id: -1 } : { createdAt: -1, _id: -1 })
      .limit(limit + 1);
    const hasMore = documents.length > limit;
    const page = hasMore ? documents.slice(0, limit) : documents;
    const data = await presentCollections(page, req.auth?.userId, false, publicationId);
    const last = page.at(-1);
    return res.status(200).json({
      data,
      meta: {
        sort,
        nextCursor: hasMore && last ? encodeCursor(sort === 'popular' ? { savedCount: last.savedCount || 0, id: last._id.toString() } : { createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null,
      },
    });
  } catch (error) {
    console.error(`[${req.requestId}] Collection listing failed`);
    return res.status(500).json({ message: 'Unable to load collections' });
  }
};

const getCollectionById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
    const collection = await Collection.findById(req.params.id)
      .populate({ path: 'author', select: 'picture username' })
      .populate({ path: 'items.publication', match: { publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] }, populate: { path: 'author', select: 'picture username' } })
      .populate({ path: 'publications', match: { publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] }, populate: { path: 'author', select: 'picture username' } });
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    const isOwner = req.auth?.userId === collection.author?._id?.toString();
    if (effectiveVisibility(collection) === 'private' && !isOwner) return res.status(404).json({ message: 'Collection not found' });
    const [data] = await presentCollections([collection], req.auth?.userId, true);
    return res.status(200).json({ data });
  } catch (error) {
    console.error(`[${req.requestId}] Collection detail failed`);
    return res.status(500).json({ message: 'Unable to load collection' });
  }
};

const getOwnCollectionPosts = async (req, res) => {
  const posts = await Publication.find({ author: req.auth.userId })
    .sort({ createdAt: -1 })
    .select('title coverImage createdAt');
  return res.status(200).json({ data: posts.map(post => ({
    id: post._id,
    title: post.title,
    image: post.coverImage || null,
    createdAt: post.createdAt,
  })) });
};

const validateCollectionInput = async (body, partial = false) => {
  const result = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 100) return { error: 'Title must be between 2 and 100 characters' };
    result.title = title;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 500) return { error: 'Description is too long' };
    result.description = description;
  }
  if (!partial || body.coverImage !== undefined) {
    const coverImage = String(body.coverImage || '').trim();
    if (coverImage.length > 2000) return { error: 'Cover image URL is too long' };
    if (coverImage) { try { const url = new URL(coverImage); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { error: 'Cover image must be a valid HTTP(S) URL' }; } catch { return { error: 'Cover image must be a valid HTTP(S) URL' }; } }
    result.coverImage = coverImage;
  }
  if (!partial || body.visibility !== undefined) {
    const visibility = body.visibility || 'public';
    if (!['public', 'unlisted', 'private'].includes(visibility)) return { error: 'Invalid collection visibility' };
    result.visibility = visibility;
    result.isPublic = visibility !== 'private';
  }
  if (!partial || body.publicationIds !== undefined) {
    const publicationIds = parsePostIds(body.publicationIds || []);
    if (!publicationIds) return { error: 'Collection posts must be unique valid identifiers' };
    const existingCount = await Publication.countDocuments({ _id: { $in: publicationIds } });
    if (existingCount !== publicationIds.length) return { error: 'One or more collection posts do not exist' };
    result.items = publicationIds.map((post, position) => ({ publication: post, position }));
    result.publications = [];
  }
  return { value: result };
};

const createCollection = async (req, res) => {
  try {
    const parsed = await validateCollectionInput(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const collection = await Collection.create({ ...parsed.value, author: req.auth.userId });
    return res.status(201).json({ data: { collectionId: collection._id } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create collection' });
  }
};

const updateCollection = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
    const parsed = await validateCollectionInput(req.body, true);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (!Object.keys(parsed.value).length) return res.status(400).json({ message: 'No collection changes provided' });
    const collection = await Collection.findOneAndUpdate(
      { _id: req.params.id, author: req.auth.userId },
      { $set: parsed.value },
      { returnDocument: 'after' }
    ).select('_id');
    if (collection) return res.status(200).json({ data: { updated: true } });
    const exists = await Collection.exists({ _id: req.params.id });
    return res.status(exists ? 403 : 404).json({ message: exists ? 'Not authorized to edit this collection' : 'Collection not found' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update collection' });
  }
};

const uploadCollectionCover = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    const collection = await Collection.findOne({ _id: req.params.id, author: req.auth.userId }).select('_id');
    if (!collection) return res.status(404).json({ message: 'Owned collection not found' });
    const upload = await uploadOnCloudinary(req.file.path);
    if (!upload?.secure_url) return res.status(502).json({ message: 'Cover image upload failed' });
    await Collection.updateOne({ _id: collection._id, author: req.auth.userId }, { $set: { coverImage: upload.secure_url } });
    return res.status(200).json({ data: { coverImage: upload.secure_url } });
  } finally {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
  }
};

const deleteCollection = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
  const result = await Collection.deleteOne({ _id: req.params.id, author: req.auth.userId });
  if (result.deletedCount) return res.status(200).json({ data: { deleted: true } });
  const exists = await Collection.exists({ _id: req.params.id });
  return res.status(exists ? 403 : 404).json({ message: exists ? 'Not authorized to delete this collection' : 'Collection not found' });
};

const saveCollection = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
  const updated = await Collection.findOneAndUpdate(
    { _id: req.params.id, visibility: { $ne: 'private' }, isPublic: { $ne: false }, savedBy: { $ne: req.auth.userId } },
    { $addToSet: { savedBy: req.auth.userId }, $inc: { savedCount: 1 } },
    { returnDocument: 'after' }
  ).select('savedCount');
  if (updated) return res.status(200).json({ data: { isSaved: true, savedCount: updated.savedCount } });
  const collection = await Collection.findById(req.params.id).select('visibility isPublic savedCount savedBy');
  if (!collection || effectiveVisibility(collection) === 'private') return res.status(404).json({ message: 'Collection not found' });
  return res.status(200).json({ data: { isSaved: true, savedCount: collection.savedCount || collection.savedBy.length } });
};

const unsaveCollection = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
  const updated = await Collection.findOneAndUpdate(
    { _id: req.params.id, savedBy: req.auth.userId, savedCount: { $gt: 0 } },
    { $pull: { savedBy: req.auth.userId }, $inc: { savedCount: -1 } },
    { returnDocument: 'after' }
  ).select('savedCount');
  if (updated) return res.status(200).json({ data: { isSaved: false, savedCount: updated.savedCount } });
  const collection = await Collection.findById(req.params.id).select('savedCount savedBy');
  if (!collection) return res.status(404).json({ message: 'Collection not found' });
  return res.status(200).json({ data: { isSaved: false, savedCount: collection.savedCount || collection.savedBy.length } });
};

const followCollection = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
  const updated = await Collection.findOneAndUpdate(
    { _id: req.params.id, visibility: { $ne: 'private' }, isPublic: { $ne: false }, followers: { $ne: req.auth.userId } },
    { $addToSet: { followers: req.auth.userId }, $inc: { followersCount: 1 } },
    { returnDocument: 'after' }
  ).select('followersCount');
  if (updated) return res.status(200).json({ data: { isFollowing: true, followersCount: updated.followersCount } });
  const collection = await Collection.findById(req.params.id).select('visibility isPublic followers followersCount');
  if (!collection || effectiveVisibility(collection) === 'private') return res.status(404).json({ message: 'Collection not found' });
  return res.status(200).json({ data: { isFollowing: true, followersCount: collection.followersCount || collection.followers.length } });
};

const unfollowCollection = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid collection id' });
  const updated = await Collection.findOneAndUpdate(
    { _id: req.params.id, followers: req.auth.userId, followersCount: { $gt: 0 } },
    { $pull: { followers: req.auth.userId }, $inc: { followersCount: -1 } },
    { returnDocument: 'after' }
  ).select('followersCount');
  if (updated) return res.status(200).json({ data: { isFollowing: false, followersCount: updated.followersCount } });
  const collection = await Collection.findById(req.params.id).select('followers followersCount');
  if (!collection) return res.status(404).json({ message: 'Collection not found' });
  return res.status(200).json({ data: { isFollowing: false, followersCount: collection.followersCount || collection.followers.length } });
};

module.exports = { getCollections, getCollectionById, getOwnCollectionPosts, createCollection, updateCollection, uploadCollectionCover, deleteCollection, saveCollection, unsaveCollection, followCollection, unfollowCollection };
