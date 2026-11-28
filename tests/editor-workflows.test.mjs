import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let boards;
let table;
let storage;
let assets;
let chartTools;
let presentation;
let ChartDisplay;
let DataPanel;
let AxisPanel;
let AxisSelectionToolbar;
let iconPickerPosition;
let iconCatalog;
let downloads;
let shortcuts;
let exerciseBank;
let exercises;

before(async () => {
  server = await createServer({
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  [boards, table, storage, assets, chartTools, presentation, { default: ChartDisplay }, { default: DataPanel },
    { default: AxisPanel }, { AxisSelectionToolbar }, { iconPickerPosition }, { PICTOGRAPH_SYMBOLS: iconCatalog }, downloads, shortcuts,
    exerciseBank, exercises] = await Promise.all([
    server.ssrLoadModule('/boards.ts'),
    server.ssrLoadModule('/tabular.ts'),
    server.ssrLoadModule('/workspaceStorage.ts'),
    server.ssrLoadModule('/pictographAssets.ts'),
    server.ssrLoadModule('/chart.ts'),
    server.ssrLoadModule('/chartPresentation.ts'),
    server.ssrLoadModule('/components/ChartDisplay.tsx'),
    server.ssrLoadModule('/components/DataPanel.tsx'),
    server.ssrLoadModule('/components/AxisPanel.tsx'),
    server.ssrLoadModule('/components/SelectionToolbar.tsx'),
    server.ssrLoadModule('/components/PictographSymbolField.tsx'),
    server.ssrLoadModule('/pictographSymbols.ts'),
    server.ssrLoadModule('/downloads.ts'),
    server.ssrLoadModule('/workspaceShortcuts.ts'),
    server.ssrLoadModule('/exerciseBank.ts'),
    server.ssrLoadModule('/randomChart.ts'),
  ]);
});

after(async () => { await server?.close(); });

function activeChart(workspace) {
  return workspace.boards.find(board => board.id === workspace.activeId).chart;
}

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('new charts draw every horizontal tick while saved interval settings still apply', () => {
  const workspace = boards.initialWorkspace();
  const chart = activeChart(workspace);
  chart.categories = Array.from({ length: 27 }, (_, index) => `第 ${index + 1} 项`);
  chart.series[0].values = chart.categories.map((_, index) => index + 1);
  const render = document => renderToStaticMarkup(createElement(ChartDisplay, { document }));

  assert.equal(chartTools.categoryTickLayout(chart).step, 1);
  const svg = render(chart);
  assert.equal([...svg.matchAll(/data-axis-tick="x"/g)].length, chart.categories.length);
  assert.match(svg, />第 27 项<\/text>/);
  assert.equal(chart.style.axes.y.tickMode, 'auto');

  chart.style = { ...chart.style, axes: { ...chart.style.axes, x: { ...chart.style.axes.x, tickMode: 'interval', interval: 3 } } };
  const restored = activeChart(storage.parseWorkspace(storage.serializeWorkspace(workspace)));
  assert.equal(chartTools.categoryTickLayout(restored).step, 3);
  assert.equal([...render(restored).matchAll(/data-axis-tick="x"/g)].length, 9);
});

test('random exercises cycle through matching scenarios and question types without adjacent repeats', () => {
  const generate = exercises.createExerciseGenerator(seededRandom(17));
  const topics = Object.keys(exercises.EXERCISE_TOPICS).filter(topic => topic !== 'all');
  const pools = [
    ['line', false, exerciseBank.AXIS_EXERCISES.line],
    ['bar', false, exerciseBank.AXIS_EXERCISES.bar],
    ['bar', true, Object.entries(exerciseBank.GROUPED_EXERCISES).flatMap(([topic, items]) =>
      items.map(item => ({ topic, ...item })))],
    ['pie', false, exerciseBank.PIE_EXERCISES],
    ['pictograph', false, exerciseBank.PICTOGRAPH_EXERCISES],
  ];
  for (const [kind, grouped, templates] of pools) {
    for (const topic of ['all', ...topics]) {
      const expected = templates.filter(template => topic === 'all' || template.topic === topic).map(template => template.title);
      assert.ok(expected.length >= 3);
      const titles = Array.from({ length: expected.length }, () => generate(kind, topic, 'chart', grouped).title);
      assert.deepEqual(new Set(titles), new Set(expected));
      const next = generate(kind, topic, 'chart', grouped);
      assert.notEqual(next.title, titles.at(-1));
      assert.equal(next.notes.length, 0);
    }
  }

  const pieQuestions = Array.from({ length: 4 }, () => generate('pie', 'school', 'random').notes[0].text);
  const typeOfQuestion = text => text.replace(/“[^”]+”/g, '“类别”');
  assert.equal(new Set(pieQuestions.slice(0, 3).map(typeOfQuestion)).size, 3);
  assert.notEqual(typeOfQuestion(pieQuestions[2]), typeOfQuestion(pieQuestions[3]));
});

test('generated values, questions and pictograph icons stay valid when scenarios are shuffled', () => {
  const generate = exercises.createExerciseGenerator(seededRandom(87));
  const pictographs = new Map(exerciseBank.PICTOGRAPH_EXERCISES.map(item => [item.title, item]));
  let nonAdjacentTrend = false;
  let shuffledIcons = false;
  for (const [kind, grouped] of [['line', false], ['bar', false], ['bar', true], ['pie', false], ['pictograph', false]]) {
    const types = exercises.exerciseTypes(kind, grouped).slice(2);
    for (const type of types) {
      for (let i = 0; i < 50; i++) {
        const chart = generate(kind, 'all', type, grouped);
        const { categories, series, style, notes } = chart;
        assert.equal(notes.length, 1);
        const question = notes[0].text;
        assert.ok(notes[0].exerciseQuestion && question.length > '问题：'.length);
        const referenced = [...question.matchAll(/“([^”]+)”/g)].map(([, category]) => categories.indexOf(category));
        assert.ok(referenced.every(index => index >= 0));
        assert.equal(series.length, grouped ? 2 : 1);
        assert.ok(series.every(item => item.values.length === categories.length));
        const values = series.flatMap(item => item.values);
        assert.ok(values.every(value => Number.isInteger(value) && value > 0));
        if (kind === 'pie') {
          assert.equal(values.reduce((sum, value) => sum + value, 0), 100);
          assert.equal(style.pie.percentageDigits, 0);
        } else {
          assert.equal(style.axes.x.tickMode, 'all');
          assert.ok(values.every(value => value % style.axes.y.interval === 0 && value < style.axes.y.maximum));
        }
        if (type === 'average') {
          for (const item of series) {
            const mean = item.values.reduce((sum, value) => sum + value, 0) / item.values.length;
            assert.equal(mean % style.axes.y.interval, 0);
          }
        }
        if (type === 'extremes' && !grouped) assert.equal(new Set(values).size, values.length);
        if (type === 'trend') {
          assert.ok(referenced[0] < referenced[1]);
          if (referenced[1] - referenced[0] > 1) nonAdjacentTrend = true;
        }
        if (type === 'countAtLeast') assert.ok(values.includes(Number(question.match(/至少为 (\d+)/)?.[1])));
        if (type === 'symbolValue') {
          assert.ok(values.some(value => value % style.pictograph.unit === style.pictograph.unit / 2));
        }
        if (kind === 'pictograph') {
          const template = pictographs.get(chart.title);
          if (Array.isArray(template.icon)) {
            assert.deepEqual(chart.pictographSymbols, categories.map(category => template.icon[template.categories.indexOf(category)]));
            if (categories.some((category, index) => category !== template.categories[index])) shuffledIcons = true;
          }
        }
      }
    }
  }
  assert.ok(nonAdjacentTrend);
  assert.ok(shuffledIcons);
});

test('a dense axis chart keeps every series name and grows the sheet to fit the legend', () => {
  const base = activeChart(boards.initialWorkspace());
  const names = Array.from({ length: 14 }, (_, index) => `年度借阅数据系列 ${index + 1}`);
  names[13] = '分馆每周图书借阅量和馆际流通数据统计一览（第十四组）';
  const chart = {
    ...base,
    series: names.map(name => ({ ...base.series[0], name })),
    notes: [{ id: 'note:1', text: '哪组的借阅量最高？', position: chartTools.EXERCISE_POSITION, exerciseQuestion: true }],
  };
  const layout = presentation.layoutSeriesLegend(chart);
  assert.equal(layout.entries.length, names.length);
  assert.deepEqual(layout.entries.map(entry => entry.lines.join('')), names);
  assert.ok(layout.entries.at(-1).lines.length > 1);
  assert.ok(layout.entries[0].y > chartTools.chartSheetHeight(chart));
  assert.ok(layout.sheetHeight > layout.entries.at(-1).y);

  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart }));
  assert.equal([...svg.matchAll(/data-series-legend-entry=""/g)].length, names.length);
  assert.ok(svg.includes(`viewBox="0 0 ${chartTools.WIDTH} ${layout.sheetHeight}"`));
  assert.ok(svg.includes(`<title>${names.at(-1)}</title>`));
});

