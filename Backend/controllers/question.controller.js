const mongoose = require('mongoose');
const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const Question = require('../schemas/question.schema');
const Report = require('../schemas/report.schema');
const { reportReasons } = Report;
const { notify } = require('../services/notification.service');
const { encodeCursor, decodeCursor } = require('../utils/cursor');
const { normalizeQuestionText } = require('../utils/question');
const { publicPostClause, getPostAccessContext, accessiblePostClause } = require('../services/publication-access.service');

const { presentDiscoveryPosts } = require('../services/publication-presenter.service');

const presentResponses = async (posts, actorId) => (posts.length ? await presentDiscoveryPosts(posts, actorId) : []).map(post => ({ ...post, _id: post.id, coverImage: post.image }));

const isValidId = id => mongoose.isValidObjectId(id);

const presentAnswer = (answer, actorId) => ({
  id: answer._id,
  text: answer.text,
  createdAt: answer.createdAt,
  upvotesCount: answer.upvotes?.length || 0,
  isUpvoted: Boolean(actorId && answer.upvotes?.some(id => id.toString() === actorId)),
  author: answer.author?._id ? {
    id: answer.author._id,
    username: answer.author.username || 'Unknown writer',
    picture: answer.author.picture || null,
  } : null,
});

const presentQuestionDetail = (question, actorId) => ({
  id: question._id,
  text: question.text,
  context: question.context,
  tags: question.tags,
  upvotesCount: question.upvotesCount,
  isUpvoted: Boolean(actorId && question.upvotes.some(id => id.toString() === actorId)),
  followersCount: question.followers?.length || 0,
  isFollowing: Boolean(actorId && question.followers?.some(id => id.toString() === actorId)),
  status: question.status,
  createdAt: question.createdAt,
  author: question.author?._id ? { id: question.author._id, username: question.author.username || 'Unknown reader', picture: question.author.picture || null } : null,
  answers: (question.answers || []).map(answer => presentAnswer(answer, actorId)),
  responsePosts: question.relatedPublications || [],
});

const presentOpportunity = (question, writerTags, now) => {
  const matchingTags = (question.tags || []).filter(tag => writerTags.has(tag));
  const isTargeted = Boolean(question._opportunityActorId && question.targetWriterIds?.some(id => id.toString() === question._opportunityActorId));
  const ageDays = Math.max(0, (now - new Date(question.createdAt).getTime()) / 86_400_000);
  const freshness = Math.max(0, 1 - (ageDays / 30));
  const demand = Math.min(1, (question.upvotesCount || 0) / 25);
  const fit = isTargeted ? 1 : matchingTags.length ? Math.min(1, 0.35 + matchingTags.length * 0.2) : 0.1;
  const score = Math.round((fit * 0.5 + demand * 0.35 + freshness * 0.15) * 1000) / 10;
  return {
    id: question._id,
    text: question.text,
    context: question.context,
    tags: question.tags,
    status: question.status,
    createdAt: question.createdAt,
    upvotesCount: question.upvotesCount,
    followersCount: question.followers?.length || 0,
    answersCount: question.answers?.length || 0,
    matchingTags,
    fitScore: score,
    isClaimedByYou: Boolean(question.claimedBy && question.claimedBy.toString() === question._opportunityActorId),
    isDeclinedByYou: Boolean(question.declinedBy?.some(id => id.toString() === question._opportunityActorId)),
    claimedBy: question.claimedBy || null,
    isTargeted,
    reason: isTargeted
      ? 'Requested directly by a reader'
      : matchingTags.length
      ? `Matches your published topic${matchingTags.length > 1 ? 's' : ''}: ${matchingTags.join(', ')}`
      : 'Open demand from readers',
    author: question.author ? { id: question.author._id, username: question.author.username, picture: question.author.picture || null } : null,
  };
};

