export type ChartKind = 'line' | 'bar';
export type Tool = 'line' | 'pen' | 'eraser' | 'select' | 'text';
export type LineKind = 'solid' | 'dashed' | 'arrow';
export type ArrowPlacement = 'start' | 'end' | 'both';
export type AxisArrowhead = 'open' | 'outline' | 'filled';
export type EraseScope = 'all' | 'marks' | 'data';
export type Axis = 'x' | 'y';
export type AxisLabel = 'xLabel' | 'yLabel';
export type NoteTarget = `note:${number}`;
export type TextTarget = 'title' | AxisLabel | NoteTarget | number;
export type TitlePlacement = 'end' | 'center' | 'start';
export type Statistic = 'max' | 'min' | 'mean';
export type Datum = { series: number; index: number };
export type Selection =
  | { kind: 'mark'; index: number }
  | { kind: 'text'; target: TextTarget }
  | { kind: 'data'; datum: Datum }
  | { kind: 'axis'; axis: Axis | 'both' };
export type TextFont = 'system' | 'sans' | 'serif' | 'kai' | 'mono';
export type TickMode = 'auto' | 'all' | 'interval';
export type AxisBreak = { from: number; to: number };

export interface TextStyle {
  font: TextFont;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: 'start' | 'middle' | 'end';
}

export interface Point {
  x: number;
  y: number;
}

export interface TextNote {
  id: NoteTarget;
  text: string;
  position: Point;
}

export interface Mark {
  type: 'line' | 'pen';
  color: string;
  points: Point[];
  lineKind?: LineKind;
  width?: number;
  opacity?: number;
  arrows?: ArrowPlacement;
  referenceValue?: number;
}

export interface SeriesStyle {
  strokeWidth: number;
  dotSize: number;
  dotShape: 'circle' | 'square' | 'diamond';
  dotFill: 'hollow' | 'solid';
  dots: boolean;
  showLabels: boolean;
  columnWidth: number;
  roundedColumns: boolean;
}

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  style?: Partial<SeriesStyle>;
}

export interface AxisStyle {
  line: LineKind;
  color: string;
  width: number;
  length: number;
  tickLength: number;
  tickPosition: 'outside' | 'inside' | 'cross';
  tickMode: TickMode;
  interval: number;
  maximum?: number;
  omitted?: AxisBreak;
  visible?: boolean;
  showValues: boolean;
  showLabel: boolean;
  titlePlacement: TitlePlacement;
}

export interface ChartStyle {
  grid: boolean;
  showLabels: boolean;
  dots: boolean;
  showOrigin: boolean;
  showTitle?: boolean;
  dotSize: number;
  strokeWidth: number;
  axes: Record<Axis, AxisStyle>;
  axisArrowhead?: AxisArrowhead;
  legend: boolean | 'auto';
}

export interface ChartDocument {
  kind: ChartKind;
  title: string;
  xLabel: string;
  yLabel: string;
  categories: string[];
  hiddenCategoryLabels?: number[];
  series: Series[];
  marks: Mark[];
  notes: TextNote[];
  plotOffset: Point;
  style: ChartStyle;
  textStyles: Partial<Record<TextTarget, Partial<TextStyle>>>;
  labelPositions: Partial<Record<AxisLabel, Point>>;
  scaleExtent: { min: number; max: number } | null;
}

export type ChartEdit = (update: (document: ChartDocument) => ChartDocument) => void;
