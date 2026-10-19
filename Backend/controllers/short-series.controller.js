const mongoose = require('mongoose');
const Publication = require('../schemas/publication.schema');
const Profile = require('../schemas/profile.schema');
const ShortSeries = require('../schemas/short-series.schema');
const { encodeCursor, decodeCursor } = require('../utils/cursor');
const { presentDiscoveryPosts } = require('../services/publication-presenter.service');

const isValidId = value => mongoose.isValidObjectId(value);
const orderedItems = series => [...series.items].sort((left, right) => left.position - right.position);

const present = async (seriesDocuments, actorId, includeItems = false) => {
  const now = new Date();
  const visibleItems = series => orderedItems(series).filter(item => item.publication && (
    actorId === series.author?._id?.toString()
    || (item.publication.publicationStatus !== 'unpublished' && (!item.publication.publicAt || item.publication.publicAt <= now))
  ));
  const authorIds = seriesDocuments.map(series => series.author?._id).filter(Boolean);
  const profiles = await Profile.find({ userId: { $in: authorIds } }).select('userId handle displayName avatarUrl');
  const byAuthor = new Map(profiles.map(profile => [profile.userId.toString(), profile]));
  const entryPosts = includeItems ? await presentDiscoveryPosts(seriesDocuments.flatMap(series => visibleItems(series).map(item => ({ ...item.publication.toObject(), author: series.author }))), actorId) : [];
  const entryById = new Map(entryPosts.map(post => [post.id.toString(), post]));
  return seriesDocuments.map(series => {
    const profile = series.author?._id ? byAuthor.get(series.author._id.toString()) : null;
    const items = visibleItems(series);
    const data = {
      id: series._id,
      title: series.title,
      description: series.description,
      visibility: series.visibility,
      type: series.type || 'short',
      entriesCount: items.length,
      entriesPreview: !includeItems ? items.slice(0, 3).map((item, index) => ({
        id: item.publication._id,
        title: item.publication.title,
        position: index + 1,
      })) : undefined,
      coverImage: items.find(item => item.publication?.coverImage)?.publication.coverImage || null,
      isOwner: actorId === series.author?._id?.toString(),
      isSaved: Boolean(actorId && series.savedBy?.some(id => id.toString() === actorId)),
      savedCount: series.savedCount || series.savedBy?.length || 0,
      createdAt: series.createdAt,
      author: {
        id: series.author?._id || null,
        username: profile?.displayName || series.author?.username || 'Unknown writer',
        picture: profile?.avatarUrl || series.author?.picture || null,
        handle: profile?.handle || null,
      },
    };
    if (includeItems) data.entries = items.map((item, index) => ({
      ...entryById.get(item.publication._id.toString()),
      id: item.publication._id,
      title: item.publication.title,
      image: item.publication.coverImage || null,
      position: index,
      createdAt: item.publication.createdAt,
    }));
    return data;
  });
};

const validateInput = async (body, authorId, existingType = null) => {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const visibility = body.visibility || 'public';
  const type = body.type || existingType || 'short';
  const publicationIds = Array.isArray(body.publicationIds) ? body.publicationIds.map(String) : null;
  if (title.length < 2 || title.length > 100 || description.length > 500
    || !['story', 'short'].includes(type) || (existingType && type !== existingType)
    || !['public', 'unlisted', 'private'].includes(visibility)
    || !publicationIds || publicationIds.length < 2 || publicationIds.length > 50
    || new Set(publicationIds).size !== publicationIds.length || publicationIds.some(id => !isValidId(id))) {
    return { error: 'Invalid short series content' };
  }
  const now = new Date();
  const posts = await Publication.find({
    _id: { $in: publicationIds }, author: authorId,
    ...(type === 'short' ? { format: 'short' } : { format: { $in: ['story', null] } }),
    publicationStatus: { $ne: 'unpublished' },
    $or: [{ publicAt: { $lte: now } }, { publicAt: null }, { publicAt: { $exists: false } }],
  }).select('_id');
  if (posts.length !== publicationIds.length) return { error: `Series entries must be your published ${type === 'short' ? 'shorts' : 'stories'}` };
  return { value: { title, description, visibility, type, items: publicationIds.map((post, position) => ({ publication: post, position })) } };
};

