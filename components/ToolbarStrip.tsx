import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ToolbarStrip({ context, children }: { context: string; children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });

  function updateEdges() {
    const { scrollLeft, scrollWidth, clientWidth } = viewport.current;
    setEdges({ start: scrollLeft < 1, end: scrollWidth - clientWidth - scrollLeft < 1 });
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      setOverflow(content.current.scrollWidth > strip.current.clientWidth);
      updateEdges();
    });
    observer.observe(content.current);
    observer.observe(strip.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    viewport.current.scrollLeft = 0;
    updateEdges();
  }, [context]);

  function scroll(direction: -1 | 1) {
    viewport.current.scrollBy({ left: direction * viewport.current.clientWidth * 0.8 });
  }

  return (
    <div className="toolbar-strip" ref={strip}>
      {overflow && <button className="icon-button toolbar-scroll-button" aria-label="向左查看更多设置"
        title="向左查看更多设置" disabled={edges.start} onClick={() => scroll(-1)}><ChevronLeft size={16} /></button>}
      <div className="toolbar-scroll" ref={viewport} role="region" aria-label="对象工具栏"
        tabIndex={overflow ? 0 : undefined} onScroll={updateEdges}>
        <div className="toolbar-content" ref={content}>{children}</div>
      </div>
      {overflow && <button className="icon-button toolbar-scroll-button" aria-label="向右查看更多设置"
        title="向右查看更多设置" disabled={edges.end} onClick={() => scroll(1)}><ChevronRight size={16} /></button>}
    </div>
  );
}
