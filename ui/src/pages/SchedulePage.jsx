import { useState, useEffect } from 'react';
import {
  ListMusic, Radio, ChevronLeft, ChevronRight, Music, Volume2,
  FileText, Play, Trash2, AlertTriangle, Shield, Loader2
} from 'lucide-react';
import { schedules, stations as stationsApi, grids as gridsApi } from '../lib/api';
import { formatDuration, DAYS } from '../lib/utils';
import api from '../lib/api';

export default function SchedulePage() {
  const [stationList, setStationList] = useState([]);
  const [gridList, setGridList] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedGrid, setSelectedGrid] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [expandedHour, setExpandedHour] = useState(null);
  const [scheduleRange, setScheduleRange] = useState({ startHour: 0, endHour: 23 });
  const [lastStats, setLastStats] = useState(null);

  useEffect(() => {
    stationsApi.list().then(data => {
      setStationList(data);
      if (data.length) setSelectedStation(data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    gridsApi.list({ station: selectedStation }).then(data => {
      setGridList(data);
      if (data.length) setSelectedGrid(data[0]._id);
    });
  }, [selectedStation]);

  const loadSchedule = () => {
    if (!selectedStation) return;
    setLoading(true);
    schedules.list({
      station: selectedStation,
      startDate: selectedDate,
      endDate: selectedDate,
    }).then(data => {
      setHours(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadSchedule(); }, [selectedStation, selectedDate]);

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleRunScheduler = async () => {
    if (!selectedStation) return;
    setScheduling(true);
    setLastStats(null);
    try {
      const result = await api.post('/schedules/run', {
        stationId: selectedStation,
        date: selectedDate,
        startHour: scheduleRange.startHour,
        endHour: scheduleRange.endHour,
        gridId: selectedGrid || undefined,
      }).then(r => r.data);

      setLastStats(result.stats);
      loadSchedule();
    } catch (err) {
      alert(`Scheduler error: ${err.response?.data?.error || err.message}`);
    } finally {
      setScheduling(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!confirm('Clear all scheduled hours for this date?')) return;
    try {
      await api.post('/schedules/clear', {
        stationId: selectedStation,
        date: selectedDate,
      }).then(r => r.data);
      loadSchedule();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const jsDay = new Date(selectedDate + 'T12:00:00').getDay();
  const dayName = DAYS[jsDay === 0 ? 6 : jsDay - 1];

  const scheduledCount = hours.filter(h => h.status === 'scheduled' || h.status === 'edited').length;
  const totalSongs = hours.reduce((s, h) => s + (h.items?.filter(i => i.type === 'song').length || 0), 0);
  const formatStartTime = value => value
    ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-primary" />
            Schedule
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {scheduledCount} hours scheduled, {totalSongs} songs
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="select select-bordered select-sm" value={selectedStation}
            onChange={e => setSelectedStation(e.target.value)}>
            {stationList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <div className="join">
            <button className="btn btn-sm btn-ghost join-item" onClick={() => changeDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input className="input input-bordered input-sm join-item w-36" type="date"
              value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            <button className="btn btn-sm btn-ghost join-item" onClick={() => changeDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>
            Today
          </button>
        </div>
      </div>

      {/* Scheduler Controls */}
      <div className="bg-base-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-base-content/60">Grid:</label>
            <select className="select select-bordered select-xs" value={selectedGrid}
              onChange={e => setSelectedGrid(e.target.value)}>
              <option value="">Auto</option>
              {gridList.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-base-content/60">Hours:</label>
            <input className="input input-bordered input-xs w-14" type="number" min={0} max={23}
              value={scheduleRange.startHour}
              onChange={e => setScheduleRange(r => ({ ...r, startHour: Number(e.target.value) }))} />
            <span className="text-xs">to</span>
            <input className="input input-bordered input-xs w-14" type="number" min={0} max={23}
              value={scheduleRange.endHour}
              onChange={e => setScheduleRange(r => ({ ...r, endHour: Number(e.target.value) }))} />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRunScheduler}
            disabled={scheduling || !selectedStation || gridList.length === 0}
          >
            {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scheduling ? 'Scheduling...' : 'Run Scheduler'}
          </button>
          <button className="btn btn-ghost btn-sm text-error" onClick={handleClearSchedule}
            disabled={hours.length === 0}>
            <Trash2 className="w-4 h-4" /> Clear
          </button>
          {lastStats && (
            <div className="text-xs text-base-content/60 flex gap-3">
              <span>Songs: {lastStats.totalSongs}</span>
              <span>Violations: {lastStats.totalViolations}</span>
              <span>Empty: {lastStats.unscheduledPositions}</span>
            </div>
          )}
        </div>
        {gridList.length === 0 && (
          <p className="text-xs text-warning mt-2">No grids found for this station. Create a grid and assign clocks before scheduling.</p>
        )}
      </div>

      <p className="text-sm text-base-content/60 mb-4 font-medium">
        {dayName}, {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {loading ? (
        <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>
      ) : (
        <div className="space-y-1">
          {Array.from({ length: 24 }).map((_, hourNum) => {
            const hourData = hours.find(h => h.hour === hourNum);
            const items = hourData?.items || [];
            const isExpanded = expandedHour === hourNum;
            const totalDur = items.reduce((s, i) => s + (i.duration || 0), 0);
            const violationCount = items.reduce((s, i) => s + (i.ruleViolations?.length || 0), 0);

            return (
              <div key={hourNum} className="bg-base-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-base-300/50"
                  onClick={() => setExpandedHour(isExpanded ? null : hourNum)}
                >
                  <span className="font-mono text-sm font-bold w-12">
                    {String(hourNum).padStart(2, '0')}:00
                  </span>
                  {hourData?.clock && (
                    <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: hourData.clock.color || '#666' }}>
                      {hourData.clock.code}
                    </span>
                  )}
                  <div className="flex-1 flex items-center gap-2">
                    {items.length > 0 ? (
                      <>
                        <span className="text-xs text-base-content/50">
                          {items.filter(i => i.type === 'song').length} songs
                        </span>
                        <span className="text-xs text-base-content/30">|</span>
                        <span className="text-xs text-base-content/40">{formatDuration(totalDur)}</span>
                        {violationCount > 0 && (
                          <span className="badge badge-xs badge-warning gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {violationCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-base-content/30">
                        {hourData ? 'Empty hour' : 'Not scheduled'}
                      </span>
                    )}
                  </div>
                  <span className={`badge badge-xs ${
                    hourData?.status === 'scheduled' ? 'badge-success' :
                    hourData?.status === 'reconciled' ? 'badge-info' :
                    hourData?.status === 'edited' ? 'badge-warning' :
                    'badge-ghost'
                  }`}>
                    {hourData?.status || 'empty'}
                  </span>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3">
                    {items.length === 0 ? (
                      <p className="text-xs text-base-content/30 py-4 text-center">
                        No items scheduled for this hour.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded border border-base-300/60">
                        <div className="min-w-[1080px]">
                          <div className="grid grid-cols-[74px_64px_34px_minmax(190px,1.5fr)_minmax(150px,1fr)_130px_100px_110px_42px] gap-2 px-2 py-1.5 bg-base-300/40 text-[10px] font-semibold uppercase tracking-wide text-base-content/40">
                            <span>Start</span>
                            <span>Duration</span>
                            <span>Icon</span>
                            <span>Title</span>
                            <span>Artist</span>
                            <span>Category</span>
                            <span>Omni Title ID</span>
                            <span>Omni ItemCode</span>
                            <span />
                          </div>
                          {items.sort((a, b) => a.position - b.position).map((item, i) => {
                            const category = item.category || item.song?.categoryAssignments?.[0]?.category;
                            const categoryColor = category?.color || category?.parent?.color || '#6b7280';
                            const categoryLabel = category?.parent?.name ? `${category.parent.name} | ${category.name}` : category?.name;
                            const artwork = item.song?.artwork;
                            return (
                              <div key={item._id || i} className="grid grid-cols-[74px_64px_34px_minmax(190px,1.5fr)_minmax(150px,1fr)_130px_100px_110px_42px] gap-2 items-center px-2 py-1.5 border-t border-base-300/40 hover:bg-base-100">
                                <span className="text-xs font-mono text-base-content/60">{formatStartTime(item.estimatedStartTime)}</span>
                                <span className="text-xs font-mono text-base-content/50">{formatDuration(item.duration)}</span>
                                <span className="w-6 h-6 rounded overflow-hidden flex items-center justify-center bg-base-300">
                                  {artwork ? (
                                    <img src={artwork} alt="" className="w-full h-full object-cover" />
                                  ) : item.type === 'song' ? (
                                    <Music className="w-3.5 h-3.5 text-blue-400" />
                                  ) : item.type === 'imaging' ? (
                                    <Volume2 className="w-3.5 h-3.5 text-green-400" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </span>
                                <span className="text-sm font-medium truncate" title={item.title || item.text || item.type}>
                                  {item.title || item.text || item.type}
                                </span>
                                <span className="text-xs text-base-content/60 truncate" title={item.artist || item.song?.artistDisplay || ''}>
                                  {item.artist || item.song?.artistDisplay || ''}
                                </span>
                                <span className="truncate">
                                  {category ? (
                                    <span className="inline-flex max-w-full text-xs px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: categoryColor }} title={categoryLabel}>
                                      <span className="truncate">{categoryLabel}</span>
                                    </span>
                                  ) : <span className="text-base-content/20">—</span>}
                                </span>
                                <span className="text-xs font-mono text-base-content/50 truncate" title={item.song?.externalIds?.omniTitleId || ''}>
                                  {item.song?.externalIds?.omniTitleId || '—'}
                                </span>
                                <span className="text-xs font-mono text-base-content/50 truncate" title={item.song?.externalIds?.omniItemCode || ''}>
                                  {item.song?.externalIds?.omniItemCode || '—'}
                                </span>
                                <span>
                                  {item.ruleViolations?.length > 0 && (
                                    <div className="dropdown dropdown-end dropdown-hover">
                                      <div tabIndex={0} className="badge badge-xs badge-warning cursor-help gap-0.5">
                                        {item.ruleViolations.some(v => v.severity === 'unbreakable')
                                          ? <Shield className="w-2.5 h-2.5" />
                                          : <AlertTriangle className="w-2.5 h-2.5" />
                                        }
                                        {item.ruleViolations.length}
                                      </div>
                                      <div tabIndex={0} className="dropdown-content z-20 shadow bg-base-100 rounded-lg p-2 w-72">
                                        {item.ruleViolations.map((v, vi) => (
                                          <div key={vi} className="text-xs py-1 flex gap-2">
                                            <span className={`badge badge-xs ${v.severity === 'unbreakable' ? 'badge-error' : 'badge-warning'}`}>
                                              {v.severity === 'unbreakable' ? 'UNB' : 'BRK'}
                                            </span>
                                            <div>
                                              <strong>{v.ruleName}</strong>
                                              <p className="text-base-content/50">{v.description}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
