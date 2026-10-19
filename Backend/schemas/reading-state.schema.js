const mongoose = require('mongoose');

const readingStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', required: true },
  progress: { type: Number, min: 0, max: 100, required: true, default: 0 },
  completed: { type: Boolean, default: false },
  lastReadAt: { type: Date, required: true, default: Date.now },
}, { versionKey: false });

readingStateSchema.index({ userId: 1, publicationId: 1 }, { unique: true });
readingStateSchema.index({ userId: 1, lastReadAt: -1 });

module.exports = mongoose.model('ReadingState', readingStateSchema);