const presentQuestions = async (questions, actorId) => {
  const authorIds = questions.map(question => question.author?._id).filter(Boolean);
  const profiles = await Profile.find({ userId: { $in: authorIds } }).select('userId handle');
  const handles = new Map(profiles.map(profile => [profile.userId.toString(), profile.handle]));
  const responses = await presentResponses(questions.flatMap(question => question.relatedPublications || []), actorId);
  const responsesById = new Map(responses.map(post => [post.id.toString(), post]));
  return questions.map(question => ({
    id: question._id,
    text: question.text,
    context: question.context,
    tags: question.tags,
    upvotesCount: question.upvotesCount,
    answersCount: question.answers.length,
    responsePosts: (question.relatedPublications || []).map(post => responsesById.get(post._id.toString())).filter(Boolean),
    status: question.status,
    createdAt: question.createdAt,
    isUpvoted: actorId ? question.upvotes.some(id => id.toString() === actorId) : false,
    author: {
      id: question.author?._id || null,
      username: question.author?.username || 'Unknown reader',
      picture: question.author?.picture || null,
      handle: question.author?._id ? handles.get(question.author._id.toString()) || null : null,
    },
  }));
};

const getQuestions = async (req, res) => {
  try {
    const sort = String(req.query.sort || 'hot');
    if (!['hot', 'newest'].includes(sort)) return res.status(400).json({ message: 'Invalid question sort' });
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 24) : 12;
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) return res.status(400).json({ message: 'Invalid question cursor' });

    const filter = { status: { $ne: 'closed' } };
    if (cursor) {
      if (!isValidId(cursor.id)) return res.status(400).json({ message: 'Invalid question cursor' });
      if (sort === 'hot') {
        if (!Number.isInteger(cursor.upvotes) || cursor.upvotes < 0) return res.status(400).json({ message: 'Invalid question cursor' });
        filter.$or = [
          { upvotesCount: { $lt: cursor.upvotes } },
          { upvotesCount: cursor.upvotes, _id: { $lt: cursor.id } },
        ];
      } else {
        const createdAt = new Date(cursor.createdAt);
        if (Number.isNaN(createdAt.getTime())) return res.status(400).json({ message: 'Invalid question cursor' });
        filter.$or = [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: cursor.id } },
        ];
      }
    }

    const order = sort === 'hot' ? { upvotesCount: -1, _id: -1 } : { createdAt: -1, _id: -1 };
    const accessContext = await getPostAccessContext(req.auth?.userId);
    const documents = await Question.find(filter)
      .populate({ path: 'author', select: 'picture username' })
      .populate({ path: 'relatedPublications', match: accessiblePostClause(accessContext), select: 'title format coverImage author createdAt body tags appreciationsCount commentsCount', populate: { path: 'author', select: 'username picture' } })
      .sort(order)
      .limit(limit + 1);
    const hasMore = documents.length > limit;
    const page = hasMore ? documents.slice(0, limit) : documents;
    const data = await presentQuestions(page, req.auth?.userId);
    const last = page.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(sort === 'hot'
      ? { upvotes: last.upvotesCount, id: last._id.toString() }
      : { createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null;
    return res.status(200).json({ data, meta: { sort, nextCursor } });
  } catch (error) {
    console.error(`[${req.requestId}] Question listing failed`);
    return res.status(500).json({ message: 'Unable to load questions' });
  }
};

const getQuestionDetail = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const accessContext = await getPostAccessContext(req.auth?.userId);
    const question = await Question.findOne({ _id: req.params.id, status: { $ne: 'closed' } })
      .populate({ path: 'author', select: 'picture username' })
      .populate({ path: 'answers.author', select: 'picture username' })
      .populate({ path: 'relatedPublications', match: accessiblePostClause(accessContext), select: 'title format coverImage author createdAt body tags appreciationsCount commentsCount', populate: { path: 'author', select: 'username picture' } });
    if (!question) return res.status(404).json({ message: 'Question not found' });
    const data = presentQuestionDetail(question, req.auth?.userId);
    data.responsePosts = await presentResponses(question.relatedPublications || [], req.auth?.userId);
    return res.status(200).json({ data });
  } catch (error) {
    console.error(`[${req.requestId}] Question detail failed`);
    return res.status(500).json({ message: 'Unable to load question' });
  }
};

