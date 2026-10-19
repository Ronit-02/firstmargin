const mongoose = require('mongoose');

/* Competition — writing contest with entries */
const entrySchema = new mongoose.Schema({
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publication:    { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', required: true },
  note:    { type: String, default: '' },
  votes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  votesCount: { type: Number, default: 0, min: 0 },
  publicationRevision: { type: Number, default: 1, min: 1 },
  judgeScores: [{
    judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    craft: { type: Number, min: 1, max: 10, required: true },
    originality: { type: Number, min: 1, max: 10, required: true },
    relevance: { type: Number, min: 1, max: 10, required: true },
    note: { type: String, default: '', maxlength: 1000 },
  }],
  status: { type: String, enum: ['submitted', 'disqualified'], default: 'submitted' },
  disqualificationReason: { type: String, default: '', maxlength: 2000 },
  disqualifiedAt: { type: Date, default: null },
  disqualifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const competitionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  coverImage:  { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'open', 'judging', 'closed'],
    default: 'open',
  },
  openDate:     { type: Date, default: Date.now },
  closeDate:    { type: Date, required: true },
  resultsDate:  { type: Date },
  votingMode: {
    type: String,
    enum: ['readers', 'judges', 'hybrid'],
    default: 'readers',
  },
  competitionType: {
    type: String,
    enum: ['theme', 'timed', 'collaborative', 'reader_choice', 'collective_choice'],
    default: 'theme',
  },
  rules: [{ type: String, trim: true, maxlength: 500 }],
  maxEntries: { type: Number, min: 1, max: 10000, default: 500 },
  prizes: [{
    rank:   { type: String },
    amount: { type: String },
  }],
  entries:   [entrySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerEntryIds: [{ type: mongoose.Schema.Types.ObjectId }],
  judgeRoster: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  finalizedAt: { type: Date, default: null },
  noWinnerReason: { type: String, default: null },
}, { timestamps: true, versionKey: false });

competitionSchema.index({ status: 1, closeDate: 1 });

module.exports = mongoose.model('Competition', competitionSchema);
