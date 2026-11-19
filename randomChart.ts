import { blankChart, EXERCISE_POSITION } from './chart';
import type { PictographSymbol } from './pictographSymbols';
import type { ChartDocument, ChartKind, TextNote } from './types';

interface Exercise {
  topic: Exclude<ExerciseTopic, 'all'>;
  title: string;
  xLabel: string;
  yLabel: string;
  series: string;
  categories: string[];
  step: number;
  icon?: PictographSymbol | PictographSymbol[];
}

export const EXERCISE_TOPICS = {
  all: '不限题材', school: '校园阅读', life: '日常生活', sports: '运动健康', nature: '自然天气',
  traffic: '交通出行', energy: '节水节电', festivals: '节日活动', shopping: '商店经营',
} as const;
export type ExerciseTopic = keyof typeof EXERCISE_TOPICS;
export const EXERCISE_TYPES = {
  chart: '只生成图', random: '随机题型', reading: '读图取数', difference: '比较差值', total: '求总数',
  average: '求平均数', extremes: '找最大最小', trend: '分析变化', share: '读百分比',
  compareGroups: '同类对比', compareTotals: '比较合计', symbolValue: '读图符',
} as const;
export type ExerciseType = keyof typeof EXERCISE_TYPES;
type QuestionType = Exclude<ExerciseType, 'chart' | 'random'>;

export function exerciseTypes(kind: ChartKind, grouped = false) {
  if (kind === 'pie') return ['chart', 'random', 'share', 'extremes'] as ExerciseType[];
  if (kind === 'pictograph') return ['chart', 'random', 'symbolValue', 'reading', 'difference', 'total', 'average', 'extremes'] as ExerciseType[];
  if (kind === 'bar' && grouped) return ['chart', 'random', 'reading', 'difference', 'compareGroups', 'compareTotals', 'total', 'average', 'extremes'] as ExerciseType[];
  return (['chart', 'random', 'reading', 'difference', 'total', 'average', 'extremes', ...(kind === 'line' ? ['trend'] : [])]) as ExerciseType[];
}

