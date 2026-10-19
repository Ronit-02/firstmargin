const mongoose = require('mongoose');
const Draft = require('../schemas/draft.schema');
const allowedBlockTypes = new Set(['text', 'h1', 'h2', 'h3', 'quote', 'code', 'image', 'divider']);

const parseDraftInput = input => {
  const title = String(input.title || '').trim();
  const format = input.format || 'story';
  if (title.length > (format === 'short' ? 120 : 180) || !['story', 'short'].includes(format)) return null;
  if (!Array.isArray(input.blocks) || input.blocks.length > 500) return null;
  const ids = new Set();
  const validBlocks = input.blocks.every(block => block
    && typeof block.id === 'string'
    && /^[a-zA-Z0-9_-]{1,80}$/.test(block.id)
    && !ids.has(block.id)
    && allowedBlockTypes.has(block.type)
    && typeof block.content === 'string'
    && block.content.length <= (block.type === 'code' ? 50_000 : 10_000)
    && (block.alt == null || (typeof block.alt === 'string' && block.alt.length <= 300))
    && Boolean(ids.add(block.id)));
  if (!validBlocks) return null;
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 20) : [];
  const publicAt = input.publicAt ? new Date(input.publicAt) : null;
  if (publicAt && Number.isNaN(publicAt.getTime())) return null;
  return { title, format, body: JSON.stringify(input.blocks), tags, publicAt };
};

const listDrafts = async (req, res) => {
  try {
    const drafts = await Draft.find({ authorId: req.auth.userId }).sort({ updatedAt: -1 }).select('title format tags version updatedAt createdAt');
    return res.json({ data: drafts });
  } catch { return res.status(500).json({ message: 'Unable to load drafts' }); }
};

const getDraft = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.draftId)) return res.status(400).json({ message: 'Invalid draft id' });
    const draft = await Draft.findOne({ _id: req.params.draftId, authorId: req.auth.userId });
    if (!draft) return res.status(404).json({ message: 'Draft not found' });
    return res.json({ data: { ...draft.toObject(), blocks: JSON.parse(draft.body) } });
  } catch { return res.status(500).json({ message: 'Unable to load draft' }); }
};

const createDraft = async (req, res) => {
  try {
    const data = parseDraftInput(req.body);
    if (!data) return res.status(400).json({ message: 'Invalid draft content' });
    const draft = await Draft.create({ ...data, authorId: req.auth.userId });
    return res.status(201).json({ data: { id: draft._id, version: draft.version, updatedAt: draft.updatedAt } });
  } catch { return res.status(500).json({ message: 'Unable to save draft' }); }
};

const updateDraft = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.draftId)) return res.status(400).json({ message: 'Invalid draft id' });
    const expectedVersion = Number(req.body.expectedVersion);
    const data = parseDraftInput(req.body);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !data) return res.status(400).json({ message: 'Invalid draft update' });
    const draft = await Draft.findOneAndUpdate(
      { _id: req.params.draftId, authorId: req.auth.userId, version: expectedVersion },
      { $set: data, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if (draft) return res.json({ data: { id: draft._id, version: draft.version, updatedAt: draft.updatedAt } });
    const exists = await Draft.exists({ _id: req.params.draftId, authorId: req.auth.userId });
    return res.status(exists ? 409 : 404).json({ code: exists ? 'DRAFT_CONFLICT' : 'NOT_FOUND', message: exists ? 'This draft changed in another session. Reload it before continuing.' : 'Draft not found' });
  } catch { return res.status(500).json({ message: 'Unable to save draft' }); }
};

const deleteDraft = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.draftId)) return res.status(400).json({ message: 'Invalid draft id' });
  await Draft.deleteOne({ _id: req.params.draftId, authorId: req.auth.userId });
  return res.status(204).send();
};

module.exports = { listDrafts, getDraft, createDraft, updateDraft, deleteDraft, parseDraftInput };