test('dense vertical tick labels are spaced while their tick marks are retained', () => {
  const base = activeChart(boards.initialWorkspace());
  const y = { ...base.style.axes.y, tickMode: 'interval', interval: 1, maximum: 100 };
  const chart = { ...base, style: { ...base.style, axes: { ...base.style.axes, y }, showOrigin: true } };
  const scale = chartTools.getScale(chart.series, null, chartTools.getPlot(chart.style), y);
  const spaced = [...presentation.spacedTickLabels(scale.ticks, scale.y, true)];
  assert.ok(spaced.length > 1 && spaced.length < scale.ticks.length);
  assert.equal(spaced.at(-1), 100);
  assert.ok(Math.abs(scale.y(spaced[0]) - scale.y(0)) >= 18);
  assert.ok(spaced.slice(1).every((tick, index) => scale.y(spaced[index]) - scale.y(tick) >= 18));

  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart }));
  assert.equal([...svg.matchAll(/data-axis-tick="y"/g)].length, scale.ticks.length);
  assert.equal([...svg.matchAll(/data-tick-label="y"/g)].length, spaced.length);

  const omitted = { from: 26, to: 70 };
  const splitScale = chartTools.getScale(chart.series, null, chartTools.getPlot(chart.style), { ...y, omitted });
  const splitLabels = presentation.spacedTickLabels(splitScale.ticks, splitScale.y, true, splitScale.omission);
  assert.ok(splitLabels.has(omitted.from) && splitLabels.has(omitted.to));
});

