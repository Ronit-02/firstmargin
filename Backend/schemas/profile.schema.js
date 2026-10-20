const mongoose = require('mongoose');
const { isSafeHttpUrl } = require('../utils/safe-url');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  handle: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Invalid writer handle'],
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  bio: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500,
  },
  avatarUrl: {
    type: String,
    default: null,
    trim: true,
  },
  coverImageUrl: {
    type: String,
    default: null,
    trim: true,
    maxlength: 2000,
    validate: { validator: value => !value || isSafeHttpUrl(value), message: 'Cover image must be a valid HTTP(S) URL' },
  },
  websiteUrl: {
    type: String,
    default: null,
    trim: true,
    validate: { validator: value => value == null || isSafeHttpUrl(value), message: 'Website must be a valid http or https URL' },
  },
  writerStatus: {
    type: String,
    enum: ['reader', 'writer'],
    default: 'writer',
  },
  membershipEnabled: {
    type: Boolean,
    default: false,
  },
  directRequestsEnabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  versionKey: false,
});

profileSchema.index({ displayName: 'text', handle: 'text', bio: 'text' });

module.exports = mongoose.model('Profile', profileSchema);
