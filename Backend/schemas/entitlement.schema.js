const mongoose = require('mongoose');

const capabilities = ['story_summary', 'read_aloud', 'writer_analytics', 'ai_writing_assistant', 'early_access', 'workshops', 'behind_scenes', 'direct_creator_requests'];

const entitlementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  capability: { type: String, enum: capabilities, required: true, index: true },
  source: { type: String, enum: ['membership', 'admin', 'promotion'], required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

entitlementSchema.index({ userId: 1, capability: 1, source: 1 }, { unique: true });
const Entitlement = mongoose.model('Entitlement', entitlementSchema);
Entitlement.capabilities = capabilities;

module.exports = Entitlement;
