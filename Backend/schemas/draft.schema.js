const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  publicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', default: null, index: true },
  title: { type: String, default: '', trim: true, maxlength: 180 },
  format: { type: String, enum: ['story', 'short'], default: 'story' },
  body: { type: String, required: true },
  tags: [{ type: String, lowercase: true, trim: true }],
  sourceQuestion: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
  depthParent: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', default: null },
  publicAt: { type: Date, default: null },
  version: { type: Number, required: true, default: 1, min: 1 },
}, { timestamps: true, versionKey: false });

draftSchema.index({ authorId: 1, updatedAt: -1 });

module.exports = mongoose.model('Draft', draftSchema);