const listSeries = async (req, res) => {
  try {
    const mine = req.query.mine === 'true';
    const type = req.query.type || 'short';
    const publicationId = req.query.publicationId;
    const authorId = req.query.authorId;
    const saved = req.query.saved === 'true';
    if (!['story', 'short'].includes(type)) return res.status(400).json({ message: 'Invalid series type' });
    if (publicationId && !isValidId(publicationId)) return res.status(400).json({ message: 'Invalid post id' });
    if (authorId && !isValidId(authorId)) return res.status(400).json({ message: 'Invalid author id' });
    if ((mine || saved) && !req.auth) return res.status(401).json({ message: 'Sign in to view your series' });
    if (mine && saved) return res.status(400).json({ message: 'Choose owned or saved series, not both' });
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) return res.status(400).json({ message: 'Invalid series cursor' });
    const filter = {
      ...(mine ? { author: req.auth.userId } : saved ? { savedBy: req.auth.userId, visibility: { $in: ['public', 'unlisted'] } } : { visibility: 'public', ...(authorId ? { author: authorId } : {}) }),
      ...(type === 'short' ? { $or: [{ type: 'short' }, { type: { $exists: false } }] } : { type: 'story' }),
    };
    if (cursor) {
      const createdAt = new Date(cursor.createdAt);
      if (!isValidId(cursor.id) || Number.isNaN(createdAt.getTime())) return res.status(400).json({ message: 'Invalid series cursor' });
      filter.$and = [{ $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: cursor.id } }] }];
    }
    const documents = await ShortSeries.find(filter)
      .populate({ path: 'author', select: 'picture username' })
      .populate({ path: 'items.publication', select: 'title coverImage publicationStatus publicAt createdAt' })
      .sort({ createdAt: -1, _id: -1 }).limit(13);
    const hasMore = documents.length > 12;
    const page = hasMore ? documents.slice(0, 12) : documents;
    const data = (await present(page, req.auth?.userId)).map(item => ({
      ...item,
      ...(mine && publicationId ? { containsPost: documents.find(document => document._id.toString() === item.id.toString())?.items.some(entry => entry.publication?._id?.toString() === publicationId) || false } : {}),
    }));
    const last = page.at(-1);
    return res.status(200).json({ data, meta: { nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last._id.toString() }) : null } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load short series' });
  }
};

const getSeries = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  const series = await ShortSeries.findById(req.params.id)
    .populate({ path: 'author', select: 'picture username' })
    .populate({ path: 'items.publication', select: 'title format coverImage body tags appreciationsCount commentsCount publicationStatus publicAt createdAt' });
  if (!series) return res.status(404).json({ message: 'Series not found' });
  const isOwner = req.auth?.userId === series.author._id.toString();
  if (series.visibility === 'private' && !isOwner) return res.status(404).json({ message: 'Series not found' });
  const [data] = await present([series], req.auth?.userId, true);
  return res.status(200).json({ data });
};

const loadEligiblePosts = async (req, res, forcedType = null) => {
  const type = forcedType || req.query.type || 'short';
  if (!['story', 'short'].includes(type)) return res.status(400).json({ message: 'Invalid series type' });
  const seriesId = req.query.seriesId;
  if (seriesId && !isValidId(seriesId)) return res.status(400).json({ message: 'Invalid series id' });
  if (seriesId && !await ShortSeries.exists({ _id: seriesId, author: req.auth.userId, ...(type === 'short' ? { $or: [{ type: 'short' }, { type: { $exists: false } }] } : { type } ) })) return res.status(404).json({ message: 'Owned series not found' });
  const now = new Date();
  const posts = await Publication.find({
    author: req.auth.userId,
    ...(type === 'short' ? { format: 'short' } : { format: { $in: ['story', null] } }),
    publicationStatus: { $ne: 'unpublished' },
    $or: [{ publicAt: { $lte: now } }, { publicAt: null }, { publicAt: { $exists: false } }],
  }).sort({ createdAt: -1 }).select('title coverImage createdAt');
  return res.status(200).json({ data: posts.map(post => ({ id: post._id, title: post.title, image: post.coverImage, createdAt: post.createdAt })) });
};

const getEligibleShorts = async (req, res) => loadEligiblePosts(req, res, 'short');
const getEligiblePosts = async (req, res) => loadEligiblePosts(req, res);

