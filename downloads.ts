import { HEIGHT, WIDTH } from './chart';

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

function serializeChart(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-editor], [data-editor-only]').forEach(element => element.remove());
  clone.querySelectorAll('[data-text-selected]').forEach(element => element.removeAttribute('data-text-selected'));
  clone.removeAttribute('class');
  const background = clone.querySelector('[data-paper]');
  background?.remove();

  const measure = document.createElement('div');
  measure.style.cssText = 'position:fixed;inset:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  measure.appendChild(clone);
  document.body.appendChild(measure);
  let bounds: DOMRect;
  try {
    bounds = clone.getBBox();
  } finally {
    measure.remove();
  }

  const padding = 24;
  const hasContent = bounds.width > 0 && bounds.height > 0;
  const x = hasContent ? Math.floor(bounds.x) - padding : 0;
  const y = hasContent ? Math.floor(bounds.y) - padding : 0;
  const width = hasContent ? Math.ceil(bounds.x + bounds.width) + padding - x : WIDTH;
  const height = hasContent ? Math.ceil(bounds.y + bounds.height) + padding - y : HEIGHT;

  if (background) {
    background.setAttribute('x', String(x));
    background.setAttribute('y', String(y));
    background.setAttribute('width', String(width));
    background.setAttribute('height', String(height));
    clone.prepend(background);
  }
  clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return { source: new XMLSerializer().serializeToString(clone), width, height };
}

export function exportChartSvg(svg: SVGSVGElement, title: string) {
  const { source } = serializeChart(svg);
  download(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), chartFileName(title, 'svg'));
}

export async function exportChartImage(svg: SVGSVGElement, title: string) {
  const { source, width, height } = serializeChart(svg);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
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
