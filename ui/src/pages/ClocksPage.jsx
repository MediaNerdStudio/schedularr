import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Plus, Pencil, Trash2, Copy, Radio } from 'lucide-react';
import { clocks, stations } from '../lib/api';

export default function ClocksPage() {
  const navigate = useNavigate();
  const [clockList, setClockList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', station: '', description: '', color: '#3b82f6', flowType: 'fixed' });

  const load = async () => {
    try {
      const [clockData, stationData] = await Promise.all([
        clocks.list(selectedStation ? { station: selectedStation } : {}),
        stationList.length ? Promise.resolve(null) : stations.list(),
      ]);
      setClockList(clockData);
      if (stationData) setStationList(stationData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedStation]);

  const openCreate = () => {
    setForm({ name: '', code: '', station: selectedStation || stationList[0]?._id || '', description: '', color: '#3b82f6', flowType: 'fixed' });
    setShowModal(true);
  };

  const handleCreate = async () => {
    try {
      const clock = await clocks.create(form);
      setShowModal(false);
      navigate(`/clocks/${clock._id}`);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDuplicate = async (clock) => {
    try {
      const name = prompt('Name for the copy:', `${clock.name} (copy)`);
      if (!name) return;
      const code = prompt('Code for the copy:', `${clock.code}C`);
      if (!code) return;
      await clocks.duplicate(clock._id, { name, code });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (clock) => {
    if (!confirm(`Delete clock "${clock.name}"?`)) return;
    try {
      await clocks.delete(clock._id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Clocks
          </h1>
          <p className="text-sm text-base-content/60 mt-1">Hour templates that define the format of each broadcast hour.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={selectedStation}
            onChange={e => setSelectedStation(e.target.value)}
          >
            <option value="">All Stations</option>
            {stationList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openCreate} disabled={stationList.length === 0}>
            <Plus className="w-4 h-4" /> New Clock
          </button>
        </div>
      </div>

      {stationList.length === 0 ? (
        <div className="alert alert-warning">Create a station first before adding clocks.</div>
      ) : clockList.length === 0 ? (
        <div className="text-center py-20">
          <Clock className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <h2 className="text-lg font-medium text-base-content/60">No clocks yet</h2>
          <p className="text-sm text-base-content/40 mb-4">Clocks define the template for each broadcast hour.</p>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><Plus className="w-4 h-4" /> Create Clock</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {clockList.map(clock => (
            <div key={clock._id}
              className="flex items-center gap-3 p-3 rounded-lg bg-base-200 hover:bg-base-300/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/clocks/${clock._id}`)}
            >
              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: clock.color }}>
                <Clock className="w-4 h-4 text-white" />
              </div>
              <span className="font-mono text-sm font-bold w-16">{clock.code}</span>
              <span className="font-medium flex-1">{clock.name}</span>
              <span className="text-xs text-base-content/40 flex items-center gap-1">
                <Radio className="w-3 h-3" /> {clock.station?.name || ''}
              </span>
              <span className="badge badge-sm badge-outline">{clock.flowType}</span>
              <span className="text-xs text-base-content/40">{clock.elements?.length || 0} elements</span>
              <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); handleDuplicate(clock); }}>
                <Copy className="w-3 h-3" />
              </button>
              <button className="btn btn-ghost btn-xs text-error" onClick={e => { e.stopPropagation(); handleDelete(clock); }}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">New Clock</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">Station</span></label>
                <select className="select select-bordered select-sm" value={form.station}
                  onChange={e => setForm({ ...form, station: e.target.value })}>
                  {stationList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Code</span></label>
                <input className="input input-bordered input-sm font-mono uppercase" maxLength={6}
                  value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g., MUS01" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Music Hour A" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Flow Type</span></label>
                <select className="select select-bordered select-sm" value={form.flowType}
                  onChange={e => setForm({ ...form, flowType: e.target.value })}>
                  <option value="fixed">Fixed Position</option>
                  <option value="natural-flow">Natural Flow</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Color</span></label>
                <input type="color" className="w-12 h-8 rounded cursor-pointer"
                  value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!form.code || !form.name || !form.station}>
                Create & Edit
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
}
