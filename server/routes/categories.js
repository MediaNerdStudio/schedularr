import { Router } from 'express';
import { Category, Song } from '../models/index.js';

const router = Router();

// === Static routes BEFORE parameterized ===

// List all categories
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.group) filter.group = req.query.group;
    const categories = await Category.find(filter).sort('sortOrder code');

    // Add song counts
    const counts = await Song.aggregate([
      { $unwind: '$categoryAssignments' },
      { $group: { _id: '$categoryAssignments.category', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));

    const result = categories.map(cat => ({
      ...cat.toObject(),
      songCount: countMap[cat._id.toString()] || 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    if (!req.body.folders?.length) {
      req.body.folders = [{ name: 'Default', exposure: 100 }];
    }
    if (req.body.parent) {
      req.body.color = '';
    }
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category code already exists' });
    res.status(400).json({ error: err.message });
  }
});

// Bulk move songs to a target category
// mode: 'move' removes from sourceCategoryId only, 'exclusive' removes all other categories
router.post('/bulk-move', async (req, res) => {
  try {
    const { songIds, sourceCategoryId, targetCategoryId, mode = 'move' } = req.body;
    if (!songIds?.length || !targetCategoryId) {
      return res.status(400).json({ error: 'songIds and targetCategoryId are required' });
    }
    const targetCat = await Category.findById(targetCategoryId);
    if (!targetCat) return res.status(404).json({ error: 'Target category not found' });

    if (mode === 'exclusive') {
      // Remove every assignment except the target category, then add target if missing
      await Song.updateMany(
        { _id: { $in: songIds } },
        { $pull: { categoryAssignments: { category: { $ne: targetCategoryId } } } }
      );
    } else if (sourceCategoryId) {
      await Song.updateMany(
        { _id: { $in: songIds } },
        { $pull: { categoryAssignments: { category: sourceCategoryId } } }
      );
    }

    const bulkOps = songIds.map(songId => ({
      updateOne: {
        filter: { _id: songId, 'categoryAssignments.category': { $ne: targetCategoryId } },
        update: { $push: { categoryAssignments: { category: targetCategoryId, addedAt: new Date() } } },
      },
    }));
    const result = await Song.bulkWrite(bulkOps);
    res.json({ moved: result.modifiedCount, total: songIds.length, mode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk copy songs to a target category (keeps source, adds target)
router.post('/bulk-copy', async (req, res) => {
  try {
    const { songIds, targetCategoryId } = req.body;
    if (!songIds?.length || !targetCategoryId) {
      return res.status(400).json({ error: 'songIds and targetCategoryId are required' });
    }
    const targetCat = await Category.findById(targetCategoryId);
    if (!targetCat) return res.status(404).json({ error: 'Target category not found' });

    const bulkOps = songIds.map(songId => ({
      updateOne: {
        filter: { _id: songId, 'categoryAssignments.category': { $ne: targetCategoryId } },
        update: { $push: { categoryAssignments: { category: targetCategoryId, addedAt: new Date() } } },
      },
    }));
    const result = await Song.bulkWrite(bulkOps);
    res.json({ copied: result.modifiedCount, total: songIds.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk remove songs from a category
router.post('/bulk-remove', async (req, res) => {
  try {
    const { songIds, categoryId } = req.body;
    if (!songIds?.length || !categoryId) {
      return res.status(400).json({ error: 'songIds and categoryId are required' });
    }
    const result = await Song.updateMany(
      { _id: { $in: songIds } },
      { $pull: { categoryAssignments: { category: categoryId } } }
    );
    res.json({ removed: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reorder categories (update sortOrder and parent)
router.post('/reorder', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { _id: item.id },
        update: { sortOrder: item.sortOrder, parent: item.parent || null },
      },
    }));
    await Category.bulkWrite(bulkOps);
    res.json({ updated: items.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === Parameterized routes ===

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get songs in a category
router.get('/:id/songs', async (req, res) => {
  try {
    const { limit = 200, skip = 0 } = req.query;
    const filter = { 'categoryAssignments.category': req.params.id, isActive: true };
    const [songs, total] = await Promise.all([
      Song.find(filter)
        .populate('primaryArtist', 'name')
        .sort('title')
        .skip(Number(skip))
        .limit(Number(limit)),
      Song.countDocuments(filter),
    ]);
    res.json({ songs, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    if (req.body.parent) {
      req.body.color = '';
    }
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete category (moves songs to uncategorized)
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    await Song.updateMany(
      { 'categoryAssignments.category': req.params.id },
      { $pull: { categoryAssignments: { category: req.params.id } } }
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add song to category
router.post('/:id/songs', async (req, res) => {
  try {
    const { songId, folderId } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const folder = folderId ? category.folders.id(folderId) : category.folders[0];
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    await Song.findByIdAndUpdate(songId, {
      $addToSet: {
        categoryAssignments: { category: category._id, folder: folder._id, addedAt: new Date() },
      },
    });
    res.json({ added: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove song from category
router.delete('/:id/songs/:songId', async (req, res) => {
  try {
    await Song.findByIdAndUpdate(req.params.songId, {
      $pull: { categoryAssignments: { category: req.params.id } },
    });
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
