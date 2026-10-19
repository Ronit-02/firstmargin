const mongoose = require('mongoose');

const publicationRevisionSchema = new mongoose.Schema({
  publicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', required: true },
  revision: { type: Number, required: true, min: 1 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  coverImage: { type: String, default: null },
  format: { type: String, enum: ['story', 'short'], required: true },
  tags: [{ type: String }],
  publicAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

publicationRevisionSchema.index({ publicationId: 1, revision: 1 }, { unique: true });

module.exports = mongoose.model('PublicationRevision', publicationRevisionSchema);
