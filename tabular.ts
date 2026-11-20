import { parseValue, SERIES_COLORS } from './chart';
import type { PictographSymbol } from './pictographSymbols';
import type { ChartDocument } from './types';

const DELIMITERS = [',', '\t', ';'] as const;
export type TableDelimiter = typeof DELIMITERS[number];
export type TableFileEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030';

export function decodeTableFile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const utf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const utf16leBom = bytes[0] === 0xff && bytes[1] === 0xfe;
  const utf16beBom = bytes[0] === 0xfe && bytes[1] === 0xff;
  const encodings: TableFileEncoding[] = utf8Bom ? ['utf-8'] : utf16leBom ? ['utf-16le'] : utf16beBom ? ['utf-16be'] : ['utf-8', 'gb18030'];
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return { text, encoding };
    } catch {
      // A BOM is authoritative. For files without a BOM, try GB18030 after UTF-8.
    }
  }
  throw new Error('无法识别表格文件的文本编码。请另存为 UTF-8 后重新导入。');
}

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

function tableRows(input: string, row: number, column: number, options: {
  delimiter?: TableDelimiter; preferred?: TableDelimiter; wholeTable?: boolean;
}): { delimiter: TableDelimiter; rows: string[][] } {
  if (options.delimiter) return { delimiter: options.delimiter, rows: parseRows(input, options.delimiter) };

  const candidates = DELIMITERS.flatMap(delimiter => {
    try {
      const rows = parseRows(input, delimiter);
      const filled = rows.filter(cells => cells.length > 1 || cells.some(Boolean));
      const header = options.wholeTable ? filled[0] : undefined;
      const body = header ? filled.slice(1) : filled;
      const dataSeparators = body.some(cells => cells.length > 1);
      const columnCounts = new Map<number, number>();
      for (const cells of filled) columnCounts.set(cells.length, (columnCounts.get(cells.length) ?? 0) + 1);
      let matchingRows = 0;
      for (const occurrences of columnCounts.values()) matchingRows = Math.max(matchingRows, occurrences);
      const consistency = matchingRows / Math.max(1, filled.length);
      const validValues = rows.every((cells, i) => cells.every((cell, j) => {
        if (options.wholeTable ? cells === header || j === 0 : row + i === 0 || column + j === 0) return true;
        try { parseValue(cell); return true; } catch { return false; }
      }));
      return [{ delimiter, rows, hasSeparator: filled.some(cells => cells.length > 1), hasHeaderSeparator: (header?.length ?? 0) > 1,
        dataSeparators, consistency, validValues }];
    } catch {
      return [];
    }
  });

  const withSeparators = candidates.filter(item => item.hasSeparator);
  const preferred = withSeparators.find(item => item.delimiter === options.preferred);
  if (preferred && (preferred.delimiter === '\t' || withSeparators.length === 1 ||
    preferred.hasHeaderSeparator && preferred.dataSeparators && preferred.consistency === 1 && preferred.validValues)) return preferred;
  if (!withSeparators.length) return { delimiter: ',', rows: parseRows(input, ',') };
  const inData = withSeparators.filter(item => item.dataSeparators);
  const ranked = inData.length ? inData : withSeparators;
  const valid = ranked.filter(item => item.validValues);
  const best = (valid.length ? valid : ranked).sort((a, b) => b.consistency - a.consistency);
  if (best.length > 1 && best[0].consistency === best[1].consistency) {
    throw new Error(options.wholeTable ? '检测到多种可能的分隔符，请选择表格分隔符后预览。'
      : '粘贴区域的分隔符不明确。请使用制表符分隔，或在整表导入中选择分隔符。');
  }
  return best[0];
}

type TableData = Pick<ChartDocument, 'categories' | 'series' | 'xLabel' | 'yLabel'>;

export function previewTable(text: string, options: { delimiter?: TableDelimiter; preferred?: TableDelimiter } = {}) {
  const input = text.replace(/^\uFEFF/, '').replace(/^(?: *\r?\n)+/, '');
  const parsed = tableRows(input, 0, 0, { ...options, wholeTable: true });
  const [headers, ...rows] = parsed.rows.filter(row => row.length > 1 || row.some(Boolean));
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
  const data: TableData = {
    categories: rows.map(row => row[0]),
    series,
    xLabel: headers[0] || '类别',
    yLabel: series.length === 1 ? series[0].name : '数量',
  };
  const unevenRows = rows.filter(row => row.length !== headers.length).length;
  return { data, delimiter: parsed.delimiter, unevenRows };
}

export function importTable(text: string): TableData {
  return previewTable(text).data;
}

function matchPrevious<T>(items: T[], name: (item: T) => string) {
  const byName = new Map<string, T[]>();
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    const key = name(item);
    const matches = byName.get(key);
    if (matches) matches.push(item);
    else byName.set(key, [item]);
  }
  return (key: string) => byName.get(key)?.pop();
}

export function replaceTable(chart: ChartDocument, data: TableData): ChartDocument {
  const previousSeries = matchPrevious(chart.series, item => item.name);
  const series = data.series.map(item => {
    const previous = previousSeries(item.name);
    return previous ? { ...previous, values: item.values } : item;
  });
  const textStyles = { ...chart.textStyles };
  chart.categories.forEach((_, index) => delete textStyles[index]);
  const previousCategory = matchPrevious(chart.categories.map((_, index) => index), index => chart.categories[index]);
  const previouslyHidden = new Set(chart.hiddenCategoryLabels);
  const hiddenCategoryLabels: number[] = [];
  const pieColors = chart.pieColors ? data.categories.map(() => null as string | null) : undefined;
  const pictographSymbols = chart.pictographSymbols ? data.categories.map<PictographSymbol | null>(() => null) : undefined;
  data.categories.forEach((name, index) => {
    const previous = previousCategory(name);
    if (previous === undefined) return;
    if (chart.textStyles[previous]) textStyles[index] = chart.textStyles[previous];
    if (previouslyHidden.has(previous)) hiddenCategoryLabels.push(index);
    if (pieColors) pieColors[index] = chart.pieColors[previous] ?? null;
    if (pictographSymbols) pictographSymbols[index] = chart.pictographSymbols[previous] ?? null;
  });
  return { ...chart, ...data, series, textStyles, hiddenCategoryLabels, pieColors, pictographSymbols,
    pieSeries: undefined, barSeries: undefined, pictographSeries: undefined, scaleExtent: null };
}

export function parseTableBlock(text: string, row: number, column: number) {
  const input = text.replace(/^\uFEFF/, '');
  return tableRows(input, row, column, { preferred: '\t' }).rows.map((cells, i) => cells.map((cell, j) => {
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
    return /[,;\t"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\r\n');
}
