import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, Download, ListX, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import type { Board } from '../boards';
import { WIDTH } from '../chart';
import { layoutSeriesLegend } from '../chartPresentation';
import { CHART_KIND_LABELS } from '../chartKindLabels';
import type { ChartDocument } from '../types';
import ChartDisplay from './ChartDisplay';
import './boardSidebar.css';

const BoardPreview = memo(function BoardPreview({ chart, active }: { chart: ChartDocument; active: boolean }) {
  const thumbnail = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const canObserve = typeof IntersectionObserver === 'function';

  useEffect(() => {
    const element = thumbnail.current;
    if (!element || !canObserve || active) return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      root: element.closest('.board-list'),
      rootMargin: '64px 0px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, canObserve]);

  return (
    <span className="board-thumbnail" aria-hidden="true" ref={thumbnail}>
      <span className="board-thumbnail-frame" style={{ aspectRatio: `${WIDTH} / ${layoutSeriesLegend(chart).sheetHeight}` }}>
        {(active || nearViewport || !canObserve) && <ChartDisplay document={chart} />}
      </span>
    </span>
  );
});

function BoardSidebar({ boards, activeId, deletedId, onSelect, onAdd, onDuplicate, onDelete, onRestore, onClear,
  saveStatus, saveFailed, replacementDisabled, onBackup, onRecover, onClose, onRestoreCheckpoint, archivedSources, onDownloadOriginal, onDownloadCheckpoint }: {
  boards: Board[]; activeId: number; deletedId?: number; onSelect: (id: number) => void;
  onAdd: () => void; onDuplicate: () => void; onDelete: (id: number) => void; onRestore: () => void;
  onClear: () => void;
  saveStatus: string; saveFailed: boolean; onBackup: () => void; onRecover: () => void; onClose?: () => void;
  replacementDisabled?: boolean;
  onRestoreCheckpoint?: () => void; archivedSources: string[]; onDownloadOriginal: (source: string, index: number) => void;
  onDownloadCheckpoint?: () => void;
}) {
  return (
    <aside className="board-sidebar" id="board-list-panel" aria-label="画布列表">
      <div className="board-heading">
        <h2>画布</h2>
        <div>
          <button className="icon-button" aria-label="新增画布" title="新增画布" onClick={onAdd}><Plus size={17} /></button>
          <button className="icon-button" aria-label="复制当前画布" title="复制当前画布" onClick={onDuplicate}><Copy size={16} /></button>
          <button className="icon-button board-clear" aria-label="清空全部画布" title="清空全部画布"
            disabled={replacementDisabled} onClick={onClear}><ListX size={17} /></button>
          {onClose && <button className="icon-button" aria-label="关闭画布列表" onClick={onClose}><X size={18} /></button>}
        </div>
      </div>
      {deletedId !== undefined && (
        <div className="board-deletion">
          <span role="status">已删除画布{deletedId}</span>
          <button className="text-button" aria-label={`撤销删除画布${deletedId}`} onClick={onRestore}>撤销删除</button>
        </div>
      )}
      <div className="board-list" role="list">
        {boards.map(({ id, chart }) => {
          const title = chart.title.trim() || '未命名统计图';
          const kind = chart.kind === 'bar' && chart.groupedColumns ? '复式柱状图' : CHART_KIND_LABELS[chart.kind];
          return (
            <div key={id} className="board-card" role="listitem">
              <button className="board-item" aria-pressed={id === activeId} title={title}
                aria-label={`画布 ${id}，${title}，${kind}`} onClick={() => onSelect(id)}>
                <BoardPreview chart={chart} active={id === activeId} />
                <span className="board-name">{title}</span>
                <span className="board-card-meta"><span>{kind}</span><span>画布 {id}</span></span>
              </button>
              <button className="icon-button tiny board-delete" aria-label={`删除画布 ${id}，${title}`}
                title={`删除画布 ${id}`} onClick={() => onDelete(id)}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
      <div className="board-project">
        <small role={saveFailed ? 'status' : undefined}>{saveStatus}</small>
        {onRestoreCheckpoint && <button className="text-button" disabled={replacementDisabled} onClick={onRestoreCheckpoint}><RotateCcw size={14} /> 恢复上个项目</button>}
        <details className="board-project-menu">
          <summary className="text-button">项目管理 <ChevronDown size={14} /></summary>
          <div className="board-project-actions">
            <button className="text-button" onClick={onBackup}><Download size={14} /> 备份项目</button>
            <button className="text-button" disabled={replacementDisabled} onClick={onRecover}><Upload size={14} /> 恢复项目</button>
            {onDownloadCheckpoint && <button className="text-button" onClick={onDownloadCheckpoint}><Download size={14} /> 下载回滚快照</button>}
            {!!archivedSources.length && <details className="board-archive">
              <summary>已保留的原始快照</summary>
              {archivedSources.map((source, index) => <button type="button" className="text-button" key={index}
                onClick={() => onDownloadOriginal(source, index)}><Download size={14} /> 下载快照 {index + 1}</button>)}
            </details>}
          </div>
        </details>
      </div>
    </aside>
  );
}

export default BoardSidebar;
