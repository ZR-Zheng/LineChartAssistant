import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent } from 'react';
import { ChevronLeft, ChevronRight, ClipboardPaste, Download, Eye, Plus, Scaling, Trash2, Upload, X } from 'lucide-react';
import { appendCategory, displayedSeriesField, parseValue, removeCategory, SERIES_COLORS, setCategoryLabelVisible, setChartValue } from '../chart';
import { chartFileName, download } from '../downloads';
import { decodeTableFile, exportTable, parseTableBlock, pasteTableBlock, previewTable, replaceTable } from '../tabular';
import type { TableDelimiter, TableFileEncoding } from '../tabular';
import type { ChartDocument, ChartEdit, DataHighlight } from '../types';
import StylePresets from './StylePresets';
import ColorPicker from './ColorPicker';
import './dataPanel.css';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  activeSeries: number;
  onSelectSeries: (index: number) => void;
  onReplaceCategories: () => void;
  onRemoveSeries: (index: number) => void;
  onHighlight: (highlight: DataHighlight) => void;
  onClose: () => void;
  importRequest?: number;
}

const DELIMITER_LABELS: Record<TableDelimiter, string> = { ',': '逗号', '\t': '制表符', ';': '分号' };
const ENCODING_LABELS: Record<TableFileEncoding, string> = {
  'utf-8': 'UTF-8', 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', gb18030: 'GB18030 / GBK',
};
const ROWS_PER_PAGE = 80;
type ImportFormat = 'auto' | TableDelimiter;
type CellDraft = { original: string; text: string; error?: string };
type CellPosition = { row: number; column: number };

function pageForRow(row: number) {
  return Math.floor(Math.max(0, row - 1) / ROWS_PER_PAGE);
}

