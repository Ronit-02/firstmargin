const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const Question = require('../schemas/question.schema');
const { presentQuestions } = require('./question.controller');
const { presentDiscoveryPosts } = require('../services/publication-presenter.service');
const { getPostAccessContext, accessiblePostClause } = require('../services/publication-access.service');
const publicAccessClause = () => ({ publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }, { publicAt: { $exists: false } }] });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topicTags = {
  all: [],
  travel: ['travel'],
  ai: ['ai', 'artificial-intelligence', 'technology'],
  science: ['science'],
  entrepreneurship: ['entrepreneurship', 'business', 'finance'],
  lifestyle: ['lifestyle', 'wellness', 'food'],
  career: ['career', 'education', 'essays'],
};
const timeWindows = {
  any: null,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};
const buildTextMatch = (query, fields = ['title', 'body', 'tags']) => ({
  $and: query.split(/\s+/).filter(Boolean).map(term => ({
    $or: fields.map(field => ({ [field]: { $regex: escapeRegex(term), $options: 'i' } })),
  })),
});

// Suggestions use only public metadata; no story bodies or private reading history.
const buildSuggestionPipeline = (query, filters, limit) => {
  const normalizedQuery = query.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
  const phrase = normalizedQuery.split(' ').map(escapeRegex).join('\\s+');
  const prefix = `^${phrase}`;
  const wordPrefix = normalizedQuery ? `(^|\\s)${phrase}` : '(?!)';
  const metadataPrefix = normalizedQuery ? `(^|[\\s_-])${normalizedQuery.split(' ').map(escapeRegex).join('[\\s_-]+')}` : '(?!)';
  return [
    { $match: { $and: [publicAccessClause(), { $or: [
      { title: { $regex: metadataPrefix, $options: 'i' } },
      { tags: { $regex: metadataPrefix, $options: 'i' } },
    ] }, ...filters] } },
    { $project: { candidates: { $concatArrays: [
      { $map: { input: { $ifNull: ['$tags', []] }, as: 'tag', in: { text: '$$tag', sourceRank: 0 } } },
      [{ text: '$title', sourceRank: 1 }],
    ] } } },
    { $unwind: '$candidates' },
    { $project: {
      publicationId: '$_id', sourceRank: '$candidates.sourceRank',
      text: { $trim: { input: { $replaceAll: { input: { $replaceAll: {
        input: { $toLower: '$candidates.text' }, find: '-', replacement: ' ',
      } }, find: '_', replacement: ' ' } } } },
    } },
    { $set: { text: { $reduce: {
      input: { $regexFindAll: { input: '$text', regex: '\\S+' } }, initialValue: '',
      in: { $concat: ['$$value', { $cond: [{ $eq: ['$$value', ''] }, '', ' '] }, '$$this.match'] },
    } } } },
    { $match: { text: { $regex: wordPrefix }, $expr: { $lte: [{ $strLenCP: '$text' }, 100] } } },
    // A repeated tag/title on one story counts as one supporting story.
    { $group: { _id: { text: '$text', publicationId: '$publicationId' }, sourceRank: { $min: '$sourceRank' } } },
    { $group: { _id: '$_id.text', articleCount: { $sum: 1 }, sourceRank: { $min: '$sourceRank' } } },
    { $addFields: { matchRank: { $cond: [
      { $eq: ['$_id', { $literal: normalizedQuery }] }, 0,
      { $cond: [{ $regexMatch: { input: '$_id', regex: prefix } }, 1, 2] },
    ] } } },
    { $sort: { matchRank: 1, articleCount: -1, sourceRank: 1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, text: '$_id', articleCount: 1 } },
  ];
};

