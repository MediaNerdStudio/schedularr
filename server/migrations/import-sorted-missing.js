import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SORTED_FILE = path.join(ROOT, 'Development', 'Omni - Missing from Schedularr - sorted.tsv');
const SYNCED_FILE = path.join(ROOT, 'Development', 'WestRadio - Omni Database [Synced] - All Songs.tsv');
const OMNI_ROOT = process.env.OMNI_DATABASE_ROOT || path.resolve(ROOT, '..', 'MediaNerd.OmniDatabase');
const omniRequire = createRequire(path.join(OMNI_ROOT, 'package.json'));
const Sybase = omniRequire('sybase');

function parseTsv(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const headers = lines[0].split('\t').map(header => header.trim());
  return lines.slice(1).map(line => {
    const columns = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, (columns[index] || '').trim()]));
  });
}

function connectSybase(connection) {
  return new Promise((resolve, reject) => connection.connect(error => error ? reject(error) : resolve()));
}

function querySybase(connection, sql) {
  return new Promise((resolve, reject) => connection.query(sql, (error, rows) => error ? reject(error) : resolve(rows)));
}

function parseNumber(value) {
  if (!value) return 0;
  return Math.round(parseFloat(String(value).replace(',', '.'))) || 0;
}

function buildProperties(row) {
  const properties = [];
  const fields = [
    ['quality', 'quality'],
    ['version', 'version'],
    ['version_info', 'version_info'],
    ['REMARKS', 'remarks'],
    ['LET OP', 'let_op'],
    ['Original Source', 'original_source'],
    ['top40_id', 'top40_id'],
    ['npo_id', 'npo_id'],
  ];
  for (const [field, key] of fields) {
    if (row[field]) properties.push({ key, value: row[field] });
  }
  return properties;
}

function buildRotationLabels(row) {
  const labels = [];
  const fields = [
    ['HIT', 'hit'],
    ['TOTH', 'toth'],
    ['Album Track', 'album-track'],
    ['A-Rotation', 'a-rotation'],
    ['B-Rotation', 'b-rotation'],
    ['C-Rotation', 'c-rotation'],
  ];
  for (const [field, label] of fields) {
    if (row[field] === 'TRUE') labels.push(label);
  }
  return labels;
}

function buildChartHistory(row) {
  const history = [];
  if (row.Top40 === 'TRUE') history.push({ chartName: 'Top 40', peakPosition: 0, weeksOnChart: 0 });
  if (row.Tipparade === 'TRUE') history.push({ chartName: 'Tipparade', peakPosition: 0, weeksOnChart: 0 });
  return history;
}

async function loadSybaseMetadata(titleIds) {
  const sybaseEnv = dotenv.parse(fs.readFileSync(path.join(OMNI_ROOT, '.env')));
  const connection = new Sybase(
    sybaseEnv.SYBASE_HOST,
    Number(sybaseEnv.SYBASE_PORT),
    sybaseEnv.SYBASE_DB,
    sybaseEnv.SYBASE_USER,
    sybaseEnv.SYBASE_PASSWORD,
    false,
    undefined,
    { encoding: 'latin1' },
  );
  await connectSybase(connection);
  const metadata = new Map();
  try {
    for (let index = 0; index < titleIds.length; index += 500) {
      const ids = titleIds.slice(index, index + 500).map(Number).filter(Number.isFinite).join(',');
      const rows = await querySybase(connection, `SELECT "titles"."title_id", "titles"."interpret", "titles"."title", "soundfiles"."soundfile_name", "titles"."duration", "titles_references"."reference_text", "titles"."year", "titles_extend"."isrc" FROM "dalet_group"."titles" AS "titles" LEFT JOIN "dalet_group"."soundfiles" AS "soundfiles" ON "titles"."soundfile_id" = "soundfiles"."soundfile_id" LEFT JOIN "dalet_group"."titles_references" AS "titles_references" ON "titles"."title_id" = "titles_references"."title_id" AND "titles_references"."reference_id" = 1 LEFT JOIN "dalet_group"."titles_extend" AS "titles_extend" ON "titles"."title_id" = "titles_extend"."title_id" WHERE "titles"."title_id" IN (${ids})`);
      for (const row of rows) metadata.set(String(row.title_id), row);
      console.log(`Sybase metadata: ${Math.min(index + 500, titleIds.length)}/${titleIds.length}`);
    }
  } finally {
    connection.disconnect();
  }
  return metadata;
}

