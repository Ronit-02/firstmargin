const mongoose = require('mongoose');

const eventTypes = ['impression', 'open', 'reading_depth', 'complete', 'save', 'follow', 'hide', 'report'];
const surfaces = ['home', 'search', 'story', 'writer', 'onboarding'];

const interactionEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  anonymousSessionId: { type: String, default: null, trim: true, maxlength: 64 },
  eventType: { type: String, enum: eventTypes, required: true, index: true },
  publicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Publication', default: null, index: true },
  writerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  surface: { type: String, enum: surfaces, required: true },
  position: { type: Number, min: 0, max: 1000, default: null },
  recommendationRequestId: { type: String, default: null, trim: true, maxlength: 64 },
  eventAt: { type: Date, required: true },
  metadata: {
    readingDepth: { type: Number, min: 0, max: 100, default: null },
  },
}, { timestamps: { createdAt: 'receivedAt', updatedAt: false }, versionKey: false });

interactionEventSchema.index({ actorId: 1, eventAt: -1 });
interactionEventSchema.index({ anonymousSessionId: 1, eventAt: -1 });
interactionEventSchema.index({ publicationId: 1, eventType: 1, eventAt: -1 });

interactionEventSchema.eventTypes = eventTypes;
interactionEventSchema.surfaces = surfaces;

const InteractionEvent = mongoose.model('InteractionEvent', interactionEventSchema);
InteractionEvent.eventTypes = eventTypes;
InteractionEvent.surfaces = surfaces;

module.exports = InteractionEvent;
