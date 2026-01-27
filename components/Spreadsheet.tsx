import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface SpreadsheetProps {
  data: string;
  onChange: (val: string) => void;
}

export const Spreadsheet: React.FC<SpreadsheetProps> = ({ data, onChange }) => {
  const MIN_ROWS = 5;
  const MIN_COLS = 3;

  const createEmptyGrid = (rows = MIN_ROWS, cols = MIN_COLS) =>
    Array.from({ length: rows }, () => Array(cols).fill(''));

  const [grid, setGrid] = useState<string[][]>([]);

  // Helper to generate column headers (A, B, ... Z, AA, AB...)
  const getColHeader = (index: number) => {
    let label = '';
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  // Sync prop data to grid state safely
  useEffect(() => {
    // Basic CSV parser for initial load
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      if (grid.length === 0) setGrid(createEmptyGrid());
      return;
    }

    const parsed = lines.map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.trim().replace(/^"|"$/g, '')));
    
    // Check if the parsed data is significantly different from current grid to avoid overwriting ongoing edits
    // This is a simple check; in a real app, we might need more robust sync logic
    const currentCSV = grid.map(r => r.join(', ')).join('\n');
    
    // Only update if the structural content implies a hard reset (e.g. from parent default) 
    // or if grid is empty.
    // We normalize the comparison by removing spaces to be lenient
    if (grid.length === 0 || Math.abs(currentCSV.length - data.length) > 10) {
         // Normalize grid width
        const maxWidth = Math.max(...parsed.map(r => r.length), MIN_COLS);
        const normalized = parsed.map(row => {
            const newRow = [...row];
            while (newRow.length < maxWidth) newRow.push('');
            return newRow;
        });
        // Ensure minimum rows for easier typing
        while (normalized.length < MIN_ROWS) {
          normalized.push(Array(maxWidth).fill(''));
        }
        setGrid(normalized);
    }
  }, [data]);

  const updateParent = (newGrid: string[][]) => {
    // Simple CSV serializer
    const csv = newGrid
        .map(row => row.join(', '))
        .join('\n');
    onChange(csv);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    let newGrid = grid.map((row, rI) => {
        if (rI !== rowIndex) return row;
        const newRow = [...row];
        newRow[colIndex] = value;
        return newRow;
    });

    const trimmed = value.trim();
    const isLastRow = rowIndex === grid.length - 1;
    const isLastCol = colIndex === (grid[0]?.length ?? MIN_COLS) - 1;

    // Auto-expand when typing at the edge, Excel-style
    if (trimmed !== '') {
      if (isLastCol) {
        newGrid = newGrid.map(row => [...row, '']);
      }
      if (isLastRow) {
        newGrid.push(Array(newGrid[0]?.length || MIN_COLS).fill(''));
      }
    }

    setGrid(newGrid);
    updateParent(newGrid);
  };

  const addRow = () => {
    const cols = grid[0]?.length || MIN_COLS;
    const newRow = Array(cols).fill('');
    const newGrid = [...grid, newRow];
    setGrid(newGrid);
    updateParent(newGrid);
  };

  const addCol = () => {
    const newGrid = grid.map(row => [...row, '']);
    setGrid(newGrid);
    updateParent(newGrid);
  };

  const clearGrid = () => {
    const empty = createEmptyGrid();
    setGrid(empty);
    updateParent(empty);
  };

  const removeRow = (index: number) => {
    if (grid.length <= 1) return;
    const newGrid = grid.filter((_, i) => i !== index);
    setGrid(newGrid);
    updateParent(newGrid);
  };

  const removeCol = (index: number) => {
    if (grid[0].length <= 1) return;
    const newGrid = grid.map(row => row.filter((_, i) => i !== index));
    setGrid(newGrid);
    updateParent(newGrid);
  };
  
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Detect if TSV (Excel/Sheets default) or CSV
    const rows = pasteData.split(/\r?\n/).filter(r => r.trim() !== '');
    
    const newGrid = [...grid];
    
    rows.forEach((rowStr, i) => {
      const rIdx = startRow + i;
      // Expand vertically
      if (rIdx >= newGrid.length) {
         // Add enough rows
         while (newGrid.length <= rIdx) {
            newGrid.push(Array(newGrid[0].length).fill(''));
         }
      }
      
      const cells = rowStr.includes('\t') ? rowStr.split('\t') : rowStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      
      cells.forEach((cellData, j) => {
        const cIdx = startCol + j;
        const cleanVal = cellData.trim().replace(/^"|"$/g, '');
        
        // Expand horizontally
        if (cIdx >= newGrid[rIdx].length) {
             // Add col to all rows
             newGrid.forEach(row => {
                 while(row.length <= cIdx) row.push('');
             });
        }
        
        newGrid[rIdx][cIdx] = cleanVal;
      });
    });

    setGrid(newGrid);
    updateParent(newGrid);
  };

  return (
    <div className="flex flex-col h-full border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
        <span>可直接输入或从 Excel/Sheets 粘贴数据，表格会自动扩展</span>
        <button
          onClick={clearGrid}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="清空表格"
        >
          <Trash2 className="w-3 h-3" /> 清空
        </button>
      </div>
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse table-fixed w-full min-w-max">
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th className="w-10 border-b border-r border-slate-200 bg-slate-50"></th>
              {grid[0]?.map((_, i) => (
                <th key={i} className="w-32 border-b border-r border-slate-200 px-1 py-1 text-center text-xs font-medium text-slate-500 group relative">
                  {getColHeader(i)}
                  <button 
                    onClick={() => removeCol(i)} 
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-500 transition-opacity"
                    title="删除列"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </th>
              ))}
              <th className="w-10 border-b border-slate-200 bg-slate-50">
                <button onClick={addCol} className="w-full h-full flex items-center justify-center hover:bg-indigo-50 text-indigo-600 transition-colors" title="添加列">
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rIdx) => (
              <tr key={rIdx}>
                <td className="sticky left-0 z-10 w-10 border-b border-r border-slate-200 bg-slate-50 text-center text-xs text-slate-400 group relative">
                    <span className="group-hover:hidden">{rIdx + 1}</span>
                    <button 
                        onClick={() => removeRow(rIdx)} 
                        className="hidden group-hover:flex w-full h-full items-center justify-center bg-slate-50 hover:bg-red-50 text-red-500"
                        title="删除行"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="border-b border-r border-slate-200 p-0 relative">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                      className="w-full h-full px-2 py-1.5 outline-none bg-transparent focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:bg-white text-sm"
                    />
                  </td>
                ))}
                <td className="border-b border-slate-200 bg-slate-50/30"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button 
        onClick={addRow} 
        className="flex w-full items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Plus className="w-3 h-3" /> 添加行
      </button>
    </div>
  );
};