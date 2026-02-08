const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isFavorite: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

noteSchema.index({ user: 1, createdAt: -1 });
noteSchema.index({ user: 1, tags: 1 });
noteSchema.index({ user: 1, title: 'text', content: 'text' });

module.exports = mongoose.model('Note', noteSchema);

