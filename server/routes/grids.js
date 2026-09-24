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

// === Format Calendar ===
// These must be registered before the generic `/:id` routes.

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
    const { station, isDefault, periodStart, periodEnd } = req.body;

    if (!req.body.hours?.length) {
      req.body.hours = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          req.body.hours.push({ day, hour, clock: null });
        }
      }
    }

    // Period grids cannot be the default
    if (periodStart || periodEnd) {
      req.body.isDefault = false;
    }

    // If this is the first grid for the station and it's not a period grid,
    // make it the default automatically.
    if (!periodStart && !periodEnd && isDefault !== false) {
      const existingDefault = await AssignmentGrid.findOne({ station, isActive: true, isDefault: true });
      if (!existingDefault) {
        req.body.isDefault = true;
      }
    }

    const grid = await AssignmentGrid.create(req.body);
    const populated = await AssignmentGrid.findById(grid._id)
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update grid
router.put('/:id', async (req, res) => {
  try {
    const { isDefault, periodStart, periodEnd } = req.body;

    // Period grids cannot be the default
    if (periodStart || periodEnd) {
      req.body.isDefault = false;
    }

    const grid = await AssignmentGrid.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color');

    if (!grid) return res.status(404).json({ error: 'Grid not found' });

    // Enforce single active default per station
    if (grid.isDefault && grid.isActive) {
      await AssignmentGrid.updateMany(
        { station: grid.station, _id: { $ne: grid._id }, isDefault: true, isActive: true },
        { $set: { isDefault: false } }
      );
    }

    res.json(grid);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Set a grid as the active default for its station
router.post('/:id/set-default', async (req, res) => {
  try {
    const grid = await AssignmentGrid.findById(req.params.id);
    if (!grid) return res.status(404).json({ error: 'Grid not found' });
    if (grid.periodStart || grid.periodEnd) {
      return res.status(400).json({ error: 'Period grids cannot be set as the default grid' });
    }

    await AssignmentGrid.updateMany(
      { station: grid.station, isDefault: true, isActive: true },
      { $set: { isDefault: false } }
    );

    grid.isDefault = true;
    grid.isActive = true;
    await grid.save();

    const populated = await AssignmentGrid.findById(grid._id)
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Duplicate a grid
router.post('/:id/duplicate', async (req, res) => {
  try {
    const source = await AssignmentGrid.findById(req.params.id).populate('hours.clock');
    if (!source) return res.status(404).json({ error: 'Grid not found' });

    const { name } = req.body || {};
    const newGrid = await AssignmentGrid.create({
      name: name || `${source.name} (Copy)`,
      station: source.station,
      description: source.description,
      color: source.color,
      hours: source.hours.map(h => ({ day: h.day, hour: h.hour, clock: h.clock?._id || null })),
      isDefault: false,
      isActive: source.isActive,
      periodStart: null,
      periodEnd: null,
      sortOrder: source.sortOrder + 1,
    });

    const populated = await AssignmentGrid.findById(newGrid._id)
      .populate('station', 'name slug')
      .populate('hours.clock', 'name code color');
    res.status(201).json(populated);
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

// Bulk update hour assignments (copy/paste support)
router.patch('/:id/hours/bulk', async (req, res) => {
  try {
    const { assignments } = req.body; // [{ day, hour, clock }]
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments array is required' });
    }

    const grid = await AssignmentGrid.findById(req.params.id);
    if (!grid) return res.status(404).json({ error: 'Grid not found' });

    for (const { day, hour, clock } of assignments) {
      const hourEntry = grid.hours.find(h => h.day === day && h.hour === hour);
      if (hourEntry) {
        hourEntry.clock = clock || null;
      } else {
        grid.hours.push({ day, hour, clock: clock || null });
      }
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

export default router;
