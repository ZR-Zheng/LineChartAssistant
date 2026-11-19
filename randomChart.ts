import { blankChart } from './chart';
import type { ChartDocument, ChartKind } from './types';

interface Exercise {
  title: string;
  xLabel: string;
  yLabel: string;
  series: string;
  categories: string[];
  step: number;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const EXERCISES: Record<ChartKind, Exercise[]> = {
  line: [
    { title: '一周课外阅读时间', xLabel: '日期', yLabel: '时间（分钟）', series: '阅读时间', categories: WEEKDAYS, step: 5 },
    { title: '一周图书借阅量', xLabel: '日期', yLabel: '借阅量（本）', series: '借阅量', categories: WEEKDAYS, step: 2 },
    { title: '上半年展览参观人数', xLabel: '月份', yLabel: '人数（人）', series: '参观人数',
      categories: ['一月', '二月', '三月', '四月', '五月', '六月'], step: 10 },
  ],
  bar: [
    { title: '校园各处花盆数量', xLabel: '地点', yLabel: '数量（盆）', series: '花盆数量',
      categories: ['校门', '操场', '花园', '走廊', '教室'], step: 2 },
    { title: '同学们最喜欢的运动', xLabel: '运动', yLabel: '人数（人）', series: '人数',
      categories: ['跑步', '足球', '篮球', '跳绳', '游泳'], step: 1 },
    { title: '图书角各类图书数量', xLabel: '类别', yLabel: '数量（本）', series: '图书数量',
      categories: ['故事', '科普', '艺术', '历史', '地理'], step: 5 },
  ],
};

export function randomChart(kind: ChartKind, random = Math.random): ChartDocument {
  const choices = EXERCISES[kind];
  const exercise = choices[Math.floor(random() * choices.length)];
  const { title, xLabel, yLabel, series, categories, step } = exercise;
  const chart = blankChart(kind);
  const pool = Array.from({ length: 9 }, (_, index) => (index + 1) * step);
  const values = categories.map(() => pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return {
    ...chart, title, xLabel, yLabel, categories: [...categories],
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
