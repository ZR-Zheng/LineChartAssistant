import { memo } from 'react';
import { Copy, Download, ListX, Plus, Trash2, Upload } from 'lucide-react';
import type { Board } from '../boards';
import type { ChartDocument } from '../types';
import ChartDisplay from './ChartDisplay';

const BoardPreview = memo(function BoardPreview({ chart }: { chart: ChartDocument }) {
  return <ChartDisplay document={chart} />;
});

function BoardSidebar({ boards, activeId, deletedId, onSelect, onAdd, onDuplicate, onDelete, onRestore, onClear, saveFailed, onBackup, onRecover }: {
  boards: Board[]; activeId: number; deletedId?: number; onSelect: (id: number) => void;
  onAdd: () => void; onDuplicate: () => void; onDelete: (id: number) => void; onRestore: () => void;
  onClear: () => void;
  saveFailed: boolean; onBackup: () => void; onRecover: () => void;
}) {
  return (
    <aside className="board-sidebar" aria-label="画布列表">
      <div className="board-heading">
        <h2>画布</h2>
        <div>
          <button className="icon-button" aria-label="新增画布" title="新增画布" onClick={onAdd}><Plus size={17} /></button>
          <button className="icon-button" aria-label="复制当前画布" title="复制当前画布" onClick={onDuplicate}><Copy size={16} /></button>
          <button className="icon-button board-clear" aria-label="清空全部画布" title="清空全部画布" onClick={onClear}><ListX size={17} /></button>
        </div>
      </div>
      {deletedId !== undefined && (
        <div className="board-deletion">
          <span role="status">已删除画布{deletedId}</span>
          <button className="text-button" aria-label={`撤销删除画布${deletedId}`} onClick={onRestore}>撤销删除</button>
        </div>
      )}
      <div className="board-list">
        {boards.map(board => (
          <div key={board.id} className="board-card">
            <button className="board-item" aria-pressed={board.id === activeId}
              aria-label={`画布${board.id}`} onClick={() => onSelect(board.id)}>
              <span className="board-thumbnail"><BoardPreview chart={board.chart} /></span>
              <span className="board-name">画布{board.id}</span>
            </button>
            <button className="icon-button tiny board-delete" aria-label={`删除画布${board.id}`}
              title={`删除画布${board.id}`} onClick={() => onDelete(board.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="board-project">
        <small role={saveFailed ? 'alert' : undefined}>{saveFailed ? '本机自动保存失败' : '已保存到本机'}</small>
        <button className="text-button" onClick={onBackup}><Download size={14} /> 备份项目</button>
        <button className="text-button" onClick={onRecover}><Upload size={14} /> 恢复项目</button>
      </div>
    </aside>
  );
}

export default BoardSidebar;
