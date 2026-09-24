import { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { grids, clocks as clocksApi, stations as stationsApi } from '../lib/api';
import { DAYS_SHORT } from '../lib/utils';

export default function GridsPage() {
  const [gridList, setGridList] = useState([]);
  const [clockList, setClockList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedGrid, setSelectedGrid] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [gridData, clockData, stationData] = await Promise.all([
        grids.list(selectedStation ? { station: selectedStation } : {}),
        clocksApi.list(selectedStation ? { station: selectedStation } : {}),
        stationList.length ? Promise.resolve(null) : stationsApi.list(),
      ]);
      setGridList(gridData);
      setClockList(clockData);
      if (stationData) setStationList(stationData);
      if (gridData.length && !selectedGrid) setSelectedGrid(gridData[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedStation]);

  const handleCreateGrid = async () => {
    const name = prompt('Grid name:', 'Regular Week');
    if (!name) return;
    const stationId = selectedStation || stationList[0]?._id;
    if (!stationId) return alert('Select a station first');
    try {
      const grid = await grids.create({ name, station: stationId });
      setGridList([...gridList, grid]);
      setSelectedGrid(grid);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleAssignClock = async (day, hour, clockId) => {
    if (!selectedGrid) return;
    try {
      const updated = await grids.updateHour(selectedGrid._id, { day, hour, clock: clockId || null });
      setSelectedGrid(updated);
      setGridList(prev => prev.map(g => g._id === updated._id ? updated : g));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteGrid = async (grid) => {
    if (!confirm(`Delete grid "${grid.name}"?`)) return;
    try {
      await grids.delete(grid._id);
      setGridList(prev => prev.filter(g => g._id !== grid._id));
      if (selectedGrid?._id === grid._id) setSelectedGrid(null);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const getClockForHour = (day, hour) => {
    if (!selectedGrid) return null;
    const entry = selectedGrid.hours?.find(h => h.day === day && h.hour === hour);
    return entry?.clock || null;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Assignment Grids
          </h1>
          <p className="text-sm text-base-content/60 mt-1">Map clocks to each hour of the week.</p>
        </div>
        <div className="flex gap-2">
          <select className="select select-bordered select-sm" value={selectedStation}
            onChange={e => { setSelectedStation(e.target.value); setSelectedGrid(null); }}>
            <option value="">All Stations</option>
            {stationList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleCreateGrid} disabled={stationList.length === 0}>
            <Plus className="w-4 h-4" /> New Grid
          </button>
        </div>
      </div>

      {/* Grid selector tabs */}
      {gridList.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {gridList.map(grid => (
            <div key={grid._id} className="flex items-center">
              <button
                className={`btn btn-sm ${selectedGrid?._id === grid._id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedGrid(grid)}
              >
                {grid.name}
              </button>
              <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeleteGrid(grid)}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 7x24 Grid */}
      {selectedGrid ? (
        <div className="overflow-x-auto">
          <table className="table table-xs border-collapse">
            <thead>
              <tr>
                <th className="w-16 bg-base-200">Hour</th>
                {DAYS_SHORT.map(day => (
                  <th key={day} className="text-center bg-base-200 min-w-24">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 24 }).map((_, hour) => (
                <tr key={hour}>
                  <td className="font-mono text-xs bg-base-200 text-center">
                    {String(hour).padStart(2, '0')}:00
                  </td>
                  {Array.from({ length: 7 }).map((_, day) => {
                    const clock = getClockForHour(day, hour);
                    return (
                      <td key={day} className="p-0.5">
                        <select
                          className="select select-xs w-full font-mono text-xs"
                          style={clock ? { backgroundColor: clock.color + '20', borderColor: clock.color } : {}}
                          value={clock?._id || ''}
                          onChange={e => handleAssignClock(day, hour, e.target.value)}
                        >
                          <option value="">-</option>
                          {clockList.map(c => (
                            <option key={c._id} value={c._id}>{c.code}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20">
          <CalendarDays className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
          <p className="text-base-content/40">
            {gridList.length === 0
              ? 'Create a grid to start mapping clocks to hours.'
              : 'Select a grid above to edit.'
            }
          </p>
        </div>
      )}
    </div>
  );
}
