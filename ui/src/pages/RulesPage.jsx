import { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { rules, categories as categoriesApi, stations as stationsApi } from '../lib/api';

const RULE_TYPES = [
  { group: 'Song History', types: [
    ['song-minimum-rest', 'Minimum Rest'],
    ['song-maximum-rest', 'Maximum Rest'],
    ['song-max-plays-per-day', 'Max Plays/Day'],
    ['song-no-repeat', 'No Repeat'],
    ['song-same-hour-separation', 'Same Hour Separation'],
    ['song-yesterday-offset', 'Yesterday Offset'],
    ['song-friday-monday-offset', 'Fri-Mon Offset'],
  ]},
  { group: 'Artist', types: [
    ['artist-primary-separation', 'Primary Artist Sep.'],
    ['artist-secondary-separation', 'Secondary Artist Sep.'],
    ['artist-same-hour-separation', 'Same Hour Separation'],
    ['artist-max-plays-per-day', 'Max Plays/Day'],
  ]},
  { group: 'Title/CD', types: [
    ['title-separation', 'Title Separation'],
    ['cd-separation', 'CD Separation'],
  ]},
  { group: 'Property', types: [
    ['property-max-in-row', 'Max in Row'],
    ['property-min-per-hour', 'Min per Hour'],
    ['property-max-per-hour', 'Max per Hour'],
  ]},
  { group: 'Flow', types: [
    ['mood-flow', 'Mood Flow'],
    ['energy-flow', 'Energy Flow'],
    ['tempo-flow', 'Tempo Flow'],
  ]},
  { group: 'Keyword', types: [
    ['keyword-separation', 'Keyword Separation'],
  ]},
];

export default function RulesPage() {
  const [ruleList, setRuleList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'song-minimum-rest', station: '', category: '',
    isBreakable: true, priority: 50, params: { separation: 0 },
  });

  const load = async () => {
    try {
      const [ruleData, catData, stationData] = await Promise.all([
        rules.list(), categoriesApi.list(), stationsApi.list(),
      ]);
      setRuleList(ruleData);
      setCategoryList(catData);
      setStationList(stationData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', type: 'song-minimum-rest', station: '', category: '',
      isBreakable: true, priority: 50, params: { separation: 60 },
    });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name, type: rule.type,
      station: rule.station?._id || rule.station || '',
      category: rule.category?._id || rule.category || '',
      isBreakable: rule.isBreakable, priority: rule.priority,
      params: { ...rule.params },
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...form };
      if (!data.station) data.station = null;
      if (!data.category) data.category = null;
      if (editing) {
        await rules.update(editing._id, data);
      } else {
        await rules.create(data);
      }
      setShowModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (rule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await rules.delete(rule._id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const getTypeName = (type) => {
    for (const group of RULE_TYPES) {
      const found = group.types.find(([t]) => t === type);
      if (found) return found[1];
    }
    return type;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Rules
          </h1>
          <p className="text-sm text-base-content/60 mt-1">Scheduling rules control separation, rotation, and flow.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus className="w-4 h-4" /> Add Rule</button>
      </div>

      {ruleList.length === 0 ? (
        <div className="text-center py-20">
          <Shield className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <h2 className="text-lg font-medium text-base-content/60">No rules yet</h2>
          <p className="text-sm text-base-content/40 mb-4">Rules define constraints for the scheduling engine.</p>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus className="w-4 h-4" /> Create Rule</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {ruleList.map(rule => (
            <div key={rule._id} className="flex items-center gap-3 p-3 rounded-lg bg-base-200">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${rule.isBreakable ? 'bg-amber-500' : 'bg-red-500'}`}>
                {rule.isBreakable
                  ? <AlertTriangle className="w-4 h-4 text-white" />
                  : <Shield className="w-4 h-4 text-white" />
                }
              </div>
              <div className="flex-1">
                <span className="font-medium">{rule.name}</span>
                <span className="text-xs text-base-content/40 ml-2">{getTypeName(rule.type)}</span>
              </div>
              {rule.category && (
                <span className="text-xs px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: rule.category.color || '#666' }}>
                  {rule.category.code || 'ALL'}
                </span>
              )}
              {rule.station && (
                <span className="text-xs text-base-content/40">{rule.station.name}</span>
              )}
              <span className="badge badge-sm">{rule.isBreakable ? 'Breakable' : 'Unbreakable'}</span>
              <span className="text-xs text-base-content/40">P{rule.priority}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => openEdit(rule)}><Pencil className="w-3 h-3" /></button>
              <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(rule)}><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">{editing ? 'Edit Rule' : 'New Rule'}</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Gold Song Separation" />
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Rule Type</span></label>
                <select className="select select-bordered select-sm" value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}>
                  {RULE_TYPES.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.types.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Station</span></label>
                <select className="select select-bordered select-sm" value={form.station}
                  onChange={e => setForm({ ...form, station: e.target.value })}>
                  <option value="">All Stations</option>
                  {stationList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Category</span></label>
                <select className="select select-bordered select-sm" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">All Categories</option>
                  {categoryList.map(c => <option key={c._id} value={c._id}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Severity</span></label>
                <select className="select select-bordered select-sm" value={form.isBreakable ? 'breakable' : 'unbreakable'}
                  onChange={e => setForm({ ...form, isBreakable: e.target.value === 'breakable' })}>
                  <option value="breakable">Breakable (warning)</option>
                  <option value="unbreakable">Unbreakable (blocks)</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Priority (0-100)</span></label>
                <input className="input input-bordered input-sm" type="number" min={0} max={100}
                  value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 divider text-xs">Parameters</div>
              <div className="form-control">
                <label className="label"><span className="label-text">Separation (min)</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={form.params.separation || 0}
                  onChange={e => setForm({ ...form, params: { ...form.params, separation: Number(e.target.value) } })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Max Count</span></label>
                <input className="input input-bordered input-sm" type="number"
                  value={form.params.maxCount || 0}
                  onChange={e => setForm({ ...form, params: { ...form.params, maxCount: Number(e.target.value) } })} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.name}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
}
