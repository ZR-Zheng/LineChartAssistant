export type CanvasObjectProps = (key: string, adjustable?: boolean) => {
  'data-canvas-object': string;
  'data-canvas-adjustable'?: string;
  'data-canvas-adjusting'?: string;
  'aria-description'?: string;
  tabIndex: 0 | -1;
};
