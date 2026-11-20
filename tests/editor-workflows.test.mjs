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
let downloads;
let shortcuts;

before(async () => {
  server = await createServer({
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  [boards, table, storage, assets, chartTools, presentation, { default: ChartDisplay }, { default: DataPanel }, downloads, shortcuts] = await Promise.all([
    server.ssrLoadModule('/boards.ts'),
    server.ssrLoadModule('/tabular.ts'),
    server.ssrLoadModule('/workspaceStorage.ts'),
    server.ssrLoadModule('/pictographAssets.ts'),
    server.ssrLoadModule('/chart.ts'),
    server.ssrLoadModule('/chartPresentation.ts'),
    server.ssrLoadModule('/components/ChartDisplay.tsx'),
    server.ssrLoadModule('/components/DataPanel.tsx'),
    server.ssrLoadModule('/downloads.ts'),
    server.ssrLoadModule('/workspaceShortcuts.ts'),
  ]);
});

after(async () => { await server?.close(); });

function activeChart(workspace) {
  return workspace.boards.find(board => board.id === workspace.activeId).chart;
}

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

test('a fresh SVG export embeds all referenced icon libraries and adds their credits', async () => {
  const names = ['apple', 'badminton', 'keyboard', 'peach', 'panda'];
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
  assert.match(credits.textContent, /MIT License/);
  assert.match(credits.textContent, /Apache License/);
});
