import { parseValue, SERIES_COLORS } from './chart';
import type { PictographSymbol } from './pictographSymbols';
import type { ChartDocument } from './types';

function parseRows(input: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === delimiter || char === '\r' || char === '\n') {
      row.push(cell.trim());
      cell = '';
      closedQuote = false;
      if (char !== delimiter) {
        rows.push(row);
        row = [];
        if (char === '\r' && input[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !closedQuote && !cell.trim()) {
      quoted = true;
      cell = '';
    } else {
      if (closedQuote && char.trim()) throw new Error('表格中的引号格式有误。');
      cell += char;
    }
  }

  if (quoted) throw new Error('表格中有未闭合的引号。');
  if (row.length || cell || closedQuote || !/[\r\n]$/.test(input)) rows.push([...row, cell.trim()]);
  return rows;
}

function detectDelimiter(input: string) {
  const firstRow = input.match(/^(?:"(?:[^"]|"")*"|[^"\r\n])*/)?.[0] ?? '';
  const unquoted = firstRow.replace(/"(?:[^"]|"")*"/g, '');
  return [',', '\t', ';'].reduce((best, next) => (
    unquoted.split(next).length > unquoted.split(best).length ? next : best
  ));
}

type TableData = Pick<ChartDocument, 'categories' | 'series' | 'xLabel' | 'yLabel'>;

export function importTable(text: string): TableData {
  const input = text.replace(/^\uFEFF/, '').replace(/^(?: *\r?\n)+/, '');
  const [headers, ...rows] = parseRows(input, detectDelimiter(input)).filter(row => row.length > 1 || row.some(Boolean));
  if (!headers || rows.length === 0) throw new Error('请提供一行表头和至少一行数据。');

  let columns = headers.length;
  for (const row of rows) columns = Math.max(columns, row.length);
  const series = Array.from({ length: columns - 1 }, (_, index) => index + 1)
    .filter(index => headers[index] || rows.some(row => row[index]))
    .map((column, index) => ({
      name: headers[column] || `数据 ${index + 1}`,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      values: rows.map((row, i) => {
        try {
          return parseValue(row[column] ?? '');
        } catch {
          throw new Error(`第 ${i + 2} 行、第 ${column + 1} 列需要数字或空白。`);
        }
      }),
    }));

  if (!series.length) throw new Error('第一列填写类别，后面的列填写数值。');
  return {
    categories: rows.map((row, i) => row[0] || `类别 ${i + 1}`),
    series,
    xLabel: headers[0] || '类别',
    yLabel: series.length === 1 ? series[0].name : '数量',
  };
}

export function replaceTable(chart: ChartDocument, data: TableData): ChartDocument {
  const previousSeries = [...chart.series];
  const series = data.series.map(item => {
    const index = previousSeries.findIndex(previous => previous.name === item.name);
    if (index < 0) return item;
    const [previous] = previousSeries.splice(index, 1);
    return { ...previous, values: item.values };
  });
  const textStyles = { ...chart.textStyles };
  chart.categories.forEach((_, index) => delete textStyles[index]);
  const previousCategories = chart.categories.map((name, index) => ({ name, index }));
  const hiddenCategoryLabels: number[] = [];
  const pieColors = chart.pieColors ? data.categories.map(() => null as string | null) : undefined;
  const pictographSymbols = chart.pictographSymbols ? data.categories.map<PictographSymbol | null>(() => null) : undefined;
  data.categories.forEach((name, index) => {
    const match = previousCategories.findIndex(previous => previous.name === name);
    if (match < 0) return;
    const [previous] = previousCategories.splice(match, 1);
    if (chart.textStyles[previous.index]) textStyles[index] = chart.textStyles[previous.index];
    if (chart.hiddenCategoryLabels?.includes(previous.index)) hiddenCategoryLabels.push(index);
    if (pieColors) pieColors[index] = chart.pieColors[previous.index] ?? null;
    if (pictographSymbols) pictographSymbols[index] = chart.pictographSymbols[previous.index] ?? null;
  });
  return { ...chart, ...data, series, textStyles, hiddenCategoryLabels, pieColors, pictographSymbols,
    pieSeries: undefined, barSeries: undefined, pictographSeries: undefined, scaleExtent: null };
}

export function parseTableBlock(text: string, row: number, column: number) {
  const input = text.replace(/^\uFEFF/, '');
  return parseRows(input, detectDelimiter(input)).map((cells, i) => cells.map((cell, j) => {
    if (row + i === 0 || column + j === 0) return cell;
    try {
      return parseValue(cell);
    } catch {
      throw new Error(`粘贴区域第 ${i + 1} 行、第 ${j + 1} 列需要数字或空白。`);
    }
  }));
}

export function pasteTableBlock(chart: ChartDocument, block: ReturnType<typeof parseTableBlock>, row: number, column: number): ChartDocument {
  const categoryCount = Math.max(chart.categories.length, row + block.length - 1);
  const seriesCount = block.reduce((count, cells) => Math.max(count, column + cells.length - 1), chart.series.length);
  const categories = Array.from({ length: categoryCount }, (_, i) => chart.categories[i] ?? `类别 ${i + 1}`);
  const series = Array.from({ length: seriesCount }, (_, i) => ({
    ...chart.series[i],
    name: chart.series[i]?.name ?? `数据 ${i + 1}`,
    color: chart.series[i]?.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
    values: Array.from({ length: categoryCount }, (_, j) => chart.series[i]?.values[j] ?? null),
  }));
  block.forEach((cells, i) => cells.forEach((cell, j) => {
    const r = row + i;
    const c = column + j;
    if (r === 0 && c > 0 && cell) series[c - 1].name = String(cell);
    if (r > 0 && c === 0) categories[r - 1] = String(cell);
    if (r > 0 && c > 0 && typeof cell !== 'string') series[c - 1].values[r - 1] = cell;
  }));
  const header = row === 0 && column === 0 ? block[0]?.[0] : '';
  return { ...chart, categories, series, scaleExtent: null, xLabel: header ? String(header) : chart.xLabel };
}

export function exportTable(document: ChartDocument) {
  const rows = [
    [document.xLabel, ...document.series.map(series => series.name)],
    ...document.categories.map((category, index) => [
      category, ...document.series.map(series => series.values[index] ?? ''),
    ]),
  ];
  return rows.map(row => row.map(value => {
    const text = String(value);
    return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\r\n');
}
