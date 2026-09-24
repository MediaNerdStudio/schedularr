import { useState, useEffect } from 'react';
import { BarChart3, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { charts } from '../lib/api';

export default function ChartsPage() {
  const [chartList, setChartList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', maxEntries: 40, chartDate: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    try {
      const data = await charts.list();
      setChartList(data);
      if (data.length && !selectedChart) setSelectedChart(data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      const chart = await charts.create({
        ...createForm,
        chartDate: new Date(createForm.chartDate),
        entries: [],
      });
      setShowCreateModal(false);
      setChartList([chart, ...chartList]);
      setSelectedChart(chart);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDelete = async (chart) => {
    if (!confirm(`Delete chart "${chart.name}"?`)) return;
    try {
      await charts.delete(chart._id);
      setChartList(prev => prev.filter(c => c._id !== chart._id));
      if (selectedChart?._id === chart._id) setSelectedChart(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const movementIcon = (movement) => {
    switch (movement) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      case 'new': return <Star className="w-3 h-3 text-amber-500" />;
      case 'reentry': return <Star className="w-3 h-3 text-blue-500" />;
      default: return <Minus className="w-3 h-3 text-base-content/30" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Charts
          </h1>
          <p className="text-sm text-base-content/60 mt-1">Manage in-house charts and track chart performance.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> New Chart
        </button>
      </div>

      <div className="flex gap-6">
        {/* Chart list */}
        <div className="w-60 shrink-0 space-y-1">
          {chartList.map(chart => (
            <div key={chart._id}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                selectedChart?._id === chart._id ? 'bg-primary/10 border border-primary/30' : 'bg-base-200 hover:bg-base-300/50'
              }`}
              onClick={() => setSelectedChart(chart)}
            >
              <BarChart3 className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{chart.name}</p>
                <p className="text-xs text-base-content/40">{new Date(chart.chartDate).toLocaleDateString()} | {chart.entries?.length || 0} entries</p>
              </div>
              <button className="btn btn-ghost btn-xs text-error" onClick={e => { e.stopPropagation(); handleDelete(chart); }}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {chartList.length === 0 && (
            <p className="text-sm text-base-content/40 text-center py-8">No charts yet</p>
          )}
        </div>

        {/* Chart detail */}
        <div className="flex-1">
          {selectedChart ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{selectedChart.name}</h2>
                <span className="text-sm text-base-content/50">
                  Week of {new Date(selectedChart.chartDate).toLocaleDateString()}
                </span>
              </div>
              {(selectedChart.entries || []).length === 0 ? (
                <div className="text-center py-12 bg-base-200 rounded-lg">
                  <p className="text-base-content/40 text-sm">No entries in this chart yet. Add songs from the library.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th className="w-12">#</th>
                        <th className="w-8"></th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th className="w-16">Last Wk</th>
                        <th className="w-16">Peak</th>
                        <th className="w-16">Weeks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChart.entries
                        .sort((a, b) => a.rankThisWeek - b.rankThisWeek)
                        .map((entry, i) => (
                          <tr key={i}>
                            <td className="font-bold text-lg">{entry.rankThisWeek}</td>
                            <td>{movementIcon(entry.movement)}</td>
                            <td className="font-medium">{entry.song?.title || '-'}</td>
                            <td className="text-base-content/60">{entry.song?.artistDisplay || '-'}</td>
                            <td className="font-mono">{entry.rankLastWeek || 'NEW'}</td>
                            <td className="font-mono">{entry.peakPosition || '-'}</td>
                            <td className="font-mono">{entry.weeksOnChart}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <BarChart3 className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
              <p className="text-base-content/40">Select a chart to view its entries.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">New Chart</h3>
            <div className="grid gap-3 mt-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm" value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g., Top 40" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Chart Date</span></label>
                <input className="input input-bordered input-sm" type="date" value={createForm.chartDate}
                  onChange={e => setCreateForm({ ...createForm, chartDate: e.target.value })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Max Entries</span></label>
                <input className="input input-bordered input-sm" type="number" value={createForm.maxEntries}
                  onChange={e => setCreateForm({ ...createForm, maxEntries: Number(e.target.value) })} />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!createForm.name}>Create</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
        </div>
      )}
    </div>
  );
}
