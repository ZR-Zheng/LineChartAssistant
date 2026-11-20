import {
  AlarmClock, Ambulance, Apple, Backpack, Banana, Bike, Bird, BookOpen, Bug, Bus, Cake, CarFront, Carrot, Cat, Cherry,
  Circle, Citrus, Cloud, CloudLightning, CloudRain, Coffee, Cookie, createLucideIcon, CupSoda, Diamond, Dog, Droplet, Fish, Flower2,
  Footprints, Gift, GraduationCap, Grape, Heart, House, IceCreamCone, Leaf, Lightbulb, Medal, Mountain, Notebook,
  Palette, PawPrint, Pencil, Pizza, Plane, Popcorn, Rabbit, Rainbow, Rocket, Ruler, Sandwich, School, Scissors, Ship, Shirt,
  ShoppingCart, Snail, Snowflake, Square, Star, Sun, Tractor, TrainFront, TreeDeciduous, TreePine, Triangle, Trophy, Truck,
  Turtle, Umbrella, UserRound, Volleyball, Wheat,
} from 'lucide-react';
import { NOTO_PICTOGRAPH_SYMBOLS } from './notoPictographSymbols';

export const SYMBOL_GROUPS = {
  shapes: '基本图形', school: '校园与生活', sports: '运动', food: '食物', animals: '动物', nature: '自然与天气', transport: '交通',
  festivals: '节日与活动',
} as const;

type IconEntry = readonly [string, typeof Circle | null, keyof typeof SYMBOL_GROUPS];

const Soccer = createLucideIcon('Soccer', [
  ['circle', { cx: '12', cy: '12', r: '10', fill: '#fff', stroke: 'none', key: 'surface' }],
  ...[0, 72, 144, 216, 288].map<['path', Record<string, string>]>(angle => ['path', {
    d: 'M8.75 2.54 A10 10 0 0 1 15.25 2.54 L14.55 4.7 12 5.8 9.45 4.7 Z M12 5.8V7.8',
    transform: `rotate(${angle} 12 12)`, fill: 'currentColor', strokeWidth: '0.9', key: `patch-${angle}`,
  }]),
  ['path', { d: 'M12 7.65 16.14 10.65 14.56 15.52 9.44 15.52 7.86 10.65 Z', fill: 'currentColor', stroke: 'none', key: 'center' }],
  ['circle', { cx: '12', cy: '12', r: '10', strokeWidth: '1.2', key: 'outline' }],
]);