test('axis toolbars expose label fonts, sizes and formatting while geometry stays in axis settings', () => {
  const workspace = boards.initialWorkspace();
  const chart = activeChart(workspace);
  const formats = { tickLabelBold: true, tickLabelItalic: true, tickLabelUnderline: true };
  const x = { ...chart.style.axes.x, ...formats, tickLabelFont: 'fangsong', tickLabelSize: 24 };
  const y = { ...chart.style.axes.y, ...formats, tickPosition: 'outside', tickLabelFont: 'mono', tickLabelSize: 27 };
  chart.style = { ...chart.style, axes: { x, y } };
  const restored = activeChart(storage.parseWorkspace(storage.serializeWorkspace(workspace)));
  assert.deepEqual(restored.style.axes.x, x);
  assert.deepEqual(restored.style.axes.y, y);

  const panel = renderToStaticMarkup(createElement(AxisPanel, { chart: restored, axis: 'y' }));
  assert.match(panel, /轴线样式/);
  assert.match(panel, /轴线长度/);
  assert.doesNotMatch(panel, /标值字体|标值字号/);
  const verticalToolbar = renderToStaticMarkup(createElement(AxisSelectionToolbar, { chart: restored, axis: 'y' }));
  assert.match(verticalToolbar, /标值字体<select/);
  assert.match(verticalToolbar, /<option value="mono" selected="">等宽<\/option>/);
  assert.match(verticalToolbar, /标值字号<input[^>]+value="27"/);
  const horizontalToolbar = renderToStaticMarkup(createElement(AxisSelectionToolbar, { chart: restored, axis: 'x' }));
  assert.match(horizontalToolbar, /标签字体<select/);
  assert.match(horizontalToolbar, /<option value="fangsong" selected="">仿宋<\/option>/);
  assert.match(horizontalToolbar, /标签字号<input[^>]+value="24"/);
  for (const [toolbar, prefix] of [[horizontalToolbar, '标签'], [verticalToolbar, '标值']]) {
    for (const label of ['加粗', '斜体', '下划线']) {
      assert.match(toolbar, new RegExp(`<button[^>]*aria-pressed="true" aria-label="${prefix}${label}"`));
    }
  }
  assert.doesNotMatch(horizontalToolbar + verticalToolbar, /轴线样式|轴线长度|箭头样式/);
  assert.match(horizontalToolbar, /刻度位置/);
  assert.match(horizontalToolbar, /网格线/);

  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: restored }));
  assert.match(svg, /<svg[^>]+style="font-synthesis:weight style"/);
  const labels = [...svg.matchAll(/<text [^>]*data-(?:tick-label="y"|origin="")[^>]*>/g)].map(match => match[0]);
  assert.ok(labels.length > 1);
  for (const label of labels) {
    assert.match(label, /font-size="27"[^>]*Consolas[^>]*font-weight="700" font-style="italic" text-decoration="underline"/);
  }
  const scale = chartTools.getScale(restored.series, null, chartTools.getPlot(restored), y);
  const positions = [0, ...presentation.spacedTickLabels(scale.ticks, scale.y, true, null, 27)].map(scale.y).sort((a, b) => a - b);
  assert.ok(positions.slice(1).every((position, index) => position - positions[index] >= 32 - 1e-6));
  assert.match(svg, /<text [^>]*font-size="24"[^>]*font-family="[^"]*FangSong[^"]*"[^>]*font-weight="700" font-style="italic" style="text-decoration:underline"[^>]*>周一<\/text>/);
  const individual = { ...restored, textStyles: { 0: { size: 18, font: 'serif', bold: false, italic: false, underline: false } } };
  const individualSvg = renderToStaticMarkup(createElement(ChartDisplay, { document: individual }));
  const individualLabel = individualSvg.match(/<text [^>]*font-size="18"[^>]*font-family="[^"]*SimSun[^"]*"[^>]*font-weight="500"[^>]*>周一<\/text>/);
  assert.ok(individualLabel);
  assert.doesNotMatch(individualLabel[0], /font-style|text-decoration/);
});

test('whole-axis formatting replaces only the matching category label overrides', () => {
  const base = activeChart(boards.initialWorkspace());
  const chart = {
    ...base,
    style: { ...base.style, axes: { ...base.style.axes, x: { ...base.style.axes.x, tickLabelFont: 'fangsong', tickLabelBold: true } } },
    textStyles: {
      0: { font: 'kai', size: 24, bold: false, color: '#ab1234' },
      1: { font: 'mono' },
      xLabel: { font: 'serif', size: 22 },
    },
  };
  const toolbar = renderToStaticMarkup(createElement(AxisSelectionToolbar, { chart, axis: 'x' }));
  assert.match(toolbar, /标签字体<select><option value="" disabled="" selected="">混合<\/option>/);
  assert.match(toolbar, /标签字号<input[^>]*placeholder="混合"/);
  assert.match(toolbar, /aria-pressed="mixed" aria-label="标签加粗"/);

  const vertical = chartTools.setTickLabelStyle(chart, 'y', 'tickLabelFont', 'serif');
  assert.equal(vertical.textStyles, chart.textStyles);
  const font = chartTools.setTickLabelStyle(chart, 'x', 'tickLabelFont', 'fangsong');
  assert.deepEqual(font.textStyles, { 0: { size: 24, bold: false, color: '#ab1234' }, xLabel: chart.textStyles.xLabel });
  const size = chartTools.setTickLabelStyle(font, 'x', 'tickLabelSize', 19);
  const bold = chartTools.setTickLabelStyle(size, 'x', 'tickLabelBold', true);
  assert.deepEqual(bold.textStyles, { 0: { color: '#ab1234' }, xLabel: chart.textStyles.xLabel });
  assert.equal(bold.style.axes.y, chart.style.axes.y);
  for (const index of [0, 1]) {
    const { font, size, bold: weight } = chartTools.getTextStyle(bold, index);
    assert.deepEqual({ font, size, bold: weight }, { font: 'fangsong', size: 19, bold: true });
  }
});

test('new axes use inward tick marks and 15-unit labels', () => {
  const chart = activeChart(boards.initialWorkspace());
  assert.equal(chart.style.axes.x.tickPosition, 'inside');
  assert.equal(chart.style.axes.y.tickPosition, 'inside');
  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart }));
  assert.match(svg, /<text [^>]*font-size="15"[^>]*>周一<\/text>/);
  assert.match(svg, /<text [^>]*font-size="15"[^>]*data-tick-label="y"/);
  for (const target of ['xLabel', 'yLabel']) {
    const title = chartTools.getTextStyle(chart, target);
    assert.equal(title.size, 15);
    assert.equal(title.bold, true);
  }
  const custom = { ...chart, textStyles: { yLabel: { size: 20, bold: false } } };
  assert.equal(chartTools.getTextStyle(custom, 'yLabel').size, 20);
  assert.equal(chartTools.getTextStyle(custom, 'yLabel').bold, false);
  const yTick = svg.match(/<line x1="([^"]+)" x2="([^"]+)"[^>]+data-axis-tick="y"/);
  const xTick = svg.match(/<line x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"[^>]+data-axis-tick="x"/);
  assert.ok(Number(yTick[1]) > Number(yTick[2]));
  assert.ok(Number(xTick[1]) < Number(xTick[2]));

  const negativeChart = { ...chart, series: chart.series.map(series => ({ ...series, values: series.values.map(value => -value) })) };
  const negativeSvg = renderToStaticMarkup(createElement(ChartDisplay, { document: negativeChart }));
  const negativeTick = negativeSvg.match(/<line x1="[^"]+" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"[^>]+data-axis-tick="x"/);
  assert.ok(Number(negativeTick[1]) > Number(negativeTick[2]));
});

