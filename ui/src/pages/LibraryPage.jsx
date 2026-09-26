import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Plus, Search, Filter, Download, Upload, ChevronDown, ChevronRight, FolderOpen, FolderClosed, LayoutGrid } from 'lucide-react';
import CompactGrid from '../components/CompactGrid';
import { songs, categories, artists } from '../lib/api';
import { formatDuration, ROTATION_LABELS } from '../lib/utils';

function buildCategoryTree(categoryList) {
  const map = new Map(categoryList.map(category => [category._id, { ...category, children: [] }]));
  const roots = [];
  for (const category of categoryList) {
    const node = map.get(category._id);
    if (category.parent && map.has(category.parent)) map.get(category.parent).children.push(node);
    else roots.push(node);
  }
  const prepare = (nodes, inheritedColor = '#6b7280') => nodes
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .forEach(node => {
      node.effectiveColor = node.color || inheritedColor;
      prepare(node.children, node.effectiveColor);
    });
  prepare(roots);
  return roots;
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [songList, setSongList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryList, setCategoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ category: '', rotationLabel: '', genre: '' });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryExpandedIds, setCategoryExpandedIds] = useState(new Set());
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
      headerName: 'Artist',
      colId: 'artist',
      field: 'artistDisplay',
      flex: 1.5,
      minWidth: 150,
      sort: 'asc',
      valueGetter: (params) => params.data?.artistDisplay || params.data?.primaryArtist?.name || '',
    },
    { headerName: 'Title', colId: 'title', field: 'title', flex: 2, minWidth: 200 },
    {
      headerName: 'Duration',
      colId: 'duration',
      field: 'duration',
      width: 90,
      valueFormatter: (params) => formatDuration(params.value),
    },
    { headerName: 'BPM', colId: 'bpm', field: 'bpm', width: 70 },
    { headerName: 'Genre', colId: 'genre', field: 'genre', width: 120 },
    { headerName: 'Year', colId: 'year', field: 'year', width: 70 },
    {
      headerName: 'Categories',
      colId: 'categories',
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
      colId: 'rotation',
      field: 'rotationLabels',
      width: 110,
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
    { headerName: 'Weight', colId: 'weight', field: 'weight', width: 70 },
    {
      headerName: 'Spotify ID',
      colId: 'spotifyId',
      width: 120,
      hide: true,
      valueGetter: p => p.data?.externalIds?.spotifyTrackId || '',
      cellClass: 'font-mono text-[10px]',
    },
    {
      headerName: 'ISRC',
      colId: 'isrc',
      width: 120,
      hide: true,
      valueGetter: p => p.data?.externalIds?.isrc || '',
      cellClass: 'font-mono text-[10px]',
    },
    {
      headerName: 'Omni TitleId',
      colId: 'omniTitleId',
      width: 120,
      hide: true,
      valueGetter: p => p.data?.externalIds?.omniTitleId || '',
      cellClass: 'font-mono text-[10px]',
    },
    {
      headerName: 'Omni ItemCode',
      colId: 'omniItemCode',
      width: 120,
      hide: true,
      valueGetter: p => p.data?.externalIds?.omniItemCode || '',
      cellClass: 'font-mono text-[10px]',
    },
  ];

  const handleRowClicked = (event) => {
    navigate(`/library/${event.data._id}`);
  };

  const categoryTree = buildCategoryTree(categoryList);
  const selectedCategory = categoryList.find(category => category._id === filters.category);
  const selectedCategoryParent = selectedCategory?.parent && categoryList.find(category => category._id === selectedCategory.parent);
  const selectedCategoryLabel = selectedCategory
    ? `${selectedCategoryParent ? `${selectedCategoryParent.name} | ` : ''}${selectedCategory.name}`
    : 'All Categories';

  const toggleCategoryExpand = categoryId => {
    setCategoryExpandedIds(previous => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
  };

  const renderCategoryPicker = (nodes, depth = 0) => nodes.map(node => {
    const hasChildren = node.children.length > 0;
    const isExpanded = categoryExpandedIds.has(node._id);
    const isSelected = filters.category === node._id;
    return (
      <div key={node._id}>
        <div className={`flex items-center gap-1.5 rounded text-sm ${isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-base-200'}`} style={{ paddingLeft: `${depth * 16 + 4}px` }}>
          <button className="w-5 h-7 flex items-center justify-center shrink-0" onClick={() => hasChildren && toggleCategoryExpand(node._id)}>
            {hasChildren ? isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" /> : null}
          </button>
          <button
            className="flex flex-1 min-w-0 items-center gap-1.5 py-1 pr-2 text-left"
            onClick={() => {
              setFilters(current => ({ ...current, category: node._id }));
              setShowCategoryPicker(false);
            }}
          >
            <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: node.effectiveColor }}>
              {hasChildren
                ? isExpanded ? <FolderOpen className="w-2.5 h-2.5 text-white" /> : <FolderClosed className="w-2.5 h-2.5 text-white" />
                : <Music className="w-2.5 h-2.5 text-white" />}
            </span>
            <span className="truncate flex-1">{node.name}</span>
            <span className="font-mono text-[10px] text-base-content/30">{node.code}</span>
          </button>
        </div>
        {hasChildren && isExpanded && renderCategoryPicker(node.children, depth + 1)}
      </div>
    );
  });

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
        <div className="relative">
          <button
            className="btn btn-sm btn-ghost bg-base-100 border border-base-300 w-60 justify-between font-normal"
            onClick={() => setShowCategoryPicker(previous => !previous)}
          >
            <span className="truncate">{selectedCategoryLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
          {showCategoryPicker && (
            <div className="absolute left-0 top-full mt-1 z-30 w-80 max-h-96 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-xl">
              <button
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${filters.category ? 'hover:bg-base-200' : 'bg-primary/15 text-primary'}`}
                onClick={() => {
                  setFilters(current => ({ ...current, category: '' }));
                  setShowCategoryPicker(false);
                }}
              >
                <LayoutGrid className="w-4 h-4" /> All Categories
              </button>
              {renderCategoryPicker(categoryTree)}
            </div>
          )}
        </div>
        {showCategoryPicker && <div className="fixed inset-0 z-20" onClick={() => setShowCategoryPicker(false)} />}
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
      <div className="flex-1 min-h-0">
        <CompactGrid
          rowData={songList}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          rowSelection="multiple"
          onRowClicked={handleRowClicked}
          loading={loading}
          noRowsMessage="No songs found"
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
