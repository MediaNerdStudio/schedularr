import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Clock,
  Music, Volume2, FileText, Terminal, Users, List, Radio as RadioIcon,
  FolderClosed, FolderOpen, Search
} from 'lucide-react';
import { clocks, categories as categoriesApi, songs as songsApi } from '../lib/api';
import { CLOCK_ELEMENT_TYPES, formatDuration, parseDuration } from '../lib/utils';

const ELEMENT_ICONS = {
  'fixed': Music, 'migrating': List, 'block': Clock, 'note': FileText,
  'command': Terminal, 'artist-block': Users, 'flow-list': List,
  'traffic': RadioIcon, 'time-marker': Clock, 'imaging': Volume2,
  'special-set': Music,
};

export default function ClockEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clock, setClock] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddElement, setShowAddElement] = useState(false);
  const [newElement, setNewElement] = useState({ type: 'fixed', category: '', song: '', label: '' });
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);

  useEffect(() => {
    if (!songQuery.trim()) {
      setSongResults([]);
      return;
    }
    const t = setTimeout(() => {
      songsApi.list({ q: songQuery, limit: 20 }).then(r => setSongResults(r.songs));
    }, 300);
    return () => clearTimeout(t);
  }, [songQuery]);

  useEffect(() => {
    Promise.all([clocks.get(id), categoriesApi.list()]).then(([clockData, catData]) => {
      setClock(clockData);
      setCategoryList(catData);
      setLoading(false);
    }).catch(() => navigate('/clocks'));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await clocks.update(id, clock);
      setClock(updated);
      setDirty(false);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const addElement = () => {
    const elements = [...(clock.elements || [])];
    const position = elements.length;
    const cat = categoryList.find(c => c._id === newElement.category);
    const songLabel = selectedSong ? `${selectedSong.title} — ${selectedSong.artistDisplay || selectedSong.primaryArtist?.name || ''}` : '';
    elements.push({
      type: newElement.type,
      position,
      category: newElement.category || undefined,
      song: newElement.song || undefined,
      label: newElement.label || (newElement.type === 'song' ? songLabel : cat?.name) || CLOCK_ELEMENT_TYPES[newElement.type]?.label || '',
      estimatedDuration: newElement.type === 'song' ? (selectedSong?.duration || 0) : 0,
      isPinned: true,
      text: '',
    });
    setClock({ ...clock, elements });
    setDirty(true);
    setShowAddElement(false);
    setNewElement({ type: 'fixed', category: '', song: '', label: '' });
    setSongQuery('');
    setSongResults([]);
    setSelectedSong(null);
  };

  const removeElement = (index) => {
    const elements = clock.elements.filter((_, i) => i !== index)
      .map((el, i) => ({ ...el, position: i }));
    setClock({ ...clock, elements });
    setDirty(true);
  };

  const moveElement = (index, direction) => {
    const elements = [...clock.elements];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= elements.length) return;
    [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
    elements.forEach((el, i) => el.position = i);
    setClock({ ...clock, elements });
    setDirty(true);
  };

  const updateElement = (index, field, value) => {
    const elements = [...clock.elements];
    elements[index] = { ...elements[index], [field]: value };
    setClock({ ...clock, elements });
    setDirty(true);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;
  if (!clock) return null;

  const totalDuration = (clock.elements || []).reduce((sum, el) => sum + (el.estimatedDuration || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clocks')}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: clock.color }}>
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{clock.name} <span className="font-mono text-base-content/40 text-sm ml-2">{clock.code}</span></h1>
          <p className="text-xs text-base-content/50">
            {clock.station?.name} | {clock.flowType === 'natural-flow' ? 'Natural Flow' : 'Fixed Position'} | {clock.elements?.length || 0} elements | {formatDuration(totalDuration)} total
          </p>
        </div>
        <button className={`btn btn-primary btn-sm`} onClick={handleSave} disabled={!dirty || saving}>
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Element List */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide">Clock Elements</h2>
            <button className="btn btn-primary btn-xs" onClick={() => setShowAddElement(true)}>
              <Plus className="w-3 h-3" /> Add Element
            </button>
          </div>

          {(clock.elements || []).length === 0 ? (
            <div className="text-center py-12 bg-base-200 rounded-lg">
              <p className="text-base-content/40 text-sm">No elements yet. Add categories, imaging, and other elements to build your clock.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {clock.elements.sort((a, b) => a.position - b.position).map((el, index) => {
                const Icon = ELEMENT_ICONS[el.type] || Music;
                const typeInfo = CLOCK_ELEMENT_TYPES[el.type] || { label: el.type, color: 'bg-gray-500' };
                const cat = el.category ? categoryList.find(c => c._id === (el.category._id || el.category)) : null;

                return (
                  <div key={el._id || index} className="flex items-center gap-2 p-2 rounded-lg bg-base-200 hover:bg-base-300/50 group">
                    <span className="text-xs font-mono text-base-content/30 w-5 text-right">{index + 1}</span>
                    <div className="flex flex-col gap-0.5">
                      <button className="btn btn-ghost btn-xs px-0 h-3 min-h-0" onClick={() => moveElement(index, -1)} disabled={index === 0}>
                        <span className="text-[10px]">&#9650;</span>
                      </button>
                      <button className="btn btn-ghost btn-xs px-0 h-3 min-h-0" onClick={() => moveElement(index, 1)} disabled={index === clock.elements.length - 1}>
                        <span className="text-[10px]">&#9660;</span>
                      </button>
                    </div>
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-white ${typeInfo.color}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {el.label || cat?.name || typeInfo.label}
                        </span>
                        {cat && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: cat.color, color: 'white' }}>
                            {cat.code}
                          </span>
                        )}
                        <span className="badge badge-xs badge-outline">{typeInfo.label}</span>
                      </div>
                    </div>
                    <input
                      className="input input-bordered input-xs w-20 text-right font-mono"
                      value={formatDuration(el.estimatedDuration)}
                      onChange={e => updateElement(index, 'estimatedDuration', parseDuration(e.target.value))}
                      placeholder="0:00"
                      title="Estimated duration"
                    />
                    {clock.flowType === 'natural-flow' && (
                      <label className="flex items-center gap-1 cursor-pointer" title={el.isPinned ? 'Pinned (fixed)' : 'Unpinned (floats)'}>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={el.isPinned}
                          onChange={e => updateElement(index, 'isPinned', e.target.checked)}
                        />
                        <span className="text-xs text-base-content/40">Pin</span>
                      </label>
                    )}
                    <button className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100"
                      onClick={() => removeElement(index)}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clock Pie View (simplified visual) */}
        <div className="w-72 shrink-0">
          <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-3">Clock View</h2>
          <div className="bg-base-200 rounded-lg p-4">
            <div className="relative w-56 h-56 mx-auto">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="none" stroke="oklch(var(--b3))" strokeWidth="2" />
                {/* Hour markers */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 30 - 90) * Math.PI / 180;
                  const x1 = 100 + 88 * Math.cos(angle);
                  const y1 = 100 + 88 * Math.sin(angle);
                  const x2 = 100 + 95 * Math.cos(angle);
                  const y2 = 100 + 95 * Math.sin(angle);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(var(--bc))" strokeWidth="1" opacity="0.3" />;
                })}
                {/* Element segments */}
                {(() => {
                  const elements = clock.elements || [];
                  const total = totalDuration || (elements.length * 240000); // fallback: 4 min each
                  let startAngle = -90;
                  return elements.map((el, i) => {
                    const duration = el.estimatedDuration || (total / elements.length);
                    const sweep = (duration / total) * 360;
                    const cat = el.category ? categoryList.find(c => c._id === (el.category._id || el.category)) : null;
                    const color = cat?.color || CLOCK_ELEMENT_TYPES[el.type]?.color?.replace('bg-', '') || '#666';

                    const startRad = startAngle * Math.PI / 180;
                    const endRad = (startAngle + sweep) * Math.PI / 180;
                    const x1 = 100 + 85 * Math.cos(startRad);
                    const y1 = 100 + 85 * Math.sin(startRad);
                    const x2 = 100 + 85 * Math.cos(endRad);
                    const y2 = 100 + 85 * Math.sin(endRad);
                    const largeArc = sweep > 180 ? 1 : 0;
                    startAngle += sweep;

                    return (
                      <path
                        key={i}
                        d={`M 100 100 L ${x1} ${y1} A 85 85 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={cat?.color || '#666'}
                        stroke="oklch(var(--b1))"
                        strokeWidth="1"
                        opacity="0.7"
                      >
                        <title>{el.label || cat?.name || CLOCK_ELEMENT_TYPES[el.type]?.label}</title>
                      </path>
                    );
                  });
                })()}
                <circle cx="100" cy="100" r="30" fill="oklch(var(--b1))" />
                <text x="100" y="96" textAnchor="middle" className="text-[10px]" fill="oklch(var(--bc))" opacity="0.6">{clock.code}</text>
                <text x="100" y="110" textAnchor="middle" className="text-[8px]" fill="oklch(var(--bc))" opacity="0.4">{formatDuration(totalDuration)}</text>
              </svg>
            </div>
            <div className="mt-3 space-y-1">
              {(clock.elements || []).slice(0, 8).map((el, i) => {
                const cat = el.category ? categoryList.find(c => c._id === (el.category._id || el.category)) : null;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat?.color || '#666' }} />
                    <span className="truncate">{el.label || cat?.name || CLOCK_ELEMENT_TYPES[el.type]?.label}</span>
                  </div>
                );
              })}
              {(clock.elements || []).length > 8 && (
                <p className="text-xs text-base-content/40">+{clock.elements.length - 8} more</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Element Modal */}
      {showAddElement && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Element</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Type</span></label>
                <select className="select select-bordered select-sm" value={newElement.type}
                  onChange={e => {
                    setNewElement({ ...newElement, type: e.target.value, category: '', song: '', label: '' });
                    setSongQuery('');
                    setSongResults([]);
                    setSelectedSong(null);
                  }}>
                  {Object.entries(CLOCK_ELEMENT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              {['fixed', 'migrating', 'imaging'].includes(newElement.type) && (
                <div className="form-control col-span-2">
                  <label className="label"><span className="label-text">Category</span></label>
                  <div className="border border-base-300 rounded-lg p-1 max-h-48 overflow-y-auto">
                    {(() => {
                      const map = {};
                      const roots = [];
                      for (const c of categoryList) map[c._id] = { ...c, children: [] };
                      for (const c of categoryList) {
                        if (c.parent && map[c.parent]) map[c.parent].children.push(map[c._id]);
                        else roots.push(map[c._id]);
                      }
                      roots.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
                      const render = (nodes, depth = 0) => nodes.map(cat => {
                        const hasChildren = cat.children?.length > 0;
                        const selected = newElement.category === cat._id;
                        return (
                          <div key={cat._id}>
                            <button
                              className={`flex items-center gap-1.5 w-full py-1 px-2 rounded text-left text-sm ${selected ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'}`}
                              style={{ paddingLeft: `${depth * 16 + 8}px` }}
                              onClick={() => setNewElement({ ...newElement, category: cat._id, label: newElement.label || cat.name })}
                            >
                              {hasChildren
                                ? <FolderOpen className="w-3 h-3 text-base-content/50" />
                                : <Music className="w-3 h-3 text-base-content/50" />
                              }
                              <span className="truncate flex-1">{cat.name}</span>
                              <span className="font-mono text-[10px] text-base-content/30">{cat.code}</span>
                            </button>
                            {hasChildren && render(cat.children.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), depth + 1)}
                          </div>
                        );
                      });
                      return render(roots);
                    })()}
                  </div>
                </div>
              )}
              {newElement.type === 'song' && (
                <div className="form-control col-span-2">
                  <label className="label"><span className="label-text">Specific song</span></label>
                  <div className="join w-full">
                    <div className="join-item flex items-center px-2 bg-base-200"><Search className="w-3.5 h-3.5 text-base-content/40" /></div>
                    <input
                      className="input input-bordered input-sm join-item flex-1"
                      placeholder="Search title or artist..."
                      value={songQuery}
                      onChange={e => { setSongQuery(e.target.value); setSelectedSong(null); }}
                    />
                  </div>
                  <div className="mt-1 border border-base-300 rounded-lg max-h-40 overflow-y-auto">
                    {songResults.length === 0 && songQuery.trim() && (
                      <p className="text-xs text-base-content/40 p-2">No songs found</p>
                    )}
                    {songResults.map(song => (
                      <button
                        key={song._id}
                        className={`flex items-center gap-2 w-full px-2 py-1 text-left text-sm hover:bg-base-200 ${selectedSong?._id === song._id ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                        onClick={() => { setSelectedSong(song); setNewElement({ ...newElement, song: song._id, label: `${song.title} — ${song.artistDisplay || ''}` }); }}
                      >
                        <Music className="w-3 h-3 text-base-content/50" />
                        <span className="truncate flex-1">{song.title}</span>
                        <span className="text-xs text-base-content/40 truncate max-w-28">{song.artistDisplay || song.primaryArtist?.name || ''}</span>
                      </button>
                    ))}
                  </div>
                  {selectedSong && (
                    <p className="text-xs text-base-content/50 mt-1">Selected: {selectedSong.title} — {selectedSong.artistDisplay || selectedSong.primaryArtist?.name || ''}</p>
                  )}
                </div>
              )}
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Label (optional)</span></label>
                <input className="input input-bordered input-sm" value={newElement.label}
                  onChange={e => setNewElement({ ...newElement, label: e.target.value })} placeholder="Custom label" />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddElement(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={addElement}>Add</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAddElement(false)} />
        </div>
      )}
    </div>
  );
}