async function main() {
  const sortedRows = parseTsv(SORTED_FILE);
  const syncedRows = parseTsv(SYNCED_FILE);
  const syncedById = new Map(syncedRows.map(row => [row.title_id, row]));
  const fallbackIds = sortedRows.filter(row => !syncedById.has(row.title_id)).map(row => row.title_id);
  console.log(`Sorted rows: ${sortedRows.length}`);
  console.log(`Google Sheet metadata: ${sortedRows.length - fallbackIds.length}`);
  console.log(`Sybase fallback required: ${fallbackIds.length}`);

  const sybaseById = await loadSybaseMetadata(fallbackIds);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const categories = await Category.find({}).lean();
  const roots = new Map(categories.filter(category => !category.parent).map(category => [category.name.toLowerCase(), category]));
  const targets = new Map();
  for (const row of sortedRows) {
    const parent = roots.get(row.parent_category.toLowerCase());
    const target = row.sub_category
      ? categories.find(category => String(category.parent) === String(parent?._id) && category.name.toLowerCase() === row.sub_category.toLowerCase())
      : parent;
    if (!target) throw new Error(`Category not found: ${row.parent_category}${row.sub_category ? ` > ${row.sub_category}` : ''}`);
    targets.set(row.title_id, target._id);
  }

  const existingSongs = await Song.find({ 'externalIds.omniTitleId': { $in: sortedRows.map(row => row.title_id) } }, 'externalIds.omniTitleId').lean();
  const existingIds = new Set(existingSongs.map(song => song.externalIds.omniTitleId));
  const artistMap = new Map((await Artist.find({}).lean()).map(artist => [artist.name.toLowerCase(), artist._id]));
  let created = 0;
  let skipped = 0;
  let errors = 0;
  let sheetMetadata = 0;
  let sybaseMetadata = 0;

  for (const sorted of sortedRows) {
    if (existingIds.has(sorted.title_id)) {
      skipped++;
      continue;
    }
    const sheet = syncedById.get(sorted.title_id);
    const fallback = sybaseById.get(sorted.title_id);
    const metadata = sheet || fallback;
    if (!metadata) {
      console.error(`No metadata found for title_id ${sorted.title_id}`);
      errors++;
      continue;
    }

    try {
      const artistName = metadata.interpret || metadata.artist_display || sorted.interpret || 'Unknown';
      let artistId = artistMap.get(artistName.toLowerCase());
      if (!artistId) {
        const artist = await Artist.create({ name: artistName });
        artistId = artist._id;
        artistMap.set(artistName.toLowerCase(), artistId);
      }
      const title = metadata.title || metadata.title_display || sorted.title || 'Untitled';
      const document = {
        title,
        primaryArtist: artistId,
        artistDisplay: metadata.artist_display || artistName,
        albumTitle: metadata.Album || '',
        duration: parseInt(metadata.duration, 10) || 0,
        year: parseInt(metadata.year, 10) || 0,
        bpm: parseNumber(metadata.bpm),
        rotationLabels: sheet ? buildRotationLabels(sheet) : [],
        chartHistory: sheet ? buildChartHistory(sheet) : [],
        categoryAssignments: [{ category: targets.get(sorted.title_id), addedAt: new Date() }],
        properties: sheet ? buildProperties(sheet) : [],
        externalIds: {
          omniTitleId: sorted.title_id,
          omniItemCode: metadata.reference_text || '',
          automationFilename: metadata.soundfile_name || '',
          spotifyTrackId: metadata['Spotify ID'] || '',
          spotifyTrackUrl: metadata['Spotify Link'] || '',
          isrc: metadata.ISRC || metadata.isrc || '',
        },
        isActive: true,
        isArchived: false,
        weight: 50,
      };
      if (sheet?.Released && /^\d{4}$/.test(sheet.Released)) {
        document.releaseDate = new Date(`${sheet.Released}-01-01`);
        document.releaseDatePrecision = 'year';
      }
      if (sheet?.Vormgeving === 'TRUE') document.keywords = ['vormgeving', 'imaging'];
      await Song.create(document);
      if (sheet) sheetMetadata++; else sybaseMetadata++;
      created++;
    } catch (error) {
      console.error(`Error importing ${sorted.title_id}: ${error.message}`);
      errors++;
    }
  }

  console.log('Import complete');
  console.log(`Created: ${created}`);
  console.log(`Skipped existing: ${skipped}`);
  console.log(`Google Sheet metadata used: ${sheetMetadata}`);
  console.log(`Sybase metadata used: ${sybaseMetadata}`);
  console.log(`Errors: ${errors}`);
  await mongoose.disconnect();
}

main().then(() => process.exit(0)).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
