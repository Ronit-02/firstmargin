const Publication = require('../schemas/publication.schema');
const Topic = require('../schemas/topic.schema');

// Public metadata only: private drafts and unreleased publications never supply choices.
const getTagOptions = async (req, res) => {
  if (req.query.q !== undefined && typeof req.query.q !== 'string') return res.status(400).json({ message: 'Invalid tag search' });
  const query = String(req.query.q || '').trim().toLowerCase();
  if (query.length > 60) return res.status(400).json({ message: 'Tag search must be at most 60 characters' });
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  try {
    const [topics, tags] = await Promise.all([
      Topic.find({ status: 'active', $or: [{ slug: pattern }, { displayName: pattern }] })
        .sort({ order: 1, slug: 1 }).limit(50).select('slug displayName').lean(),
      Publication.aggregate([
        { $match: { publicationStatus: { $ne: 'unpublished' }, $or: [{ publicAt: { $lte: new Date() } }, { publicAt: null }] } },
        { $project: { tags: 1 } },
        { $unwind: '$tags' },
        { $project: { tag: { $toLower: { $trim: { input: '$tags' } } } } },
        { $match: { tag: { $regex: pattern, $ne: '' } } },
        { $group: { _id: '$tag' } },
        { $sort: { _id: 1 } },
        { $limit: 50 },
      ]),
    ]);
    const choices = new Map(topics.map(topic => [topic.slug, { value: topic.slug, label: topic.displayName }]));
    for (const tag of tags) {
      if (tag._id.length <= 60 && !tag._id.includes(',') && !choices.has(tag._id)) choices.set(tag._id, { value: tag._id, label: tag._id });
    }
    return res.json({ data: [...choices.values()].slice(0, 50) });
  } catch {
    return res.status(500).json({ message: 'Unable to load tag suggestions' });
  }
};

module.exports = { getTagOptions };
