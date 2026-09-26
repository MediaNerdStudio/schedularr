import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Search, Columns3, X } from 'lucide-react';

const CompactGrid = forwardRef(({
  columnDefs,
  rowData,
  defaultColDef = {},
  rowSelection,
  onSelectionChanged,
  onRowClicked,
  onRowDoubleClicked,
  getRowId,
  loading,
  noRowsMessage = 'No rows',
  rowHeight = 28,
  headerHeight = 30,
  additionalActions,
  persistenceKey,
}, ref) => {
  const innerRef = useRef(null);
  const gridApiRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current, [innerRef]);

  const [isDark, setIsDark] = useState(false);
  const [quickFilter, setQuickFilter] = useState(() => persistenceKey
    ? sessionStorage.getItem(`${persistenceKey}:search`) || ''
    : '');
  const [showPicker, setShowPicker] = useState(false);
  const [gridReady, setGridReady] = useState(false);

  // Ensure every column has a stable colId for the visibility picker
  const normalizedColumns = useMemo(() => {
    return (columnDefs || []).map((col, i) => {
      if (col.colId || col.field) return col;
      const id = col.headerName
        ? String(col.headerName).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : `col-${i}`;
      return { ...col, colId: id };
    });
  }, [columnDefs]);

  // Track visibility state (skip columns with no usable id)
  const [visibility, setVisibility] = useState(() => {
    const map = {};
    normalizedColumns.forEach(col => {
      const key = col.colId || col.field;
      if (key) map[key] = col.hide !== true;
    });
    return map;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setIsDark(
      document.documentElement.dataset.theme === 'dark' || mq.matches
    );
    update();
    mq.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (gridReady && gridApiRef.current) {
      gridApiRef.current.setGridOption('quickFilterText', quickFilter);
    }
    if (persistenceKey) sessionStorage.setItem(`${persistenceKey}:search`, quickFilter);
  }, [quickFilter, gridReady, persistenceKey]);

  const onGridReady = (event) => {
    gridApiRef.current = event.api;
    setGridReady(true);
    // ensure visibility state matches current grid
    const api = event.api;
    const next = {};
    normalizedColumns.forEach(col => {
      const key = col.colId || col.field;
      if (!key) return;
      const visible = api.getColumn(key)?.isVisible() ?? visibility[key];
      next[key] = visible;
    });
    setVisibility(next);
    if (persistenceKey) {
      try {
        const savedSort = JSON.parse(sessionStorage.getItem(`${persistenceKey}:sort`) || '[]');
        if (savedSort.length) api.applyColumnState({ state: savedSort, defaultState: { sort: null } });
      } catch {
        sessionStorage.removeItem(`${persistenceKey}:sort`);
      }
    }
  };

  const handleSortChanged = (event) => {
    if (!persistenceKey) return;
    const sortState = event.api.getColumnState()
      .filter(column => column.sort)
      .map(({ colId, sort, sortIndex }) => ({ colId, sort, sortIndex }));
    sessionStorage.setItem(`${persistenceKey}:sort`, JSON.stringify(sortState));
  };

  const handleColumnVisible = (event) => {
    if (!event.column) return;
    setVisibility(previous => ({
      ...previous,
      [event.column.getColId()]: event.column.isVisible(),
    }));
  };

  const toggleColumn = (key) => {
    const api = gridApiRef.current;
    if (!api) return;
    const column = api.getColumn(key);
    if (!column) return;
    const nextVisible = !column.isVisible();
    api.applyColumnState({ state: [{ colId: key, hide: !nextVisible }] });
    setVisibility(previous => ({ ...previous, [key]: nextVisible }));
  };

  const themeClass = isDark ? 'ag-theme-alpine-dark' : 'ag-theme-alpine';

  const pickerColumns = normalizedColumns
    .map(col => {
      const key = col.colId || col.field;
      if (!key) return null;
      const label = col.headerName || col.field || key;
      // Skip the checkbox selection column (no label/header)
      if (label === '' || label === key && !col.headerName) return null;
      return { key, label };
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full gap-1.5">
      <div className="flex items-center gap-2 px-1">
        <div className="join flex-1 max-w-sm">
          <div className="join-item flex items-center px-2 bg-base-200">
            <Search className="w-3.5 h-3.5 text-base-content/40" />
          </div>
          <input
            className="input input-bordered input-sm join-item w-full"
            placeholder="Filter visible rows..."
            value={quickFilter}
            onChange={e => setQuickFilter(e.target.value)}
          />
          {quickFilter && (
            <button className="join-item btn btn-sm btn-ghost" onClick={() => setQuickFilter('')}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <button
            className="btn btn-sm btn-ghost gap-1"
            onClick={() => setShowPicker(v => !v)}
          >
            <Columns3 className="w-3.5 h-3.5" /> Columns
          </button>
          {showPicker && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-base-100 border border-base-300 rounded-lg shadow-xl p-2 w-56 max-h-80 overflow-y-auto">
              <div className="text-xs font-semibold text-base-content/50 mb-2 px-1">Visible columns</div>
              {pickerColumns.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-base-200 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={!!visibility[key]}
                    onChange={() => toggleColumn(key)}
                  />
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {additionalActions}
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowPicker(false)} />
      )}

      <div className={`flex-1 ${themeClass} compact-grid`}>
        <AgGridReact
          ref={innerRef}
          theme="legacy"
          rowData={rowData}
          columnDefs={normalizedColumns}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            ...defaultColDef,
          }}
          rowHeight={rowHeight}
          headerHeight={headerHeight}
          suppressRowHoverHighlight={false}
          animateRows={true}
          rowSelection={rowSelection}
          onSelectionChanged={onSelectionChanged}
          onRowClicked={onRowClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          getRowId={getRowId}
          loading={loading}
          overlayLoadingTemplate='<span class="loading loading-spinner loading-sm"></span>'
          overlayNoRowsTemplate={`<span class="text-base-content/40 text-sm">${noRowsMessage}</span>`}
          onGridReady={onGridReady}
          onSortChanged={handleSortChanged}
          onColumnVisible={handleColumnVisible}
        />
      </div>
    </div>
  );
});

CompactGrid.displayName = 'CompactGrid';

export default CompactGrid;
