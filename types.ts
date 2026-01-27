export interface ChartDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface ChartSeries {
  dataKey: string;
  color: string;
  name: string;
}

export interface ChartPreset {
  id: string;
  name: string;
  config: ChartConfig;
  createdAt: number;
}

export interface ChartConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  grid: boolean;
  dots: boolean;
  strokeWidth: number;
  smooth: boolean;
  legend: boolean;
  // New customizations
  axisColor: string;
  // showArrows removed, replaced by specific flags
  xAxisArrowStart: boolean;
  xAxisArrowEnd: boolean;
  yAxisArrowStart: boolean;
  yAxisArrowEnd: boolean;
  
  xAxisStartZero: boolean;
  yAxisStartZero: boolean;
  xAxisMin: string;
  xAxisMax: string;
  yAxisMin: string;
  yAxisMax: string;
  xAxisTickFontSize: number;
  yAxisTickFontSize: number;
  xAxisTickInterval: number;
  yAxisTickCount: number;
  yAxisTickInterval: number;
  xAxisTickType: 'inside' | 'outside' | 'cross';
  yAxisTickType: 'inside' | 'outside' | 'cross';
  showLabels: boolean;

  // New visibility toggles for axis labels
  showXAxisLabel: boolean;
  showYAxisLabel: boolean;
  
  // Axis label positioning
  xAxisLabelPosition: string;
  yAxisLabelPosition: string;
  xAxisLabelFontSize: number;
  yAxisLabelFontSize: number;
  xAxisLabelOffsetX: number;
  xAxisLabelOffsetY: number;
  yAxisLabelOffsetX: number;
  yAxisLabelOffsetY: number;
  
  // Font settings
  fontFamily: string;
}

export interface ParsedResponse {
  data: ChartDataPoint[];
  suggestedConfig: Partial<ChartConfig>;
  seriesKeys: string[];
}

export enum ParsingStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}