import { Router } from 'express';
import { previewOmniDuplexx, syncOmniDuplexx } from '../lib/omniDuplexx.js';

const router = Router();
let omniSyncRunning = false;

function selection(body) {
  const mode = body.mode === 'future' ? 'future' : 'specific';
  if (!body.stationId) throw new Error('stationId is required');
  if (mode === 'future') {
    const fromDate = body.fromDate || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) throw new Error('A valid fromDate is required');
    return { mode, stationId: body.stationId, fromDate };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) throw new Error('A valid date is required');
  const startHour = Number(body.startHour ?? 0);
  const endHour = Number(body.endHour ?? 23);
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || endHour > 23 || startHour > endHour) {
    throw new Error('Hours must be between 0 and 23, with the start not after the end');
  }
  return { mode, stationId: body.stationId, date: body.date, startHour, endHour };
}

function sendError(res, error) {
  res.status(400).json({ error: error.message, details: error.details || [] });
}

router.post('/omni-duplexx/preview', async (req, res) => {
  try {
    res.json(await previewOmniDuplexx(selection(req.body)));
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/omni-duplexx/sync', async (req, res) => {
  if (omniSyncRunning) return res.status(409).json({ error: 'Another Omni synchronization is already running' });
  try {
    if (req.body.confirm !== true) return res.status(400).json({ error: 'Explicit confirmation is required' });
    omniSyncRunning = true;
    res.json(await syncOmniDuplexx(selection(req.body)));
  } catch (error) {
    sendError(res, error);
  } finally {
    omniSyncRunning = false;
  }
});

export default router;