const FLUENT_PICTOGRAPH_SYMBOLS = {
  circle: ['圆形', Circle, 'shapes'],
  square: ['方形', Square, 'shapes'],
  triangle: ['三角形', Triangle, 'shapes'],
  diamond: ['菱形', Diamond, 'shapes'],
  star: ['星形', Star, 'shapes'],
  heart: ['爱心', Heart, 'shapes'],
  book: ['书本', BookOpen, 'school'],
  pencil: ['铅笔', Pencil, 'school'],
  backpack: ['书包', Backpack, 'school'],
  cap: ['学士帽', GraduationCap, 'school'],
  school: ['学校', School, 'school'],
  notebook: ['笔记本', Notebook, 'school'],
  art: ['调色盘', Palette, 'school'],
  scissors: ['剪刀', Scissors, 'school'],
  ruler: ['尺子', Ruler, 'school'],
  clock: ['闹钟', AlarmClock, 'school'],
  lightbulb: ['灯泡', Lightbulb, 'school'],
  person: ['人物', UserRound, 'school'],
  gift: ['礼物', Gift, 'school'],
  house: ['房屋', House, 'school'],
  shirt: ['衣服', Shirt, 'school'],
  cart: ['购物车', ShoppingCart, 'school'],
  ball: ['排球', Volleyball, 'sports'],
  soccer: ['足球', Soccer, 'sports'],
  basketball: ['篮球', Circle, 'sports'],
  run: ['运动鞋', Footprints, 'sports'],
  trophy: ['奖杯', Trophy, 'sports'],
  medal: ['奖牌', Medal, 'sports'],
  apple: ['苹果', Apple, 'food'],
  banana: ['香蕉', Banana, 'food'],
  cherry: ['樱桃', Cherry, 'food'],
  carrot: ['胡萝卜', Carrot, 'food'],
  orange: ['橘子', Citrus, 'food'],
  grapes: ['葡萄', Grape, 'food'],
  watermelon: ['西瓜', Pizza, 'food'],
  pizza: ['披萨', Pizza, 'food'],
  icecream: ['冰淇淋', IceCreamCone, 'food'],
  cake: ['蛋糕', Cake, 'food'],
  bread: ['面包', Wheat, 'food'],
  hamburger: ['汉堡', Sandwich, 'food'],
  cookie: ['饼干', Cookie, 'food'],
  popcorn: ['爆米花', Popcorn, 'food'],
  milk: ['牛奶', CupSoda, 'food'],
  coffee: ['咖啡', Coffee, 'food'],
  cat: ['猫', Cat, 'animals'],
  dog: ['狗', Dog, 'animals'],
  rabbit: ['兔子', Rabbit, 'animals'],
  bird: ['小鸟', Bird, 'animals'],
  fish: ['鱼', Fish, 'animals'],
  paw: ['脚印', PawPrint, 'animals'],
  turtle: ['乌龟', Turtle, 'animals'],
  snail: ['蜗牛', Snail, 'animals'],
  ladybug: ['瓢虫', Bug, 'animals'],
  butterfly: ['蝴蝶', Bug, 'animals'],
  whale: ['鲸鱼', Fish, 'animals'],
  bee: ['蜜蜂', Bug, 'animals'],
  flower: ['花朵', Flower2, 'nature'],
  tree: ['树木', TreeDeciduous, 'nature'],
  leaf: ['叶子', Leaf, 'nature'],
  sun: ['晴天', Sun, 'nature'],
  cloud: ['阴天', Cloud, 'nature'],
  rain: ['雨天', CloudRain, 'nature'],
  snow: ['雪花', Snowflake, 'nature'],
  umbrella: ['雨伞', Umbrella, 'nature'],
  drop: ['水滴', Droplet, 'nature'],
  rainbow: ['彩虹', Rainbow, 'nature'],
  mountain: ['山峰', Mountain, 'nature'],
  lightning: ['雷电', CloudLightning, 'nature'],
  pine: ['松树', TreePine, 'nature'],
  car: ['汽车', CarFront, 'transport'],
  bus: ['公交车', Bus, 'transport'],
  bike: ['自行车', Bike, 'transport'],
  train: ['火车', TrainFront, 'transport'],
  plane: ['飞机', Plane, 'transport'],
  ship: ['轮船', Ship, 'transport'],
  truck: ['货车', Truck, 'transport'],
  ambulance: ['救护车', Ambulance, 'transport'],
  rocket: ['火箭', Rocket, 'transport'],
  tractor: ['拖拉机', Tractor, 'transport'],
} as const satisfies Record<string, IconEntry>;

const notoSymbols = Object.fromEntries<IconEntry>(Object.entries(NOTO_PICTOGRAPH_SYMBOLS).map(([id, [label, group]]) => (
  [id, [label, null, group]]
))) as Record<keyof typeof NOTO_PICTOGRAPH_SYMBOLS, IconEntry>;

export const PICTOGRAPH_SYMBOLS = { ...FLUENT_PICTOGRAPH_SYMBOLS, ...notoSymbols };

export type PictographSymbol = keyof typeof PICTOGRAPH_SYMBOLS;

export function isPictographSymbol(value: unknown): value is PictographSymbol {
  return typeof value === 'string' && Object.hasOwn(PICTOGRAPH_SYMBOLS, value);
}
