const mongoose = require('mongoose');
const Publication = require('../schemas/publication.schema');
const { hasCapability } = require('../services/entitlement.service');
const { getOrCreateSummary } = require('../services/summary.service');

const getPublicationSummary = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.publicationId)) return res.status(400).json({ message: 'Invalid post id' });
    if (!await hasCapability(req.auth.userId, 'story_summary')) return res.status(403).json({ code: 'ENTITLEMENT_REQUIRED', message: 'Article summaries require an active membership' });
    const post = await Publication.findById(req.params.publicationId).select('body publicAt publicationStatus author');
    if (!post) return res.status(404).json({ message: 'Publication not found' });
    if (post.publicationStatus === 'unpublished' && post.author.toString() !== req.auth.userId) return res.status(404).json({ message: 'Publication not found' });
    if (post.publicAt && post.publicAt > new Date() && !await hasCapability(req.auth.userId, 'early_access')) return res.status(404).json({ message: 'Publication not found' });
    const summary = await getOrCreateSummary(post);
    return res.status(200).json({ data: { points: summary.points, provider: summary.provider, disclosure: summary.disclosure, generatedAt: summary.generatedAt } });
  } catch (error) {
    console.error(`[${req.requestId}] Summary generation failed`);
    return res.status(500).json({ message: 'Unable to generate story overview' });
  }
};

module.exports = { getPublicationSummary };