const getQuestionOpportunities = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 30) : 20;
    const [posts, questions] = await Promise.all([
      Publication.find({ author: req.auth.userId, ...publicPostClause() }).select('tags').lean(),
      Question.find({ status: 'open', author: { $ne: req.auth.userId }, declinedBy: { $ne: req.auth.userId }, $or: [{ claimedBy: null }, { claimedBy: req.auth.userId }, { claimedBy: { $exists: false } }] })
        .populate({ path: 'author', select: 'username picture' })
        .select('text context tags status createdAt upvotesCount followers answers author claimedBy declinedBy targetWriterIds')
        .lean(),
    ]);
    const writerTags = new Set(posts.flatMap(post => post.tags || []).map(tag => String(tag).toLowerCase()));
    const now = Date.now();
    const ranked = questions.map(question => presentOpportunity({ ...question, _opportunityActorId: req.auth.userId }, writerTags, now))
      .sort((left, right) => right.fitScore - left.fitScore || right.upvotesCount - left.upvotesCount || new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, limit);
    const topicDemand = new Map();
    questions.forEach(question => (question.tags || []).forEach(tag => topicDemand.set(tag, (topicDemand.get(tag) || 0) + question.upvotesCount)));
    const topTopics = [...topicDemand.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([topic, upvotes]) => ({ topic, upvotes }));
    return res.status(200).json({ data: ranked, meta: { summary: { openQuestions: questions.length, totalUpvotes: questions.reduce((sum, question) => sum + (question.upvotesCount || 0), 0), topTopics }, writerTopics: [...writerTags].slice(0, 20) } });
  } catch (error) {
    console.error(`[${req.requestId}] Question opportunities failed`);
    return res.status(500).json({ message: 'Unable to load writer opportunities' });
  }
};

const claimQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const existing = await Question.findOne({ _id: req.params.id, claimedBy: req.auth.userId }).select('claimedBy claimedAt');
    if (existing) return res.status(200).json({ data: { isClaimed: true, claimedAt: existing.claimedAt } });
    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, status: 'open', declinedBy: { $ne: req.auth.userId }, $or: [{ claimedBy: null }, { claimedBy: { $exists: false } }] },
      { $set: { claimedBy: req.auth.userId, claimedAt: new Date() } },
      { returnDocument: 'after' }
    ).select('claimedBy claimedAt');
    if (!question) return res.status(409).json({ message: 'This question has already been claimed or is no longer open' });
    return res.status(200).json({ data: { isClaimed: true, claimedAt: question.claimedAt } });
  } catch { return res.status(500).json({ message: 'Unable to claim question' }); }
};

const unclaimQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const question = await Question.findOneAndUpdate({ _id: req.params.id, claimedBy: req.auth.userId }, { $set: { claimedBy: null, claimedAt: null } }, { returnDocument: 'after' }).select('claimedBy claimedAt');
    if (!question) {
      const exists = await Question.exists({ _id: req.params.id });
      return res.status(exists ? 200 : 404).json({ data: { isClaimed: false }, ...(exists ? {} : { message: 'Question not found' }) });
    }
    return res.status(200).json({ data: { isClaimed: false, claimedAt: null } });
  } catch { return res.status(500).json({ message: 'Unable to release question' }); }
};

const declineQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const question = await Question.findOneAndUpdate({ _id: req.params.id, status: 'open', author: { $ne: req.auth.userId } }, { $addToSet: { declinedBy: req.auth.userId }, $set: { claimedBy: null, claimedAt: null } }, { returnDocument: 'after' }).select('declinedBy');
    if (!question) return res.status(404).json({ message: 'Open question not found' });
    return res.status(200).json({ data: { isDeclined: true } });
  } catch { return res.status(500).json({ message: 'Unable to decline question' }); }
};

const suggestQuestions = async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 4 || query.length > 180) return res.status(400).json({ message: 'Suggestion query must be between 4 and 180 characters' });
    const normalizedText = normalizeQuestionText(query);
    const exact = await Question.findOne({ normalizedText }).select('text upvotesCount status');
    const related = await Question.find({ $text: { $search: query }, _id: { $ne: exact?._id } })
      .select('text upvotesCount status')
      .sort({ score: { $meta: 'textScore' }, upvotesCount: -1 })
      .limit(exact ? 4 : 5);
    return res.status(200).json({
      data: [exact, ...related].filter(Boolean).map(question => ({
        id: question._id,
        text: question.text,
        upvotesCount: question.upvotesCount,
        status: question.status,
        exact: question._id.equals(exact?._id),
      })),
    });
  } catch (error) {
    console.error(`[${req.requestId}] Question suggestions failed`);
    return res.status(500).json({ message: 'Unable to suggest questions' });
  }
};

