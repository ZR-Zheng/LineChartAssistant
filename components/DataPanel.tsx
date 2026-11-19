import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent } from 'react';
import { ClipboardPaste, Download, Plus, Scaling, Trash2, Upload, X } from 'lucide-react';
import { parseValue, SERIES_COLORS, setChartValue } from '../chart';
import { chartFileName, download } from '../downloads';
import { exportTable, importTable } from '../tabular';
import type { ChartDocument, ChartEdit } from '../types';
import StylePresets from './StylePresets';
import ColorPicker from './ColorPicker';

interface Props {
  chart: ChartDocument;
  onEdit: ChartEdit;
  activeSeries: number;
  onSelectSeries: (index: number) => void;
  onReplaceCategories: () => void;
  onClose: () => void;
}

function DataPanel({ chart, onEdit, activeSeries, onSelectSeries, onReplaceCategories, onClose }: Props) {
  const [importing, setImporting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  const importFile = useRef<HTMLInputElement>(null);
  const { categories, series } = chart;

  function applyTable(text: string) {
    try {
      const data = importTable(text);
      onEdit(current => {
        const { title, xLabel, yLabel } = current.textStyles ?? {};
        return { ...current, ...data, scaleExtent: null, textStyles: { title, xLabel, yLabel } };
      });
      onReplaceCategories();
      onSelectSeries(0);
      setError('');
      setPasted('');
      setImporting(false);
    } catch (error) {
      setError(error.message);
      setPasted(text);
      setImporting(true);
    }
  }

  async function importFromFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      applyTable(await file.text());
    } catch {
      setError('无法读取文件。');
    }
  }

  function pasteCells(event: ClipboardEvent<HTMLInputElement>) {
    const input = event.clipboardData.getData('text');
    if (!input.includes('\t') && !/\r?\n./.test(input)) return;
    event.preventDefault();
    setPasted(input);
    setImporting(true);
    setError('');
  }

  function addCategory() {
    onEdit(current => ({
      ...current,
      categories: [...current.categories, `类别 ${current.categories.length + 1}`],
      series: current.series.map(item => ({ ...item, values: [...item.values, null] })),
    }));
  }

  function removeCategory(index: number) {
    if (categories.length <= 1) return;
    onEdit(current => {
      if (current.categories.length <= 1) return current;
      const textStyles = { ...current.textStyles };
      for (let i = index; i < current.categories.length - 1; i++) {
        const nextStyle = textStyles[i + 1];
        if (nextStyle) textStyles[i] = nextStyle;
        else delete textStyles[i];
      }
      delete textStyles[current.categories.length - 1];
      return {
        ...current,
        textStyles,
        categories: current.categories.filter((_, i) => i !== index),
        series: current.series.map(item => ({ ...item, values: item.values.filter((_, i) => i !== index) })),
      };
    });
    onReplaceCategories();
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

  function removeSeries(index: number) {
    if (series.length <= 1) return;
    onEdit(current => ({ ...current, series: current.series.filter((_, i) => i !== index) }));
    if (index <= activeSeries) onSelectSeries(Math.max(0, activeSeries - 1));
  }

  function editSeries(index: number, changes: { name?: string; color?: string }) {
    onEdit(current => ({
      ...current,
      series: current.series.map((item, i) => i === index ? { ...item, ...changes } : item),
    }));
  }

  function applyPaste(event: FormEvent) {
    event.preventDefault();
    applyTable(pasted);
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
            <label htmlFor="pasted-data">第一列为类别，首行为表头。应用后替换当前表格。</label>
            <textarea id="pasted-data" rows={4} value={pasted} onChange={event => setPasted(event.target.value)}
              placeholder={'日期\t数量\n周一\t12\n周二\t18'} />
            <button className="button primary compact" disabled={!pasted.trim()}>应用数据</button>
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
              <button className="icon-button tiny" disabled={series.length === 1} onClick={() => removeSeries(index)}
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
                    }} onPaste={pasteCells} />
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
                    }))} onPaste={pasteCells} />
                  </td>
                  {series.map((item, seriesIndex) => (
                    <td key={seriesIndex}>
                      <Cell value={String(item.values[index] ?? '')} label={`${category || `类别 ${index + 1}`}，${item.name}`}
                        numeric onPaste={pasteCells} onCommit={value => {
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
                  <td><button className="icon-button tiny" disabled={categories.length === 1} onClick={() => removeCategory(index)}
                    aria-label={`删除类别 ${category}`} title="删除类别"><Trash2 size={14} /></button></td>
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
          scaleExtent: current.style.axes.y.maximum === style.axes.y.maximum ? current.scaleExtent : null,
        }))} />
      </div>
    </aside>
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
