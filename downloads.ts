import { HEIGHT, WIDTH } from './chart';
import { hydratePictographImages } from './pictographAssets';

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function chartFileName(title: string, extension: string) {
  const name = title.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').trim().slice(0, 90);
  return `${name || '统计图'}.${extension}`;
}

type ExportBounds = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;

function paperBounds(svg: SVGSVGElement): ExportBounds {
  const values = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
    const [x, y, width, height] = values;
    return { x, y, width, height };
  }
  return { x: 0, y: 0, width: WIDTH, height: HEIGHT };
}

function cropBounds(bounds: ExportBounds | null, paper: ExportBounds): ExportBounds {
  if (!bounds || bounds.width < 0 || bounds.height < 0 || (bounds.width === 0 && bounds.height === 0)) return paper;
  const padding = 24;
  const x = Math.floor(bounds.x) - padding;
  const y = Math.floor(bounds.y) - padding;
  const width = Math.ceil(bounds.x + bounds.width) + padding - x;
  const height = Math.ceil(bounds.y + bounds.height) + padding - y;
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 ? { x, y, width, height } : paper;
}

function bitmapSize(width: number, height: number) {
  const maxSide = 8192;
  const maxPixels = 16_000_000;
  const scale = Math.min(2, maxSide / Math.max(width, height), Math.sqrt(maxPixels / width / height));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

async function serializeChart(svg: SVGSVGElement, bitmap = false) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-editor], [data-editor-only]').forEach(element => element.remove());
  clone.querySelectorAll('[data-export-note]').forEach(element => {
    element.removeAttribute('display');
    element.removeAttribute('aria-hidden');
  });
  clone.querySelectorAll('[data-text-selected]').forEach(element => element.removeAttribute('data-text-selected'));
  clone.removeAttribute('class');
  if (clone.hasAttribute('tabindex')) clone.removeAttribute('aria-description');
  clone.removeAttribute('tabindex');
  clone.querySelectorAll('[data-canvas-object]').forEach(element => {
    if (element.hasAttribute('data-editable')) element.removeAttribute('aria-label');
    for (const attribute of ['data-canvas-object', 'data-canvas-adjustable', 'data-canvas-adjusting', 'tabindex', 'role', 'aria-description', 'aria-keyshortcuts']) {
      element.removeAttribute(attribute);
    }
  });
  const descriptions = clone.getAttribute('aria-describedby');
  if (descriptions) {
    const ids = new Set(Array.from(clone.querySelectorAll('[id]'), element => element.id));
    const retained = descriptions.split(/\s+/).filter(id => ids.has(id)).join(' ');
    if (retained) clone.setAttribute('aria-describedby', retained);
    else clone.removeAttribute('aria-describedby');
  }
  const background = clone.querySelector('[data-paper]');
  background?.remove();
  await hydratePictographImages(clone);

  const paper = paperBounds(clone);
  clone.setAttribute('width', String(paper.width));
  clone.setAttribute('height', String(paper.height));
  const measure = document.createElement('div');
  measure.style.cssText = 'position:fixed;inset:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  measure.appendChild(clone);
  document.body.appendChild(measure);
  let bounds: ExportBounds | null = null;
  try {
    bounds = clone.getBBox();
  } catch {
    // A chart without measurable SVG content can still export its sheet.
  } finally {
    measure.remove();
  }

  const { x, y, width, height } = cropBounds(bounds, paper);

  if (background) {
    background.setAttribute('x', String(x));
    background.setAttribute('y', String(y));
    background.setAttribute('width', String(width));
    background.setAttribute('height', String(height));
    clone.prepend(background);
  }
  clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  const size = bitmap ? bitmapSize(width, height) : { width, height };
  clone.setAttribute('width', String(size.width));
  clone.setAttribute('height', String(size.height));
  return { source: new XMLSerializer().serializeToString(clone), ...size };
}

export async function exportChartSvg(svg: SVGSVGElement, title: string) {
  const { source } = await serializeChart(svg);
  download(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), chartFileName(title, 'svg'));
}

export async function exportChartImage(svg: SVGSVGElement, title: string) {
  const { source, width, height } = await serializeChart(svg, true);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('图片导出不可用。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('无法生成 PNG 图片。');
    download(blob, chartFileName(title, 'png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
