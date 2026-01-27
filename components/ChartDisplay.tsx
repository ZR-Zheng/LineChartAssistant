import React, { useRef, useCallback, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartConfig, ChartDataPoint, ChartSeries } from '../types';
import { Download, Move } from 'lucide-react';

// 可拖动标签的位置偏移类型
interface LabelOffset {
  [key: string]: { dx: number; dy: number };
}

// 自定义可拖动标签组件
const DraggableLabel: React.FC<{
  x?: number;
  y?: number;
  value?: number | string;
  fill: string;
  labelKey: string;
  offset: { dx: number; dy: number };
  onDrag: (key: string, dx: number, dy: number) => void;
  isDraggable: boolean;
}> = ({ x = 0, y = 0, value, fill, labelKey, offset, onDrag, isDraggable }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return;
    e.stopPropagation();
    setIsDragging(true);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.dx,
      offsetY: offset.dy,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startPos.current.x + startPos.current.offsetX;
      const dy = moveEvent.clientY - startPos.current.y + startPos.current.offsetY;
      onDrag(labelKey, dx, dy);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <text
      x={x + offset.dx}
      y={y + offset.dy - 5}
      fill={fill}
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      style={{ 
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {value}
    </text>
  );
};

interface ChartDisplayProps {
  data: ChartDataPoint[];
  config: ChartConfig;
  series: ChartSeries[];
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({ data, config, series }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [labelOffsets, setLabelOffsets] = useState<LabelOffset>({});
  const [isDraggableMode, setIsDraggableMode] = useState(false);

  const handleLabelDrag = useCallback((key: string, dx: number, dy: number) => {
    setLabelOffsets(prev => ({
      ...prev,
      [key]: { dx, dy }
    }));
  }, []);

  const resetLabelPositions = useCallback(() => {
    setLabelOffsets({});
  }, []);

  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;
    
    try {
      const svg = chartRef.current.querySelector('svg');
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const scale = 2;
        const titleHeight = config.title ? 50 : 0;
        const padding = 20;
        
        canvas.width = (img.width + padding * 2) * scale;
        canvas.height = (img.height + titleHeight + padding * 2) * scale;
        ctx.scale(scale, scale);
        
        // 填充白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制标题
        if (config.title) {
          ctx.fillStyle = '#1e293b';
          ctx.font = `bold 20px ${config.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText(config.title, (img.width + padding * 2) / 2, padding + 25);
        }
        
        // 绘制图表
        ctx.drawImage(img, padding, titleHeight + padding);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${config.title || 'chart'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

      img.src = url;
    } catch (error) {
      console.error('导出PNG失败:', error);
    }
  }, [config.title]);

  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-400">
        <p>暂无数据，请在左侧输入数据</p>
      </div>
    );
  }

  // Padding logic to extend axes when arrows are present
  // If arrow is present at start, we add padding to the start side.
  // If arrow is present at end, we add padding to the end side.
  const xAxisPadding = { 
    left: config.xAxisArrowStart ? 20 : 10, 
    right: config.xAxisArrowEnd ? 30 : 10 
  };
  
  const yAxisPadding = { 
    top: config.yAxisArrowStart ? 20 : 10, 
    bottom: config.yAxisArrowEnd ? 30 : 10 
  };

  const xTickFontSize = config.xAxisTickFontSize || 12;
  const yTickFontSize = config.yAxisTickFontSize || 12;
  const xLabelFontSize = config.xAxisLabelFontSize || 12;
  const yLabelFontSize = config.yAxisLabelFontSize || 12;

  // --- X-Axis Label Configuration ---
  const xOffsetX = config.xAxisLabelOffsetX || 0;
  const xOffsetY = config.xAxisLabelOffsetY || 0;
  
  let xAxisLabelProps: any = {
    value: config.xAxisLabel,
    fill: config.axisColor,
    fontSize: xLabelFontSize,
    style: { fontFamily: config.fontFamily },
  };

  if (config.xAxisLabelPosition === 'rightBelow') {
    // Custom position: Below the right end of the axis
    xAxisLabelProps = {
      ...xAxisLabelProps,
      position: 'insideBottomRight',
      dy: 10 + xOffsetY,
      dx: xOffsetX,
      offset: 0,
    };
  } else if (config.xAxisLabelPosition === 'rightEnd') {
    // New position: Right of the last tick, aligned with X axis ticks, below arrow
    xAxisLabelProps = {
      ...xAxisLabelProps,
      position: 'right',
      dy: -2 + xOffsetY,
      dx: -8 + xOffsetX,
      offset: 0,
    };
  } else {
    // Standard positions
    xAxisLabelProps = {
      ...xAxisLabelProps,
      position: config.xAxisLabelPosition as any,
      offset: config.xAxisLabelPosition === 'insideBottom' ? -10 : 0,
      dy: xOffsetY,
      dx: xOffsetX,
    };
  }


  // --- Y-Axis Label Configuration ---
  const yOffsetX = config.yAxisLabelOffsetX || 0;
  const yOffsetY = config.yAxisLabelOffsetY || 0;
  const isYLabelHorizontal = config.yAxisLabelPosition === 'insideTop' || config.yAxisLabelPosition === 'insideTopLeft' || config.yAxisLabelPosition === 'topAbove' || config.yAxisLabelPosition === 'aboveArrow';
  
  let yAxisLabelProps: any = {
    value: config.yAxisLabel,
    fill: config.axisColor,
    angle: isYLabelHorizontal ? 0 : -90,
    fontSize: yLabelFontSize,
    style: { fontFamily: config.fontFamily },
  };

  if (config.yAxisLabelPosition === 'topAbove') {
    // Custom position: Above the top arrow, centered
    yAxisLabelProps = {
      ...yAxisLabelProps,
      position: 'insideTopLeft',
      dy: -25 + yOffsetY,
      dx: 0 + yOffsetX,
      textAnchor: 'middle',
    };
  } else if (config.yAxisLabelPosition === 'aboveArrow') {
    // New position: Above Y axis arrow, horizontal, centered vertically above arrow
    yAxisLabelProps = {
      ...yAxisLabelProps,
      position: 'insideTop',
      dy: -30 + yOffsetY,
      dx: 20 + yOffsetX,
      textAnchor: 'middle',
      angle: 0,
    };
  } else {
    // Standard positions
    yAxisLabelProps = {
      ...yAxisLabelProps,
      position: config.yAxisLabelPosition as any,
      offset: config.yAxisLabelPosition === 'insideTop' ? -15 : 0,
      dy: yOffsetY,
      dx: yOffsetX,
    };
  }


  return (
    <div className="w-full h-[400px] sm:h-[500px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.showLabels && (
            <>
              <button
                onClick={() => setIsDraggableMode(!isDraggableMode)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDraggableMode 
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' 
                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
                title={isDraggableMode ? "关闭拖动模式" : "开启拖动模式调整标签位置"}
              >
                <Move className="w-4 h-4" />
                拖动标签
              </button>
              {Object.keys(labelOffsets).length > 0 && (
                <button
                  onClick={resetLabelPositions}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="重置所有标签位置"
                >
                  重置位置
                </button>
              )}
            </>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: config.fontFamily }}>{config.title}</h2>
        <button
          onClick={handleExportPNG}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          title="导出为PNG图片"
        >
          <Download className="w-4 h-4" />
          导出PNG
        </button>
      </div>
      
      <div className="flex-1 w-full min-h-0" ref={chartRef} style={{ fontFamily: config.fontFamily }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 30, // Increased top margin to accommodate 'topAbove' label
              right: 30,
              left: 20,
              bottom: 25,
            }}
          >
            <defs>
              {/* 
                refX=0 puts the attachment point at the base of the triangle.
                orient="auto-start-reverse" allows the same marker to be used for start (pointing out) and end (pointing out).
              */}
              <marker 
                id="arrow" 
                viewBox="0 0 10 10" 
                refX="0" 
                refY="5" 
                markerWidth="6" 
                markerHeight="6" 
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={config.axisColor} />
              </marker>
            </defs>
            
            {config.grid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
            
            <XAxis 
              dataKey="label" 
              label={config.showXAxisLabel ? xAxisLabelProps : undefined} 
              tick={{ fill: config.axisColor, fontSize: xTickFontSize }}
              interval={config.xAxisTickInterval}
              minTickGap={8}
              tickLine={{ 
                stroke: config.axisColor,
                ...(config.xAxisTickType === 'inside' ? { transform: 'translate(0, -6)' } : {}),
                ...(config.xAxisTickType === 'cross' ? { transform: 'translate(0, -3)' } : {})
              }}
              tickSize={config.xAxisTickType === 'cross' ? 12 : 6}
              axisLine={{ 
                stroke: config.axisColor, 
                markerEnd: config.xAxisArrowEnd ? 'url(#arrow)' : undefined,
                markerStart: config.xAxisArrowStart ? 'url(#arrow)' : undefined
              }}
              padding={xAxisPadding}
            />
            
            <YAxis 
              label={config.showYAxisLabel ? yAxisLabelProps : undefined} 
              tick={{ fill: config.axisColor, fontSize: yTickFontSize }}
              tickCount={config.yAxisTickInterval > 0 ? undefined : (config.yAxisTickCount || 5)}
              interval={config.yAxisTickInterval > 0 ? config.yAxisTickInterval : undefined}
              tickLine={{ 
                stroke: config.axisColor,
                ...(config.yAxisTickType === 'inside' ? { transform: 'translate(6, 0)' } : {}),
                ...(config.yAxisTickType === 'cross' ? { transform: 'translate(3, 0)' } : {})
              }}
              tickSize={config.yAxisTickType === 'cross' ? 12 : 6}
              axisLine={{ 
                stroke: config.axisColor, 
                markerEnd: config.yAxisArrowStart ? 'url(#arrow)' : undefined,
                markerStart: config.yAxisArrowEnd ? 'url(#arrow)' : undefined
              }}
              padding={yAxisPadding}
              domain={[
                config.yAxisStartZero ? 0 : (config.yAxisMin === 'auto' || config.yAxisMin === '' ? 'dataMin' : parseFloat(config.yAxisMin)),
                config.yAxisMax === 'auto' || config.yAxisMax === '' ? 'dataMax' : parseFloat(config.yAxisMax)
              ]}
              allowDataOverflow={false}
            />
            
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            
            {config.legend && <Legend verticalAlign="top" height={36}/>}
            
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type={config.smooth ? "monotone" : "linear"}
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={config.strokeWidth}
                activeDot={{ r: 8 }}
                dot={config.dots ? { r: 4 } : false}
                label={config.showLabels ? (props: any) => {
                  const labelKey = `${s.dataKey}-${props.index}`;
                  const offset = labelOffsets[labelKey] || { dx: 0, dy: 0 };
                  return (
                    <DraggableLabel
                      {...props}
                      fill={s.color}
                      labelKey={labelKey}
                      offset={offset}
                      onDrag={handleLabelDrag}
                      isDraggable={isDraggableMode}
                    />
                  );
                } : false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartDisplay;