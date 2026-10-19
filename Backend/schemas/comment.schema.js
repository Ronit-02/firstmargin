// models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    publicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publication',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    parentCommentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null,  // null = top-level comment
    },
    deletedAt: {
        type: Date,
        default: null,
    },

}, {
    timestamps: true,
});

module.exports = mongoose.model('Comment', commentSchema);
