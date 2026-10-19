// models/Appreciation.js
const mongoose = require('mongoose');

const appreciationSchema = new mongoose.Schema({
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

// Prevent duplicate likes
appreciationSchema.index({ userId: 1, publicationId: 1 }, { unique: true });

module.exports = mongoose.model('Appreciation', appreciationSchema);