const express = require('express');
const Note = require('../models/Note');
const auth = require('../middleware/auth');
const router = express.Router();

// All routes require authentication
router.use(auth);

// Create a new note
router.post('/', async (req, res) => {
  try {
    const { title, content, tags, isFavorite } = req.body;
    console.log('Creating note - Request body:', { title, content, tags, isFavorite });

    // Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      console.error('Validation Error: Title is required');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      console.error('Validation Error: Content is required');
      return res.status(400).json({ error: 'Content is required' });
    }

    // Process tags - ensure it's an array and clean it
    let tagsArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsArray = tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
      } else if (typeof tags === 'string') {
        // Handle string tags (split by comma, space, or hashtag)
        tagsArray = tags
          .split(/[,\s#]+/)
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
      }
    }
    
    // Remove duplicates
    tagsArray = [...new Set(tagsArray)];
    console.log('Processed tags:', tagsArray);

    const note = new Note({
      user: req.user._id,
      title: title.trim(),
      content: content.trim(),
      tags: tagsArray,
      isFavorite: isFavorite || false
    });

    await note.save();
    console.log('Note created successfully:', note._id, 'Tags:', note.tags);
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ error: errors.join(', ') });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while creating note' });
  }
});

// Get all notes (with optional search and tag filter)
router.get('/', async (req, res) => {
  try {
    const { q, tags, favorite } = req.query;
    const query = { user: req.user._id };
    console.log(req.query);
    // Search query
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } }
      ];
    }

    // Tag filter - handle both single tag and comma-separated tags
    if (tags) {
      // Split by comma and filter out empty strings
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      if (tagArray.length > 0) {
        query.tags = { $in: tagArray };
      }
    }

    // Favorite filter
    if (favorite === 'true') {
      query.isFavorite = true;
    }

    console.log('Fetching notes with query:', query);
    const notes = await Note.find(query).sort({ createdAt: -1 });
    console.log('Notes fetched successfully:', notes.length, 'items');
    if (notes.length > 0) {
      console.log('Sample note tags:', notes[0].tags);
    }
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while fetching notes' });
  }
});

// Get a single note
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching note:', req.params.id);
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!note) {
      console.error('Note not found:', req.params.id);
      return res.status(404).json({ error: 'Note not found' });
    }

    console.log('Note fetched successfully:', note._id);
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    if (error.name === 'CastError') {
      console.error('Invalid note ID format:', req.params.id);
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while fetching note' });
  }
});

// Update a note
router.put('/:id', async (req, res) => {
  try {
    const { title, content, tags, isFavorite } = req.body;
    const updateData = {};

    console.log('Updating note:', req.params.id, { title, content, tags, isFavorite });

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        console.error('Validation Error: Title is required');
        return res.status(400).json({ error: 'Title is required' });
      }
      updateData.title = title.trim();
    }
    
    if (content !== undefined) {
      if (!content || typeof content !== 'string' || !content.trim()) {
        console.error('Validation Error: Content is required');
        return res.status(400).json({ error: 'Content is required' });
      }
      updateData.content = content.trim();
    }
    
    if (tags !== undefined) {
      // Process tags - ensure it's an array and clean it
      let tagsArray = [];
      if (Array.isArray(tags)) {
        tagsArray = tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
      } else if (typeof tags === 'string') {
        tagsArray = tags
          .split(/[,\s#]+/)
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
      }
      updateData.tags = [...new Set(tagsArray)];
      console.log('Processed tags for update:', updateData.tags);
    }
    
    if (isFavorite !== undefined) {
      updateData.isFavorite = isFavorite;
    }

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!note) {
      console.error('Note not found:', req.params.id);
      return res.status(404).json({ error: 'Note not found' });
    }

    console.log('Note updated successfully:', note._id, 'Tags:', note.tags);
    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ error: errors.join(', ') });
    }
    if (error.name === 'CastError') {
      console.error('Invalid note ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while updating note' });
  }
});

// Delete a note
router.delete('/:id', async (req, res) => {
  try {
    console.log('Deleting note:', req.params.id);
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    
    if (!note) {
      console.error('Note not found for deletion:', req.params.id);
      return res.status(404).json({ error: 'Note not found' });
    }

    console.log('Note deleted successfully:', req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    if (error.name === 'CastError') {
      console.error('Invalid note ID format:', req.params.id);
      return res.status(400).json({ error: 'Invalid note ID' });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while deleting note' });
  }
});

module.exports = router;

