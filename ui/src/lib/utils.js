// Format milliseconds to MM:SS or HH:MM:SS
export function formatDuration(ms) {
  if (!ms) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Parse MM:SS or HH:MM:SS to milliseconds
export function parseDuration(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return parts[0] * 1000;
}

// Rotation label display
export const ROTATION_LABELS = {
  'hit': { label: 'Hit', color: 'bg-red-500 text-white' },
  'toth': { label: 'TOTH', color: 'bg-amber-500 text-white' },
  'album-track': { label: 'Album', color: 'bg-blue-400 text-white' },
  'a-rotation': { label: 'A', color: 'bg-green-500 text-white' },
  'b-rotation': { label: 'B', color: 'bg-yellow-500 text-black' },
  'c-rotation': { label: 'C', color: 'bg-orange-500 text-white' },
  'gold': { label: 'Gold', color: 'bg-amber-400 text-black' },
  'recurrent': { label: 'Rec', color: 'bg-purple-500 text-white' },
  'power': { label: 'Power', color: 'bg-red-600 text-white' },
  'library': { label: 'Lib', color: 'bg-gray-500 text-white' },
};

// Category type icons and colors
export const CATEGORY_TYPES = {
  'music': { label: 'Music', emoji: '' },
  'non-music': { label: 'Non-Music', emoji: '' },
  'imaging': { label: 'Imaging', emoji: '' },
  'jingle': { label: 'Jingle', emoji: '' },
  'liner': { label: 'Liner', emoji: '' },
  'promo': { label: 'Promo', emoji: '' },
  'news': { label: 'News', emoji: '' },
  'traffic': { label: 'Traffic', emoji: '' },
  'other': { label: 'Other', emoji: '' },
};

// Clock element types
export const CLOCK_ELEMENT_TYPES = {
  'fixed': { label: 'Fixed', color: 'bg-blue-500' },
  'migrating': { label: 'Migrating', color: 'bg-purple-500' },
  'block': { label: 'Block', color: 'bg-indigo-500' },
  'note': { label: 'Note', color: 'bg-gray-400' },
  'command': { label: 'Command', color: 'bg-slate-500' },
  'artist-block': { label: 'Artist Block', color: 'bg-pink-500' },
  'flow-list': { label: 'Flow List', color: 'bg-teal-500' },
  'traffic': { label: 'Traffic', color: 'bg-orange-500' },
  'time-marker': { label: 'Time Marker', color: 'bg-cyan-500' },
  'imaging': { label: 'Imaging', color: 'bg-emerald-500' },
  'special-set': { label: 'Special Set', color: 'bg-rose-500' },
};

// Day names
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generate slug from name
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