const createQuestion = async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const context = String(req.body?.context || '').trim();
    const tags = Array.isArray(req.body?.tags)
      ? [...new Set(req.body.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))]
      : [];
    const targetWriterIds = Array.isArray(req.body?.targetWriterIds) ? [...new Set(req.body.targetWriterIds.map(String))] : [];
    if (text.length < 10 || text.length > 180 || context.length > 1000 || tags.length > 5 || tags.some(tag => tag.length > 30) || targetWriterIds.length > 5 || targetWriterIds.some(id => !isValidId(id) || id === req.auth.userId)) {
      return res.status(400).json({ message: 'Invalid question content' });
    }
    if (targetWriterIds.length) {
      const writers = await Profile.countDocuments({ userId: { $in: targetWriterIds }, writerStatus: 'writer' });
      if (writers !== targetWriterIds.length) return res.status(400).json({ message: 'One or more target writers could not be found' });
    }
    const normalizedText = normalizeQuestionText(text);
    const existing = await Question.findOneAndUpdate(
      { normalizedText, upvotes: { $ne: req.auth.userId } },
      { $addToSet: { upvotes: req.auth.userId }, $inc: { upvotesCount: 1 } },
      { returnDocument: 'after' }
    );
    if (existing) return res.status(200).json({ data: { questionId: existing._id, mergedExisting: true, upvotesCount: existing.upvotesCount } });
    const alreadyUpvoted = await Question.findOne({ normalizedText }).select('_id upvotesCount');
    if (alreadyUpvoted) return res.status(200).json({ data: { questionId: alreadyUpvoted._id, mergedExisting: true, upvotesCount: alreadyUpvoted.upvotesCount } });

    try {
      const question = await Question.create({
        text, normalizedText, context, tags, targetWriterIds, author: req.auth.userId,
        upvotes: [req.auth.userId], upvotesCount: 1,
      });
      await Promise.all(targetWriterIds.map(recipientId => notify({
        recipientId,
        actorId: req.auth.userId,
        type: 'question_targeted',
        title: 'A reader requested your perspective',
        body: text,
        href: `/explore/questions/${question._id}`,
        entityType: 'question',
        entityId: question._id,
      })));
      return res.status(201).json({ data: { questionId: question._id, mergedExisting: false, upvotesCount: 1 } });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const duplicate = await Question.findOne({ normalizedText }).select('_id upvotesCount');
      return res.status(200).json({ data: { questionId: duplicate._id, mergedExisting: true, upvotesCount: duplicate.upvotesCount } });
    }
  } catch (error) {
    console.error(`[${req.requestId}] Question creation failed`);
    return res.status(500).json({ message: 'Unable to ask this question' });
  }
};

const upvoteQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const updated = await Question.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'closed' }, upvotes: { $ne: req.auth.userId } },
      { $addToSet: { upvotes: req.auth.userId }, $inc: { upvotesCount: 1 } },
      { returnDocument: 'after' }
    ).select('upvotesCount');
    if (updated) return res.status(200).json({ data: { isUpvoted: true, upvotesCount: updated.upvotesCount } });
    const question = await Question.findById(req.params.id).select('upvotesCount status');
    if (!question) return res.status(404).json({ message: 'Question not found' });
    if (question.status === 'closed') return res.status(409).json({ message: 'Closed questions cannot be changed' });
    return res.status(200).json({ data: { isUpvoted: true, upvotesCount: question.upvotesCount } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to upvote question' });
  }
};

