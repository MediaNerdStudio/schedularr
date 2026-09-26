import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Link2, Loader2 } from 'lucide-react';
import { charts } from '../lib/api';

function periodLabel(periodType, period) {
  if (!period) return '';
  return periodType === 'week'
    ? `${period.year}-W${String(period.week).padStart(2, '0')}`
    : `${period.year} #${period.edition}`;
}

export default function ChartsPage() {
  const [chartList, setChartList] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [periodType, setPeriodType] = useState('week');
  const [periods, setPeriods] = useState([]);
  const [periodIndex, setPeriodIndex] = useState(-1);
  const [periodInput, setPeriodInput] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedChart = chartList.find(chart => chart.slug === selectedSlug);
  const selectedPeriod = periods[periodIndex];

  useEffect(() => {
    charts.list().then(data => {
      setChartList(data);
      if (data.length) setSelectedSlug(data[0].slug);
    }).catch(requestError => setError(requestError.response?.data?.error || requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    setEntries([]);
    setPeriods([]);
    setPeriodIndex(-1);
    setError('');
    charts.periods(selectedSlug).then(data => {
      setPeriodType(data.periodType);
      setPeriods(data.periods || []);
      setPeriodIndex(data.periods?.length ? 0 : -1);
    }).catch(requestError => setError(requestError.response?.data?.error || requestError.message));
  }, [selectedSlug]);

  useEffect(() => {
    setPeriodInput(periodLabel(periodType, selectedPeriod));
  }, [periodType, selectedPeriod]);

  useEffect(() => {
    if (!selectedSlug || !selectedPeriod) return;
    setEntriesLoading(true);
    setError('');
    charts.entries(selectedSlug, selectedPeriod).then(data => setEntries(data.entries || []))
      .catch(requestError => setError(requestError.response?.data?.error || requestError.message))
      .finally(() => setEntriesLoading(false));
  }, [selectedSlug, selectedPeriod]);

  const sortedEntries = useMemo(() => {
    const active = entries.filter(entry => entry.current !== 0);
    const exited = entries.filter(entry => entry.current === 0);
    return [...active, ...exited];
  }, [entries]);

  const selectPeriodLabel = value => {
    const index = periods.findIndex(period => periodLabel(periodType, period) === value);
    if (index >= 0) setPeriodIndex(index);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6 h-full min-h-0 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Charts
        </h1>
        <p className="text-sm text-base-content/60 mt-1">Live chart data from WatHoordeIk. Charts are not copied into the Schedularr database.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chartList.map(chart => (
          <button
            key={chart.slug}
            className={`btn btn-sm h-auto min-h-12 px-4 ${selectedSlug === chart.slug ? 'btn-primary' : 'btn-ghost bg-base-200 border border-base-300'}`}
            onClick={() => setSelectedSlug(chart.slug)}
          >
            <span className="flex flex-col items-start">
              <span>{chart.name}</span>
              <span className="text-[10px] opacity-60 font-normal">{chart.publisher}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-3">
          <div className="font-semibold text-sm">{periodType === 'week' ? 'Charts week selection' : 'Charts edition selection'}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/60">{periodType === 'week' ? 'Week' : 'Edition'}</span>
            <input
              className="input input-bordered input-sm bg-base-100 w-44"
              type={periodType === 'week' ? 'week' : 'text'}
              list="chart-periods"
              value={periodInput}
              onChange={event => {
                setPeriodInput(event.target.value);
                selectPeriodLabel(event.target.value);
              }}
              disabled={!periods.length}
            />
            <datalist id="chart-periods">
              {periods.map((period, index) => <option key={index} value={periodLabel(periodType, period)} />)}
            </datalist>
            <button className="btn btn-sm btn-ghost" disabled={periodIndex < 0 || periodIndex >= periods.length - 1} onClick={() => setPeriodIndex(index => index + 1)}>
              <ChevronLeft className="w-4 h-4" /> Previous {periodType === 'week' ? 'week' : 'edition'}
            </button>
            <button className="btn btn-sm btn-ghost" disabled={periodIndex <= 0} onClick={() => setPeriodIndex(index => index - 1)}>
              Next {periodType === 'week' ? 'week' : 'edition'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-base-content/40">
            {periodType === 'week' ? 'Week selection applies to Top 40 and Tipparade.' : 'Edition selection applies to this chart.'}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}

      <div className="card bg-base-200 border border-base-300 flex-1 min-h-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
          <div>
            <div className="font-bold">{selectedChart?.name || 'Chart'} {periodLabel(periodType, selectedPeriod)}</div>
            <div className="text-xs text-base-content/40">{entries.length} entries · highlighted rows are linked to Schedularr songs</div>
          </div>
          {entriesLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          <table className="table table-sm table-pin-rows">
            <thead>
              <tr>
                <th className="w-16 text-center">#</th>
                <th className="w-16 text-center">{periodType === 'week' ? 'LW' : 'LE'}</th>
                {periodType === 'week' && <th className="w-16 text-center">W</th>}
                <th>Artist</th>
                <th>Title</th>
                <th className="w-20 text-center">Link</th>
              </tr>
            </thead>
            <tbody>
              {!entriesLoading && sortedEntries.length === 0 && (
                <tr><td colSpan={periodType === 'week' ? 6 : 5} className="text-center text-base-content/40 py-12">No entries found for this selection.</td></tr>
              )}
              {sortedEntries.map((entry, index) => (
                <tr key={`${entry.sourceId || index}-${entry.current}-${entry.section}`} className={entry.linked ? 'bg-info/10' : ''}>
                  <td className="text-center font-bold">
                    {entry.current === 0 ? <span className="badge badge-error badge-sm">EXIT</span> : entry.current}
                  </td>
                  <td className="text-center font-mono">
                    {entry.last === 0 ? <span className="badge badge-success badge-sm">NEW</span> : entry.last ?? ''}
                  </td>
                  {periodType === 'week' && <td className="text-center font-mono">{entry.weeks ?? ''}</td>}
                  <td>{entry.artist || ''}</td>
                  <td className="font-medium">{entry.title || ''}</td>
                  <td className="text-center">{entry.linked && <Link2 className="w-4 h-4 text-info mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
