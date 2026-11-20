import { NOTO_PICTOGRAPH_SYMBOLS } from './notoPictographSymbols';

export const SYMBOL_GROUPS = {
  shapes: '基本图形', school: '校园与生活', sports: '运动', food: '食物', animals: '动物', nature: '自然与天气',
  transport: '交通', festivals: '节日与活动', places: '建筑与地点', expressions: '表情与手势',
} as const;

export const PICTOGRAPH_SYMBOLS = NOTO_PICTOGRAPH_SYMBOLS satisfies
  Record<string, readonly [string, keyof typeof SYMBOL_GROUPS, string]>;

export type PictographSymbol = keyof typeof PICTOGRAPH_SYMBOLS;

export function isPictographSymbol(value: unknown): value is PictographSymbol {
  return typeof value === 'string' && Object.hasOwn(PICTOGRAPH_SYMBOLS, value);
}
