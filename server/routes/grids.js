import { Router } from 'express';
import { AssignmentGrid, FormatCalendar } from '../models/index.js';

const router = Router();

// === Assignment Grids ===

// List grids (filter by station)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.station) filter.station = req.query.station;
    const grids = await AssignmentGrid.find(filter)
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color')
      .sort('sortOrder name');
    res.json(grids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single grid
router.get('/:id', async (req, res) => {
  try {
    const grid = await AssignmentGrid.findById(req.params.id)
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color elements');
    if (!grid) return res.status(404).json({ error: 'Grid not found' });
    res.json(grid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create grid (pre-populate 168 empty hours)
router.post('/', async (req, res) => {
  try {
    if (!req.body.hours?.length) {
      req.body.hours = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          req.body.hours.push({ day, hour, clock: null });
        }
      }
    }
    const grid = await AssignmentGrid.create(req.body);
    res.status(201).json(grid);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update grid
router.put('/:id', async (req, res) => {
  try {
    const grid = await AssignmentGrid.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('hours.clock', 'name code color');
    if (!grid) return res.status(404).json({ error: 'Grid not found' });
    res.json(grid);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a single hour assignment in a grid
router.patch('/:id/hours', async (req, res) => {
  try {
    const { day, hour, clock } = req.body;
    const grid = await AssignmentGrid.findById(req.params.id);
    if (!grid) return res.status(404).json({ error: 'Grid not found' });
    const hourEntry = grid.hours.find(h => h.day === day && h.hour === hour);
    if (hourEntry) {
      hourEntry.clock = clock || null;
    } else {
      grid.hours.push({ day, hour, clock: clock || null });
    }
    await grid.save();
    const populated = await AssignmentGrid.findById(grid._id).populate('hours.clock', 'name code color');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete grid
router.delete('/:id', async (req, res) => {
  try {
    const grid = await AssignmentGrid.findByIdAndDelete(req.params.id);
    if (!grid) return res.status(404).json({ error: 'Grid not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Format Calendar ===

// Get format calendar for a station
router.get('/calendar/:stationId', async (req, res) => {
  try {
    let calendar = await FormatCalendar.findOne({ station: req.params.stationId })
      .populate('gridRotation.grid', 'name color')
      .populate('dateOverrides.grid', 'name color')
      .populate('dateOverrides.hourOverrides.clock', 'name code color');
    if (!calendar) {
      calendar = await FormatCalendar.create({ station: req.params.stationId });
    }
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update format calendar
router.put('/calendar/:stationId', async (req, res) => {
  try {
    const calendar = await FormatCalendar.findOneAndUpdate(
      { station: req.params.stationId },
      req.body,
      { returnDocument: "after", upsert: true, runValidators: true }
    );
    res.json(calendar);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
