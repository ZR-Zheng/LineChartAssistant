import { useId, useRef } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import './exportControls.css';

export default function ExportControls({ title, exporting, onExportImage, onExportSvg }: {
  title: string; exporting: boolean; onExportImage: () => void; onExportSvg: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDivElement>(null);
  const chartTitle = title.trim() || '未命名统计图';

  function chooseFormat(exportChart: () => void) {
    options.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
    exportChart();
  }

  return (
    <div className="chart-export">
      <button type="button" ref={trigger} className="button chart-export-trigger" popoverTarget={id}
        aria-disabled={exporting || undefined} onClick={event => { if (exporting) event.preventDefault(); }}>
        <Download size={17} /> {exporting ? '正在导出' : '导出图片'} <ChevronDown className="chart-export-arrow" size={15} />
      </button>
      <div id={id} ref={options} className="chart-export-menu" popover="auto" role="group" aria-label="图片导出格式"
        aria-describedby={`${id}-range`}>
        <p className="chart-export-title" title={chartTitle}>{chartTitle}</p>
        <p className="chart-export-range" id={`${id}-range`}>按图表和标注的范围裁剪。</p>
        <div className="chart-export-formats">
          <button type="button" className="button compact" onClick={() => chooseFormat(onExportImage)}>PNG 位图</button>
          <button type="button" className="button compact" onClick={() => chooseFormat(onExportSvg)}>SVG 矢量图</button>
        </div>
      </div>
    </div>
  );
}
