const mongoose = require('mongoose');

const reportReasons = [
  'spam',
  'harassment',
  'hate',
  'toxicity',
  'plagiarism',
  'misinformation',
  'other',
];

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  subjectType: {
    type: String,
    enum: ['publication', 'comment', 'question', 'answer', 'user'],
    required: true,
    index: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  reason: {
    type: String,
    enum: reportReasons,
    required: true,
  },
  details: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'actioned', 'dismissed'],
    default: 'pending',
    index: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

reportSchema.index(
  { reporterId: 1, subjectType: 1, subjectId: 1 },
  { unique: true }
);
reportSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.reportReasons = reportReasons;
