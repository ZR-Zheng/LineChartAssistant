import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEventHandler, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ToolbarStrip({ context, children, onKeyDown, onClose }: {
  context: string; children: ReactNode; onKeyDown?: KeyboardEventHandler<HTMLDivElement>; onClose?: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const hasClose = !!onClose;
  const [overflow, setOverflow] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });

  function updateEdges() {
    const { scrollLeft, scrollWidth, clientWidth } = viewport.current;
    const start = scrollLeft < 1;
    const end = scrollWidth - clientWidth - scrollLeft < 1;
    setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
  }

  function updateLayout() {
    const stripStyle = getComputedStyle(strip.current);
    const pixels = (value: string) => Number.parseFloat(value) || 0;
    let available = strip.current.clientWidth - pixels(stripStyle.paddingInlineStart) - pixels(stripStyle.paddingInlineEnd);
    if (closeButton.current) {
      const closeStyle = getComputedStyle(closeButton.current);
      available -= closeButton.current.offsetWidth + pixels(closeStyle.marginInlineStart) + pixels(closeStyle.marginInlineEnd)
        + pixels(stripStyle.columnGap);
    }
    setOverflow(content.current.offsetWidth > available);
    updateEdges();
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(updateLayout);
    observer.observe(strip.current);
    observer.observe(viewport.current);
    observer.observe(content.current);
    if (closeButton.current) observer.observe(closeButton.current);
    return () => observer.disconnect();
  }, [hasClose]);

  useLayoutEffect(() => {
    viewport.current.scrollLeft = 0;
    updateLayout();
  }, [context]);

  function scroll(direction: -1 | 1) {
    viewport.current.scrollBy({ left: direction * viewport.current.clientWidth * 0.9 });
  }

  return (
    <div className="toolbar-strip" ref={strip} onKeyDown={onKeyDown}>
      {overflow && <button type="button" className="icon-button toolbar-scroll-button" aria-label="向左查看更多设置"
        title="向左查看更多设置" disabled={edges.start} onClick={() => scroll(-1)}><ChevronLeft size={16} /></button>}
      <div className="toolbar-scroll" ref={viewport} role="region" aria-label="对象工具栏"
        tabIndex={overflow ? 0 : undefined} onScroll={updateEdges}>
        <div className="toolbar-content" ref={content}>{children}</div>
      </div>
      {overflow && <button type="button" className="icon-button toolbar-scroll-button" aria-label="向右查看更多设置"
        title="向右查看更多设置" disabled={edges.end} onClick={() => scroll(1)}><ChevronRight size={16} /></button>}
      {onClose && <button type="button" className="icon-button toolbar-strip-close" ref={closeButton}
        aria-label="关闭数据点设置" title="关闭数据点设置" onClick={onClose}><X size={17} /></button>}
    </div>
  );
}
