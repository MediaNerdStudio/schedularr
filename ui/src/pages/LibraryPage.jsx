import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule } from 'ag-grid-community';
import { Music, Plus, Search, Filter, Download, Upload } from 'lucide-react';
import { songs, categories, artists } from '../lib/api';
import { formatDuration, ROTATION_LABELS } from '../lib/utils';

export default function LibraryPage() {
  const navigate = useNavigate();
  const gridRef = useRef(null);
  const [songList, setSongList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryList, setCategoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ category: '', rotationLabel: '', genre: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '', primaryArtistName: '', albumTitle: '', duration: 0,
    genre: '', year: '', bpm: 0, mood: '', energy: '', rotationLabels: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 500, sort: 'title' };
      if (searchQuery) params.q = searchQuery;
      if (filters.category) params.category = filters.category;
      if (filters.rotationLabel) params.rotationLabel = filters.rotationLabel;
      if (filters.genre) params.genre = filters.genre;

      const [songData, catData] = await Promise.all([
        songs.list(params),
        categoryList.length ? Promise.resolve(null) : categories.list(),
      ]);

      setSongList(songData.songs);
      setTotal(songData.total);
      if (catData) setCategoryList(catData);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => { load(); }, [load]);

  const columnDefs = [
    {
      headerName: '',
      field: 'artwork',
      width: 50,
      cellRenderer: (params) => {
        const img = params.value || params.data?.images?.[0]?.url;
        return img
          ? <img src={img} className="w-8 h-8 rounded object-cover" alt="" />
          : <div className="w-8 h-8 rounded bg-base-300 flex items-center justify-center"><Music className="w-4 h-4 text-base-content/30" /></div>;
      },
      sortable: false,
      filter: false,
    },
    { headerName: 'Title', field: 'title', flex: 2, minWidth: 200 },
    {
      headerName: 'Artist',
      field: 'artistDisplay',
      flex: 1.5,
      minWidth: 150,
      valueGetter: (params) => params.data?.artistDisplay || params.data?.primaryArtist?.name || '',
    },
    {
      headerName: 'Duration',
      field: 'duration',
      width: 90,
      valueFormatter: (params) => formatDuration(params.value),
    },
    { headerName: 'BPM', field: 'bpm', width: 70 },
    { headerName: 'Genre', field: 'genre', width: 120 },
    { headerName: 'Year', field: 'year', width: 70 },
    {
      headerName: 'Categories',
      field: 'categoryAssignments',
      flex: 1,
      cellRenderer: (params) => {
        const cats = params.value || [];
        return (
          <div className="flex gap-1 items-center h-full flex-wrap">
            {cats.map((ca, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded font-medium text-white"
                style={{ backgroundColor: ca.category?.color || '#666' }}
              >
                {ca.category?.code || '?'}
              </span>
            ))}
          </div>
        );
      },
      sortable: false,
    },
    {
      headerName: 'Rotation',
      field: 'rotationLabels',
      width: 130,
      cellRenderer: (params) => {
        const labels = params.value || [];
        return (
          <div className="flex gap-1 items-center h-full flex-wrap">
            {labels.map((l, i) => {
              const info = ROTATION_LABELS[l];
              return info ? (
                <span key={i} className={`rotation-badge ${info.color}`}>{info.label}</span>
              ) : null;
            })}
          </div>
        );
      },
      sortable: false,
    },
    {
      headerName: 'Weight',
      field: 'weight',
      width: 70,
    },
  ];

  const handleRowClicked = (event) => {
    navigate(`/library/${event.data._id}`);
  };

  const handleAddSong = async () => {
    try {
      const data = { ...addForm };
      if (data.year) data.year = Number(data.year);
      if (data.bpm) data.bpm = Number(data.bpm);
      await songs.create(data);
      setShowAddModal(false);
      setAddForm({
        title: '', primaryArtistName: '', albumTitle: '', duration: 0,
        genre: '', year: '', bpm: 0, mood: '', energy: '', rotationLabels: [],
      });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" />
            Song Library
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {total} songs in library
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" /> Add Song
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="join">
          <div className="join-item flex items-center px-2 bg-base-200">
            <Search className="w-4 h-4 text-base-content/40" />
          </div>
          <input
            className="input input-bordered input-sm join-item w-64"
            placeholder="Search songs, artists, albums..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="select select-bordered select-sm"
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">All Categories</option>
          {categoryList.map(c => (
            <option key={c._id} value={c._id}>{c.code} - {c.name}</option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm"
          value={filters.rotationLabel}
          onChange={e => setFilters(f => ({ ...f, rotationLabel: e.target.value }))}
        >
          <option value="">All Rotations</option>
          {Object.entries(ROTATION_LABELS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
        {(searchQuery || filters.category || filters.rotationLabel || filters.genre) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setSearchQuery(''); setFilters({ category: '', rotationLabel: '', genre: '' }); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          modules={[AllCommunityModule]}
          rowData={songList}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          rowHeight={40}
          headerHeight={36}
          animateRows={true}
          rowSelection="multiple"
          onRowClicked={handleRowClicked}
          overlayLoadingTemplate='<span class="loading loading-spinner"></span>'
          overlayNoRowsTemplate='<span class="text-base-content/40">No songs found</span>'
          loading={loading}
          getRowId={(params) => params.data._id}
        />
      </div>

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">Add Song</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Title *</span></label>
                <input
                  className="input input-bordered input-sm"
                  value={addForm.title}
                  onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="Song title"
                />
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Artist *</span></label>
                <input
                  className="input input-bordered input-sm"
                  value={addForm.primaryArtistName}
                  onChange={e => setAddForm({ ...addForm, primaryArtistName: e.target.value })}
                  placeholder="Primary artist name"
                />
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Album</span></label>
                <input
                  className="input input-bordered input-sm"
                  value={addForm.albumTitle}
                  onChange={e => setAddForm({ ...addForm, albumTitle: e.target.value })}
                  placeholder="Album title"
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Genre</span></label>
                <input
                  className="input input-bordered input-sm"
                  value={addForm.genre}
                  onChange={e => setAddForm({ ...addForm, genre: e.target.value })}
                  placeholder="e.g., Pop"
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Year</span></label>
                <input
                  className="input input-bordered input-sm"
                  type="number"
                  value={addForm.year}
                  onChange={e => setAddForm({ ...addForm, year: e.target.value })}
                  placeholder="2024"
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">BPM</span></label>
                <input
                  className="input input-bordered input-sm"
                  type="number"
                  value={addForm.bpm}
                  onChange={e => setAddForm({ ...addForm, bpm: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Mood</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={addForm.mood}
                  onChange={e => setAddForm({ ...addForm, mood: e.target.value })}
                >
                  <option value="">-</option>
                  <option value="very-sad">Very Sad</option>
                  <option value="melancholy">Melancholy</option>
                  <option value="neutral">Neutral</option>
                  <option value="happy">Happy</option>
                  <option value="very-happy">Very Happy</option>
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddSong}
                disabled={!addForm.title || !addForm.primaryArtistName}
              >
                Add Song
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddModal(false)} />
        </div>
      )}
    </div>
  );
}