function DataPanel({ chart, onEdit, activeSeries, onSelectSeries, onReplaceCategories, onRemoveSeries, onHighlight, onClose, importRequest = 0 }: Props) {
  const [importing, setImporting] = useState(importRequest > 0);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [requestedPage, setPage] = useState(0);
  const [tableRevision, setTableRevision] = useState(0);
  const [pasteVersions, setPasteVersions] = useState(new Map<string, number>());
  const [preview, setPreview] = useState<ReturnType<typeof previewTable> | null>(null);
  const [importFormat, setImportFormat] = useState<ImportFormat>('auto');
  const [fileFormat, setFileFormat] = useState<TableDelimiter | undefined>(undefined);
  const [fileEncoding, setFileEncoding] = useState<TableFileEncoding | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const fileRequest = useRef(0);
  const pasteInput = useRef<HTMLTextAreaElement>(null);
  const pasteTrigger = useRef<HTMLButtonElement>(null);
  const tableScroll = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<CellPosition | null>(null);
  const savedDrafts = useRef(new Map<string, CellDraft>());
  const { categories, series } = chart;
  const lastPage = pageForRow(categories.length);
  const page = Math.min(requestedPage, lastPage);
  const rowStart = page * ROWS_PER_PAGE;
  if (requestedPage !== page) setPage(page);

  useLayoutEffect(() => {
    if (importRequest <= 0) return;
    setImporting(true);
    const frame = requestAnimationFrame(() => pasteInput.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [importRequest]);

  function focusCell(row: number, column: number) {
    const input = tableScroll.current?.querySelector<HTMLInputElement>(
      `input[data-table-row="${row}"][data-table-column="${column}"]`,
    );
    input?.focus();
    input?.select();
    return Boolean(input);
  }

  useLayoutEffect(() => {
    if (tableScroll.current) tableScroll.current.scrollTop = 0;
  }, [page, tableRevision]);

  useLayoutEffect(() => {
    const target = focusRequest.current;
    if (target && focusCell(target.row, target.column)) focusRequest.current = null;
  }, [page, categories.length, series.length]);

  function navigateCell(row: number, column: number) {
    if (row < 0 || row > categories.length) return;
    const nextPage = pageForRow(row);
    if (row === 0 || nextPage === page) focusCell(row, column);
    else {
      focusRequest.current = { row, column };
      setPage(nextPage);
    }
  }

  function checkTable(text: string, format: ImportFormat, preferred?: TableDelimiter) {
    try {
      setPreview(previewTable(text, { delimiter: format === 'auto' ? undefined : format, preferred }));
      setError('');
    } catch (error) {
      setPreview(null);
      setError(error.message);
    }
  }

  async function importFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const request = ++fileRequest.current;
    setStatus('');
    setError('');
    setPreview(null);
    setFileEncoding(null);
    setImporting(true);
    setReadingFile(true);
    try {
      const bytes = await file.arrayBuffer().catch(() => { throw new Error('无法读取文件，请重新选择。'); });
      if (request !== fileRequest.current) return;
      const { text, encoding } = decodeTableFile(bytes);
      const preferred = /\.tsv$/i.test(file.name) ? '\t' : /\.csv$/i.test(file.name) ? ',' : undefined;
      setPasted(text);
      setImportFormat('auto');
      setFileFormat(preferred);
      setFileEncoding(encoding);
      checkTable(text, 'auto', preferred);
    } catch (error) {
      if (request === fileRequest.current) setError(error.message);
    } finally {
      if (request === fileRequest.current) setReadingFile(false);
    }
  }

  function pasteCells(event: ClipboardEvent<HTMLInputElement>, row: number, column: number) {
    const input = event.clipboardData.getData('text');
    if (!input.includes('\t') && !/[\r\n][\s\S]/.test(input)) return false;
    event.preventDefault();
    setStatus('');
    const block = parseTableBlock(input, row, column);
    onEdit(current => pasteTableBlock(current, block, row, column));
    block.forEach((cells, rowOffset) => cells.forEach((_, columnOffset) => {
      savedDrafts.current.delete(`${row + rowOffset}:${column + columnOffset}`);
    }));
    setPasteVersions((previous: ReadonlyMap<string, number>) => {
      const versions = new Map(previous);
      block.forEach((cells, rowOffset) => cells.forEach((_, columnOffset) => {
        const key = `${row + rowOffset}:${column + columnOffset}`;
        versions.set(key, (versions.get(key) ?? 0) + 1);
      }));
      return versions;
    });
    setStatus('已粘贴数据区域，可撤销。');
    return true;
  }

  function resetTableDrafts() {
    savedDrafts.current.clear();
    setPasteVersions(new Map());
    setTableRevision(revision => revision + 1);
  }

  function addCategory() {
    const row = categories.length + 1;
    focusRequest.current = { row, column: 0 };
    setPage(pageForRow(row));
    onEdit(appendCategory);
  }

  function addSeries() {
    const index = series.length;
    focusRequest.current = { row: 0, column: index + 1 };
    onEdit(current => {
      const field = displayedSeriesField(current);
      return { ...current,
        ...(field && { [field]: current.series.length }),
        ...(field === 'barSeries' && { scaleExtent: null }),
        series: [...current.series, {
          name: `数据 ${index + 1}`, color: SERIES_COLORS[index % SERIES_COLORS.length], values: current.categories.map(() => null),
        }],
      };
    });
    onSelectSeries(index);
  }

  function editSeries(index: number, changes: { name?: string; color?: string }) {
    onEdit(current => ({
      ...current,
      series: current.series.map((item, i) => i === index ? { ...item, ...changes } : item),
    }));
    if (changes.color) onHighlight({ series: index });
  }

  function applyPaste(event: FormEvent) {
    event.preventDefault();
    if (readingFile) return;
    if (!preview) {
      checkTable(pasted, importFormat, fileFormat);
      return;
    }
    onEdit(current => replaceTable(current, preview.data));
    resetTableDrafts();
    focusRequest.current = null;
    setPage(0);
    onReplaceCategories();
    onSelectSeries(0);
    setPreview(null);
    setPasted('');
    setFileFormat(undefined);
    setFileEncoding(null);
    setImportFormat('auto');
    setImporting(false);
    setStatus('已替换当前表格，可撤销。');
    pasteTrigger.current?.focus();
  }

  return (
    <aside className="data-panel" id="data-panel" aria-label="图表数据" tabIndex={-1}>
      <div className="panel-heading">
        <h2>图表数据</h2>
        <button className="icon-button" title="关闭数据面板" aria-label="关闭数据面板" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="panel-content">
        <div className="panel-actions data-import-actions" role="group" aria-label="导入和导出数据">
          <button className="button compact" ref={pasteTrigger} aria-expanded={importing} aria-controls={importing ? 'paste-table' : undefined}
            onClick={() => { setImporting(!importing); setError(''); setStatus(''); }}>
            <ClipboardPaste size={16} /> 粘贴整表
          </button>
          <button className="button compact" aria-label="导入 CSV / TSV" title="导入 CSV / TSV" onClick={() => importFile.current?.click()}>
            <Upload size={16} /> <span>导入<span className="data-import-formats"> CSV / TSV</span></span>
          </button>
          <button className="icon-button" title="导出 CSV" aria-label="导出 CSV" onClick={() => download(
            new Blob(['\uFEFF', exportTable(chart)], { type: 'text/csv;charset=utf-8' }), chartFileName(chart.title, 'csv'),
          )}><Download size={17} /></button>
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            ref={importFile} hidden onChange={importFromFile} />
        </div>
        {error && <p className="panel-error" role="alert">{error}</p>}
        {status && <p className="data-entry-hint" role="status">{status}</p>}
        {importing && (
          <form className="paste-form" id="paste-table" onSubmit={applyPaste}>
            <label htmlFor="pasted-data">粘贴带表头的整张表。第一列填类别名称，其余列填数值。预览后可替换当前表格。</label>
            <textarea id="pasted-data" ref={pasteInput} rows={4} value={pasted} onChange={event => {
              fileRequest.current++;
              setReadingFile(false);
              setPasted(event.target.value);
              setFileFormat(undefined);
              setFileEncoding(null);
              setPreview(null);
              setError('');
            }}
              placeholder={'日期\t数量\n周一\t12\n周二\t18'} />
            <label className="table-import-format">表格分隔符
              <select value={importFormat} disabled={readingFile} onChange={event => {
                setImportFormat(event.target.value as ImportFormat);
                setPreview(null);
                setError('');
              }}>
                <option value="auto">自动识别</option>
                {Object.entries(DELIMITER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {preview && <ImportPreview {...preview} encoding={fileEncoding} />}
            <button className="button primary compact" disabled={readingFile || !pasted.trim()}>
              {readingFile ? '正在读取文件' : preview ? '替换当前表格' : '预览数据'}
            </button>
          </form>
        )}
        <div className="panel-actions" role="group" aria-label="编辑表格结构">
          <button className="text-button" onClick={addCategory}><Plus size={16} /> 添加一行</button>
          <button className="text-button" onClick={addSeries}><Plus size={16} /> 添加数据系列</button>
        </div>
        <p className="data-entry-hint" id="data-table-hint">在单元格中粘贴可填充数据区域。按 Enter 向下录入，按 Shift+Enter 向上录入。</p>
        {chart.kind === 'bar' && chart.groupedColumns && <p className="data-entry-hint" role="status">
          同一个类别的各系列数值填在同一行。
        </p>}
        <div className="table-scroll editable-table-scroll" ref={tableScroll}>
          <table key={tableRevision} className="data-table editable-data-table" aria-label="数据表格"
            aria-describedby="data-table-hint" aria-rowcount={lastPage > 0 ? categories.length + 1 : undefined}>
            <thead>
              <tr aria-rowindex={lastPage > 0 ? 1 : undefined}>
                <th scope="col">{chart.xLabel.trim() || '类别'}</th>
                {series.map((item, index) => (
                  <th scope="col" key={index}>
                    <Cell value={item.name} label={`第 ${index + 1} 个系列的名称`} row={0} column={index + 1}
                      drafts={savedDrafts.current} onNavigate={navigateCell}
                      pasteVersion={pasteVersions.get(`0:${index + 1}`)} onCommit={value => {
                      const name = value.trim();
                      if (!name) throw new Error('请输入系列名称。');
                      if (name !== item.name) editSeries(index, { name });
                    }} onPaste={event => pasteCells(event, 0, index + 1)} />
                  </th>
                ))}
                <th scope="col"><span className="sr-only">行操作</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.slice(rowStart, rowStart + ROWS_PER_PAGE).map((category, offset) => {
                const index = rowStart + offset;
                return <tr key={index} aria-rowindex={lastPage > 0 ? index + 2 : undefined}>
                  <th scope="row">
                    <Cell value={category} label={`第 ${index + 1} 行名称`} row={index + 1} column={0}
                      drafts={savedDrafts.current} onNavigate={navigateCell}
                      pasteVersion={pasteVersions.get(`${index + 1}:0`)} onCommit={value => {
                      const name = value.trim();
                      if (name !== category) onEdit(current => ({
                        ...current, categories: current.categories.map((previous, i) => i === index ? name : previous),
                      }));
                    }} onPaste={event => pasteCells(event, index + 1, 0)} />
                  </th>
                  {series.map((item, seriesIndex) => (
                    <td key={seriesIndex}>
                      <Cell value={String(item.values[index] ?? '')} label={`${category || `类别 ${index + 1}`}，${item.name}`}
                        drafts={savedDrafts.current} onNavigate={navigateCell}
                        row={index + 1} column={seriesIndex + 1} numeric pasteVersion={pasteVersions.get(`${index + 1}:${seriesIndex + 1}`)}
                        onPaste={event => pasteCells(event, index + 1, seriesIndex + 1)} onCommit={value => {
                          const parsed = parseValue(value);
                          if (parsed !== item.values[index]) {
                            onEdit(current => setChartValue(current, seriesIndex, index, parsed));
                            onHighlight({ series: seriesIndex, index });
                          }
                        }} />
                    </td>
                  ))}
                  <td>
                    {chart.hiddenCategoryLabels?.includes(index) && <button className="icon-button tiny" aria-label={`显示类别标签 ${category}`}
                      title="显示类别标签" onClick={() => onEdit(current => setCategoryLabelVisible(current, index, true))}><Eye size={14} /></button>}
                    <button className="icon-button tiny" disabled={categories.length === 1} onClick={() => {
                      onEdit(current => removeCategory(current, index));
                      resetTableDrafts();
                      onReplaceCategories();
                    }} aria-label={`删除类别 ${category}`} title="删除类别"><Trash2 size={14} /></button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {lastPage > 0 && <div className="data-table-pagination" role="group" aria-label="数据表格分页">
          <button type="button" className="icon-button" aria-label="上一页" title="上一页" disabled={page === 0}
            onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
          <select aria-label="跳转到表格行范围" value={page} onChange={event => setPage(Number(event.target.value))}>
            {Array.from({ length: lastPage + 1 }, (_, index) => {
              const first = index * ROWS_PER_PAGE + 1;
              const last = Math.min(first + ROWS_PER_PAGE - 1, categories.length);
              return <option key={index} value={index}>第 {first}–{last} 行</option>;
            })}
          </select>
          <button type="button" className="icon-button" aria-label="下一页" title="下一页" disabled={page === lastPage}
            onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
          <span>共 {categories.length} 行</span>
        </div>}
        <details className="presets">
          <summary>管理数据系列</summary>
          <div className="series-list">
            {series.map((item, index) => (
              <div className="series-row" key={index}>
                <ColorPicker value={item.color} label={`${item.name}的颜色`} onChange={color => editSeries(index, { color })} />
                <button className="series-select" aria-pressed={activeSeries === index} onClick={() => onSelectSeries(index)}
                  title={`在画布上使用${item.name}`}>{item.name}</button>
                <button className="icon-button tiny" disabled={series.length === 1} onClick={() => {
                  onRemoveSeries(index);
                  resetTableDrafts();
                }}
                  aria-label={`删除系列 ${item.name}`} title={`删除系列 ${item.name}`}><X size={14} /></button>
              </div>
            ))}
          </div>
        </details>
        {chart.scaleExtent && <div className="panel-actions">
          <button className="text-button" onClick={() => onEdit(current => ({ ...current, scaleExtent: null }))}>
            <Scaling size={16} /> 按数据调整纵轴
          </button>
        </div>}
        <StylePresets style={chart.style} onApply={style => onEdit(current => ({
          ...current, style,
          scaleExtent: current.style.axes.y.maximum === style.axes.y.maximum && current.style.axes.y.omitted === style.axes.y.omitted
            ? current.scaleExtent : null,
        }))} />
      </div>
    </aside>
  );
}

function ImportPreview({ data, delimiter, unevenRows, encoding }: ReturnType<typeof previewTable> & { encoding: TableFileEncoding | null }) {
  const shown = 5;
  const missing = data.series.reduce((sum, series) => sum + series.values.filter(value => value === null).length, 0);
  return (
    <div className="import-preview">
      <p role="status">{encoding && `${ENCODING_LABELS[encoding]} · `}{DELIMITER_LABELS[delimiter]}分隔 · {data.categories.length} 行 · {data.series.length} 个系列{missing ? ` · ${missing} 个空值` : ''}</p>
      {unevenRows > 0 && <p>{unevenRows} 行的列数与表头不同，请核对预览。</p>}
      <div className="table-scroll">
        <table className="data-table" aria-label="待导入数据预览">
          <thead><tr><th>{data.xLabel}</th>{data.series.slice(0, shown).map((item, i) => <th key={i}>{item.name}</th>)}</tr></thead>
          <tbody>{data.categories.slice(0, shown).map((name, i) => <tr key={i}>
            <th scope="row">{name}</th>{data.series.slice(0, shown).map((item, j) => <td key={j}>{item.values[i] ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {(data.categories.length > shown || data.series.length > shown) && <small>预览最多显示前 5 行和 5 个系列。</small>}
    </div>
  );
}

function Cell({ value, label, row, column, onCommit, onPaste, onNavigate, drafts, numeric = false, pasteVersion = 0 }: {
  value: string;
  label: string;
  row: number;
  column: number;
  onCommit: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => boolean;
  onNavigate: (row: number, column: number) => void;
  drafts: Map<string, CellDraft>;
  numeric?: boolean;
  pasteVersion?: number;
}) {
  const errorId = useId();
  const movingFocus = useRef(false);
  const key = `${row}:${column}`;
  const original = `${pasteVersion}:${value}`;
  const [edit, setEdit] = useState<CellDraft | null>(() => drafts.get(key) ?? null);
  const currentEdit = edit?.original === original ? edit : null;
  if (edit && !currentEdit) setEdit(null);
  useLayoutEffect(() => {
    const saved = drafts.get(key);
    if (saved && saved.original !== original) drafts.delete(key);
  }, [drafts, key, original]);

  function updateEdit(next: CellDraft | null) {
    if (next?.error) drafts.set(key, next);
    else drafts.delete(key);
    setEdit(next);
  }

  function showError(text: string, error: unknown) {
    updateEdit({ original, text, error: error instanceof Error ? error.message : '无法更新单元格。' });
  }

  function commit(text: string) {
    try {
      if (text !== value) onCommit(text);
      if (edit) updateEdit(null);
      return true;
    } catch (error) {
      showError(text, error);
      return false;
    }
  }

  return (
    <>
      <input value={currentEdit?.text ?? value} aria-label={label} inputMode={numeric ? 'decimal' : 'text'}
        aria-invalid={!!currentEdit?.error || undefined} aria-describedby={currentEdit?.error ? errorId : undefined}
        data-table-row={row} data-table-column={column}
        onChange={event => updateEdit({ original, text: event.currentTarget.value })}
        onPaste={event => {
          try {
            if (onPaste(event)) updateEdit(null);
          } catch (error) {
            showError(event.currentTarget.value, error);
          }
        }}
        onBlur={event => {
          if (!movingFocus.current) commit(event.currentTarget.value);
        }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && currentEdit) {
            event.preventDefault();
            updateEdit(null);
          }
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const cell: HTMLInputElement = event.currentTarget;
          if (!commit(cell.value)) return;
          movingFocus.current = true;
          onNavigate(row + (event.shiftKey ? -1 : 1), column);
          movingFocus.current = false;
        }} />
      {currentEdit?.error && <span id={errorId} className="table-cell-error" role="alert">{currentEdit.error}</span>}
    </>
  );
}

export default DataPanel;
