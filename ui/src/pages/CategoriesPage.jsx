import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  FolderOpen, FolderClosed, Plus, Pencil, Trash2, Music, ChevronRight, ChevronDown,
  Copy, Move, GripVertical, LayoutGrid, Volume2, FileText, Megaphone, Radio
} from 'lucide-react';
import { categories, songs } from '../lib/api';
import { formatDuration, ROTATION_LABELS, CATEGORY_TYPES } from '../lib/utils';

const TYPE_ICONS = {
  music: Music, imaging: Volume2, jingle: Volume2, liner: FileText,
  promo: Megaphone, news: FileText, traffic: Radio, other: FileText, 'non-music': FileText,
};

export default function CategoriesPage() {
  const [catList, setCatList] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [catSongs, setCatSongs] = useState([]);
  const [songTotal, setSongTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveMode, setMoveMode] = useState('move'); // 'move' or 'copy'
  const [dragOverCatId, setDragOverCatId] = useState(null);
  const gridRef = useRef(null);

  const [catForm, setCatForm] = useState({
    code: '', name: '', type: 'music', color: '#3b82f6', rotationLabel: '',
    parent: '', description: '',
    rules: { songSeparation: 0, artistPrimarySeparation: 0, searchDepth: 20 },
  });

  // Load categories
  const loadCategories = async () => {
    try {
      const data = await categories.list();
      setCatList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  // Load songs when category selected
  const loadSongs = async (catId) => {
    if (!catId) { setCatSongs([]); setSongTotal(0); return; }
    setLoadingSongs(true);
    try {
      const data = await categories.getSongs(catId, { limit: 5000 });
      setCatSongs(data.songs);
      setSongTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSongs(false);
    }
  };

  useEffect(() => { loadSongs(selectedCat?._id); }, [selectedCat?._id]);

  // Build tree structure
  const buildTree = (cats) => {
    const map = new Map();
    const roots = [];
    for (const cat of cats) {
      map.set(cat._id, { ...cat, children: [] });
    }
    for (const cat of cats) {
      const node = map.get(cat._id);
      if (cat.parent && map.has(cat.parent)) {
        map.get(cat.parent).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  };

  const tree = buildTree(catList);

  // Toggle expand
  const toggleExpand = (catId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  // Category CRUD
  const openCreateCat = (parentId = null) => {
    setEditingCat(null);
    setCatForm({
      code: '', name: '', type: 'music', color: '#3b82f6', rotationLabel: '',
      parent: parentId || '', description: '',
      rules: { songSeparation: 0, artistPrimarySeparation: 0, searchDepth: 20 },
    });
    setShowCatModal(true);
  };

  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({
      code: cat.code, name: cat.name, type: cat.type, color: cat.color,
      rotationLabel: cat.rotationLabel || '', parent: cat.parent || '',
      description: cat.description || '',
      rules: { ...cat.rules },
    });
    setShowCatModal(true);
  };

  const saveCat = async () => {
    try {
      const data = { ...catForm, parent: catForm.parent || null };
      if (editingCat) {
        await categories.update(editingCat._id, data);
      } else {
        await categories.create(data);
      }
      setShowCatModal(false);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const deleteCat = async (cat) => {
    const childCount = catList.filter(c => c.parent === cat._id).length;
    const msg = childCount > 0
      ? `Delete "${cat.name}" and its ${childCount} subcategories? Songs will be uncategorized.`
      : `Delete "${cat.name}"? ${cat.songCount || 0} songs will be uncategorized.`;
    if (!confirm(msg)) return;
    try {
      // Delete children first
      if (childCount > 0) {
        for (const child of catList.filter(c => c.parent === cat._id)) {
          await categories.delete(child._id);
        }
      }
      await categories.delete(cat._id);
      if (selectedCat?._id === cat._id) setSelectedCat(null);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // Song selection
  const onSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api?.getSelectedRows() || [];
    setSelectedSongIds(rows.map(r => r._id));
  }, []);

  // Drag-drop from grid to tree
  const handleDragStart = (e, songIds) => {
    e.dataTransfer.setData('application/json', JSON.stringify(songIds));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTreeDrop = async (e, targetCat) => {
    e.preventDefault();
    setDragOverCatId(null);
    try {
      const songIds = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!songIds?.length) return;
      // If holding Ctrl/Cmd = copy, otherwise move
      const isCopy = e.ctrlKey || e.metaKey;
      if (isCopy) {
        await categories.bulkCopy(songIds, targetCat._id);
      } else {
        await categories.bulkMove(songIds, selectedCat?._id, targetCat._id);
      }
      loadSongs(selectedCat?._id);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleTreeDragOver = (e, catId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? 'copy' : 'move';
    setDragOverCatId(catId);
  };

  // Bulk move/copy via modal
  const openBulkMove = (mode) => {
    if (selectedSongIds.length === 0) return;
    setMoveMode(mode);
    setShowMoveModal(true);
  };

  const executeBulkAction = async (targetCatId) => {
    try {
      if (moveMode === 'move') {
        await categories.bulkMove(selectedSongIds, selectedCat?._id, targetCatId);
      } else {
        await categories.bulkCopy(selectedSongIds, targetCatId);
      }
      setShowMoveModal(false);
      setSelectedSongIds([]);
      gridRef.current?.api?.deselectAll();
      loadSongs(selectedCat?._id);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedSongIds.length === 0 || !selectedCat) return;
    if (!confirm(`Remove ${selectedSongIds.length} songs from "${selectedCat.name}"?`)) return;
    try {
      await categories.bulkRemove(selectedSongIds, selectedCat._id);
      setSelectedSongIds([]);
      gridRef.current?.api?.deselectAll();
      loadSongs(selectedCat._id);
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // AG Grid columns
  const columnDefs = [
    {
      headerName: '', width: 40, checkboxSelection: true, headerCheckboxSelection: true,
      pinned: 'left', suppressHeaderMenuButton: true, lockPosition: true,
    },
    { headerName: 'Title', field: 'title', flex: 2, minWidth: 200 },
    {
      headerName: 'Artist', flex: 1.5, minWidth: 150,
      valueGetter: p => p.data?.artistDisplay || p.data?.primaryArtist?.name || '',
    },
    { headerName: 'Year', field: 'year', width: 70, type: 'numericColumn' },
    {
      headerName: 'Duration', field: 'duration', width: 80,
      valueFormatter: p => formatDuration(p.value),
    },
    { headerName: 'BPM', field: 'bpm', width: 60, type: 'numericColumn' },
    {
      headerName: 'Labels', width: 120,
      valueGetter: p => (p.data?.rotationLabels || []).map(l => ROTATION_LABELS[l]?.label || l).join(', '),
    },
    {
      headerName: 'Spotify', width: 70,
      valueGetter: p => p.data?.externalIds?.spotifyTrackId ? 'Yes' : '',
      cellClass: p => p.value ? 'text-green-500' : 'text-base-content/20',
    },
  ];

  const defaultColDef = {
    sortable: true, filter: true, resizable: true,
  };

  // Render tree node
  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedIds.has(node._id);
    const isSelected = selectedCat?._id === node._id;
    const isDragOver = dragOverCatId === node._id;
    const Icon = TYPE_ICONS[node.type] || Music;

    return (
      <div key={node._id}>
        <div
          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors text-sm group
            ${isSelected ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-base-300/50'}
            ${isDragOver ? 'bg-primary/25 outline outline-1 outline-primary' : ''}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedCat(node)}
          onDragOver={e => handleTreeDragOver(e, node._id)}
          onDragLeave={() => setDragOverCatId(null)}
          onDrop={e => handleTreeDrop(e, node)}
        >
          {/* Expand toggle */}
          <button
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(node._id); }}
          >
            {hasChildren ? (
              isExpanded
                ? <ChevronDown className="w-3 h-3 text-base-content/40" />
                : <ChevronRight className="w-3 h-3 text-base-content/40" />
            ) : <span className="w-3" />}
          </button>

          {/* Category color dot & icon */}
          <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: node.color }}>
            {hasChildren || depth === 0
              ? (isExpanded ? <FolderOpen className="w-2.5 h-2.5 text-white" /> : <FolderClosed className="w-2.5 h-2.5 text-white" />)
              : <Icon className="w-2.5 h-2.5 text-white" />
            }
          </div>

          {/* Name + count */}
          <span className="truncate flex-1">{node.name}</span>
          <span className="text-xs text-base-content/30 tabular-nums">{node.songCount || 0}</span>

          {/* Rotation badge */}
          {node.rotationLabel && (
            <span className={`text-[10px] px-1 rounded ${ROTATION_LABELS[node.rotationLabel]?.color || ''}`}>
              {ROTATION_LABELS[node.rotationLabel]?.label}
            </span>
          )}

          {/* Context actions */}
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
            <button className="btn btn-ghost btn-xs px-1 h-5 min-h-0" onClick={e => { e.stopPropagation(); openCreateCat(node._id); }} title="Add subcategory">
              <Plus className="w-3 h-3" />
            </button>
            <button className="btn btn-ghost btn-xs px-1 h-5 min-h-0" onClick={e => { e.stopPropagation(); openEditCat(node); }} title="Edit">
              <Pencil className="w-3 h-3" />
            </button>
            <button className="btn btn-ghost btn-xs px-1 h-5 min-h-0 text-error" onClick={e => { e.stopPropagation(); deleteCat(node); }} title="Delete">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
              .map(child => renderTreeNode(child, depth + 1))
            }
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left: Category Tree */}
      <div className="w-72 shrink-0 border-r border-base-300 flex flex-col bg-base-100">
        <div className="flex items-center justify-between p-3 border-b border-base-300">
          <h2 className="font-bold text-sm flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-primary" />
            Categories
          </h2>
          <button className="btn btn-primary btn-xs" onClick={() => openCreateCat(null)}>
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {tree.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 mx-auto text-base-content/15 mb-2" />
              <p className="text-xs text-base-content/30">No categories</p>
            </div>
          ) : (
            tree
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
              .map(node => renderTreeNode(node))
          )}
        </div>

        {/* Tree stats */}
        <div className="p-2 border-t border-base-300 text-xs text-base-content/40">
          {catList.length} categories | {catList.reduce((s, c) => s + (c.songCount || 0), 0)} assignments
        </div>
      </div>

      {/* Right: Song Explorer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Explorer header */}
        <div className="flex items-center gap-3 p-3 border-b border-base-300">
          {selectedCat ? (
            <>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: selectedCat.color }}>
                <Music className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate">{selectedCat.name}
                  <span className="font-mono text-base-content/30 ml-2 font-normal">{selectedCat.code}</span>
                </h3>
                <p className="text-xs text-base-content/40">{songTotal} songs{selectedCat.description ? ` — ${selectedCat.description}` : ''}</p>
              </div>

              {/* Bulk actions */}
              {selectedSongIds.length > 0 && (
                <div className="flex gap-1 items-center">
                  <span className="text-xs text-base-content/50 mr-1">{selectedSongIds.length} selected</span>
                  <button className="btn btn-sm btn-ghost gap-1" onClick={() => openBulkMove('move')} title="Move to...">
                    <Move className="w-3.5 h-3.5" /> Move
                  </button>
                  <button className="btn btn-sm btn-ghost gap-1" onClick={() => openBulkMove('copy')} title="Copy to...">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button className="btn btn-sm btn-ghost gap-1 text-error" onClick={handleBulkRemove} title="Remove from category">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 text-center text-sm text-base-content/30 py-2">
              Select a category to view its songs
            </div>
          )}
        </div>

        {/* AG Grid */}
        <div className="flex-1 ag-theme-alpine" data-theme="">
          {selectedCat ? (
            loadingSongs ? (
              <div className="flex items-center justify-center h-full">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : (
              <AgGridReact
                ref={gridRef}
                rowData={catSongs}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowSelection="multiple"
                onSelectionChanged={onSelectionChanged}
                getRowId={p => p.data._id}
                rowDragManaged={true}
                animateRows={true}
                suppressRowClickSelection={true}
                rowHeight={32}
                headerHeight={36}
                onRowDragEnd={(e) => {
                  // Could be used for rotation order sorting within category
                }}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-base-content/10 mb-4" />
                <p className="text-base-content/30 text-sm">Select a category from the tree</p>
                <p className="text-base-content/20 text-xs mt-1">Drag songs to categories to move them</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Create/Edit Modal */}
      {showCatModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">{editingCat ? 'Edit Category' : 'New Category'}</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Code</span></label>
                <input className="input input-bordered input-sm font-mono uppercase" maxLength={6}
                  value={catForm.code} onChange={e => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })} placeholder="e.g., POWR" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm"
                  value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g., Power Current" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Parent Category</span></label>
                <select className="select select-bordered select-sm"
                  value={catForm.parent} onChange={e => setCatForm({ ...catForm, parent: e.target.value })}>
                  <option value="">None (root level)</option>
                  {catList
                    .filter(c => c._id !== editingCat?._id) // prevent self-reference
                    .map(c => <option key={c._id} value={c._id}>{c.name}</option>)
                  }
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Type</span></label>
                <select className="select select-bordered select-sm"
                  value={catForm.type} onChange={e => setCatForm({ ...catForm, type: e.target.value })}>
                  {Object.entries(CATEGORY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Rotation</span></label>
                <select className="select select-bordered select-sm"
                  value={catForm.rotationLabel} onChange={e => setCatForm({ ...catForm, rotationLabel: e.target.value })}>
                  <option value="">None</option>
                  {Object.entries(ROTATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Color</span></label>
                <div className="flex items-center gap-2">
                  <input type="color" className="w-8 h-8 rounded cursor-pointer"
                    value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} />
                  <span className="text-xs font-mono text-base-content/40">{catForm.color}</span>
                </div>
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Description</span></label>
                <input className="input input-bordered input-sm"
                  value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} />
              </div>
              <div className="col-span-2 divider text-xs my-1">Separation Rules (minutes)</div>
              <div className="form-control">
                <label className="label"><span className="label-text">Song Separation</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={catForm.rules.songSeparation} onChange={e => setCatForm({ ...catForm, rules: { ...catForm.rules, songSeparation: Number(e.target.value) } })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Artist Primary Sep.</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={catForm.rules.artistPrimarySeparation} onChange={e => setCatForm({ ...catForm, rules: { ...catForm.rules, artistPrimarySeparation: Number(e.target.value) } })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Search Depth %</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={catForm.rules.searchDepth} onChange={e => setCatForm({ ...catForm, rules: { ...catForm.rules, searchDepth: Number(e.target.value) } })} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCatModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveCat} disabled={!catForm.code || !catForm.name}>
                {editingCat ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCatModal(false)} />
        </div>
      )}

      {/* Move/Copy Modal */}
      {showMoveModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg">{moveMode === 'move' ? 'Move' : 'Copy'} {selectedSongIds.length} songs to...</h3>
            <div className="mt-4 max-h-80 overflow-y-auto space-y-0.5">
              {catList
                .filter(c => c._id !== selectedCat?._id)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cat => (
                  <button
                    key={cat._id}
                    className="flex items-center gap-2 w-full p-2 rounded hover:bg-base-200 text-left text-sm"
                    onClick={() => executeBulkAction(cat._id)}
                  >
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color }} />
                    <span className="font-mono text-xs text-base-content/40 w-14">{cat.code}</span>
                    <span className="flex-1 truncate">{cat.name}</span>
                    <span className="text-xs text-base-content/30">{cat.songCount || 0}</span>
                  </button>
                ))
              }
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMoveModal(false)}>Cancel</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowMoveModal(false)} />
        </div>
      )}
    </div>
  );
}
