import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Stations
export const stations = {
  list: (params) => api.get('/stations', { params }).then(r => r.data),
  get: (id) => api.get(`/stations/${id}`).then(r => r.data),
  create: (data) => api.post('/stations', data).then(r => r.data),
  update: (id, data) => api.put(`/stations/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/stations/${id}`).then(r => r.data),
};

// Artists
export const artists = {
  list: (params) => api.get('/artists', { params }).then(r => r.data),
  get: (id) => api.get(`/artists/${id}`).then(r => r.data),
  create: (data) => api.post('/artists', data).then(r => r.data),
  update: (id, data) => api.put(`/artists/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/artists/${id}`).then(r => r.data),
};

// Songs
export const songs = {
  list: (params) => api.get('/songs', { params }).then(r => r.data),
  get: (id) => api.get(`/songs/${id}`).then(r => r.data),
  create: (data) => api.post('/songs', data).then(r => r.data),
  update: (id, data) => api.put(`/songs/${id}`, data).then(r => r.data),
  delete: (id, hard) => api.delete(`/songs/${id}`, { params: { hard } }).then(r => r.data),
  bulkUpdate: (songIds, update) => api.post('/songs/bulk-update', { songIds, update }).then(r => r.data),
};

// Categories
export const categories = {
  list: (params) => api.get('/categories', { params }).then(r => r.data),
  get: (id) => api.get(`/categories/${id}`).then(r => r.data),
  getSongs: (id, params) => api.get(`/categories/${id}/songs`, { params }).then(r => r.data),
  create: (data) => api.post('/categories', data).then(r => r.data),
  update: (id, data) => api.put(`/categories/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/categories/${id}`).then(r => r.data),
  addSong: (id, songId, folderId) => api.post(`/categories/${id}/songs`, { songId, folderId }).then(r => r.data),
  removeSong: (id, songId) => api.delete(`/categories/${id}/songs/${songId}`).then(r => r.data),
  bulkMove: (songIds, sourceCategoryId, targetCategoryId) =>
    api.post('/categories/bulk-move', { songIds, sourceCategoryId, targetCategoryId }).then(r => r.data),
  bulkCopy: (songIds, targetCategoryId) =>
    api.post('/categories/bulk-copy', { songIds, targetCategoryId }).then(r => r.data),
  bulkRemove: (songIds, categoryId) =>
    api.post('/categories/bulk-remove', { songIds, categoryId }).then(r => r.data),
  reorder: (items) => api.post('/categories/reorder', { items }).then(r => r.data),
};

// Clocks
export const clocks = {
  list: (params) => api.get('/clocks', { params }).then(r => r.data),
  get: (id) => api.get(`/clocks/${id}`).then(r => r.data),
  create: (data) => api.post('/clocks', data).then(r => r.data),
  update: (id, data) => api.put(`/clocks/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/clocks/${id}`).then(r => r.data),
  duplicate: (id, data) => api.post(`/clocks/${id}/duplicate`, data).then(r => r.data),
};

// Assignment Grids
export const grids = {
  list: (params) => api.get('/grids', { params }).then(r => r.data),
  get: (id) => api.get(`/grids/${id}`).then(r => r.data),
  create: (data) => api.post('/grids', data).then(r => r.data),
  update: (id, data) => api.put(`/grids/${id}`, data).then(r => r.data),
  updateHour: (id, data) => api.patch(`/grids/${id}/hours`, data).then(r => r.data),
  delete: (id) => api.delete(`/grids/${id}`).then(r => r.data),
  getCalendar: (stationId) => api.get(`/grids/calendar/${stationId}`).then(r => r.data),
  updateCalendar: (stationId, data) => api.put(`/grids/calendar/${stationId}`, data).then(r => r.data),
};

// Charts
export const charts = {
  list: (params) => api.get('/charts', { params }).then(r => r.data),
  get: (id) => api.get(`/charts/${id}`).then(r => r.data),
  create: (data) => api.post('/charts', data).then(r => r.data),
  update: (id, data) => api.put(`/charts/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/charts/${id}`).then(r => r.data),
};

// Blocks
export const blocks = {
  list: () => api.get('/blocks').then(r => r.data),
  get: (id) => api.get(`/blocks/${id}`).then(r => r.data),
  create: (data) => api.post('/blocks', data).then(r => r.data),
  update: (id, data) => api.put(`/blocks/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/blocks/${id}`).then(r => r.data),
};

// Rules
export const rules = {
  list: (params) => api.get('/rules', { params }).then(r => r.data),
  get: (id) => api.get(`/rules/${id}`).then(r => r.data),
  create: (data) => api.post('/rules', data).then(r => r.data),
  update: (id, data) => api.put(`/rules/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/rules/${id}`).then(r => r.data),
};

// Schedules
export const schedules = {
  list: (params) => api.get('/schedules', { params }).then(r => r.data),
  get: (id) => api.get(`/schedules/${id}`).then(r => r.data),
  update: (stationId, date, hour, data) => api.put(`/schedules/${stationId}/${date}/${hour}`, data).then(r => r.data),
  updateItem: (id, itemId, data) => api.patch(`/schedules/${id}/items/${itemId}`, data).then(r => r.data),
  delete: (id) => api.delete(`/schedules/${id}`).then(r => r.data),
  songHistory: (songId, params) => api.get(`/schedules/history/song/${songId}`, { params }).then(r => r.data),
  stationHistory: (stationId, params) => api.get(`/schedules/history/station/${stationId}`, { params }).then(r => r.data),
};

export default api;
