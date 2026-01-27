import React, { useState, useEffect } from 'react';
import { ChartConfig, ChartSeries, ParsingStatus, ChartPreset } from '../types';
import { Loader2, Wand2, RefreshCw, Grid3X3, FileText, MoveRight, MoveUp, Eye, EyeOff, Save, FolderOpen, Trash2 } from 'lucide-react';
import { Spreadsheet } from './Spreadsheet';

interface ControlsProps {
  inputData: string;
  setInputData: (val: string) => void;
  config: ChartConfig;
  setConfig: (val: ChartConfig) => void;
  series: ChartSeries[];
  setSeries: (val: ChartSeries[]) => void;
  onParse: () => void;
  status: ParsingStatus;
}

const COLORS = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

const Controls: React.FC<ControlsProps> = ({
  inputData,
  setInputData,
  config,
  setConfig,
  series,
  setSeries,
  onParse,
  status
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');
  const [inputMode, setInputMode] = useState<'grid' | 'text'>('grid');
  const [presets, setPresets] = useState<ChartPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetPanel, setShowPresetPanel] = useState(false);

  // 从 localStorage 加载预设
  useEffect(() => {
    const savedPresets = localStorage.getItem('chartPresets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('加载预设失败:', e);
      }
    }
  }, []);

  // 保存预设到 localStorage
  const savePresetsToStorage = (updatedPresets: ChartPreset[]) => {
    localStorage.setItem('chartPresets', JSON.stringify(updatedPresets));
    setPresets(updatedPresets);
  };

  // 创建新预设
  const createPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: ChartPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      config: { ...config },
      createdAt: Date.now(),
    };
    savePresetsToStorage([...presets, newPreset]);
    setNewPresetName('');
  };

  // 加载预设
  const loadPreset = (preset: ChartPreset) => {
    setConfig({ ...preset.config });
  };

  // 删除预设
  const deletePreset = (id: string) => {
    savePresetsToStorage(presets.filter(p => p.id !== id));
  };

  const updateConfig = (key: keyof ChartConfig, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const updateSeriesColor = (index: number, color: string) => {
    const newSeries = [...series];
    newSeries[index].color = color;
    setSeries(newSeries);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'data' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          数据
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'style' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          样式
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto flex flex-col min-h-0">
        {activeTab === 'data' ? (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                输入数据
              </label>
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setInputMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${inputMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  title="表格视图"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setInputMode('text')}
                  className={`p-1.5 rounded-md transition-all ${inputMode === 'text' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  title="文本编辑器"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[250px] relative">
              {inputMode === 'grid' ? (
                <Spreadsheet data={inputData} onChange={setInputData} />
              ) : (
                <textarea
                  className="w-full h-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono"
                  placeholder={`在此粘贴数据
示例：
月份, 收入, 成本
1月, 4000, 2400
2月, 3000, 1398`}
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-3 pt-2">
                <button
                onClick={onParse}
                disabled={status === ParsingStatus.PARSING || !inputData.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {status === ParsingStatus.PARSING ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Wand2 className="w-4 h-4" />
                )}
                {status === ParsingStatus.PARSING ? '生成中...' : '生成图表'}
                </button>
                
                {status === ParsingStatus.ERROR && (
                <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                    解析失败，请检查数据格式
                </p>
                )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 预设管理 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">预设管理</h3>
                <button
                  onClick={() => setShowPresetPanel(!showPresetPanel)}
                  className={`p-1.5 rounded-md transition-all ${showPresetPanel ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                  title={showPresetPanel ? "收起预设面板" : "展开预设面板"}
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              
              {showPresetPanel && (
                <div className="bg-slate-50 rounded-lg p-3 space-y-3 mb-4">
                  {/* 保存新预设 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="输入预设名称..."
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-indigo-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && createPreset()}
                    />
                    <button
                      onClick={createPreset}
                      disabled={!newPresetName.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="保存当前设置为预设"
                    >
                      <Save className="w-3.5 h-3.5" />
                      保存
                    </button>
                  </div>
                  
                  {/* 预设列表 */}
                  {presets.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-slate-200 group"
                        >
                          <button
                            onClick={() => loadPreset(preset)}
                            className="flex-1 text-left text-sm text-slate-700 hover:text-indigo-600 transition-colors truncate"
                            title={`加载预设: ${preset.name}`}
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="删除预设"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2">暂无保存的预设</p>
                  )}
                </div>
              )}
            </div>

            {/* General Config */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">基本设置</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">图表标题</label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => updateConfig('title', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">图表字体</label>
                  <select
                    value={config.fontFamily}
                    onChange={(e) => updateConfig('fontFamily', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:border-indigo-500 outline-none"
                  >
                    <option value='"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'>思源黑体</option>
                    <option value='"Microsoft YaHei", sans-serif'>微软雅黑</option>
                    <option value='"SimSun", serif'>宋体</option>
                    <option value='"SimHei", sans-serif'>黑体</option>
                    <option value='"KaiTi", serif'>楷体</option>
                    <option value='"FangSong", serif'>仿宋</option>
                    <option value='Arial, sans-serif'>Arial</option>
                    <option value='"Times New Roman", serif'>Times New Roman</option>
                    <option value='Georgia, serif'>Georgia</option>
                    <option value='"Courier New", monospace'>Courier New</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700">X轴标签</label>
                      <button 
                        onClick={() => updateConfig('showXAxisLabel', !config.showXAxisLabel)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title={config.showXAxisLabel ? "隐藏标签" : "显示标签"}
                      >
                         {config.showXAxisLabel ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={config.xAxisLabel}
                      disabled={!config.showXAxisLabel}
                      onChange={(e) => updateConfig('xAxisLabel', e.target.value)}
                      className={`w-full px-2 py-1.5 text-sm border rounded focus:border-indigo-500 outline-none transition-colors mb-1 ${!config.showXAxisLabel ? 'bg-slate-50 text-slate-400 border-slate-200' : 'border-slate-300'}`}
                    />
                    <select
                        value={config.xAxisLabelPosition}
                        onChange={(e) => updateConfig('xAxisLabelPosition', e.target.value)}
                        disabled={!config.showXAxisLabel}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none bg-slate-50 focus:bg-white"
                    >
                        <option value="insideBottom">居中 (内侧)</option>
                        <option value="bottom">居中 (外侧)</option>
                        <option value="insideBottomLeft">左侧</option>
                        <option value="insideBottomRight">右侧 (内侧)</option>
                        <option value="rightBelow">右侧 (轴下方)</option>
                        <option value="rightEnd">箭头下方 (右端)</option>
                    </select>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      value={config.xAxisLabelFontSize}
                      onChange={(e) => updateConfig('xAxisLabelFontSize', Number(e.target.value) || 12)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none mt-1"
                      placeholder="字号"
                      disabled={!config.showXAxisLabel}
                    />
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        value={config.xAxisLabelOffsetX}
                        onChange={(e) => updateConfig('xAxisLabelOffsetX', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                        placeholder="X偏移"
                        title="水平偏移量"
                        disabled={!config.showXAxisLabel}
                      />
                      <input
                        type="number"
                        value={config.xAxisLabelOffsetY}
                        onChange={(e) => updateConfig('xAxisLabelOffsetY', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                        placeholder="Y偏移"
                        title="垂直偏移量"
                        disabled={!config.showXAxisLabel}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700">Y轴标签</label>
                       <button 
                        onClick={() => updateConfig('showYAxisLabel', !config.showYAxisLabel)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title={config.showYAxisLabel ? "隐藏标签" : "显示标签"}
                      >
                         {config.showYAxisLabel ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={config.yAxisLabel}
                      disabled={!config.showYAxisLabel}
                      onChange={(e) => updateConfig('yAxisLabel', e.target.value)}
                      className={`w-full px-2 py-1.5 text-sm border rounded focus:border-indigo-500 outline-none transition-colors mb-1 ${!config.showYAxisLabel ? 'bg-slate-50 text-slate-400 border-slate-200' : 'border-slate-300'}`}
                    />
                    <select
                        value={config.yAxisLabelPosition}
                        onChange={(e) => updateConfig('yAxisLabelPosition', e.target.value)}
                        disabled={!config.showYAxisLabel}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none bg-slate-50 focus:bg-white"
                    >
                        <option value="insideLeft">居中 (垂直)</option>
                        <option value="insideTop">顶部 (水平)</option>
                        <option value="insideTopLeft">左上角</option>
                        <option value="topAbove">顶部 (轴上方)</option>
                        <option value="aboveArrow">箭头上方 (水平居中)</option>
                        <option value="left">居中 (外侧)</option>
                    </select>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      value={config.yAxisLabelFontSize}
                      onChange={(e) => updateConfig('yAxisLabelFontSize', Number(e.target.value) || 12)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none mt-1"
                      placeholder="字号"
                      disabled={!config.showYAxisLabel}
                    />
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <input
                        type="number"
                        value={config.yAxisLabelOffsetX}
                        onChange={(e) => updateConfig('yAxisLabelOffsetX', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                        placeholder="X偏移"
                        title="水平偏移量"
                        disabled={!config.showYAxisLabel}
                      />
                      <input
                        type="number"
                        value={config.yAxisLabelOffsetY}
                        onChange={(e) => updateConfig('yAxisLabelOffsetY', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                        placeholder="Y偏移"
                        title="垂直偏移量"
                        disabled={!config.showYAxisLabel}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Axes & Display */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">坐标轴设置</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-700">轴颜色</label>
                    <input 
                        type="color" 
                        value={config.axisColor} 
                        onChange={(e) => updateConfig('axisColor', e.target.value)}
                        className="h-8 w-14 p-1 rounded border border-slate-300 cursor-pointer"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-700">
                        <span className="flex items-center gap-1"><MoveRight className="w-3 h-3"/> X轴箭头</span>
                        <div className="flex items-center gap-3">
                             <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={config.xAxisArrowStart} onChange={(e) => updateConfig('xAxisArrowStart', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-xs">起点</span>
                             </label>
                             <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={config.xAxisArrowEnd} onChange={(e) => updateConfig('xAxisArrowEnd', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-xs">终点</span>
                             </label>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-slate-700">
                        <span className="flex items-center gap-1"><MoveUp className="w-3 h-3"/> Y轴箭头</span>
                        <div className="flex items-center gap-3">
                             <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={config.yAxisArrowStart} onChange={(e) => updateConfig('yAxisArrowStart', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-xs">起点</span>
                             </label>
                             <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={config.yAxisArrowEnd} onChange={(e) => updateConfig('yAxisArrowEnd', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-xs">终点</span>
                             </label>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">X轴字号</label>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      value={config.xAxisTickFontSize}
                      onChange={(e) => updateConfig('xAxisTickFontSize', Number(e.target.value) || 12)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Y轴字号</label>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      value={config.yAxisTickFontSize}
                      onChange={(e) => updateConfig('yAxisTickFontSize', Number(e.target.value) || 12)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">X轴刻度间隔</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={config.xAxisTickInterval}
                      onChange={(e) => updateConfig('xAxisTickInterval', Number(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                    />
                    <span className="text-xs text-slate-400">0=全部显示</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Y轴刻度数量</label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={config.yAxisTickCount}
                      onChange={(e) => updateConfig('yAxisTickCount', Number(e.target.value) || 5)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Y轴刻度间隔</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={config.yAxisTickInterval}
                      onChange={(e) => updateConfig('yAxisTickInterval', Number(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                    />
                    <span className="text-xs text-slate-400">0=按数量显示</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">选项</label>
                    <div className="text-xs text-slate-500 py-1.5">
                      优先使用间隔设置
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">X轴刻度类型</label>
                    <select
                      value={config.xAxisTickType}
                      onChange={(e) => updateConfig('xAxisTickType', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none bg-slate-50 focus:bg-white"
                    >
                      <option value="outside">外部</option>
                      <option value="inside">内部</option>
                      <option value="cross">交叉</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Y轴刻度类型</label>
                    <select
                      value={config.yAxisTickType}
                      onChange={(e) => updateConfig('yAxisTickType', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded outline-none bg-slate-50 focus:bg-white"
                    >
                      <option value="outside">外部</option>
                      <option value="inside">内部</option>
                      <option value="cross">交叉</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                     <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.showLabels}
                            onChange={(e) => updateConfig('showLabels', e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">显示数值</span>
                    </label>
                </div>
                
                <div className="pt-2 border-t border-slate-100 space-y-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.yAxisStartZero}
                            onChange={(e) => updateConfig('yAxisStartZero', e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-700">Y轴从0开始</span>
                    </label>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Y轴范围</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="最小值 (auto)"
                          value={config.yAxisMin}
                          disabled={config.yAxisStartZero}
                          onChange={(e) => updateConfig('yAxisMin', e.target.value)}
                          className="px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="最大值 (auto)"
                          value={config.yAxisMax}
                          onChange={(e) => updateConfig('yAxisMax', e.target.value)}
                          className="px-2 py-1.5 text-xs border border-slate-300 rounded focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">图表样式</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.grid}
                    onChange={(e) => updateConfig('grid', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">显示网格</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.legend}
                    onChange={(e) => updateConfig('legend', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">显示图例</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.dots}
                    onChange={(e) => updateConfig('dots', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">显示数据点</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.smooth}
                    onChange={(e) => updateConfig('smooth', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">平滑曲线</span>
                </label>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  线条粗细: {config.strokeWidth}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={config.strokeWidth}
                  onChange={(e) => updateConfig('strokeWidth', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Series Colors */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">系列颜色</h3>
              <div className="space-y-2">
                {series.map((s, idx) => (
                  <div key={s.dataKey} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 truncate max-w-[100px]">{s.name}</span>
                    <div className="flex gap-1">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateSeriesColor(idx, c)}
                          className={`w-5 h-5 rounded-full border ${s.color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {series.length === 0 && <p className="text-sm text-slate-400 italic">暂无系列数据</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Controls;