const createSeries = async (req, res) => {
  const parsed = await validateInput(req.body, req.auth.userId);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const series = await ShortSeries.create({ ...parsed.value, author: req.auth.userId });
  return res.status(201).json({ data: { seriesId: series._id } });
};

const updateSeries = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  const owner = await ShortSeries.exists({ _id: req.params.id, author: req.auth.userId });
  if (!owner) return res.status(404).json({ message: 'Owned series not found' });
  const current = await ShortSeries.findById(req.params.id).select('type');
  const parsed = await validateInput(req.body, req.auth.userId, current?.type || 'short');
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  await ShortSeries.updateOne({ _id: req.params.id, author: req.auth.userId }, { $set: parsed.value });
  return res.status(200).json({ data: { updated: true } });
};

const deleteSeries = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  const deleted = await ShortSeries.findOneAndDelete({ _id: req.params.id, author: req.auth.userId });
  if (!deleted) return res.status(404).json({ message: 'Owned series not found' });
  return res.status(200).json({ data: { deleted: true } });
};

const addSeriesItem = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  if (!isValidId(req.body?.publicationId)) return res.status(400).json({ message: 'Invalid post id' });
  const series = await ShortSeries.findOne({ _id: req.params.id, author: req.auth.userId }).select('type items');
  if (!series) return res.status(404).json({ message: 'Owned series not found' });
  const publicationId = String(req.body.publicationId);
  if (series.items.some(item => item.publication.toString() === publicationId)) return res.status(200).json({ data: { added: false, alreadyPresent: true } });
  if (series.items.length >= 50) return res.status(409).json({ message: 'A series can contain at most 50 parts' });
  const type = series.type || 'short';
  const now = new Date();
  const post = await Publication.findOne({
    _id: publicationId,
    author: req.auth.userId,
    ...(type === 'short' ? { format: 'short' } : { format: { $in: ['story', null] } }),
    publicationStatus: { $ne: 'unpublished' },
    $or: [{ publicAt: { $lte: now } }, { publicAt: null }, { publicAt: { $exists: false } }],
  }).select('_id');
  if (!post) return res.status(400).json({ message: `Series entries must be your published ${type === 'short' ? 'shorts' : 'stories'}` });
  try {
    const result = await ShortSeries.updateOne(
      { _id: series._id, author: req.auth.userId, 'items.publication': { $ne: post._id }, [`items.${series.items.length}`]: { $exists: false } },
      { $push: { items: { publication: post._id, position: series.items.length } } },
    );
    if (!result.modifiedCount) return res.status(409).json({ message: 'The series changed. Please try again.' });
    return res.status(200).json({ data: { added: true, alreadyPresent: false } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'This post is already in the series' });
    throw error;
  }
};

const saveSeries = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  const updated = await ShortSeries.findOneAndUpdate(
    { _id: req.params.id, visibility: { $ne: 'private' }, savedBy: { $ne: req.auth.userId } },
    { $addToSet: { savedBy: req.auth.userId }, $inc: { savedCount: 1 } }, { new: true },
  ).select('savedCount');
  if (updated) return res.status(200).json({ data: { isSaved: true, savedCount: updated.savedCount } });
  const series = await ShortSeries.findById(req.params.id).select('visibility savedCount savedBy');
  if (!series) return res.status(404).json({ message: 'Series not found' });
  return res.status(200).json({ data: { isSaved: true, savedCount: series.savedCount || series.savedBy.length } });
};

const unsaveSeries = async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid series id' });
  const updated = await ShortSeries.findOneAndUpdate(
    { _id: req.params.id, savedBy: req.auth.userId, savedCount: { $gt: 0 } },
    { $pull: { savedBy: req.auth.userId }, $inc: { savedCount: -1 } }, { new: true },
  ).select('savedCount');
  if (updated) return res.status(200).json({ data: { isSaved: false, savedCount: updated.savedCount } });
  const series = await ShortSeries.findById(req.params.id).select('savedCount savedBy');
  if (!series) return res.status(404).json({ message: 'Series not found' });
  return res.status(200).json({ data: { isSaved: false, savedCount: series.savedCount || series.savedBy.length } });
};

module.exports = { listSeries, getSeries, getEligibleShorts, getEligiblePosts, createSeries, updateSeries, deleteSeries, addSeriesItem, saveSeries, unsaveSeries };
