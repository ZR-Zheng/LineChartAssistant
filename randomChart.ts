import { blankChart, EXERCISE_POSITION } from './chart';
import { AXIS_EXERCISES, GROUPED_EXERCISES, PICTOGRAPH_EXERCISES, PIE_EXERCISES } from './exerciseBank';
import type { ExerciseTopic, GroupedExercise } from './exerciseBank';
import type { ChartDocument, ChartKind, TextNote } from './types';

export { EXERCISE_TOPICS } from './exerciseBank';
export type { ExerciseTopic } from './exerciseBank';

export const EXERCISE_TYPES = {
  chart: '只生成图', random: '随机题型', reading: '读图取数', difference: '比较差值', total: '求总数',
  average: '求平均数', extremes: '找最大最小', trend: '分析变化', countAtLeast: '按条件计数', share: '读百分比',
  shareDifference: '比较占比', compareGroups: '同类对比', groupTotal: '同类求合计', compareTotals: '比较合计',
  symbolValue: '读图标',
} as const;
export type ExerciseType = keyof typeof EXERCISE_TYPES;
type QuestionType = Exclude<ExerciseType, 'chart' | 'random'>;
type ChartVariant = ChartKind | 'groupedBar';
type Picker = <T>(items: readonly T[], key: string) => T;

const BASIC_QUESTIONS = ['reading', 'difference', 'total', 'average', 'extremes'] as const;
const QUESTIONS: Record<ChartVariant, readonly QuestionType[]> = {
  line: [...BASIC_QUESTIONS, 'trend', 'countAtLeast'],
  bar: [...BASIC_QUESTIONS, 'countAtLeast'],
  groupedBar: ['reading', 'difference', 'compareGroups', 'groupTotal', 'compareTotals', 'total', 'average', 'extremes'],
  pie: ['share', 'shareDifference', 'extremes'],
  pictograph: ['symbolValue', ...BASIC_QUESTIONS, 'countAtLeast'],
};

function chartVariant(kind: ChartKind, grouped: boolean): ChartVariant {
  return kind === 'bar' && grouped ? 'groupedBar' : kind;
}

export function exerciseTypes(kind: ChartKind, grouped = false): ExerciseType[] {
  return ['chart', 'random', ...QUESTIONS[chartVariant(kind, grouped)]];
}

function exerciseNote(text: string): TextNote {
  return { id: 'note:1', text: `问题：${text}`, position: EXERCISE_POSITION, exerciseQuestion: true };
}

function randomIndex(length: number, random: () => number) {
  return Math.floor(random() * length);
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[randomIndex(items.length, random)];
}

function draw<T>(items: readonly T[], count: number, random: () => number) {
  const pool = [...items];
  return Array.from({ length: count }, () => pool.splice(randomIndex(pool.length, random), 1)[0]);
}

function categoryOrder(count: number, ordered: boolean, random: () => number) {
  const indices = Array.from({ length: count }, (_, index) => index);
  return ordered ? indices : draw(indices, count, random);
}

function questionType(variant: ChartVariant, type: ExerciseType, select: Picker) {
  const available = QUESTIONS[variant];
  if (type === 'random') return select(available, `question:${variant}`);
  if (type !== 'chart' && available.includes(type)) return type;
}

const TICK_UNITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const GROUPED_UNITS = [...TICK_UNITS, 10];

function wholeAverage(units: number[], allowed: number[], random: () => number) {
  const index = randomIndex(units.length, random);
  const subtotal = units.reduce((sum, value) => sum + value, 0) - units[index];
  const choices = allowed.filter(value => (subtotal + value) % units.length === 0);
  return units.map((value, i) => i === index ? pick(choices, random) : value);
}

function singleSeriesUnits(count: number, type: QuestionType | undefined, random: () => number) {
  if (type === 'extremes') return draw(TICK_UNITS, count, random);

  const units = Array.from({ length: count }, () => pick(TICK_UNITS, random));
  if (type === 'average') return wholeAverage(units, TICK_UNITS, random);
  if (type === 'symbolValue' && units.every(unit => unit % 2 === 0)) {
    units[randomIndex(units.length, random)]--;
  }
  return units;
}

function pieValues(count: number, random: () => number) {
  const weights = draw(TICK_UNITS, count, random);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  // Keep every slice large enough to read while using whole percentages that sum to 100.
  const minimumShare = 8;
  const remainder = 100 - minimumShare * count;
  const values = weights.map(weight => minimumShare + Math.floor(weight / total * remainder));
  const unassigned = 100 - values.reduce((sum, value) => sum + value, 0);
  const largest = [...weights.keys()].sort((a, b) => weights[b] - weights[a]);
  for (const index of largest.slice(0, unassigned)) values[index]++;
  return values;
}

function question(type: QuestionType, categories: string[], values: number[], random: () => number, kind: ChartKind) {
  switch (type) {
    case 'symbolValue': return '一个完整的图标代表多少？半个图标代表多少？';
    case 'reading': return `“${pick(categories, random)}”对应的数值是多少？`;
    case 'difference':
    case 'shareDifference': {
      const [first, second] = draw(categories, 2, random);
      return type === 'difference' ? `“${first}”和“${second}”的数值相差多少？`
        : `“${first}”和“${second}”的占比相差多少个百分点？`;
    }
    case 'total': return '图中各项的数值合计是多少？';
    case 'average': return '图中各项的平均数是多少？';
    case 'extremes': return kind === 'pie' ? '哪一项占比最大？哪一项占比最小？' : '哪一项的数值最大？哪一项最小？相差多少？';
    case 'share': return `“${pick(categories, random)}”占总数的百分之多少？`;
    case 'trend': {
      const [start, end] = draw([...categories.keys()], 2, random).sort((a, b) => a - b);
      return `与“${categories[start]}”相比，“${categories[end]}”的数值怎样变化？变化了多少？`;
    }
    case 'countAtLeast': {
      const minimum = Math.min(...values);
      const choices = [...new Set(values.filter(value => value > minimum))];
      const threshold = choices.length ? pick(choices, random) : minimum;
      return `图中有几项的数值至少为 ${threshold}？`;
    }
  }
}

