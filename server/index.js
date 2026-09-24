import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import stationsRouter from './routes/stations.js';
import songsRouter from './routes/songs.js';
import artistsRouter from './routes/artists.js';
import categoriesRouter from './routes/categories.js';
import clocksRouter from './routes/clocks.js';
import gridsRouter from './routes/grids.js';
import chartsRouter from './routes/charts.js';
import blocksRouter from './routes/blocks.js';
import rulesRouter from './routes/rules.js';
import schedulesRouter from './routes/schedules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/stations', stationsRouter);
app.use('/api/songs', songsRouter);
app.use('/api/artists', artistsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/clocks', clocksRouter);
app.use('/api/grids', gridsRouter);
app.use('/api/charts', chartsRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/schedules', schedulesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Serve built UI in production
const distDir = path.resolve(__dirname, '..', 'ui', 'dist');
import('fs').then(fs => {
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
    console.log('Serving production UI from ui/dist/');
  }
});

// Connect to database and start server
await connectDB();

app.listen(PORT, () => {
  console.log(`Schedularr API listening on http://localhost:${PORT}`);
});
