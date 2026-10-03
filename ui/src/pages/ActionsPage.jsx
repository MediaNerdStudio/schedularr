import { useEffect, useState } from 'react';
import { Activity, Database, CalendarDays, Clock, CheckCircle2, AlertTriangle, Loader2, Search, Upload, Sheet } from 'lucide-react';
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
  const [chartPreview, setChartPreview] = useState(null);
  const [chartResult, setChartResult] = useState(null);
  const [chartError, setChartError] = useState(null);
  const [sheetPreview, setSheetPreview] = useState(null);
  const [sheetResult, setSheetResult] = useState(null);
  const [sheetError, setSheetError] = useState(null);

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

  const previewChartSync = async () => {
    setWorking('chart-preview');
    setChartPreview(null);
    setChartResult(null);
    setChartError(null);
    try {
      const response = await api.post('/actions/westradio-charts/preview');
      setChartPreview(response.data);
    } catch (requestError) {
      setChartError(requestError.response?.data?.error || requestError.message);
    } finally {
      setWorking('');
    }
  };

  const runChartSync = async () => {
    if (!chartPreview) return;
    const confirmed = confirm(
      `Apply the latest Top 40 and Tipparade categories?\n\n` +
      `${chartPreview.activateTop40} songs → Hits | Top 40\n` +
      `${chartPreview.activateTipparade} songs → Hits | Tipparade\n` +
      `${chartPreview.releaseToDecades} exiting songs → decade | A Rotation`,
    );
    if (!confirmed) return;
    setWorking('chart-sync');
    setChartError(null);
    try {
      const response = await api.post('/actions/westradio-charts/sync', { confirm: true });
      setChartResult(response.data);
      setChartPreview(null);
    } catch (requestError) {
      setChartError(requestError.response?.data?.error || requestError.message);
    } finally {
      setWorking('');
    }
  };

  const previewSheetSync = async () => {
    setWorking('sheet-preview');
    setSheetPreview(null);
    setSheetResult(null);
    setSheetError(null);
    try {
      const response = await api.post('/actions/google-sheet/preview');
      setSheetPreview(response.data);
    } catch (requestError) {
      setSheetError(requestError.response?.data?.error || requestError.message);
    } finally {
      setWorking('');
    }
  };

  const runSheetSync = async () => {
    if (!sheetPreview) return;
    const confirmed = confirm(
      `Update ${sheetPreview.changed} songs from the "${sheetPreview.sheetName}" Google sheet?\n\n` +
      `Synced fields: artist, title, album, duration, year, BPM, release date, rotation labels, chart flags, Spotify/ISRC IDs, and managed properties (top40_id, npo_id, quality, version, remarks, ...).\n\n` +
      `Omni Title ID, ItemCode, and categories are never changed.`,
    );
    if (!confirmed) return;
    setWorking('sheet-sync');
    setSheetError(null);
    try {
      const response = await api.post('/actions/google-sheet/sync', { confirm: true });
      setSheetResult(response.data);
      setSheetPreview(null);
    } catch (requestError) {
      setSheetError(requestError.response?.data?.error || requestError.message);
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

      <div className="card bg-base-200 border border-base-300 shadow-sm mt-4">
        <div className="card-body p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-secondary" />
            </div>
            <div className="flex-1">
              <h2 className="card-title text-lg">WestRadio Charts Sync</h2>
              <p className="text-sm text-base-content/60">Synchronize the latest live Top 40 and Tipparade with the Hits categories using each song's <span className="font-mono">top40_id</span>.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-2 text-sm">
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Current entries</div>
              <div className="text-xs text-base-content/50 mt-1">Linked chart songs are assigned exclusively to <strong>Hits | Top 40</strong> or <strong>Hits | Tipparade</strong>.</div>
            </div>
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Exiting entries</div>
              <div className="text-xs text-base-content/50 mt-1">Songs leaving either chart move to their release-decade <strong>A Rotation</strong> category.</div>
            </div>
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Unlinked entries</div>
              <div className="text-xs text-base-content/50 mt-1">Chart entries without a matching <span className="font-mono">top40_id</span> are intentionally ignored.</div>
            </div>
          </div>

          {chartError && <div className="alert alert-error mt-2"><AlertTriangle className="w-4 h-4" /><span>{chartError}</span></div>}

          {chartPreview && (
            <div className="alert alert-info mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-sm">
                <div className="font-semibold">Chart sync preflight passed</div>
                <div className="text-xs mt-1">
                  Top 40 {chartPreview.charts.top40.year}-W{String(chartPreview.charts.top40.week).padStart(2, '0')}: {chartPreview.activateTop40}/{chartPreview.charts.top40.entries} linked ·{' '}
                  Tipparade {chartPreview.charts.tipparade.year}-W{String(chartPreview.charts.tipparade.week).padStart(2, '0')}: {chartPreview.activateTipparade}/{chartPreview.charts.tipparade.entries} linked ·{' '}
                  {chartPreview.releaseToDecades} songs leave the charts.
                </div>
              </div>
            </div>
          )}

          {chartResult && (
            <div className="alert alert-success mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Chart synchronization complete: {chartResult.updatedSongs} song assignments updated.</span>
            </div>
          )}

          <div className="card-actions justify-end mt-2">
            <button className="btn btn-ghost" onClick={previewChartSync} disabled={!!working}>
              {working === 'chart-preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Run preflight
            </button>
            <button className="btn btn-secondary" onClick={runChartSync} disabled={!chartPreview || !!working}>
              {working === 'chart-sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Sync charts
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 shadow-sm mt-4">
        <div className="card-body p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Sheet className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="card-title text-lg">Google Sheet Sync</h2>
              <p className="text-sm text-base-content/60">Update all song metadata from the <strong>All Songs</strong> Google sheet, matched by Omni Title ID. Title ID, ItemCode, and category assignments are never changed.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-2 text-sm">
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Synced fields</div>
              <div className="text-xs text-base-content/50 mt-1">Artist, title, album, duration, year, BPM, release date, rotation labels, chart flags, Spotify/ISRC IDs, and managed properties such as <span className="font-mono">top40_id</span> and <span className="font-mono">npo_id</span>.</div>
            </div>
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Never changed</div>
              <div className="text-xs text-base-content/50 mt-1">Omni Title ID, Omni ItemCode, and category assignments stay untouched.</div>
            </div>
            <div className="rounded-lg bg-base-100 border border-base-300 p-3">
              <div className="font-semibold">Matching</div>
              <div className="text-xs text-base-content/50 mt-1">Songs are matched by Omni Title ID. Deleted sheet rows and sheet rows without a match are reported, not imported.</div>
            </div>
          </div>

          {sheetError && <div className="alert alert-error mt-2"><AlertTriangle className="w-4 h-4" /><span>{sheetError}</span></div>}

          {sheetPreview && (
            <div className="alert alert-info mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-sm flex-1">
                <div className="font-semibold">Sheet sync preflight: {sheetPreview.changed} of {sheetPreview.matched} matched songs will change</div>
                <div className="text-xs mt-1">
                  {sheetPreview.rows} rows in "{sheetPreview.sheetName}" · {sheetPreview.unchanged} unchanged · {sheetPreview.skippedDeleted} deleted rows skipped · {sheetPreview.unmatchedTotal} unmatched rows · {sheetPreview.noTitleId} rows without Title ID
                  {sheetPreview.newArtists.length > 0 && ` · ${sheetPreview.newArtists.length} new artists will be created`}
                </div>
                {Object.keys(sheetPreview.fieldChanges).length > 0 && (
                  <div className="text-xs mt-1">
                    Changed fields: {Object.entries(sheetPreview.fieldChanges).map(([field, count]) => `${field} (${count})`).join(', ')}
                  </div>
                )}
                {sheetPreview.sampleChanges?.length > 0 && (
                  <div className="text-xs mt-1 max-h-32 overflow-y-auto">
                    {sheetPreview.sampleChanges.map((sample, index) => (
                      <div key={index}>{sample.song} — {sample.fields.join(', ')}</div>
                    ))}
                  </div>
                )}
                {sheetPreview.unmatchedRows?.length > 0 && (
                  <div className="text-xs mt-1">
                    Unmatched: {sheetPreview.unmatchedRows.slice(0, 10).map(row => `${row.interpret} — ${row.title} (${row.title_id})`).join('; ')}{sheetPreview.unmatchedTotal > 10 ? ' …' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {sheetResult && (
            <div className="alert alert-success mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sheet synchronization complete: {sheetResult.updated} songs updated{sheetResult.artistsCreated ? `, ${sheetResult.artistsCreated} artists created` : ''}.</span>
            </div>
          )}

          <div className="card-actions justify-end mt-2">
            <button className="btn btn-ghost" onClick={previewSheetSync} disabled={!!working}>
              {working === 'sheet-preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Run preflight
            </button>
            <button className="btn btn-accent" onClick={runSheetSync} disabled={!sheetPreview || !!working}>
              {working === 'sheet-sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Sync from sheet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
