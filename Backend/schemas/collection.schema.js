const mongoose = require('mongoose');

/* Collection — user-curated set of posts */
const collectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  publications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Publication',
  }],
  items: [{
    publication: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', required: true },
    position: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
  }],
  coverImage: {
    type: String,
    default: '',
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  visibility: {
    type: String,
    enum: ['public', 'unlisted', 'private'],
    default: 'public',
    index: true,
  },
  savedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  savedCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  followersCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true, versionKey: false });

collectionSchema.index({ author: 1 });
collectionSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
collectionSchema.index({ visibility: 1, savedCount: -1, _id: -1 });
collectionSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Collection', collectionSchema);
