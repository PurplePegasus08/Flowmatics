
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
}

export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface ColumnStats {
  header: string;
  type: 'numeric' | 'categorical' | 'boolean';
  min?: number | string;
  max?: number | string;
  median?: number | string;
  mode?: any;
  missing: number;
  missingPct: string;
  unique: number;
  healthScore: number;
  totalRows: number;
}

export type ChartType = 'bar' | 'line' | 'scatter' | 'pie' | 'area' | 'heatmap' | 'doughnut' | 'bubble' | 'box' | 'venn' | 'contour' | 'table';
export type ThemeType = 'default' | 'neon' | 'pastel' | 'dark' | 'professional';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type SortOrder = 'none' | 'asc' | 'desc';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipConfig {
  show: boolean;
  backgroundColor: string;
  textColor: string;
  borderRadius?: number;
}

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xAxisKey: string;
  yAxisKeys: string[]; 
  zAxisKey?: string; 
  xAxisTitle?: string;
  yAxisTitle?: string;
  aggregation?: AggregationType;
  color?: string;
  theme?: ThemeType;
  tooltip?: TooltipConfig;
  showBox?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  legendPosition?: LegendPosition;
  legendFontSize?: number;
  legendTextColor?: string;
  smoothCurve?: boolean;
  showLabels?: boolean;
  labelColor?: string;
  labelFontSize?: number;
  showLabelsOn?: boolean;
  showLabelsIn?: boolean;
  showLabelsValue?: boolean;
  showLabelsPercent?: boolean;
  stacked?: boolean;
  sortByValue?: SortOrder;
  columnFilters?: Record<string, any[]>;
}

export interface DashboardItem extends ChartConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  isLocked?: boolean;
  zIndex?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  isToolOutput?: boolean;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  DATA = 'data',
  VISUALIZE = 'visualize',
  INSIGHTS = 'insights',
}