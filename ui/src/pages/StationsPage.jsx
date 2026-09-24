import { useState, useEffect } from 'react';
import { Radio, Plus, Pencil, Trash2, Building2, ChevronRight } from 'lucide-react';
import { stations } from '../lib/api';
import { slugify } from '../lib/utils';

export default function StationsPage() {
  const [stationList, setStationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', color: '#3b82f6', parentStation: '' });

  const load = async () => {
    try {
      const data = await stations.list();
      setStationList(data);
    } catch (err) {
      console.error('Failed to load stations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', color: '#3b82f6', parentStation: '' });
    setShowModal(true);
  };

  const openEdit = (station) => {
    setEditing(station);
    setForm({
      name: station.name,
      slug: station.slug,
      description: station.description || '',
      color: station.color || '#3b82f6',
      parentStation: station.parentStation?._id || station.parentStation || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...form };
      if (!data.slug) data.slug = slugify(data.name);
      if (!data.parentStation) data.parentStation = null;
      if (editing) {
        await stations.update(editing._id, data);
      } else {
        await stations.create(data);
      }
      setShowModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (station) => {
    if (!confirm(`Delete station "${station.name}"?`)) return;
    try {
      await stations.delete(station._id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // Group stations: parents first, then children under them
  const parentStations = stationList.filter(s => !s.parentStation);
  const childStations = stationList.filter(s => s.parentStation);

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Stations
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage radio stations and sub-channels. All stations share the same song database.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {stationList.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <h2 className="text-lg font-medium text-base-content/60">No stations yet</h2>
          <p className="text-sm text-base-content/40 mb-4">Create your first radio station to get started.</p>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Create Station
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {parentStations.map(station => {
            const children = childStations.filter(c =>
              (c.parentStation?._id || c.parentStation) === station._id
            );
            return (
              <div key={station._id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: station.color }}>
                      <Radio className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{station.name}</h3>
                      <p className="text-xs text-base-content/50">{station.slug} {station.description && `- ${station.description}`}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(station)}>
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(station)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {children.length > 0 && (
                    <div className="mt-3 ml-6 grid gap-2">
                      {children.map(child => (
                        <div key={child._id} className="flex items-center gap-2 p-2 rounded-lg bg-base-100">
                          <ChevronRight className="w-3 h-3 text-base-content/30" />
                          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: child.color }}>
                            <Radio className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-medium flex-1">{child.name}</span>
                          <span className="text-xs text-base-content/40">{child.slug}</span>
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(child)}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(child)}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Orphan child stations (parent deleted) */}
          {childStations
            .filter(c => !parentStations.find(p => p._id === (c.parentStation?._id || c.parentStation)))
            .map(station => (
              <div key={station._id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: station.color }}>
                      <Radio className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{station.name}</h3>
                      <p className="text-xs text-base-content/50">{station.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(station)}>
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(station)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{editing ? 'Edit Station' : 'New Station'}</h3>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Name</span></label>
              <input
                className="input input-bordered input-sm"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
                placeholder="e.g., Radio 538"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Slug</span></label>
              <input
                className="input input-bordered input-sm"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g., radio-538"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Description</span></label>
              <input
                className="input input-bordered input-sm"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Parent Station</span></label>
              <select
                className="select select-bordered select-sm"
                value={form.parentStation}
                onChange={e => setForm({ ...form, parentStation: e.target.value })}
              >
                <option value="">None (main station)</option>
                {stationList
                  .filter(s => !s.parentStation && s._id !== editing?._id)
                  .map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))
                }
              </select>
            </div>
            <div className="form-control mt-2">
              <label className="label"><span className="label-text">Color</span></label>
              <input
                type="color"
                className="w-12 h-8 rounded cursor-pointer"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
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
