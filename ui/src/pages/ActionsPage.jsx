import { useEffect, useState } from 'react';
import { Activity, Database, CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Search, Upload } from 'lucide-react';
import api, { stations as stationsApi } from '../lib/api';

const today = new Date().toISOString().slice(0, 10);

export default function ActionsPage() {
  const [stationList, setStationList] = useState([]);
  const [form, setForm] = useState({
    stationId: '', mode: 'specific', date: today, fromDate: today, startHour: 0, endHour: 23,
  });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);
  const [working, setWorking] = useState('');

  useEffect(() => {
    stationsApi.list().then(stations => {
      setStationList(stations);
      if (stations.length) setForm(current => ({ ...current, stationId: stations[0]._id }));
    });
  }, []);

  const payload = () => form.mode === 'future'
    ? { stationId: form.stationId, mode: 'future', fromDate: form.fromDate }
    : {
      stationId: form.stationId,
      mode: 'specific',
      date: form.date,
      startHour: Number(form.startHour),
      endHour: Number(form.endHour),
    };

  const runPreview = async () => {
    setWorking('preview');
    setPreview(null);
    setResult(null);
    setError(null);
    setDetails([]);
    try {
      const response = await api.post('/actions/omni-duplexx/preview', payload());
      setPreview(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message);
      setDetails(requestError.response?.data?.details || []);
    } finally {
      setWorking('');
    }
  };

  const runSync = async () => {
    if (!preview) return;
    const confirmed = confirm(
      `Write ${preview.items} items across ${preview.hours} hours directly to Omni E2 Sybase?\n\n` +
      `${preview.firstHour} through ${preview.lastHour}\n\nThis database action cannot be undone from Schedularr.`,
    );
    if (!confirmed) return;
    setWorking('sync');
    setResult(null);
    setError(null);
    setDetails([]);
    try {
      const response = await api.post('/actions/omni-duplexx/sync', { ...payload(), confirm: true });
      setResult(response.data);
      setPreview(null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message);
      setDetails(requestError.response?.data?.details || []);
    } finally {
      setWorking('');
    }
  };

  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Actions
        </h1>
        <p className="text-sm text-base-content/60 mt-1">Run synchronization and integration tasks for radio automation and external services.</p>
      </div>

      <div className="card bg-base-200 border border-base-300 shadow-sm">
        <div className="card-body p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="card-title text-lg">Omni E2 Duplexx</h2>
              <p className="text-sm text-base-content/60">Write scheduled hours directly to the Omni Sybase clocks, blocks, items, and spots tables. Tracks are resolved through their Omni ItemCode.</p>
            </div>
          </div>

          <div className="divider my-2" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="form-control">
              <span className="label-text mb-1">Station</span>
              <select className="select select-bordered bg-base-100" value={form.stationId} onChange={event => update('stationId', event.target.value)}>
                {stationList.map(station => <option key={station._id} value={station._id}>{station.name}</option>)}
              </select>
            </label>

            <div className="form-control">
              <span className="label-text mb-1">Schedule selection</span>
              <div className="join">
                <button className={`btn join-item flex-1 ${form.mode === 'specific' ? 'btn-primary' : 'btn-ghost bg-base-100'}`} onClick={() => update('mode', 'specific')}>
                  <CalendarDays className="w-4 h-4" /> Specific day
                </button>
                <button className={`btn join-item flex-1 ${form.mode === 'future' ? 'btn-primary' : 'btn-ghost bg-base-100'}`} onClick={() => update('mode', 'future')}>
                  <Clock className="w-4 h-4" /> All future days
                </button>
              </div>
            </div>

            {form.mode === 'specific' ? (
              <>
                <label className="form-control">
                  <span className="label-text mb-1">Date</span>
                  <input className="input input-bordered bg-base-100" type="date" value={form.date} onChange={event => update('date', event.target.value)} />
                </label>
                <div className="form-control">
                  <span className="label-text mb-1">Hours, inclusive</span>
                  <div className="flex items-center gap-2">
                    <input className="input input-bordered bg-base-100 w-24" type="number" min="0" max="23" value={form.startHour} onChange={event => update('startHour', event.target.value)} />
                    <span className="text-base-content/40">to</span>
                    <input className="input input-bordered bg-base-100 w-24" type="number" min="0" max="23" value={form.endHour} onChange={event => update('endHour', event.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <label className="form-control">
                <span className="label-text mb-1">From date</span>
                <input className="input input-bordered bg-base-100" type="date" value={form.fromDate} onChange={event => update('fromDate', event.target.value)} />
              </label>
            )}
          </div>

          <div className="alert alert-warning text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Preflight validates ItemCodes, title mix data, counters, and existing Omni clocks. Synchronization is blocked if any selected item cannot be written safely.</span>
          </div>

          {error && (
            <div className="alert alert-error mt-2">
              <AlertTriangle className="w-4 h-4" />
              <div>
                <div className="font-semibold">{error}</div>
                {details.length > 0 && (
                  <div className="text-xs mt-1 max-h-32 overflow-y-auto">
                    {details.map((detail, index) => <div key={index}>{detail.date ? `${detail.date} ${String(detail.hour).padStart(2, '0')}:00 — ` : ''}{detail.title || detail.clock_id || ''}{detail.itemCode ? ` (${detail.itemCode})` : ''}{detail.reason ? `: ${detail.reason}` : ''}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {preview && (
            <div className="alert alert-info mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <div className="flex-1">
                <div className="font-semibold">Preflight passed</div>
                <div className="text-xs mt-1">{preview.station} → Omni radio {preview.radioId}: {preview.items} items in {preview.hours} hours across {preview.dates.length} day(s).</div>
                <div className="text-xs">{preview.firstHour} through {preview.lastHour}</div>
              </div>
            </div>
          )}

          {result && (
            <div className="alert alert-success mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <div>
                <div className="font-semibold">Omni synchronization complete</div>
                <div className="text-xs mt-1">{result.items} items in {result.hours} hours written with {result.statements} Sybase statements.</div>
              </div>
            </div>
          )}

          <div className="card-actions justify-end mt-2">
            <button className="btn btn-ghost" onClick={runPreview} disabled={!form.stationId || !!working}>
              {working === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Run preflight
            </button>
            <button className="btn btn-primary" onClick={runSync} disabled={!preview || !!working}>
              {working === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Sync to Omni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
