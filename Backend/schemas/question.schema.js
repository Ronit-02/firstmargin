const mongoose = require('mongoose');

/* Question — writing community Q&A */
const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  normalizedText: {
    type: String,
    default: null,
  },
  context: {
    type: String,
    default: '',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tags: [{ type: String, lowercase: true, trim: true }],
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  upvotesCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  answers: [{
    text:      { type: String, required: true },
    author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    upvotes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
  }],
  relatedPublications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  declinedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  targetWriterIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['open', 'answered', 'closed'],
    default: 'open',
    index: true,
  },
}, { timestamps: true, versionKey: false });

questionSchema.index({ text: 'text', tags: 'text' });
questionSchema.index({ author: 1 });
questionSchema.index({ upvotesCount: -1, createdAt: -1 });
questionSchema.index(
  { normalizedText: 1 },
  { unique: true, partialFilterExpression: { normalizedText: { $type: 'string' } } }
);

module.exports = mongoose.model('Question', questionSchema);
