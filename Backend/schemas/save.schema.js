// models/Save.js
const mongoose = require('mongoose');

const saveSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    publicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publication',
        required: true,
        index: true,
    },
}, {
  timestamps: true,
});

// Prevent duplicate saves
saveSchema.index({ userId: 1, publicationId: 1 }, { unique: true });

module.exports = mongoose.model('Save', saveSchema);