const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['question_answered', 'question_targeted', 'direct_request_received', 'direct_request_updated', 'competition_result', 'moderation', 'publication_commented', 'publication_appreciated', 'user_followed'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  body: { type: String, default: '', trim: true, maxlength: 500 },
  href: { type: String, required: true, trim: true, maxlength: 500 },
  entityType: { type: String, enum: ['publication', 'question', 'creator_request', 'competition', 'report', 'user'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true, versionKey: false });

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