function groupedQuestion(type: QuestionType, categories: string[], [first, second]: GroupedExercise['names'], random: () => number) {
  const group = pick([first, second], random);
  const category = pick(categories, random);
  switch (type) {
    case 'reading': return `“${category}”一项中，${group}的数值是多少？`;
    case 'difference': return `“${category}”一项中，${first}与${second}相差多少？`;
    case 'compareGroups': return `“${category}”一项中，${first}与${second}哪个数值更大，还是相同？`;
    case 'groupTotal': return `“${category}”一项中，${first}与${second}的数值合计是多少？`;
    case 'compareTotals': return `${first}与${second}各项合计各是多少？比较两者。`;
    case 'total': return `只看${group}，各项数值合计是多少？`;
    case 'average': return `只看${group}，各项数值的平均数是多少？`;
    case 'extremes': return `${group}的最大值和最小值各是多少？相差多少？`;
  }
}

function exerciseAxes(chart: ChartDocument, step: number, largest: number): ChartDocument['style']['axes'] {
  const { x, y } = chart.style.axes;
  return { x, y: { ...y, maximum: largest + step, interval: step, tickMode: 'interval' } };
}

function groupedChart(random: () => number, topic: ExerciseTopic, type: QuestionType | undefined, select: Picker): ChartDocument {
  const choices = topic === 'all' ? Object.values(GROUPED_EXERCISES).flat() : GROUPED_EXERCISES[topic];
  const { title, xLabel, yLabel, categories: labels, names, pairs, step, ordered } = select(choices, `template:groupedBar:${topic}`);
  const chart = blankChart('bar', true);
  const order = categoryOrder(labels.length, ordered === true, random);
  const categories = order.map(index => labels[index]);
  const series = names.map((name, group) => {
    const units = order.map(index => Math.max(1, pairs[index][group] + randomIndex(5, random) - 2));
    const values = (type === 'average' ? wholeAverage(units, GROUPED_UNITS, random) : units).map(value => value * step);
    return { ...chart.series[group], name, values };
  });
  const notes = type ? [exerciseNote(groupedQuestion(type, categories, names, random))] : [];
  const largest = Math.max(...series.flatMap(item => item.values));
  return {
    ...chart, title, xLabel, yLabel, categories, series, notes,
    style: { ...chart.style, showLabels: false, axes: exerciseAxes(chart, step, largest) },
  };
}

function generateChart(kind: ChartKind, random: () => number, topic: ExerciseTopic, type: ExerciseType, grouped: boolean, select: Picker): ChartDocument {
  const variant = chartVariant(kind, grouped);
  const chosenType = questionType(variant, type, select);
  if (variant === 'groupedBar') return groupedChart(random, topic, chosenType, select);

  const templates = kind === 'pie' ? PIE_EXERCISES : kind === 'pictograph' ? PICTOGRAPH_EXERCISES : AXIS_EXERCISES[kind];
  const choices = topic === 'all' ? templates : templates.filter(exercise => exercise.topic === topic);
  const exercise = select(choices, `template:${variant}:${topic}`);
  const { title, xLabel, yLabel, series, categories: labels, step = 1, ordered, icon } = exercise;
  const order = categoryOrder(labels.length, kind === 'line' || ordered === true, random);
  const categories = order.map(index => labels[index]);
  const chart = blankChart(kind);
  const values = kind === 'pie' ? pieValues(categories.length, random)
    : singleSeriesUnits(categories.length, chosenType, random).map(unit => unit * step);
  const notes = chosenType ? [exerciseNote(question(chosenType, categories, values, random, kind))] : [];

  return {
    ...chart, title, xLabel, yLabel, categories, notes,
    ...(Array.isArray(icon) && { pictographSymbols: order.map(index => icon[index]) }),
    series: [{ ...chart.series[0], name: series, values }],
    style: {
      ...chart.style,
      showLabels: kind === 'pie',
      ...(kind === 'pie' ? { pie: { percentageDigits: 0 } } : { axes: exerciseAxes(chart, step, Math.max(...values)) }),
      ...(icon && { pictograph: {
        ...(typeof icon === 'string' ? { symbol: icon } : { symbolMode: 'category', direction: 'vertical' }),
        colorMode: 'color', unit: step * (chosenType === 'symbolValue' ? 2 : 1),
      } }),
    },
  };
}

export function randomChart(kind: ChartKind, random = Math.random, topic: ExerciseTopic = 'all', type: ExerciseType = 'chart', grouped = false) {
  return generateChart(kind, random, topic, type, grouped, items => pick(items, random));
}

export function createExerciseGenerator(random = Math.random) {
  const cycles = new Map<string, { used: Set<number>; last: number }>();
  const select: Picker = (items, key) => {
    const cycle = cycles.get(key) ?? { used: new Set<number>(), last: -1 };
    if (cycle.used.size === items.length) cycle.used.clear();
    const available = [...items.keys()].filter(index => !cycle.used.has(index) && (index !== cycle.last || items.length === 1));
    const index = pick(available, random);
    cycle.used.add(index);
    cycle.last = index;
    cycles.set(key, cycle);
    return items[index];
  };
  return (kind: ChartKind, topic: ExerciseTopic = 'all', type: ExerciseType = 'chart', grouped = false) =>
    generateChart(kind, random, topic, type, grouped, select);
}
