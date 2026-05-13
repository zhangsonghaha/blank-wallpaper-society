export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio?: number;
}

export interface FilterConfig {
  name: string;
  label: string;
  css: string;
  params: FilterParam[];
}

export interface FilterParam {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
  unit: string;
}

export interface FilterValues {
  [key: string]: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  opacity: number;
}

export interface CalendarConfig {
  year: number;
  month: number;
  style: 'minimal' | 'modern' | 'handwrite';
  position: 'bottom' | 'right';
  opacity: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  showWeekNumbers: boolean;
  startOnMonday: boolean;
}

export type ToolType = 'crop' | 'filter' | 'text' | 'calendar' | null;

export interface EditorState {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  crop: CropArea | null;
  filterValues: FilterValues;
  textOverlays: TextOverlay[];
  calendarConfig: CalendarConfig | null;
  activeTool: ToolType;
  history: EditorHistoryEntry[];
  historyIndex: number;
}

export interface EditorHistoryEntry {
  crop: CropArea | null;
  filterValues: FilterValues;
  textOverlays: TextOverlay[];
  calendarConfig: CalendarConfig | null;
}

export const FILTER_PRESETS: FilterConfig[] = [
  {
    name: 'original',
    label: '原图',
    css: '',
    params: [],
  },
  {
    name: 'grayscale',
    label: '黑白',
    css: 'grayscale({amount}%)',
    params: [
      { key: 'amount', label: '强度', min: 0, max: 100, default: 100, step: 1, unit: '%' },
    ],
  },
  {
    name: 'vintage',
    label: '复古',
    css: 'sepia({amount}%) contrast({contrast}%)',
    params: [
      { key: 'amount', label: '复古度', min: 0, max: 100, default: 60, step: 1, unit: '%' },
      { key: 'contrast', label: '对比度', min: 80, max: 150, default: 110, step: 1, unit: '%' },
    ],
  },
  {
    name: 'warm',
    label: '暖色',
    css: 'saturate({saturate}%) sepia({sepia}%)',
    params: [
      { key: 'saturate', label: '饱和度', min: 80, max: 200, default: 130, step: 1, unit: '%' },
      { key: 'sepia', label: '暖度', min: 0, max: 50, default: 20, step: 1, unit: '%' },
    ],
  },
  {
    name: 'cool',
    label: '冷色',
    css: 'saturate({saturate}%) hue-rotate({hue}deg)',
    params: [
      { key: 'saturate', label: '饱和度', min: 50, max: 150, default: 90, step: 1, unit: '%' },
      { key: 'hue', label: '色相', min: 0, max: 60, default: 20, step: 1, unit: 'deg' },
    ],
  },
  {
    name: 'contrast',
    label: '高对比',
    css: 'contrast({amount}%) brightness({brightness}%)',
    params: [
      { key: 'amount', label: '对比度', min: 100, max: 200, default: 150, step: 1, unit: '%' },
      { key: 'brightness', label: '亮度', min: 80, max: 120, default: 105, step: 1, unit: '%' },
    ],
  },
  {
    name: 'blur',
    label: '模糊',
    css: 'blur({amount}px)',
    params: [
      { key: 'amount', label: '模糊度', min: 0, max: 20, default: 5, step: 0.5, unit: 'px' },
    ],
  },
];

export const ASPECT_RATIOS = [
  { label: '自由', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
];

export const DEFAULT_FILTER_VALUES: FilterValues = {
  amount: 100,
  contrast: 110,
  saturate: 130,
  sepia: 20,
  hue: 20,
  brightness: 105,
};

export const FONT_OPTIONS = [
  { label: '默认', value: 'Inter, sans-serif' },
  { label: '衬线', value: 'Georgia, serif' },
  { label: '等宽', value: '"Courier New", monospace' },
  { label: '手写', value: '"Comic Sans MS", cursive' },
];

export const CALENDAR_STYLES = [
  { value: 'minimal' as const, label: '简约' },
  { value: 'modern' as const, label: '现代' },
  { value: 'handwrite' as const, label: '手写' },
];