test('point placement can use the nearest tick without crossing a broken axis', () => {
  const chart = activeChart(boards.initialWorkspace());
  const axis = { ...chart.style.axes.y, tickMode: 'interval', interval: 5, maximum: 30 };
  const plot = chartTools.getPlot(chart);
  const scale = chartTools.getScale(chart.series, null, plot, axis);
  assert.equal(scale.valueAt(scale.y(17)), 17);
  assert.equal(scale.valueAt(scale.y(17), true), 15);
  assert.equal(scale.valueAt(scale.y(1), true), 0);
  const split = chartTools.getScale(chart.series, null, plot, { ...axis, omitted: { from: 12, to: 22 } });
  assert.equal(split.valueAt(split.y(11.5), true), 12);
  assert.equal(split.valueAt(split.y(23), true), 22);
  assert.equal(split.valueAt(split.omission.top + 2, true), 22);
});

test('adding a category creates an empty point position in every series', () => {
  const chart = chartTools.blankChart('bar', true);
  const result = chartTools.appendCategory(chart);
  assert.equal(result.categories.length, chart.categories.length + 1);
  assert.equal(result.categories.at(-1), '类别 7');
  for (const [i, series] of result.series.entries()) {
    assert.deepEqual(series.values, [...chart.series[i].values, null]);
  }
  const withPoint = chartTools.setChartValue(result, 1, result.categories.length - 1, 5);
  assert.equal(withPoint.series[0].values.at(-1), null);
  assert.equal(withPoint.series[1].values.at(-1), 5);
});

test('column icons share tick centers and respect partial intervals and axis breaks', () => {
  const base = chartTools.blankChart('bar');
  const y = { ...base.style.axes.y, tickMode: 'interval', interval: 5 };
  const series = { ...base.series[0], values: [10, 7, -10], style: { columnIcon: { symbol: 'apple', colorMode: 'single' } } };
  const chart = {
    ...base, categories: ['A', 'B', 'C'], series: [series],
    style: { ...base.style, axes: { ...base.style.axes, y } },
  };
  const scale = chartTools.getScale(chart.series, null, chartTools.getPlot(chart), y);
  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart }));
  const centers = [...svg.matchAll(/<g data-column-icons=""[^>]*>(.*?)<\/g>/g)].map(([, group]) =>
    [...group.matchAll(/<use [^>]*y="([^"]+)"[^>]*height="([^"]+)"/g)].map(([, top, size]) => Number(top) + Number(size) / 2));
  const expected = [[2.5, 7.5], [2.5, 6], [-2.5, -7.5]].map(values => values.map(scale.y));
  assert.deepEqual(centers.map(values => values.length), [2, 2, 2]);
  for (const [index, column] of centers.entries()) {
    assert.ok(column.every((center, row) => Math.abs(center - expected[index][row]) < 1e-6));
  }

  const split = chartTools.getScale([{ ...series, values: [20, 5, -10] }], null, chartTools.getPlot(chart),
    { ...y, omitted: { from: 5, to: 15 } });
  assert.ok(presentation.columnIconRows(split).every(row =>
    row.bottom <= split.omission.top + 1e-6 || row.top >= split.omission.bottom - 1e-6));
  const dense = chartTools.getScale(chart.series, null, chartTools.getPlot(chart), { ...y, interval: 0.1 });
  assert.ok(presentation.columnIconRows(dense).length < 20);
});

test('the coordinate system can move near the foot of the sheet while allowing space for labels', () => {
  const base = activeChart(boards.initialWorkspace());
  const moveToBottom = chart => chartTools.movePlot(chart, { x: chart.plotOffset.x, y: 1000 });
  const defaultPlot = chartTools.getPlot(moveToBottom(base));
  assert.ok(defaultPlot.bottom >= 510);
  assert.equal(defaultPlot.bottom - defaultPlot.top, base.style.axes.y.length);

  const titleBelow = { ...base, style: { ...base.style, axes: { ...base.style.axes,
    x: { ...base.style.axes.x, titlePlacement: 'center' } } } };
  const centeredPlot = chartTools.getPlot(moveToBottom(titleBelow));
  assert.ok(centeredPlot.bottom < defaultPlot.bottom && centeredPlot.bottom > 470);
  assert.ok(chartTools.axisTitleLayout('x', centeredPlot, titleBelow).point.y < chartTools.HEIGHT - 12);

  const dense = { ...base, categories: Array(45).fill('较长的横轴类别名称'),
    style: { ...base.style, axes: { ...base.style.axes, x: { ...base.style.axes.x, tickMode: 'all' } } } };
  const layout = chartTools.categoryTickLayout(dense);
  assert.equal(layout.angled, true);
  assert.ok(chartTools.getPlot(moveToBottom(dense)).bottom + layout.labelOffset
    + layout.width * Math.sin(Math.PI / 3) < chartTools.HEIGHT - 12);
});

test('coincident values leave room for readable labels and keep isolated line markers', () => {
  const base = activeChart(boards.initialWorkspace());
  const chart = {
    ...base, categories: ['A', 'B', 'C'],
    series: ['#3455c5', '#b95030', '#087e77'].map((color, index) => ({
      name: `系列 ${index + 1}`, color, values: [null, 21, null],
      style: { dots: false, showLabels: true },
    })),
  };
  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart }));
  assert.equal([...svg.matchAll(/<circle /g)].length, 3);
  const values = [...svg.matchAll(/<text [^>]*y="([^"]+)"[^>]*data-value-label=""[^>]*>21<\/text>/g)];
  assert.equal(values.length, 2);
  assert.ok(Math.abs(Number(values[0][1]) - Number(values[1][1])) >= 19);
});