const search = async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const type = String(req.query.type || 'all').toLowerCase();
    const topic = String(req.query.topic || 'all').toLowerCase();
    const time = String(req.query.time || 'any').toLowerCase();
    const sort = String(req.query.sort || 'relevance').toLowerCase();
    if (query.length < 1 || query.length > 100) {
      return res.status(400).json({ message: 'Search query must be between 1 and 100 characters' });
    }
    if (!['all', 'posts', 'writers', 'shorts', 'questions'].includes(type)) {
      return res.status(400).json({ message: 'Invalid search type' });
    }
    if (!Object.prototype.hasOwnProperty.call(topicTags, topic)) {
      return res.status(400).json({ message: 'Invalid search topic' });
    }
    if (!Object.prototype.hasOwnProperty.call(timeWindows, time)) {
      return res.status(400).json({ message: 'Invalid search time range' });
    }
    if (!['relevance', 'latest'].includes(sort)) {
      return res.status(400).json({ message: 'Invalid search sort' });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 24)
      : 12;
    const includePosts = type === 'all' || type === 'posts' || type === 'shorts';
    const includeWriters = type === 'all' || type === 'writers';
    const includeQuestions = type === 'questions';
    const formatFilter = type === 'shorts'
      ? { format: 'short' }
      : type === 'posts'
        ? { format: { $ne: 'short' } }
        : null;
    const topicFilter = topicTags[topic].length
      ? { tags: { $in: topicTags[topic] } }
      : null;
    const timeFilter = timeWindows[time]
      ? { createdAt: { $gte: new Date(Date.now() - timeWindows[time] * 24 * 60 * 60 * 1000) } }
      : null;

    if (req.query.suggestions === 'true') {
      const suggestionLimit = Math.min(limit, 5);
      const filters = [formatFilter, topicFilter, timeFilter].filter(Boolean);
      const [suggestions, profiles] = await Promise.all([
        includePosts ? Publication.aggregate(buildSuggestionPipeline(query, filters, suggestionLimit)) : [],
        includeWriters ? Profile.find({
          writerStatus: 'writer',
          $and: query.split(/\s+/).filter(Boolean).map(term => ({ $or: [
            { displayName: { $regex: escapeRegex(term), $options: 'i' } },
            { handle: { $regex: escapeRegex(term), $options: 'i' } },
          ] })),
        }).select('userId handle displayName avatarUrl').populate({ path: 'userId', select: '_id' })
          .sort({ displayName: 1, _id: 1 }).limit(suggestionLimit) : [],
      ]);
      const writers = profiles.filter(profile => profile.userId).map(profile => ({
        id: profile.userId._id, handle: profile.handle, displayName: profile.displayName, avatarUrl: profile.avatarUrl,
      }));
      return res.status(200).json({ data: { suggestions, writers, posts: [], shorts: [], questions: [] }, meta: { query, type, topic, time, sort } });
    }

    const accessContext = includeQuestions ? await getPostAccessContext(req.auth?.userId) : null;
    const [postDocuments, profileDocuments, questionDocuments] = await Promise.all([
      includePosts
        ? Publication.find({
            $and: [
              buildTextMatch(query),
              publicAccessClause(),
              ...(formatFilter ? [formatFilter] : []),
              ...(topicFilter ? [topicFilter] : []),
              ...(timeFilter ? [timeFilter] : []),
            ],
          })
            .select('title format coverImage body tags appreciationsCount commentsCount createdAt author')
            .populate({ path: 'author', select: 'picture username' })
            .sort(sort === 'latest' ? { createdAt: -1, _id: -1 } : { appreciationsCount: -1, createdAt: -1, _id: -1 })
            .limit(limit)
        : Promise.resolve([]),
      includeWriters
        ? Profile.find({
            $and: query.split(/\s+/).filter(Boolean).map(term => ({
              $or: [
                { displayName: { $regex: escapeRegex(term), $options: 'i' } },
                { handle: { $regex: escapeRegex(term), $options: 'i' } },
                { bio: { $regex: escapeRegex(term), $options: 'i' } },
              ],
            })),
            writerStatus: 'writer',
          })
            .select('userId handle displayName bio avatarUrl writerStatus membershipEnabled')
            .populate({ path: 'userId', select: 'followersCount' })
            .sort({ displayName: 1 })
            .limit(limit)
        : Promise.resolve([]),
      includeQuestions
        ? Question.find({
            $and: [
              { status: { $ne: 'closed' } },
              buildTextMatch(query, ['text', 'context', 'tags']),
              ...(topicFilter ? [topicFilter] : []),
              ...(timeFilter ? [timeFilter] : []),
            ],
          })
            .select('text context tags upvotesCount upvotes answers._id relatedPublications status createdAt author')
            .populate({ path: 'author', select: 'picture username' })
            .populate({ path: 'relatedPublications', match: accessiblePostClause(accessContext), select: 'title format coverImage author createdAt body tags appreciationsCount commentsCount', populate: { path: 'author', select: 'username picture' } })
            .sort(sort === 'latest' ? { createdAt: -1, _id: -1 } : { upvotesCount: -1, createdAt: -1, _id: -1 })
            .limit(limit)
        : Promise.resolve([]),
    ]);

    const presentedPosts = includePosts ? await presentDiscoveryPosts(postDocuments, req.auth?.userId) : [];
    const posts = type === 'shorts' ? [] : presentedPosts;
    const shorts = type === 'shorts' ? presentedPosts : [];
    const writers = profileDocuments
      .filter(profile => profile.userId)
      .map(profile => ({
        id: profile.userId._id,
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        writerStatus: profile.writerStatus,
        membershipEnabled: profile.membershipEnabled,
        followersCount: profile.userId.followersCount || 0,
      }));

    const questions = includeQuestions ? await presentQuestions(questionDocuments, req.auth?.userId) : [];
    return res.status(200).json({ data: { posts, writers, shorts, questions }, meta: { query, type, topic, time, sort } });
  } catch (error) {
    console.error(`[${req.requestId}] Unified search failed`);
    return res.status(500).json({ message: 'Unable to search at this time' });
  }
};

module.exports = { search };
