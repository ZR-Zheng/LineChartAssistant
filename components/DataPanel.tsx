import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent } from 'react';
import { ClipboardPaste, Download, Eye, Plus, Scaling, Trash2, Upload, X } from 'lucide-react';
import { parseValue, removeCategory, SERIES_COLORS, setCategoryLabelVisible, setChartValue } from '../chart';
import { chartFileName, download } from '../downloads';
import { exportTable, importTable, parseTableBlock, pasteTableBlock, replaceTable } from '../tabular';
import type { ChartDocument, ChartEdit } from '../types';
import StylePresets from './StylePresets';
import ColorPicker from './ColorPicker';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  activeSeries: number;
  onSelectSeries: (index: number) => void;
  onReplaceCategories: () => void;
  onRemoveSeries: (index: number) => void;
  onClose: () => void;
}

function DataPanel({ chart, onEdit, activeSeries, onSelectSeries, onReplaceCategories, onRemoveSeries, onClose }: Props) {
  const [importing, setImporting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof importTable> | null>(null);
  const importFile = useRef<HTMLInputElement>(null);
  const { categories, series } = chart;

  function checkTable(text: string) {
    try {
      setPreview(importTable(text));
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
    try {
      const text = await file.text();
      setPasted(text);
      setImporting(true);
      checkTable(text);
    } catch {
      setError('无法读取文件。');
    }
  }

  function pasteCells(event: ClipboardEvent<HTMLInputElement>, row: number, column: number) {
    const input = event.clipboardData.getData('text');
    if (!input.includes('\t') && !/[\r\n][\s\S]/.test(input)) return;
    event.preventDefault();
    try {
      const block = parseTableBlock(input, row, column);
      onEdit(current => pasteTableBlock(current, block, row, column));
      setError('');
    } catch (caught) { setError(caught.message); }
  }

  function addCategory() {
    onEdit(current => ({
      ...current,
      categories: [...current.categories, `类别 ${current.categories.length + 1}`],
      series: current.series.map(item => ({ ...item, values: [...item.values, null] })),
    }));
  }

  function addSeries() {
    const index = series.length;
    onEdit(current => ({
      ...current,
      series: [...current.series, {
        name: `数据 ${index + 1}`,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        values: current.categories.map(() => null),
      }],
    }));
    onSelectSeries(index);
  }

  function editSeries(index: number, changes: { name?: string; color?: string }) {
    onEdit(current => ({
      ...current,
      series: current.series.map((item, i) => i === index ? { ...item, ...changes } : item),
    }));
  }

  function applyPaste(event: FormEvent) {
    event.preventDefault();
    if (!preview) {
      checkTable(pasted);
      return;
    }
    onEdit(current => replaceTable(current, preview));
    onReplaceCategories();
    onSelectSeries(0);
    setPreview(null);
    setPasted('');
    setImporting(false);
  }

  return (
    <aside className="data-panel" id="data-panel" aria-label="图表数据">
      <div className="panel-heading">
        <h2>图表数据</h2>
        <button className="icon-button" title="关闭数据面板" aria-label="关闭数据面板" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="panel-content">
        <div className="panel-actions">
          <button className="button compact" aria-expanded={importing} onClick={() => { setImporting(!importing); setError(''); }}>
            <ClipboardPaste size={16} /> 粘贴表格
          </button>
          <button className="button compact" onClick={() => importFile.current?.click()}><Upload size={16} /> 导入数据</button>
          <button className="icon-button" title="导出 CSV" aria-label="导出 CSV" onClick={() => download(
            new Blob(['\uFEFF', exportTable(chart)], { type: 'text/csv;charset=utf-8' }), chartFileName(chart.title, 'csv'),
          )}><Download size={17} /></button>
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            ref={importFile} hidden onChange={importFromFile} />
        </div>
        {importing && (
          <form className="paste-form" onSubmit={applyPaste}>
            <label htmlFor="pasted-data">首行为表头，第一列为类别。可直接在下方表格选中单元格并粘贴区域。</label>
            <textarea id="pasted-data" rows={4} value={pasted} onChange={event => {
              setPasted(event.target.value);
              setPreview(null);
              setError('');
            }}
              placeholder={'日期\t数量\n周一\t12\n周二\t18'} />
            {preview && <ImportPreview data={preview} />}
            <button className="button primary compact" disabled={!pasted.trim()}>{preview ? '替换当前表格' : '检查并预览'}</button>
          </form>
        )}
        {error && <p className="panel-error" role="alert">{error}</p>}
        <div className="series-list" aria-label="数据系列">
          {series.map((item, index) => (
            <div className="series-row" key={index}>
              <ColorPicker value={item.color} label={`系列 ${index + 1} 的颜色`}
                onChange={color => editSeries(index, { color })} />
              <button className="series-select" aria-pressed={activeSeries === index} onClick={() => onSelectSeries(index)}
                title={`在画布上编辑 ${item.name}`}>{item.name}</button>
              <button className="icon-button tiny" disabled={series.length === 1} onClick={() => onRemoveSeries(index)}
                aria-label={`删除系列 ${item.name}`} title="删除系列"><X size={14} /></button>
            </div>
          ))}
          <button className="text-button" onClick={addSeries}><Plus size={16} /> 添加系列</button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">类别</th>
                {series.map((item, index) => (
                  <th scope="col" key={index}>
                    <Cell value={item.name} label={`系列 ${index + 1} 名称`} onCommit={value => {
                      if (value.trim()) editSeries(index, { name: value.trim() });
                    }} onPaste={event => pasteCells(event, 0, index + 1)} />
                  </th>
                ))}
                <th scope="col"><span className="sr-only">删除类别</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category, index) => (
                <tr key={index}>
                  <td>
                    <Cell value={category} label={`类别 ${index + 1} 名称`} onCommit={value => onEdit(current => ({
                      ...current, categories: current.categories.map((previous, i) => i === index ? value.trim() : previous),
                    }))} onPaste={event => pasteCells(event, index + 1, 0)} />
                  </td>
                  {series.map((item, seriesIndex) => (
                    <td key={seriesIndex}>
                      <Cell value={String(item.values[index] ?? '')} label={`${category || `类别 ${index + 1}`}，${item.name}`}
                        numeric onPaste={event => pasteCells(event, index + 1, seriesIndex + 1)} onCommit={value => {
                          try {
                            const parsed = parseValue(value);
                            onEdit(current => setChartValue(current, seriesIndex, index, parsed));
                            setError('');
                          } catch (error) {
                            setError(error.message);
                          }
                        }} />
                    </td>
                  ))}
                  <td>
                    {chart.hiddenCategoryLabels?.includes(index) && <button className="icon-button tiny" aria-label={`显示类别标签 ${category}`}
                      title="显示类别标签" onClick={() => onEdit(current => setCategoryLabelVisible(current, index, true))}><Eye size={14} /></button>}
                    <button className="icon-button tiny" disabled={categories.length === 1} onClick={() => {
                      onEdit(current => removeCategory(current, index));
                      onReplaceCategories();
                    }} aria-label={`删除类别 ${category}`} title="删除类别"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-actions">
          <button className="text-button" onClick={addCategory}><Plus size={16} /> 添加类别</button>
          {chart.scaleExtent && <button className="text-button" onClick={() => onEdit(current => ({ ...current, scaleExtent: null }))}>
            <Scaling size={16} /> 按数据调整纵轴
          </button>}
        </div>
        <StylePresets style={chart.style} onApply={style => onEdit(current => ({
          ...current, style,
          scaleExtent: current.style.axes.y.maximum === style.axes.y.maximum && current.style.axes.y.omitted === style.axes.y.omitted
            ? current.scaleExtent : null,
        }))} />
      </div>
    </aside>
  );
}

function ImportPreview({ data }: { data: ReturnType<typeof importTable> }) {
  const shown = 5;
  const missing = data.series.reduce((sum, series) => sum + series.values.filter(value => value === null).length, 0);
  return (
    <div className="import-preview">
      <p role="status">{data.categories.length} 个类别 · {data.series.length} 个系列{missing ? ` · ${missing} 个空值` : ''}</p>
      <div className="table-scroll">
        <table className="data-table" aria-label="待导入数据预览">
          <thead><tr><th>{data.xLabel}</th>{data.series.slice(0, shown).map((item, i) => <th key={i}>{item.name}</th>)}</tr></thead>
          <tbody>{data.categories.slice(0, shown).map((name, i) => <tr key={i}>
            <th scope="row">{name}</th>{data.series.slice(0, shown).map((item, j) => <td key={j}>{item.values[i] ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {(data.categories.length > shown || data.series.length > shown) && <small>预览最多显示前 5 个类别和 5 个系列。</small>}
    </div>
  );
}

function Cell({ value, label, onCommit, onPaste, numeric = false }: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  numeric?: boolean;
}) {
  return (
    <input key={value} defaultValue={value} aria-label={label} inputMode={numeric ? 'decimal' : 'text'} onPaste={onPaste}
      onBlur={event => {
        const input = event.currentTarget;
        if (input.value === value) return;
        const next = input.value;
        input.value = value;
        onCommit(next);
      }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') event.currentTarget.value = value;
        if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
      }} />
  );
}

export default DataPanel;