test('CSV import and a regional paste can be undone and redone independently', () => {
  const original = boards.initialWorkspace();
  const id = original.activeId;
  const data = table.importTable('\uFEFF日期,借阅量,归还量\r\n"周一,上午",12,\r\n周二,,5');
  const imported = boards.boardReducer(original, { type: 'edit', id, update: chart => table.replaceTable(chart, data) });
  assert.deepEqual(activeChart(imported).categories, ['周一,上午', '周二']);
  assert.deepEqual(activeChart(imported).series.map(series => series.values), [[12, null], [null, 5]]);
  assert.throws(() => table.parseTableBlock('20\t无效', 1, 1), /第 1 行、第 2 列/);

  const block = table.parseTableBlock('20\t4\r\n\t9', 1, 1);
  const pasted = boards.boardReducer(imported, { type: 'edit', id, update: chart => table.pasteTableBlock(chart, block, 1, 1) });
  assert.deepEqual(activeChart(pasted).series.map(series => series.values), [[20, null], [4, 9]]);

  const undoPaste = boards.boardReducer(pasted, { type: 'undo', id });
  const undoImport = boards.boardReducer(undoPaste, { type: 'undo', id });
  assert.deepEqual(activeChart(undoPaste), activeChart(imported));
  assert.deepEqual(activeChart(undoImport), activeChart(original));

  const redoImport = boards.boardReducer(undoImport, { type: 'redo', id });
  const redoPaste = boards.boardReducer(redoImport, { type: 'redo', id });
  assert.deepEqual(activeChart(redoImport), activeChart(imported));
  assert.deepEqual(activeChart(redoPaste), activeChart(pasted));
});

test('CSV and TSV distinguish text punctuation from separators', () => {
  const csv = 'Date,Budget;Plan;Actual\r\nA,12';
  const data = table.importTable(csv);
  assert.equal(data.series[0].name, 'Budget;Plan;Actual');
  assert.deepEqual(data.series[0].values, [12]);
  const chart = table.replaceTable(activeChart(boards.initialWorkspace()), data);
  assert.deepEqual(table.importTable(table.exportTable(chart)), data);

  const tsv = table.previewTable('Category\tActual, USD\r\nJan\t1\r\nFeb\t2');
  assert.equal(tsv.delimiter, '\t');
  assert.deepEqual(tsv.data.series[0].values, [1, 2]);
  assert.deepEqual(table.parseTableBlock('Apple, red\t1\nBanana\t2', 1, 0), [['Apple, red', 1], ['Banana', 2]]);

  const ambiguous = 'Date,Label;Other\nA,1\nB;2';
  assert.throws(() => table.previewTable(ambiguous), /分隔符/);
  assert.equal(table.previewTable(ambiguous, { delimiter: ';' }).delimiter, ';');
  assert.equal(table.previewTable(ambiguous, { delimiter: ';' }).unevenRows, 1);
  assert.deepEqual(table.previewTable('Date;Quantity\nA;12', { preferred: ',' }).data.series[0].values, [12]);
});

test('table files decode strict UTF-8, Excel UTF-16 and GBK before parsing', () => {
  const csv = '日期,借阅量\n周一,12';
  const utf16le = Buffer.from('\uFEFF' + csv, 'utf16le');
  const cases = [
    [new TextEncoder().encode(csv), 'utf-8'],
    [new TextEncoder().encode('\uFEFF' + csv), 'utf-8'],
    [utf16le, 'utf-16le'],
    [Buffer.from(utf16le).swap16(), 'utf-16be'],
    [Buffer.from('c8d5c6da2cbde8d4c4c1bf0ad6dcd2bb2c3132', 'hex'), 'gb18030'],
  ];
  for (const [bytes, encoding] of cases) {
    const buffer = Uint8Array.from(bytes).buffer;
    assert.deepEqual(table.decodeTableFile(buffer), { text: csv, encoding });
    assert.deepEqual(table.previewTable(table.decodeTableFile(buffer).text).data.categories, ['周一']);
  }
  assert.throws(() => table.decodeTableFile(Uint8Array.of(0xef, 0xbb, 0xbf, 0xc8, 0xd5).buffer), /另存为 UTF-8/);
  assert.throws(() => table.decodeTableFile(Uint8Array.of(0, 1, 2).buffer), /另存为 UTF-8/);
});

test('replacing a table matches repeated names in order and preserves their formatting', () => {
  const base = activeChart(boards.initialWorkspace());
  const previous = {
    ...base,
    categories: ['甲', '乙', '甲'],
    series: [
      { name: '数量', color: '#112233', values: [1, 2, 3] },
      { name: '数量', color: '#445566', values: [4, 5, 6] },
    ],
    hiddenCategoryLabels: [2],
    textStyles: { 0: { size: 14 }, 2: { size: 22 } },
    pieColors: ['#112233', null, '#445566'],
  };
  const data = table.importTable('日期,数量,数量,数量\n甲,21,22,23\n甲,31,32,33\n乙,41,42,43\n甲,51,52,53');
  const chart = table.replaceTable(previous, data);
  assert.deepEqual(chart.series.map(item => item.color), ['#112233', '#445566', data.series[2].color]);
  assert.deepEqual(chart.series[0].values, [21, 31, 41, 51]);
  assert.deepEqual(chart.textStyles, { 0: { size: 14 }, 1: { size: 22 } });
  assert.deepEqual(chart.hiddenCategoryLabels, [1]);
  assert.deepEqual(chart.pieColors, ['#112233', '#445566', null, null]);
});

