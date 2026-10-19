const mongoose = require('mongoose');

const roleChangeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromRole: { type: String, enum: ['regular', 'premium', 'exclusive-writer', 'moderator'], required: true },
  toRole: { type: String, enum: ['regular', 'exclusive-writer', 'moderator'], required: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('RoleChange', roleChangeSchema);
