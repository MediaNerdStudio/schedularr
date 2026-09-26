import { useState, useEffect, useRef, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { CalendarDays, Plus, Trash2, Copy, ClipboardPaste, X, Check, Star, Calendar } from 'lucide-react';
import { grids, clocks as clocksApi, stations as stationsApi } from '../lib/api';
import { DAYS_SHORT } from '../lib/utils';

export default function GridsPage() {
  const [gridList, setGridList] = useState([]);
  const [clockList, setClockList] = useState([]);
  const [stationList, setStationList] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedGrid, setSelectedGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', type: 'default', periodStart: '', periodEnd: '', isActive: true,
  });

  // Excel-like cell selection
  const [anchorCell, setAnchorCell] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [copyBuffer, setCopyBuffer] = useState(null);
  const gridApiRef = useRef(null);
  const selectedCellsRef = useRef(selectedCells);

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
      if (gridData.length && !selectedGrid) {
        setSelectedGrid(gridData[0]);
      } else if (!gridData.length) {
        setSelectedGrid(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedStation]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(document.documentElement.dataset.theme === 'dark' || media.matches);
    update();
    media.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    selectedCellsRef.current = selectedCells;
    gridApiRef.current?.refreshCells({ force: true });
  }, [selectedCells]);

  // Global copy/paste listener
  useEffect(() => {
    const handleKey = (e) => {
      if (!selectedGrid || selectedCells.size === 0) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelection();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copyBuffer != null) {
        e.preventDefault();
        pasteSelection();
      }
      if (e.key === 'Escape') {
        setSelectedCells(new Set());
        setAnchorCell(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedGrid, selectedCells, copyBuffer, clockList]);

  const getClockForHour = (day, hour) => {
    if (!selectedGrid) return null;
    const entry = selectedGrid.hours?.find(h => h.day === day && h.hour === hour);
    return entry?.clock || null;
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

  const handleBulkAssign = async (assignments) => {
    if (!selectedGrid || assignments.length === 0) return;
    try {
      const updated = await grids.updateHoursBulk(selectedGrid._id, assignments);
      setSelectedGrid(updated);
      setGridList(prev => prev.map(g => g._id === updated._id ? updated : g));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleCreateGrid = async () => {
    const stationId = selectedStation || stationList[0]?._id;
    if (!stationId) return alert('Select a station first');
    const payload = {
      name: createForm.name,
      station: stationId,
      isActive: createForm.isActive,
    };
    if (createForm.type === 'period') {
      payload.periodStart = createForm.periodStart ? new Date(createForm.periodStart).toISOString() : null;
      payload.periodEnd = createForm.periodEnd ? new Date(createForm.periodEnd).toISOString() : null;
    }
    try {
      const grid = await grids.create(payload);
      setGridList([...gridList, grid]);
      setSelectedGrid(grid);
      setShowCreateModal(false);
      setCreateForm({ name: '', type: 'default', periodStart: '', periodEnd: '', isActive: true });
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteGrid = async (grid) => {
    if (!confirm(`Delete grid "${grid.name}"?`)) return;
    try {
      await grids.delete(grid._id);
      setGridList(prev => prev.filter(g => g._id !== grid._id));
      if (selectedGrid?._id === grid._id) {
        const remaining = gridList.filter(g => g._id !== grid._id);
        setSelectedGrid(remaining[0] || null);
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleSetDefault = async (grid) => {
    try {
      const updated = await grids.setDefault(grid._id);
      setGridList(prev => prev.map(g => (g.station === updated.station ? { ...g, isDefault: false } : g)).map(g => g._id === updated._id ? updated : g));
      if (selectedGrid?._id === updated._id) setSelectedGrid(updated);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDuplicateGrid = async (grid) => {
    const name = prompt('Duplicate grid as:', `${grid.name} (Copy)`);
    if (!name) return;
    try {
      const newGrid = await grids.duplicate(grid._id, { name });
      setGridList([...gridList, newGrid]);
      setSelectedGrid(newGrid);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // Cell selection helpers
  const cellKey = (day, hour) => `${day}-${hour}`;

  const rangeCells = (a, b) => {
    const minDay = Math.min(a.day, b.day);
    const maxDay = Math.max(a.day, b.day);
    const minHour = Math.min(a.hour, b.hour);
    const maxHour = Math.max(a.hour, b.hour);
    const set = new Set();
    for (let d = minDay; d <= maxDay; d++) {
      for (let h = minHour; h <= maxHour; h++) {
        set.add(cellKey(d, h));
      }
    }
    return set;
  };

  const assignmentCell = (columnId, hour) => {
    const match = /^day([0-6])$/.exec(columnId || '');
    return match ? { day: Number(match[1]), hour } : null;
  };

  const handleCellMouseDown = event => {
    const cell = assignmentCell(event.column.getColId(), event.data?.hour);
    const mouse = event.event;
    if (!cell || mouse.button !== 0) return;
    setIsSelecting(true);

    if (mouse.ctrlKey || mouse.metaKey) {
      const key = cellKey(cell.day, cell.hour);
      const next = new Set(selectedCellsRef.current);
      if (next.has(key)) next.delete(key); else next.add(key);
      setSelectedCells(next);
      setAnchorCell(cell);
      return;
    }
    if (mouse.shiftKey && anchorCell) {
      setSelectedCells(rangeCells(anchorCell, cell));
      return;
    }
    setAnchorCell(cell);
    setSelectedCells(new Set([cellKey(cell.day, cell.hour)]));
  };

  const handleCellMouseOver = event => {
    const cell = assignmentCell(event.column.getColId(), event.data?.hour);
    if (!cell || !isSelecting || event.event.buttons !== 1 || !anchorCell) return;
    setSelectedCells(rangeCells(anchorCell, cell));
  };

  const selectionBounds = () => {
    const cells = [...selectedCells].map(key => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour };
    });
    if (!cells.length) return null;
    return {
      minDay: Math.min(...cells.map(cell => cell.day)),
      maxDay: Math.max(...cells.map(cell => cell.day)),
      minHour: Math.min(...cells.map(cell => cell.hour)),
      maxHour: Math.max(...cells.map(cell => cell.hour)),
    };
  };

  const copySelection = () => {
    const bounds = selectionBounds();
    if (!bounds) return;
    const values = [];
    for (let hour = bounds.minHour; hour <= bounds.maxHour; hour++) {
      const row = [];
      for (let day = bounds.minDay; day <= bounds.maxDay; day++) {
        const clock = getClockForHour(day, hour);
        row.push(clock?._id || clock || null);
      }
      values.push(row);
    }
    setCopyBuffer({
      rows: bounds.maxHour - bounds.minHour + 1,
      columns: bounds.maxDay - bounds.minDay + 1,
      values,
    });
  };

  const pasteSelection = async () => {
    const bounds = selectionBounds();
    if (!bounds || !copyBuffer) return;
    const assignments = [];
    if (copyBuffer.rows === 1 && copyBuffer.columns === 1) {
      selectedCells.forEach(key => {
        const [day, hour] = key.split('-').map(Number);
        assignments.push({ day, hour, clock: copyBuffer.values[0][0] });
      });
    } else {
      for (let row = 0; row < copyBuffer.rows; row++) {
        for (let column = 0; column < copyBuffer.columns; column++) {
          const day = bounds.minDay + column;
          const hour = bounds.minHour + row;
          if (day <= 6 && hour <= 23) assignments.push({ day, hour, clock: copyBuffer.values[row][column] });
        }
      }
      setSelectedCells(rangeCells(
        { day: bounds.minDay, hour: bounds.minHour },
        { day: Math.min(6, bounds.minDay + copyBuffer.columns - 1), hour: Math.min(23, bounds.minHour + copyBuffer.rows - 1) },
      ));
    }
    await handleBulkAssign(assignments);
  };

  const clockMap = useMemo(() => new Map(clockList.map(clock => [clock._id, clock])), [clockList]);

  const assignmentRows = useMemo(() => Array.from({ length: 24 }, (_, hour) => {
    const row = { hour, hourLabel: `${String(hour).padStart(2, '0')}:00` };
    for (let day = 0; day < 7; day++) {
      const entry = selectedGrid?.hours?.find(item => item.day === day && item.hour === hour);
      row[`day${day}`] = entry?.clock?._id || entry?.clock || '';
    }
    return row;
  }), [selectedGrid]);

  const assignmentColumns = useMemo(() => [
    {
      headerName: 'Hour',
      field: 'hourLabel',
      pinned: 'left',
      editable: false,
      sortable: false,
      width: 76,
      suppressMovable: true,
      cellClass: 'font-mono text-center bg-base-200',
    },
    ...DAYS_SHORT.map((dayName, day) => ({
      headerName: dayName,
      field: `day${day}`,
      colId: `day${day}`,
      flex: 1,
      minWidth: 110,
      sortable: false,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...clockList.map(clock => clock._id)],
        formatValue: value => clockMap.get(value)?.code || '-',
      },
      valueFormatter: params => clockMap.get(params.value)?.code || '-',
      cellClassRules: {
        'assignment-cell-selected': params => selectedCellsRef.current.has(cellKey(day, params.data.hour)),
      },
      cellStyle: params => {
        const clock = clockMap.get(params.value);
        return clock ? { backgroundColor: `${clock.color}20`, borderColor: clock.color } : null;
      },
    })),
  ], [clockList, clockMap]);

  const handleCellValueChanged = event => {
    const cell = assignmentCell(event.column.getColId(), event.data?.hour);
    if (!cell || event.newValue === event.oldValue) return;
    handleAssignClock(cell.day, cell.hour, event.newValue);
  };

  const formatPeriod = (grid) => {
    if (!grid.periodStart || !grid.periodEnd) return null;
    const start = new Date(grid.periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const end = new Date(grid.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${start} - ${end}`;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Assignment Grids
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Map clocks to each hour of the week. Period grids override the default grid during their date range.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="select select-bordered select-sm bg-base-100 text-base-content" value={selectedStation}
            onChange={e => { setSelectedStation(e.target.value); setSelectedGrid(null); setSelectedCells(new Set()); }}>
            <option className="bg-base-100 text-base-content" value="">All Stations</option>
            {stationList.map(s => <option className="bg-base-100 text-base-content" key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)} disabled={stationList.length === 0}>
            <Plus className="w-4 h-4" /> New Grid
          </button>
        </div>
      </div>

      {/* Grid selector tabs */}
      {gridList.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          {gridList.map(grid => (
            <div key={grid._id} className={`flex items-center gap-1 rounded-lg border px-2 py-1 ${selectedGrid?._id === grid._id ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100'}`}>
              <button
                className={`btn btn-sm ${selectedGrid?._id === grid._id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSelectedGrid(grid); setSelectedCells(new Set()); }}
              >
                {grid.name}
              </button>
              {grid.isDefault && <span className="badge badge-xs badge-primary gap-0.5"><Star className="w-2.5 h-2.5" /> Default</span>}
              {grid.periodStart && <span className="badge badge-xs badge-secondary gap-0.5"><Calendar className="w-2.5 h-2.5" /> {formatPeriod(grid)}</span>}
              {!grid.isActive && <span className="badge badge-xs badge-ghost">Inactive</span>}
              <div className="dropdown dropdown-end">
                <button className="btn btn-ghost btn-xs px-1" tabIndex={0}>
                  <span className="text-xs">…</span>
                </button>
                <ul tabIndex={0} className="dropdown-content z-30 menu menu-xs p-1 shadow bg-base-100 rounded-lg w-36 border border-base-300">
                  {!grid.periodStart && !grid.isDefault && (
                    <li><button onClick={() => handleSetDefault(grid)}><Star className="w-3 h-3" /> Set as default</button></li>
                  )}
                  <li><button onClick={() => handleDuplicateGrid(grid)}><Copy className="w-3 h-3" /> Duplicate</button></li>
                  <li><button className="text-error" onClick={() => handleDeleteGrid(grid)}><Trash2 className="w-3 h-3" /> Delete</button></li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selection toolbar */}
      {selectedGrid && (
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="text-base-content/50">
            {selectedCells.size > 0 ? `${selectedCells.size} cells selected` : 'Drag to select a range; double-click or press Enter to edit a clock'}
          </span>
          {selectedCells.size > 0 && (
            <>
              <button className="btn btn-xs btn-ghost gap-1" onClick={copySelection} disabled={!anchorCell}>
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button className="btn btn-xs btn-ghost gap-1" onClick={pasteSelection} disabled={copyBuffer == null}>
                <ClipboardPaste className="w-3 h-3" /> Paste
              </button>
              <button className="btn btn-xs btn-ghost gap-1" onClick={() => { setSelectedCells(new Set()); setAnchorCell(null); }}>
                <X className="w-3 h-3" /> Clear
              </button>
            </>
          )}
          {copyBuffer != null && (
            <span className="text-base-content/40 ml-2">
              Copied: {copyBuffer.rows} × {copyBuffer.columns} cells
            </span>
          )}
        </div>
      )}

      {/* 7x24 Grid */}
      {selectedGrid ? (
        <div
          className={`flex-1 min-h-0 border border-base-300 rounded-lg overflow-hidden assignment-grid ${isDark ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}`}
          onMouseUp={() => setIsSelecting(false)}
          onMouseLeave={() => setIsSelecting(false)}
        >
          <AgGridReact
            theme="legacy"
            rowData={assignmentRows}
            columnDefs={assignmentColumns}
            defaultColDef={{ resizable: true }}
            getRowId={params => String(params.data.hour)}
            rowHeight={30}
            headerHeight={32}
            stopEditingWhenCellsLoseFocus={true}
            suppressRowClickSelection={true}
            onGridReady={event => { gridApiRef.current = event.api; }}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseOver={handleCellMouseOver}
            onCellValueChanged={handleCellValueChanged}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CalendarDays className="w-16 h-16 mx-auto text-base-content/20 mb-4" />
            <p className="text-base-content/40">
              {gridList.length === 0
                ? 'Create a grid to start mapping clocks to hours.'
                : 'Select a grid above to edit.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Create grid modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">New Assignment Grid</h3>
            <div className="space-y-3 mt-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Name</span></label>
                <input className="input input-bordered input-sm" placeholder="e.g. Christmas Schedule"
                  value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Grid type</span></label>
                <div className="flex gap-2">
                  <button
                    className={`btn btn-sm flex-1 ${createForm.type === 'default' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCreateForm({ ...createForm, type: 'default' })}
                  >
                    Default
                  </button>
                  <button
                    className={`btn btn-sm flex-1 ${createForm.type === 'period' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setCreateForm({ ...createForm, type: 'period' })}
                  >
                    Scheduled Period
                  </button>
                </div>
              </div>
              {createForm.type === 'period' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label"><span className="label-text">Start date</span></label>
                    <input type="date" className="input input-bordered input-sm"
                      value={createForm.periodStart} onChange={e => setCreateForm({ ...createForm, periodStart: e.target.value })} />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">End date</span></label>
                    <input type="date" className="input input-bordered input-sm"
                      value={createForm.periodEnd} onChange={e => setCreateForm({ ...createForm, periodEnd: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Active</span>
                  <input type="checkbox" className="checkbox checkbox-sm"
                    checked={createForm.isActive} onChange={e => setCreateForm({ ...createForm, isActive: e.target.checked })} />
                </label>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreateGrid} disabled={!createForm.name}>
                <Check className="w-4 h-4" /> Create
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
        </div>
      )}
    </div>
  );
}