test('large tables only mount editable cells for the current page', () => {
  const base = activeChart(boards.initialWorkspace());
  const categories = Array.from({ length: 600 }, (_, index) => `Row ${index + 1}`);
  const chart = { ...base, categories, series: [{ ...base.series[0], values: categories.map(() => 1) }] };
  const panel = renderToStaticMarkup(createElement(DataPanel, { chart, activeSeries: 0 }));
  assert.equal([...panel.matchAll(/data-table-row="/g)].length, 161);
  assert.match(panel, /aria-rowcount="601"/);
  assert.match(panel, /data-table-row="80"/);
  assert.doesNotMatch(panel, /data-table-row="81"/);
  assert.match(panel, /第 561–600 行/);
});

const workspaceKey = 'lineChartWorkspace';

function memoryStorage(t, shouldRejectWrite = () => false) {
  const items = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => items.get(key) ?? null,
      setItem(key, value) {
        if (shouldRejectWrite(key)) throw new Error('Storage quota exceeded');
        items.set(key, value);
      },
      removeItem: key => items.delete(key),
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  return items;
}

test('replacing an unreadable project keeps its original contents in the archive', t => {
  const items = memoryStorage(t);
  const unreadable = ' {"version":999} ';
  items.set(workspaceKey, unreadable);

  const startup = storage.loadWorkspace();
  assert.equal(startup.status, 'invalid');
  assert.equal(startup.source, unreadable);
  assert.equal(items.get(workspaceKey), unreadable);

  const next = boards.boardReducer(startup.workspace, { type: 'duplicate' });
  storage.replaceStoredWorkspace(next, startup.workspace, startup.source, true);
  assert.equal(storage.loadWorkspace().workspace.activeId, next.activeId);
  assert.deepEqual(storage.loadWorkspaceArchive(), [unreadable]);
});

test('a failed replacement retains both the saved project and its earlier checkpoint', t => {
  let rejectWorkspaceWrites = false;
  const items = memoryStorage(t, key => key === workspaceKey && rejectWorkspaceWrites);
  const original = boards.initialWorkspace();
  const current = boards.boardReducer(original, { type: 'duplicate' });
  const initial = storage.saveWorkspace(original, null);
  storage.replaceStoredWorkspace(current, original, initial.source);
  const savedProject = items.get(workspaceKey);
  const checkpoint = storage.loadWorkspaceCheckpoint();
  assert.equal(checkpoint.workspace.activeId, original.activeId);

  rejectWorkspaceWrites = true;
  assert.throws(() => storage.replaceStoredWorkspace(original, current, savedProject), /Storage quota exceeded/);
  assert.equal(items.get(workspaceKey), savedProject);
  assert.equal(storage.loadWorkspaceCheckpoint().source, checkpoint.source);
});

test('a stale tab cannot save, replace or change the view of a newer revision', t => {
  const items = memoryStorage(t);
  const original = boards.initialWorkspace();
  const initial = storage.saveWorkspace(original, null);
  const otherTab = storage.loadWorkspace();
  const edit = { type: 'edit', id: original.activeId, update: chart => chartTools.setChartValue(chart, 0, 0, 91) };
  const newer = boards.boardReducer(original, edit);
  const saved = storage.saveWorkspace(newer, initial.source);
  const zoomed = boards.boardReducer(otherTab.workspace, { type: 'zoom', id: original.activeId, value: 150 });
  assert(storage.sameWorkspaceContent(otherTab.workspace, zoomed));
  assert(storage.workspaceChanged(otherTab.snapshot.source));
  assert.throws(() => storage.saveWorkspace(zoomed, otherTab.snapshot.source), storage.WorkspaceConflict);
  assert.throws(() => storage.replaceStoredWorkspace(zoomed, otherTab.workspace, otherTab.snapshot.source), storage.WorkspaceConflict);
  assert.throws(() => storage.saveWorkspaceView(zoomed, otherTab.snapshot), storage.WorkspaceConflict);
  assert.equal(items.get(workspaceKey), saved.source);
  assert.equal(activeChart(storage.loadWorkspace().workspace).series[0].values[0], 91);
  assert.equal(storage.loadWorkspaceCheckpoint(), null);
});

test('selecting a board and changing its zoom do not rewrite saved chart data', t => {
  const items = memoryStorage(t);
  const original = boards.boardReducer(boards.initialWorkspace(), { type: 'duplicate' });
  const saved = storage.saveWorkspace(original, null);
  const selected = boards.boardReducer(original, { type: 'select', id: 1 });
  const zoomed = boards.boardReducer(selected, { type: 'zoom', id: 1, value: 150 });
  assert(storage.sameWorkspaceContent(original, zoomed));
  storage.saveWorkspaceView(zoomed, saved);
  assert.equal(items.get(workspaceKey), saved.source);
  const loaded = storage.loadWorkspace().workspace;
  assert.equal(loaded.activeId, 1);
  assert.equal(loaded.boards[0].zoom, 150);
});

test('existing values use vertical drag deltas and can be nudged above an axis limit', () => {
  const chart = chartTools.blankChart('bar');
  const plot = chartTools.getPlot(chart.style);
  const scale = chartTools.getScale([{ ...chart.series[0], values: [12.34, 100] }], null, plot,
    { ...chart.style.axes.y, maximum: 60 });
  assert.equal(scale.drag(12.34, 0), 12.34);
  assert.equal(scale.drag(12.34, scale.y(13.34) - scale.y(12.34)), 13.34);
  assert(scale.nudge(100, 1) > 100);
  assert(scale.nudge(100, -1) > 60);
  assert.equal(scale.drag(100, scale.y(59) - scale.y(60)), 99);
  assert.equal(scale.valueAt(scale.y(12.34)), 12);
});

test('dragged values stay concise in the chart, data table and export', () => {
  const base = chartTools.blankChart('line');
  const chart = chartTools.setChartValue(base, 0, 0, 12.34);
  const plot = chartTools.getPlot(chart);
  const scale = chartTools.getScale(chart.series, null, plot, { ...chart.style.axes.y, maximum: 60 });
  const dragged = scale.drag(12.34, scale.y(13.3471234567) - scale.y(12.34));
  assert.equal(dragged, 13.35);
  const changed = chartTools.setChartValue(chart, 0, 0, dragged);
  assert.match(renderToStaticMarkup(createElement(ChartDisplay, { document: changed })), /data-value-label=""[^>]*>13\.35<\/text>/);
  assert.match(renderToStaticMarkup(createElement(DataPanel, { chart: changed, activeSeries: 0 })), /value="13\.35"/);
  assert.match(table.exportTable(changed), /,13\.35\r?\n/);
  assert.equal(scale.drag(12.3449, scale.y(12.34495) - scale.y(12.3449)), 12.3449);
});

test('drag precision preserves small values and exact axis boundaries', () => {
  const chart = chartTools.blankChart('bar');
  const plot = chartTools.getPlot(chart);
  const axis = chart.style.axes.y;
  const small = chartTools.getScale(chart.series, null, plot, { ...axis, maximum: 0.0006 });
  assert.equal(small.drag(0.00012, small.y(0.00014623) - small.y(0.00012)), 0.000146);

  const omitted = { from: 12.1278, to: 22.3421 };
  const maximum = 30.5678;
  const split = chartTools.getScale(chart.series, null, plot, { ...axis, maximum, omitted });
  assert.equal(split.drag(10, split.y(12.1277) - split.y(10)), omitted.from);
  assert.equal(split.drag(25, split.y(22.3422) - split.y(25)), omitted.to);
  assert.equal(split.drag(25, split.y(maximum) - split.y(25)), maximum);
});

test('data label precision adapts to magnitude and only uses extra digits near other readings', () => {
  const labels = presentation.formatValueLabels([
    0, -42, 12345, 0.001234567, 1.234567e-7, 123456789, Number.MIN_VALUE, 13.3471234567, 13.3471234567,
    12.341210003, 12.341219999,
  ]);
  assert.equal(labels.get(0), '0');
  assert.equal(labels.get(-42), '-42');
  assert.equal(labels.get(12345), '12,345');
  assert.equal(labels.get(0.001234567), '≈0.001235');
  assert.equal(labels.get(1.234567e-7), '≈1.235E-7');
  assert.equal(labels.get(123456789), '≈1.235E8');
  assert.equal(labels.get(Number.MIN_VALUE), '5E-324');
  assert.equal(labels.get(13.3471234567), '≈13.35');
  assert.equal(labels.get(12.341210003), '≈12.34121');
  assert.equal(labels.get(12.341219999), '≈12.34122');

  const exact = presentation.formatValueLabels([1, 1 + Number.EPSILON]);
  assert.deepEqual([...exact.values()], ['1', '1.0000000000000002']);
});

test('data label formatting persists per series and a chart-wide change replaces the matching override', () => {
  const workspace = boards.initialWorkspace();
  const chart = activeChart(workspace);
  const shared = chartTools.setDataLabelStyle(chart, { font: 'fangsong', size: 25, color: '#315897', bold: false, italic: true, underline: true });
  const individual = chartTools.setDataLabelStyle(shared, { font: 'mono', size: 20, bold: true }, 0);
  const updated = chartTools.setDataLabelStyle(individual, { font: 'fangsong' });
  assert.deepEqual(updated.series[0].style.dataLabel, { size: 20, bold: true });
  workspace.boards.find(board => board.id === workspace.activeId).chart = updated;
  const restored = activeChart(storage.parseWorkspace(storage.serializeWorkspace(workspace)));
  assert.deepEqual(restored.style.dataLabel, updated.style.dataLabel);
  assert.deepEqual(restored.series[0].style.dataLabel, updated.series[0].style.dataLabel);

  const render = document => renderToStaticMarkup(createElement(ChartDisplay, { document }));
  for (const kind of ['line', 'bar', 'pictograph']) {
    const svg = render({ ...restored, kind });
    assert.match(svg, /font-size="20"[^>]*FangSong[^>]*font-weight="700" font-style="italic" text-decoration="underline"[^>]*data-value-label=/);
    assert.match(svg, /<text[^>]*data-value-label=""[^>]*fill="#315897"|<text[^>]*fill="#315897"[^>]*data-value-label=""/);
    assert.match(svg, /<text[^>]*>周一<\/text>/);
  }

  const pie = { ...chart, kind: 'pie', style: { ...chart.style, pie: {
    labelFont: 'mono', labelFontSize: 19, labelColor: '#315897', labelBold: false, labelItalic: true, labelUnderline: true,
  } } };
  workspace.boards.find(board => board.id === workspace.activeId).chart = pie;
  const pieSvg = render(activeChart(storage.parseWorkspace(storage.serializeWorkspace(workspace))));
  assert.match(pieSvg, /fill="#315897" font-size="19"[^>]*Consolas[^>]*font-weight="400" font-style="italic" text-decoration="underline"[^>]*data-value-label=/);
});

test('line and bar graphics show adaptive labels while point descriptions and tables show the original values', () => {
  const values = [13.3471234567, 12.341210003, 12.341219999, 123.456789, null, null];
  for (const kind of ['line', 'bar']) {
    const base = chartTools.blankChart(kind);
    const chart = { ...base, series: [{ ...base.series[0], values }], style: { ...base.style,
      axes: { ...base.style.axes, y: { ...base.style.axes.y, maximum: 60 } } } };
    const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: chart, tool: 'select' }));
    assert.match(svg, /data-value-label=""[^>]*>≈13\.35<\/text>/);
    assert.match(svg, /data-value-label=""[^>]*>≈12\.34121<\/text>/);
    assert.match(svg, /data-value-label=""[^>]*>≈12\.34122<\/text>/);
    assert.match(svg, /aria-label="A，数据 1，13\.3471234567"/);
    assert.match(svg, /<title>A，数据 1，13\.3471234567<\/title>/);
    if (kind === 'bar') assert.match(svg, /data-clipped-value="123\.456789"[^>]*>.*>≈123\.46<\/text>/);
    assert.match(renderToStaticMarkup(createElement(DataPanel, { chart, activeSeries: 0 })), /value="13\.3471234567"/);
    assert.match(table.exportTable(chart), /,13\.3471234567\r?\n/);
  }
});