function exerciseNote(text: string): TextNote {
  return { id: 'note:1', text: `问题：${text}`, position: EXERCISE_POSITION, exerciseQuestion: true };
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月'];
type GroupedExercise = Omit<Exercise, 'series' | 'topic'> & {
  names: [string, string];
  pairs: [number, number][];
};

const GROUPED_EXERCISES: Record<Exclude<ExerciseTopic, 'all'>, GroupedExercise[]> = {
  school: [
    { title: '两个班的图书借阅量', xLabel: '图书类别', yLabel: '借阅量（本）', categories: ['故事', '科普', '历史', '童话'],
      names: ['一班', '二班'], pairs: [[7, 4], [3, 6], [4, 3], [5, 7]], step: 2 },
    { title: '图书角两个月的借阅量', xLabel: '图书类别', yLabel: '借阅量（本）', categories: ['绘本', '寓言', '科普', '百科', '历史'],
      names: ['九月', '十月'], pairs: [[6, 8], [7, 5], [4, 6], [3, 3], [2, 5]], step: 5 },
  ],
  life: [
    { title: '两个社区各类活动报名人数', xLabel: '活动', yLabel: '人数（人）', categories: ['绘画', '合唱', '手工', '舞蹈'],
      names: ['东区', '西区'], pairs: [[8, 6], [4, 7], [7, 5], [2, 4]], step: 5 },
    { title: '两个家庭每周家务时间', xLabel: '家务', yLabel: '时间（分钟）', categories: ['打扫', '做饭', '洗衣', '整理'],
      names: ['小明家', '小华家'], pairs: [[5, 7], [8, 6], [4, 5], [3, 5]], step: 10 },
  ],
  sports: [
    { title: '两个班参加体育活动的人数', xLabel: '项目', yLabel: '人数（人）', categories: ['足球', '篮球', '跳绳', '跑步', '羽毛球'],
      names: ['一班', '二班'], pairs: [[7, 3], [5, 7], [4, 8], [6, 4], [2, 4]], step: 2 },
    { title: '训练前后的投篮命中次数', xLabel: '小组', yLabel: '命中数（次）', categories: ['第一组', '第二组', '第三组', '第四组'],
      names: ['训练前', '训练后'], pairs: [[3, 5], [4, 7], [2, 5], [5, 8]], step: 2 },
  ],
  nature: [
    { title: '两处公园观察到的鸟类数量', xLabel: '鸟类', yLabel: '数量（只）', categories: ['麻雀', '燕子', '喜鹊', '白头鹎'],
      names: ['湿地公园', '人民公园'], pairs: [[6, 8], [7, 4], [3, 6], [4, 2]], step: 2 },
    { title: '两地上半年的月降雨量', xLabel: '月份', yLabel: '降雨量（毫米）', categories: MONTHS,
      names: ['江城', '海城'], pairs: [[2, 4], [3, 6], [4, 6], [6, 7], [7, 8], [8, 6]], step: 10 },
  ],
  traffic: [
    { title: '两个班的上学方式调查', xLabel: '交通方式', yLabel: '人数（人）', categories: ['步行', '骑车', '公交', '地铁', '乘车'],
      names: ['一班', '二班'], pairs: [[8, 6], [3, 5], [5, 7], [4, 2], [3, 4]], step: 1 },
    { title: '两个站点各时段的乘车人数', xLabel: '时段', yLabel: '人数（人）', categories: ['7–8时', '8–9时', '9–10时', '10–11时'],
      names: ['公园站', '广场站'], pairs: [[6, 8], [8, 7], [4, 5], [3, 5]], step: 10 },
  ],
  energy: [
    { title: '两个改进方案每周节电量', xLabel: '使用场所', yLabel: '节电量（千瓦时）', categories: ['教室', '图书室', '办公室', '礼堂'],
      names: ['方案一', '方案二'], pairs: [[5, 8], [4, 6], [3, 6], [7, 5]], step: 2 },
    { title: '两个年级回收雨水量', xLabel: '周次', yLabel: '水量（升）', categories: ['第一周', '第二周', '第三周', '第四周'],
      names: ['五年级', '六年级'], pairs: [[4, 6], [5, 4], [7, 8], [8, 7]], step: 5 },
  ],
  festivals: [
    { title: '元宵游园上下午各项目参与人数', xLabel: '项目', yLabel: '人数（人）', categories: ['猜灯谜', '剪纸', '做花灯', '包元宵'],
      names: ['上午', '下午'], pairs: [[7, 8], [4, 6], [5, 7], [6, 4]], step: 5 },
    { title: '两家摊位的粽子销量', xLabel: '粽子口味', yLabel: '销量（个）', categories: ['豆沙', '鲜肉', '红枣', '蛋黄'],
      names: ['一号摊', '二号摊'], pairs: [[6, 4], [8, 7], [3, 5], [4, 7]], step: 10 },
  ],
  shopping: [
    { title: '两个门店的文具销量', xLabel: '文具', yLabel: '销量（件）', categories: ['铅笔', '橡皮', '本子', '直尺', '胶棒'],
      names: ['城东店', '城西店'], pairs: [[8, 6], [5, 7], [6, 8], [3, 4], [5, 3]], step: 10 },
    { title: '水果店工作日与周末的销量', xLabel: '水果', yLabel: '日均销量（千克）', categories: ['苹果', '香蕉', '梨', '橙子'],
      names: ['工作日', '周末'], pairs: [[5, 8], [4, 7], [3, 5], [6, 8]], step: 5 },
  ],
};

const EXERCISES: Record<'line' | 'bar', Exercise[]> = {
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

type PictographExercise = Exercise & { icon: PictographSymbol | PictographSymbol[] };

function categoryExercise(exercise: Omit<Exercise, 'categories' | 'icon'>, rows: [name: string, icon: PictographSymbol][]): PictographExercise {
  return { ...exercise, categories: rows.map(([name]) => name), icon: rows.map(([, icon]) => icon) };
}

const PICTOGRAPH_EXERCISES: PictographExercise[] = [
  { topic: 'school', title: '图书角各类图书数量', xLabel: '类别', yLabel: '数量（本）', series: '图书数量',
    categories: ['故事', '科普', '艺术', '历史', '地理'], step: 5, icon: 'book' },
  { topic: 'school', title: '各班捐赠的图书数量', xLabel: '班级', yLabel: '数量（本）', series: '捐赠数量',
    categories: ['一班', '二班', '三班', '四班'], step: 5, icon: 'books' },
  categoryExercise({ topic: 'school', title: '新学期发放的文具数量', xLabel: '文具', yLabel: '数量（件）', series: '发放数量', step: 2 },
    [['铅笔', 'pencil'], ['尺子', 'ruler'], ['笔记本', 'notebook'], ['剪刀', 'scissors']]),

  categoryExercise({ topic: 'life', title: '同学们最喜欢的小动物', xLabel: '动物', yLabel: '人数（人）', series: '人数', step: 1 },
    [['猫', 'cat'], ['狗', 'dog'], ['兔子', 'rabbit'], ['小鸟', 'bird'], ['熊猫', 'panda']]),
  categoryExercise({ topic: 'life', title: '早餐点餐数量', xLabel: '早餐', yLabel: '份数（份）', series: '份数', step: 2 },
    [['面条', 'noodles'], ['煎蛋', 'friedEgg'], ['面包', 'bread'], ['牛奶', 'milk'], ['饺子', 'dumpling']]),
  { topic: 'life', title: '各组回收的纸箱数量', xLabel: '组别', yLabel: '数量（个）', series: '纸箱数量',
    categories: ['第一组', '第二组', '第三组', '第四组'], step: 1, icon: 'package' },
  { topic: 'life', title: '社区各类可回收物重量', xLabel: '种类', yLabel: '重量（千克）', series: '回收重量',
    categories: ['纸张', '塑料', '金属', '玻璃'], step: 5, icon: 'recycle' },

  categoryExercise({ topic: 'sports', title: '同学们最喜欢的运动', xLabel: '运动', yLabel: '人数（人）', series: '人数', step: 1 },
    [['跑步', 'runner'], ['足球', 'soccer'], ['篮球', 'basketball'], ['羽毛球', 'badminton'], ['游泳', 'swim']]),
  { topic: 'sports', title: '各组选手的投篮命中数', xLabel: '组别', yLabel: '命中数（次）', series: '命中数',
    categories: ['第一组', '第二组', '第三组', '第四组'], step: 2, icon: 'basketball' },
  { topic: 'sports', title: '运动会各班获得的奖牌数', xLabel: '班级', yLabel: '数量（枚）', series: '奖牌数量',
    categories: ['一班', '二班', '三班', '四班'], step: 1, icon: 'medal' },

  categoryExercise({ topic: 'nature', title: '小组记录的各类天气天数', xLabel: '天气', yLabel: '天数（天）', series: '天数', step: 1 },
    [['晴天', 'sun'], ['阴天', 'cloud'], ['雨天', 'rain'], ['雪天', 'snow']]),
  { topic: 'nature', title: '校园各处花盆数量', xLabel: '地点', yLabel: '数量（盆）', series: '花盆数量',
    categories: ['校门', '操场', '花园', '走廊', '教室'], step: 2, icon: 'flowerpot' },
  categoryExercise({ topic: 'nature', title: '校园花圃中的花卉数量', xLabel: '花卉', yLabel: '数量（株）', series: '花卉数量', step: 2 },
    [['郁金香', 'tulip'], ['向日葵', 'sunflower'], ['玫瑰', 'rose'], ['木槿花', 'hibiscus']]),
  { topic: 'nature', title: '校园观察到的鸟类数量', xLabel: '鸟类', yLabel: '数量（只）', series: '数量',
    categories: ['麻雀', '燕子', '喜鹊', '白头鹎'], step: 2, icon: 'bird' },

  categoryExercise({ topic: 'traffic', title: '同学们的上学方式', xLabel: '方式', yLabel: '人数（人）', series: '人数', step: 1 },
    [['步行', 'walk'], ['骑自行车', 'bike'], ['坐公交车', 'bus'], ['坐地铁', 'metro'], ['坐私家车', 'car']]),
  { topic: 'traffic', title: '各站点停放的汽车数量', xLabel: '站点', yLabel: '数量（辆）', series: '停车数量',
    categories: ['广场站', '公园站', '图书馆站', '体育馆站'], step: 5, icon: 'car' },
  categoryExercise({ topic: 'traffic', title: '校园门口各类车辆通行数量', xLabel: '车辆', yLabel: '数量（辆）', series: '车辆数量', step: 5 },
    [['公交车', 'bus'], ['自行车', 'bike'], ['汽车', 'car'], ['货车', 'truck']]),

  { topic: 'energy', title: '各班一周节电量', xLabel: '班级', yLabel: '节电量（千瓦时）', series: '节电量',
    categories: ['一班', '二班', '三班', '四班', '五班'], step: 2, icon: 'electricPlug' },
  { topic: 'energy', title: '各组收集的雨水量', xLabel: '组别', yLabel: '水量（升）', series: '收集水量',
    categories: ['第一组', '第二组', '第三组', '第四组'], step: 5, icon: 'drop' },

  { topic: 'festivals', title: '元宵节各组制作的灯笼数量', xLabel: '组别', yLabel: '数量（个）', series: '灯笼数量',
    categories: ['第一组', '第二组', '第三组', '第四组'], step: 1, icon: 'lantern' },
  { topic: 'festivals', title: '中秋节各组制作的月饼数量', xLabel: '组别', yLabel: '数量（个）', series: '月饼数量',
    categories: ['第一组', '第二组', '第三组', '第四组'], step: 2, icon: 'mooncake' },
  { topic: 'festivals', title: '元宵游园各项目参与人数', xLabel: '项目', yLabel: '人数（人）', series: '参与人数',
    categories: ['猜灯谜', '剪纸', '做花灯', '包元宵'], step: 5, icon: 'person' },
  categoryExercise({ topic: 'festivals', title: '节日布置所用装饰品数量', xLabel: '装饰品', yLabel: '数量（件）', series: '装饰品数量', step: 2 },
    [['红灯笼', 'lantern'], ['气球', 'balloon'], ['三角旗', 'flag'], ['蝴蝶结', 'ribbon']]),

  categoryExercise({ topic: 'shopping', title: '果蔬店各类水果销量', xLabel: '水果', yLabel: '销量（千克）', series: '水果销量', step: 5 },
    [['苹果', 'apple'], ['香蕉', 'banana'], ['梨', 'pear'], ['橘子', 'orange'], ['葡萄', 'grapes']]),
  { topic: 'shopping', title: '一周面包销售量', xLabel: '日期', yLabel: '销量（个）', series: '面包销量',
    categories: WEEKDAYS, step: 5, icon: 'bread' },
  { topic: 'shopping', title: '上半年文具店笔记本销量', xLabel: '月份', yLabel: '销量（本）', series: '笔记本销量',
    categories: MONTHS, step: 20, icon: 'notebook' },
  { topic: 'shopping', title: '书店各类书籍销售量', xLabel: '书籍类别', yLabel: '销量（本）', series: '书籍销量',
    categories: ['绘本', '童话', '科普', '漫画', '历史'], step: 10, icon: 'book' },
];

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

function question(type: QuestionType, categories: string[], random: () => number, kind: ChartKind) {
  switch (type) {
    case 'symbolValue': return '一个完整的图符代表多少？半个图符代表多少？';
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
    case 'extremes': return kind === 'pie' ? '哪一项占比最大？哪一项占比最小？' : '哪一项的数值最大？哪一项最小？相差多少？';
    case 'share': {
      const [item] = draw(categories, 1, random);
      return `“${item}”占总数的百分之多少？`;
    }
    case 'trend': {
      const start = Math.floor(random() * (categories.length - 1));
      return `从“${categories[start]}”到“${categories[start + 1]}”，数值怎样变化？变化了多少？`;
    }
  }
}

function groupedQuestion(type: QuestionType, theme: GroupedExercise, random: () => number) {
  const [first, second] = theme.names;
  const [category] = draw(theme.categories, 1, random);
  if (type === 'reading') return `“${category}”一项中，${first}的数值是多少？`;
  if (type === 'difference') return `“${category}”一项中，${first}与${second}相差多少？`;
  if (type === 'compareGroups') return `“${category}”一项中，${first}与${second}哪个数值更大，还是相同？`;
  if (type === 'compareTotals') return `${first}与${second}各项合计各是多少？比较两者。`;
  if (type === 'extremes') return `${first}的最大值和最小值各是多少？相差多少？`;
  return `只看${first}，${question(type, theme.categories, random, 'bar')}`;
}

function groupedChart(random: () => number, topic: ExerciseTopic, type: ExerciseType): ChartDocument {
  const choices = topic === 'all' ? Object.values(GROUPED_EXERCISES).flat() : GROUPED_EXERCISES[topic];
  const [theme] = draw(choices, 1, random);
  const { title, xLabel, yLabel, categories, names, pairs, step } = theme;
  const chart = blankChart('bar', true);
  const available = exerciseTypes('bar', true).slice(2);
  const chosenType = type === 'random' ? draw(available, 1, random)[0] : type;
  const series = names.map((name, group) => {
    const units = pairs.map(pair => pair[group] + Math.floor(random() * 3) - 1);
    if (chosenType === 'average' && group === 0) {
      const remainder = units.reduce((sum, value) => sum + value, 0) % units.length;
      const index = units.indexOf(Math.max(...units));
      units[index] += remainder <= units.length / 2 ? -remainder : units.length - remainder;
    }
    return { ...chart.series[group], name, values: units.map(value => value * step) };
  });
  const maximum = Math.max(...series.flatMap(item => item.values)) + step;
  const notes = available.includes(chosenType) && chosenType !== 'chart' && chosenType !== 'random'
    ? [exerciseNote(groupedQuestion(chosenType, theme, random))]
    : [];
  return { ...chart, title, xLabel, yLabel, categories: [...categories], series, notes, style: {
    ...chart.style, showLabels: false,
    axes: { ...chart.style.axes, y: { ...chart.style.axes.y, maximum, interval: step, tickMode: 'interval' } },
  } };
}

export function randomChart(kind: ChartKind, random = Math.random, topic: ExerciseTopic = 'all', type: ExerciseType = 'chart', grouped = false): ChartDocument {
  if (kind === 'bar' && grouped) return groupedChart(random, topic, type);
  const templates = kind === 'pictograph' ? PICTOGRAPH_EXERCISES : EXERCISES[kind === 'line' ? 'line' : 'bar'];
  const choices = topic === 'all' ? templates : templates.filter(exercise => exercise.topic === topic);
  const exercise = choices[Math.floor(random() * choices.length)];
  const { title, xLabel, yLabel, series, categories, step } = exercise;
  const icon = kind === 'pictograph' ? exercise.icon : undefined;
  const symbols = Array.isArray(icon) ? icon : undefined;
  const chart = blankChart(kind);
  const availableTypes = exerciseTypes(kind);
  const chosenType = type === 'random' ? draw(availableTypes.slice(2), 1, random)[0] : type;
  const units = chosenType === 'average' ? averageValues(categories.length, random)
    : draw(Array.from({ length: 9 }, (_, index) => index + 1), categories.length, random);
  const halfSymbol = kind === 'pictograph' && chosenType === 'symbolValue';
  if (halfSymbol && units.every(unit => unit % 2 === 0)) units[0] -= 1;
  const values = units.map(value => value * step);
  const notes = chosenType !== 'chart' && chosenType !== 'random' && availableTypes.includes(chosenType)
    ? [exerciseNote(question(chosenType, categories, random, kind))]
    : [];
  return {
    ...chart, title, xLabel, yLabel, categories: [...categories], notes,
    ...(symbols && { pictographSymbols: [...symbols] }),
    series: [{ ...chart.series[0], name: series, values }],
    style: {
      ...chart.style,
      showLabels: kind === 'pie',
      ...(icon && { pictograph: {
        ...(typeof icon === 'string' ? { symbol: icon } : { symbolMode: 'category', direction: 'vertical' }),
        colorMode: 'color', unit: step * (halfSymbol ? 2 : 1),
      } }),
      axes: {
        ...chart.style.axes,
        y: { ...chart.style.axes.y, maximum: step * 10, interval: step, tickMode: 'interval' },
      },
    },
  };
}
