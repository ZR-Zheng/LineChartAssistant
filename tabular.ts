import { parseValue, SERIES_COLORS } from './chart';
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
  rows.push([...row, cell.trim()]);
  return rows.filter(cells => cells.some(Boolean));
}

function detectDelimiter(input: string) {
  const firstRow = input.match(/^(?:"(?:[^"]|"")*"|[^"\r\n])*/)?.[0] ?? '';
  const unquoted = firstRow.replace(/"(?:[^"]|"")*"/g, '');
  return [',', '\t', ';'].reduce((best, next) => (
    unquoted.split(next).length > unquoted.split(best).length ? next : best
  ));
}

export function importTable(text: string): Pick<ChartDocument, 'categories' | 'series' | 'xLabel' | 'yLabel'> {
  const input = text.replace(/^\uFEFF/, '').replace(/^(?: *\r?\n)+/, '');
  const [headers, ...rows] = parseRows(input, detectDelimiter(input));
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
