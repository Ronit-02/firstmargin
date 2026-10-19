const mongoose = require('mongoose');

const competitionAuditSchema = new mongoose.Schema({
  competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['created', 'updated', 'scored', 'score_edited', 'results_published', 'entry_disqualified', 'appeal_submitted', 'appeal_decided', 'vote_blocked', 'fraud_reviewed'], required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

competitionAuditSchema.index({ competitionId: 1, createdAt: 1 });
module.exports = mongoose.model('CompetitionAudit', competitionAuditSchema);