const removeQuestionUpvote = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const updated = await Question.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'closed' }, upvotes: req.auth.userId, upvotesCount: { $gt: 0 } },
      { $pull: { upvotes: req.auth.userId }, $inc: { upvotesCount: -1 } },
      { returnDocument: 'after' }
    ).select('upvotesCount');
    if (updated) return res.status(200).json({ data: { isUpvoted: false, upvotesCount: updated.upvotesCount } });
    const question = await Question.findById(req.params.id).select('upvotesCount status');
    if (!question) return res.status(404).json({ message: 'Question not found' });
    if (question.status === 'closed') return res.status(409).json({ message: 'Closed questions cannot be changed' });
    return res.status(200).json({ data: { isUpvoted: false, upvotesCount: question.upvotesCount } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove question upvote' });
  }
};

const createAnswer = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 10 || text.length > 1000) return res.status(400).json({ message: 'Answer must be between 10 and 1,000 characters' });
    const question = await Question.findOne({ _id: req.params.id, status: { $ne: 'closed' } }).select('author followers answers relatedPublications text');
    if (!question) return res.status(404).json({ message: 'Question not found' });
    if (question.answers.length >= 100) return res.status(409).json({ message: 'This question has reached its answer limit' });
    question.answers.push({ text, author: req.auth.userId });
    question.status = 'answered';
    await question.save();
    const answer = question.answers.at(-1);
    const recipients = new Set([question.author.toString(), ...(question.followers || []).map(id => id.toString())]);
    await Promise.all([...recipients].map(recipientId => notify({
      recipientId, actorId: req.auth.userId, type: 'question_answered',
      title: 'A question has a new answer', body: text.slice(0, 180),
      href: `/explore/questions/${question._id}`, entityType: 'question', entityId: question._id,
    })));
    return res.status(201).json({ data: { answer: presentAnswer({ ...answer.toObject(), author: { _id: req.auth.userId, username: 'You', picture: null } }, req.auth.userId), status: question.status } });
  } catch (error) {
    console.error(`[${req.requestId}] Question answer failed`);
    return res.status(500).json({ message: 'Unable to post answer' });
  }
};

const upvoteAnswer = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.answerId)) return res.status(400).json({ message: 'Invalid question or answer id' });
    const updated = await Question.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'closed' }, 'answers._id': req.params.answerId, 'answers.upvotes': { $ne: req.auth.userId } },
      { $addToSet: { 'answers.$.upvotes': req.auth.userId } },
      { returnDocument: 'after' }
    ).select('answers');
    if (!updated) {
      const exists = await Question.exists({ _id: req.params.id, status: { $ne: 'closed' }, 'answers._id': req.params.answerId });
      if (!exists && await Question.exists({ _id: req.params.id, status: 'closed' })) return res.status(409).json({ message: 'Closed questions cannot be changed' });
      return res.status(exists ? 200 : 404).json({ data: { isUpvoted: true, upvotesCount: exists ? undefined : 0 }, ...(exists ? {} : { message: 'Answer not found' }) });
    }
    const answer = updated.answers.id(req.params.answerId);
    return res.status(200).json({ data: { isUpvoted: true, upvotesCount: answer.upvotes.length } });
  } catch { return res.status(500).json({ message: 'Unable to upvote answer' }); }
};

const removeAnswerUpvote = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.answerId)) return res.status(400).json({ message: 'Invalid question or answer id' });
    const updated = await Question.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'closed' }, 'answers._id': req.params.answerId, 'answers.upvotes': req.auth.userId },
      { $pull: { 'answers.$.upvotes': req.auth.userId } },
      { returnDocument: 'after' }
    ).select('answers');
    if (!updated) {
      const exists = await Question.exists({ _id: req.params.id, status: { $ne: 'closed' }, 'answers._id': req.params.answerId });
      if (!exists && await Question.exists({ _id: req.params.id, status: 'closed' })) return res.status(409).json({ message: 'Closed questions cannot be changed' });
      return res.status(exists ? 200 : 404).json({ data: { isUpvoted: false, upvotesCount: 0 }, ...(exists ? {} : { message: 'Answer not found' }) });
    }
    const answer = updated.answers.id(req.params.answerId);
    return res.status(200).json({ data: { isUpvoted: false, upvotesCount: answer.upvotes.length } });
  } catch { return res.status(500).json({ message: 'Unable to remove answer upvote' }); }
};

const followQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const updated = await Question.findOneAndUpdate({ _id: req.params.id, status: { $ne: 'closed' } }, { $addToSet: { followers: req.auth.userId } }, { returnDocument: 'after' }).select('followers');
    if (!updated) return res.status(404).json({ message: 'Question not found' });
    return res.status(200).json({ data: { isFollowing: true, followersCount: updated.followers.length } });
  } catch { return res.status(500).json({ message: 'Unable to follow question' }); }
};

const unfollowQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const updated = await Question.findOneAndUpdate({ _id: req.params.id, followers: req.auth.userId }, { $pull: { followers: req.auth.userId } }, { returnDocument: 'after' }).select('followers');
    if (!updated) {
      const exists = await Question.exists({ _id: req.params.id });
      return res.status(exists ? 200 : 404).json({ data: { isFollowing: false, followersCount: 0 }, ...(exists ? {} : { message: 'Question not found' }) });
    }
    return res.status(200).json({ data: { isFollowing: false, followersCount: updated.followers.length } });
  } catch { return res.status(500).json({ message: 'Unable to unfollow question' }); }
};

const reportQuestion = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid question id' });
    const reason = String(req.body?.reason || '').trim().toLowerCase();
    const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
    if (!reportReasons.includes(reason)) return res.status(400).json({ message: 'Select a valid report reason' });
    if (details.length > 1000) return res.status(400).json({ message: 'Report details are too long' });
    if (!await Question.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Question not found' });
    const result = await Report.updateOne({ reporterId: req.auth.userId, subjectType: 'question', subjectId: req.params.id }, { $setOnInsert: { reporterId: req.auth.userId, subjectType: 'question', subjectId: req.params.id, reason, details, status: 'pending' } }, { upsert: true });
    return res.status(result.upsertedCount === 1 ? 201 : 200).json({ data: { reported: true, alreadyReported: result.upsertedCount !== 1 } });
  } catch { return res.status(500).json({ message: 'Unable to submit question report' }); }
};

const reportAnswer = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.answerId)) return res.status(400).json({ message: 'Invalid question or answer id' });
    const reason = String(req.body?.reason || '').trim().toLowerCase();
    const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
    if (!reportReasons.includes(reason)) return res.status(400).json({ message: 'Select a valid report reason' });
    if (details.length > 1000) return res.status(400).json({ message: 'Report details are too long' });
    const answerExists = await Question.exists({ _id: req.params.id, 'answers._id': req.params.answerId });
    if (!answerExists) return res.status(404).json({ message: 'Answer not found' });
    const result = await Report.updateOne(
      { reporterId: req.auth.userId, subjectType: 'answer', subjectId: req.params.answerId },
      { $setOnInsert: { reporterId: req.auth.userId, subjectType: 'answer', subjectId: req.params.answerId, reason, details, status: 'pending' } },
      { upsert: true }
    );
    return res.status(result.upsertedCount === 1 ? 201 : 200).json({ data: { reported: true, alreadyReported: result.upsertedCount !== 1 } });
  } catch { return res.status(500).json({ message: 'Unable to submit answer report' }); }
};

const linkResponsePost = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.publicationId)) return res.status(400).json({ message: 'Invalid question or post id' });
    const post = await Publication.findOne({ _id: req.params.publicationId, author: req.auth.userId, ...publicPostClause() }).select('_id');
    if (!post) return res.status(404).json({ message: 'Owned post not found' });
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { relatedPublications: post._id }, $set: { status: 'answered' } },
      { returnDocument: 'after' }
    ).select('_id status');
    if (!question) return res.status(404).json({ message: 'Question not found' });
    return res.status(200).json({ data: { questionId: question._id, status: question.status, publicationId: post._id } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to link story response' });
  }
};

module.exports = { presentQuestions, getQuestions, getQuestionDetail, getQuestionOpportunities, suggestQuestions, createQuestion, upvoteQuestion, removeQuestionUpvote, createAnswer, upvoteAnswer, removeAnswerUpvote, followQuestion, unfollowQuestion, reportQuestion, reportAnswer, claimQuestion, unclaimQuestion, declineQuestion, linkResponsePost };
