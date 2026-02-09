const express = require('express');
const Bookmark = require('../models/Bookmark');
const auth = require('../middleware/auth');
const fetchMetadata = require('../utils/fetchMetadata');
const router = express.Router();

// All routes require authentication
router.use(auth);

// Create a new bookmark
router.post('/', async (req, res) => {
  try {
    const { url, title, description, tags, isFavorite } = req.body;
    console.log('Creating bookmark - Request body:', { url, title, description, tags, isFavorite });

    // Validation
    if (!url || typeof url !== 'string' || !url.trim()) {
      console.error('Validation Error: URL is required');
      return res.status(400).json({ error: 'URL is required' });
    }

    // URL format validation
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url.trim())) {
      console.error('Validation Error: Invalid URL format', url);
      return res.status(400).json({ error: 'Please provide a valid URL (must start with http:// or https://)' });
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

    let bookmarkTitle = title;

    // Auto-fetch title if not provided
    if (!bookmarkTitle || bookmarkTitle.trim() === '') {
      console.log('Title not provided, fetching metadata from URL:', url);
      bookmarkTitle = await fetchMetadata(url);
      if (!bookmarkTitle) {
        bookmarkTitle = url; // Fallback to URL if fetch fails
        console.log('Metadata fetch failed, using URL as title');
      } else {
        console.log('Metadata fetched successfully:', bookmarkTitle);
      }
    }

    const bookmark = new Bookmark({
      user: req.user._id,
      url: url.trim(),
      title: bookmarkTitle.trim(),
      description: description ? description.trim() : '',
      tags: tagsArray,
      isFavorite: isFavorite || false
    });

    await bookmark.save();
    console.log('Bookmark created successfully:', bookmark._id, 'Tags:', bookmark.tags);
    res.status(201).json(bookmark);
  } catch (error) {
    console.error('Error creating bookmark:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ error: errors.join(', ') });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while creating bookmark' });
  }
});

// Get all bookmarks (with optional search and tag filter)
router.get('/', async (req, res) => {
  try {
    const { q, tags, favorite } = req.query;
    const query = { user: req.user._id };

    // Search query
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { url: { $regex: q, $options: 'i' } }
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

    console.log('Fetching bookmarks with query:', query);
    const bookmarks = await Bookmark.find(query).sort({ createdAt: -1 });
    console.log('Bookmarks fetched successfully:', bookmarks.length, 'items');
    if (bookmarks.length > 0) {
      console.log('Sample bookmark tags:', bookmarks[0].tags);
    }
    res.json(bookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while fetching bookmarks' });
  }
});

// Get a single bookmark
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching bookmark:', req.params.id);
    const bookmark = await Bookmark.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!bookmark) {
      console.error('Bookmark not found:', req.params.id);
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    console.log('Bookmark fetched successfully:', bookmark._id);
    res.json(bookmark);
  } catch (error) {
    console.error('Error fetching bookmark:', error);
    if (error.name === 'CastError') {
      console.error('Invalid bookmark ID format:', req.params.id);
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while fetching bookmark' });
  }
});

// Update a bookmark
router.put('/:id', async (req, res) => {
  try {
    const { url, title, description, tags, isFavorite } = req.body;
    const updateData = {};

    console.log('Updating bookmark:', req.params.id, { url, title, description, tags, isFavorite });

    if (url !== undefined) {
      if (!url || typeof url !== 'string' || !url.trim()) {
        console.error('Validation Error: URL is required');
        return res.status(400).json({ error: 'URL is required' });
      }
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url.trim())) {
        console.error('Validation Error: Invalid URL format', url);
        return res.status(400).json({ error: 'Please provide a valid URL (must start with http:// or https://)' });
      }
      updateData.url = url.trim();
    }
    
    if (title !== undefined) {
      updateData.title = title ? title.trim() : '';
    }
    
    if (description !== undefined) {
      updateData.description = description ? description.trim() : '';
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

    const bookmark = await Bookmark.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!bookmark) {
      console.error('Bookmark not found:', req.params.id);
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    console.log('Bookmark updated successfully:', bookmark._id);
    res.json(bookmark);
  } catch (error) {
    console.error('Error updating bookmark:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({ error: errors.join(', ') });
    }
    if (error.name === 'CastError') {
      console.error('Invalid bookmark ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Server error while updating bookmark' });
  }
});

// Delete a bookmark
router.delete('/:id', async (req, res) => {
  try {
    console.log('Deleting bookmark:', req.params.id);
    const bookmark = await Bookmark.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!bookmark) {
      console.error('Bookmark not found for deletion:', req.params.id);
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    console.log('Bookmark deleted successfully:', req.params.id);
    res.json({ message: 'Bookmark deleted successfully' });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    if (error.name === 'CastError') {
      console.error('Invalid bookmark ID format:', req.params.id);
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }
    console.error('Server error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error while deleting bookmark' });
  }
});

module.exports = router;

