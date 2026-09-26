import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { createServer as createHttpServer } from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
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
import actionsRouter from './routes/actions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, '..', 'ui');
const distDir = path.join(uiDir, 'dist');
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
app.use('/api/actions', actionsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

const server = createHttpServer(app);

// Production: serve built UI. Dev: mount Vite middleware (HMR on the same port).
let vite = null;
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  console.log('Serving production UI from ui/dist/');
} else {
  const require = createRequire(path.join(uiDir, 'package.json'));
  const viteEntry = require.resolve('vite');
  const { createServer: createViteServer } = await import(pathToFileURL(viteEntry).href);
  vite = await createViteServer({
    root: uiDir,
    appType: 'custom',
    server: { middlewareMode: true, hmr: { server } },
  });
  app.use(vite.middlewares);
  // SPA catch-all: serve transformed index.html
  app.get('{*path}', async (req, res, next) => {
    try {
      const html = await vite.transformIndexHtml(
        req.originalUrl,
        fs.readFileSync(path.join(uiDir, 'index.html'), 'utf-8')
      );
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (err) {
      vite.ssrFixStacktrace(err);
      next(err);
    }
  });
  console.log('Vite dev middleware attached (HMR on this port)');
}

await connectDB();

server.listen(PORT, () => {
  console.log(`Schedularr listening on http://localhost:${PORT}`);
});
