import { blankChart, getPlot } from './chart';
import type { ChartDocument, ChartKind } from './types';

interface Exercise {
  topic: Exclude<ExerciseTopic, 'all'>;
  title: string;
  xLabel: string;
  yLabel: string;
  series: string;
  categories: string[];
  step: number;
}

export const EXERCISE_TOPICS = {
  all: '不限题材', school: '校园阅读', life: '日常生活', sports: '运动健康', nature: '自然天气',
  traffic: '交通出行', energy: '节水节电', festivals: '节日活动', shopping: '商店经营',
} as const;
export type ExerciseTopic = keyof typeof EXERCISE_TOPICS;
export const EXERCISE_TYPES = {
  chart: '只生成图', random: '随机题型', reading: '读图取数', difference: '比较差值', total: '求总数',
  average: '求平均数', extremes: '找最大最小', trend: '分析变化',
} as const;
export type ExerciseType = keyof typeof EXERCISE_TYPES;
type QuestionType = Exclude<ExerciseType, 'chart' | 'random'>;

export function exerciseTypes(kind: ChartKind) {
  return (Object.keys(EXERCISE_TYPES) as ExerciseType[]).filter(type => kind === 'line' || type !== 'trend');
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月'];
const EXERCISES: Record<ChartKind, Exercise[]> = {
  line: [
    { topic: 'school', title: '一周课外阅读时间', xLabel: '日期', yLabel: '时间（分钟）', series: '阅读时间', categories: WEEKDAYS, step: 5 },
    { topic: 'school', title: '一周图书借阅量', xLabel: '日期', yLabel: '借阅量（本）', series: '借阅量', categories: WEEKDAYS, step: 2 },
    { topic: 'life', title: '上半年展览参观人数', xLabel: '月份', yLabel: '人数（人）', series: '参观人数',
      categories: MONTHS, step: 10 },
    { topic: 'life', title: '一周回收废纸重量', xLabel: '日期', yLabel: '重量（千克）', series: '废纸重量', categories: WEEKDAYS, step: 2 },
    { topic: 'sports', title: '一周跳绳训练时间', xLabel: '日期', yLabel: '时间（分钟）', series: '训练时间', categories: WEEKDAYS, step: 5 },
    { topic: 'sports', title: '一周步行步数', xLabel: '日期', yLabel: '步数（步）', series: '步数', categories: WEEKDAYS, step: 1000 },
    { topic: 'nature', title: '一周每日降雨量', xLabel: '日期', yLabel: '降雨量（毫米）', series: '降雨量', categories: WEEKDAYS, step: 5 },
    { topic: 'nature', title: '一周每日最高气温', xLabel: '日期', yLabel: '气温（℃）', series: '最高气温', categories: WEEKDAYS, step: 5 },
    { topic: 'traffic', title: '各时段公交站上车人数', xLabel: '时段', yLabel: '人数（人）', series: '上车人数',
      categories: ['7时', '8时', '9时', '10时', '11时', '12时'], step: 5 },
    { topic: 'traffic', title: '一周共享单车借用次数', xLabel: '日期', yLabel: '次数（次）', series: '借用次数', categories: WEEKDAYS, step: 10 },
    { topic: 'energy', title: '上半年家庭用电量', xLabel: '月份', yLabel: '用电量（千瓦时）', series: '用电量', categories: MONTHS, step: 20 },
    { topic: 'energy', title: '节水周每天回收的雨水量', xLabel: '日期', yLabel: '水量（升）', series: '雨水量', categories: WEEKDAYS, step: 5 },
    { topic: 'festivals', title: '端午假期每天的龙舟观赛人数', xLabel: '日期', yLabel: '人数（人）', series: '观赛人数',
      categories: ['第一天', '第二天', '第三天'], step: 20 },
    { topic: 'festivals', title: '春节前一周年货集市客流', xLabel: '日期', yLabel: '人数（人）', series: '客流量', categories: WEEKDAYS, step: 50 },
    { topic: 'shopping', title: '一周面包销售量', xLabel: '日期', yLabel: '销量（个）', series: '面包销量', categories: WEEKDAYS, step: 5 },
    { topic: 'shopping', title: '上半年文具店练习本销量', xLabel: '月份', yLabel: '销量（本）', series: '练习本销量', categories: MONTHS, step: 20 },
  ],
  bar: [
    { topic: 'nature', title: '校园各处花盆数量', xLabel: '地点', yLabel: '数量（盆）', series: '花盆数量',
      categories: ['校门', '操场', '花园', '走廊', '教室'], step: 2 },
    { topic: 'sports', title: '同学们最喜欢的运动', xLabel: '运动', yLabel: '人数（人）', series: '人数',
      categories: ['跑步', '足球', '篮球', '跳绳', '游泳'], step: 1 },
    { topic: 'school', title: '图书角各类图书数量', xLabel: '类别', yLabel: '数量（本）', series: '图书数量',
      categories: ['故事', '科普', '艺术', '历史', '地理'], step: 5 },
    { topic: 'school', title: '各班捐赠的图书数量', xLabel: '班级', yLabel: '数量（本）', series: '捐赠数量',
      categories: ['一班', '二班', '三班', '四班'], step: 5 },
    { topic: 'life', title: '最受欢迎的早餐', xLabel: '早餐', yLabel: '人数（人）', series: '人数',
      categories: ['粥', '面条', '包子', '面包', '鸡蛋'], step: 2 },
    { topic: 'life', title: '社区各类可回收物重量', xLabel: '种类', yLabel: '重量（千克）', series: '回收重量',
      categories: ['纸张', '塑料', '金属', '玻璃'], step: 5 },
    { topic: 'sports', title: '各组选手的投篮命中数', xLabel: '组别', yLabel: '命中数（次）', series: '命中数',
      categories: ['第一组', '第二组', '第三组', '第四组'], step: 2 },
    { topic: 'nature', title: '校园观察到的鸟类数量', xLabel: '鸟类', yLabel: '数量（只）', series: '数量',
      categories: ['麻雀', '燕子', '喜鹊', '白头鹎'], step: 2 },
    { topic: 'traffic', title: '学生上学方式调查', xLabel: '方式', yLabel: '人数（人）', series: '人数',
      categories: ['步行', '骑车', '公交', '地铁', '乘车'], step: 2 },
    { topic: 'traffic', title: '各站点的停车数量', xLabel: '站点', yLabel: '数量（辆）', series: '停车数量',
      categories: ['广场站', '公园站', '图书馆站', '体育馆站'], step: 5 },
    { topic: 'energy', title: '各班一周节电量', xLabel: '班级', yLabel: '节电量（千瓦时）', series: '节电量',
      categories: ['一班', '二班', '三班', '四班', '五班'], step: 2 },
    { topic: 'energy', title: '各组收集的雨水量', xLabel: '组别', yLabel: '水量（升）', series: '雨水量',
      categories: ['第一组', '第二组', '第三组', '第四组'], step: 5 },
    { topic: 'festivals', title: '元宵游园各项目参与人数', xLabel: '项目', yLabel: '人数（人）', series: '参与人数',
      categories: ['猜灯谜', '剪纸', '做花灯', '包元宵'], step: 5 },
    { topic: 'festivals', title: '端午集市各口味粽子销量', xLabel: '口味', yLabel: '销量（个）', series: '粽子销量',
      categories: ['豆沙', '鲜肉', '红枣', '蛋黄'], step: 10 },
    { topic: 'shopping', title: '果蔬店各类水果销量', xLabel: '水果', yLabel: '销量（千克）', series: '水果销量',
      categories: ['苹果', '香蕉', '梨', '橙子', '葡萄'], step: 5 },
    { topic: 'shopping', title: '书店各类书籍销售量', xLabel: '书籍类别', yLabel: '销量（本）', series: '书籍销量',
      categories: ['绘本', '童话', '科普', '漫画', '历史'], step: 10 },
  ],
};

function draw<T>(items: T[], count: number, random: () => number) {
  const pool = [...items];
  return Array.from({ length: count }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
}

function averageValues(count: number, random: () => number) {
  const pairs = Math.floor(count / 2);
  const center = pairs + 1 + Math.floor(random() * (9 - 2 * pairs));
  const room = Math.min(center - 1, 9 - center);
  const offsets = draw(Array.from({ length: room }, (_, i) => i + 1), pairs, random);
  const values = offsets.flatMap(offset => [center - offset, center + offset]);
  if (count % 2) values.push(center);
  return draw(values, count, random);
}

function question(type: QuestionType, categories: string[], random: () => number) {
  switch (type) {
    case 'reading': {
      const [item] = draw(categories, 1, random);
      return `“${item}”对应的数值是多少？`;
    }
    case 'difference': {
      const [first, second] = draw(categories, 2, random);
      return `“${first}”和“${second}”的数值相差多少？`;
    }
    case 'total': return '图中各项的数值合计是多少？';
    case 'average': return '图中各项的平均数是多少？';
    case 'extremes': return '哪一项的数值最大？哪一项最小？相差多少？';
    case 'trend': {
      const start = Math.floor(random() * (categories.length - 1));
      return `从“${categories[start]}”到“${categories[start + 1]}”，数值怎样变化？变化了多少？`;
    }
  }
}

export function randomChart(kind: ChartKind, random = Math.random, topic: ExerciseTopic = 'all', type: ExerciseType = 'chart'): ChartDocument {
  const choices = topic === 'all' ? EXERCISES[kind] : EXERCISES[kind].filter(exercise => exercise.topic === topic);
  const exercise = choices[Math.floor(random() * choices.length)];
  const { title, xLabel, yLabel, series, categories, step } = exercise;
  const chart = blankChart(kind);
  const availableTypes = exerciseTypes(kind);
  const chosenType = type === 'random' ? draw(availableTypes.slice(2), 1, random)[0] : type;
  const units = chosenType === 'average' ? averageValues(categories.length, random)
    : draw(Array.from({ length: 9 }, (_, index) => index + 1), categories.length, random);
  const values = units.map(value => value * step);
  const plot = getPlot(chart.style);
  const notes = chosenType !== 'chart' && chosenType !== 'random' && availableTypes.includes(chosenType)
    ? [{ id: 'note:1' as const, text: `问题：${question(chosenType, categories, random)}`, position: { x: plot.left, y: plot.bottom + 103 } }]
    : [];
  return {
    ...chart, title, xLabel, yLabel, categories: [...categories], notes,
    series: [{ ...chart.series[0], name: series, values }],
    style: {
      ...chart.style,
      showLabels: false,
      axes: {
        ...chart.style.axes,
        y: { ...chart.style.axes.y, maximum: step * 10, interval: step, tickMode: 'interval' },
      },
    },
  };
}