test('SVG markup includes clipped values and export explanations for the affected charts', () => {
  const chart = chartTools.blankChart('bar');
  const clipped = { ...chart, series: [{ ...chart.series[0], values: [100, 15, null, null, null, null] }],
    style: { ...chart.style, showLabels: false, axes: { ...chart.style.axes, y: { ...chart.style.axes.y, maximum: 60, omitted: { from: 10, to: 20 } } } } };
  const svg = renderToStaticMarkup(createElement(ChartDisplay, { document: clipped, tool: 'select' }));
  assert.match(svg, /data-clipped-value="100"/);
  assert.match(svg, /data-export-note="" display="none"/);
  assert.match(svg, /纵轴上限 60/);
  assert.match(svg, /断轴省略区间（10 至 20）/);

  const pie = { ...clipped, kind: 'pie', series: [{ ...chart.series[0], values: [15, -2, null, null, null, null] }] };
  assert.match(renderToStaticMarkup(createElement(ChartDisplay, { document: pie, tool: 'select' })), /1 个负值未绘制/);
});

test('export reveals chart explanations in the clone before measuring its crop', async t => {
  const note = new Map([['display', 'none'], ['aria-hidden', 'true']]);
  let captured;
  let pngSize;
  let bounds = { x: 10, y: 10, width: 100, height: 600 };
  const attributes = new Map();
  const clone = {
    querySelectorAll: selector => selector === '[data-export-note]' ? [{ removeAttribute: key => note.delete(key) }] : [],
    getAttribute: key => attributes.get(key) ?? null,
    hasAttribute: () => false,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: () => {},
    querySelector: () => null,
    getBBox: () => {
      assert.equal(note.has('display'), false);
      assert.equal(note.has('aria-hidden'), false);
      return bounds;
    },
  };
  const fixtures = {
    document: { body: { appendChild() {} }, createElement(tag) {
      if (tag === 'a') return { click() {}, remove() {} };
      if (tag === 'canvas') return {
        getContext: () => ({ drawImage() {} }),
        toBlob(callback, type) {
          pngSize = [this.width, this.height];
          callback(new Blob(['image'], { type }));
        },
      };
      return { appendChild() {}, remove() {}, style: {} };
    } },
    window: { setTimeout() {} },
    Image: class { async decode() {} },
    XMLSerializer: class { serializeToString() { return '<svg>裁切说明</svg>'; } },
  };
  for (const [key, value] of Object.entries(fixtures)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  t.mock.method(URL, 'createObjectURL', blob => { captured = blob; return 'blob:chart'; });
  await downloads.exportChartSvg({ cloneNode: () => clone }, 'chart');
  assert.match(await captured.text(), /裁切说明/);
  note.set('display', 'none');
  note.set('aria-hidden', 'true');
  await downloads.exportChartImage({ cloneNode: () => clone }, 'chart');
  assert.equal(captured.type, 'image/png');
  assert.deepEqual(pngSize, [296, 1296]);

  bounds = { x: 101.25, y: 200, width: 300.5, height: 0 };
  await downloads.exportChartSvg({ cloneNode: () => clone }, 'chart');
  assert.equal(attributes.get('viewBox'), '77 176 349 48');
  bounds = { x: 150, y: 200.5, width: 0, height: 20.25 };
  await downloads.exportChartSvg({ cloneNode: () => clone }, 'chart');
  assert.equal(attributes.get('viewBox'), '126 176 48 69');

  bounds = { x: 0, y: 0, width: 0, height: 0 };
  attributes.set('viewBox', '0 0 920 950');
  await downloads.exportChartSvg({ cloneNode: () => clone }, 'chart');
  assert.equal(attributes.get('viewBox'), '0 0 920 950');

  for (const [width, height] of [[1000, 20000], [6000, 6000]]) {
    bounds = { x: 0, y: 0, width, height };
    await downloads.exportChartImage({ cloneNode: () => clone }, 'chart');
    assert.ok(Math.max(...pngSize) <= 8192);
    assert.ok(pngSize[0] * pngSize[1] <= 16_000_000);
    assert.ok(Math.abs(pngSize[0] / pngSize[1] - (width + 48) / (height + 48)) < 0.002);
    assert.deepEqual(pngSize, [Number(attributes.get('width')), Number(attributes.get('height'))]);
  }
});

test('chart shortcut scopes distinguish editing focus from sidebar controls and popovers', () => {
  const target = (...selectors) => ({ closest: query => query.split(', ').some(selector => selectors.includes(selector)) });
  assert.equal(shortcuts.workspaceShortcutScope(target('.chart-sheet')), 'canvas');
  assert.equal(shortcuts.workspaceShortcutScope(target('.toolbar-strip')), 'object');
  assert.equal(shortcuts.workspaceShortcutScope(target('.canvas-view-controls')), 'tools');
  assert.equal(shortcuts.workspaceShortcutScope(target('.board-list')), 'workspace');
  assert.equal(shortcuts.workspaceShortcutScope(target('#data-panel')), 'workspace');
  assert.equal(shortcuts.workspaceShortcutScope(target('.toolbar-strip', 'input')), 'blocked');
  assert.equal(shortcuts.workspaceShortcutScope(target('.toolbar-strip', '[popover]')), 'blocked');
});

test('a fresh SVG export embeds Noto Emoji icons and adds their license', async () => {
  const names = ['apple', 'soccer', 'badminton', 'keyboard', 'peach', 'panda', 'hospital', 'grin', 'train'];
  const images = names.map(name => {
    const attributes = new Map([['data-pictograph-symbol', name]]);
    return {
      getAttribute: key => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: key => attributes.delete(key),
    };
  });
  const children = [];
  const svg = {
    namespaceURI: 'http://www.w3.org/2000/svg',
    ownerDocument: { createElementNS: (_namespace, tag) => ({ tag, textContent: '' }) },
    querySelectorAll: () => images,
    prepend: element => children.unshift(element),
  };

  assert(names.every(name => assets.cachedPictographImage(name) === undefined));
  await assets.hydratePictographImages(svg);
  for (const image of images) {
    assert.match(decodeURIComponent(image.getAttribute('href')), /^data:image\/svg\+xml,<svg(?:\s|>)/);
  }
  const [credits] = children;
  assert.equal(credits.tag, 'metadata');
  assert.match(credits.textContent, /googlefonts\/noto-emoji/);
  assert.match(credits.textContent, /Apache License/);
});

test('each selectable Noto Emoji graphic has an offline asset', async () => {
  const names = Object.keys(iconCatalog);
  assert.ok(names.length >= 300);
  const images = await Promise.all(names.map(name => assets.loadPictographImage(name)));
  assert.ok(images.every(image => decodeURIComponent(image).startsWith('data:image/svg+xml,<svg')));
});

test('icon picker uses the available space below before considering an upward placement', () => {
  const position = iconPickerPosition({ left: 635, top: 270, bottom: 310 }, 760, 575);
  assert.deepEqual(position, { top: 316, left: 398, width: 354, height: 251 });
  const bottom = iconPickerPosition({ left: 20, top: 525, bottom: 565 }, 320, 600);
  assert.deepEqual(bottom, { top: 119, left: 8, width: 304, height: 400 });
});
