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

// 自定义数据点形状组件
const CustomDot: React.FC<{
  cx?: number;
  cy?: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  size: number;
  shape: 'circle' | 'square' | 'triangle' | 'diamond';
}> = ({ cx = 0, cy = 0, fill, stroke, strokeWidth, size, shape }) => {
  switch (shape) {
    case 'square':
      return (
        <rect
          x={cx - size}
          y={cy - size}
          width={size * 2}
          height={size * 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'triangle':
      const trianglePoints = `${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`;
      return (
        <polygon
          points={trianglePoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'diamond':
      const diamondPoints = `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
      return (
        <polygon
          points={diamondPoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'circle':
    default:
      return (
        <circle
          cx={cx}
          cy={cy}
          r={size}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
  }
};

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
  fontSize: number;
  distance: number;
  alwaysShow?: boolean;
}> = ({ x = 0, y = 0, value, fill, labelKey, offset, onDrag, isDraggable, fontSize, distance, alwaysShow }) => {
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
      y={y + offset.dy - distance}
      fill={fill}
      fontSize={fontSize}
      fontWeight={600}
      textAnchor="middle"
      style={{ 
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
        // 在拖动模式下添加视觉提示
        opacity: isDraggable ? 1 : 1,
        filter: isDragging ? 'drop-shadow(0 0 2px rgba(99, 102, 241, 0.8))' : 'none',
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

      // 克隆SVG以避免修改原始元素
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      
      // 获取SVG的实际尺寸
      const svgRect = svg.getBoundingClientRect();
      const svgWidth = svgRect.width || svg.clientWidth || 800;
      const svgHeight = svgRect.height || svg.clientHeight || 400;
      
      // 设置克隆SVG的正确尺寸和viewBox
      clonedSvg.setAttribute('width', String(svgWidth));
      clonedSvg.setAttribute('height', String(svgHeight));
      if (!clonedSvg.getAttribute('viewBox')) {
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      }
      
      // 添加必要的命名空间
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      
      // 将计算样式内联到SVG元素中（确保图例等元素正确导出）
      const applyInlineStyles = (element: Element) => {
        const computedStyle = window.getComputedStyle(element as HTMLElement);
        const originalElement = svg.querySelector(`[class="${element.getAttribute('class')}"]`);
        if (originalElement) {
          const origStyle = window.getComputedStyle(originalElement as HTMLElement);
          // 仅对文本元素应用字体样式
          if (element.tagName === 'text' || element.tagName === 'tspan') {
            (element as HTMLElement).style.fontFamily = origStyle.fontFamily;
            (element as HTMLElement).style.fontSize = origStyle.fontSize;
            (element as HTMLElement).style.fontWeight = origStyle.fontWeight;
          }
        }
        Array.from(element.children).forEach(child => applyInlineStyles(child));
      };
      applyInlineStyles(clonedSvg);

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
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
        
        canvas.width = (svgWidth + padding * 2) * scale;
        canvas.height = (svgHeight + titleHeight + padding * 2) * scale;
        ctx.scale(scale, scale);
        
        // 填充白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制标题
        if (config.title) {
          ctx.fillStyle = '#1e293b';
          ctx.font = `bold 20px ${config.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText(config.title, (svgWidth + padding * 2) / 2, padding + 25);
        }
        
        // 绘制图表（SVG已包含图例）
        ctx.drawImage(img, padding, titleHeight + padding, svgWidth, svgHeight);
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
  }, [config.title, config.fontFamily]);

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
    right: config.xAxisArrowEnd ? 30 : (config.xAxisLabelPosition === 'axisLabelRight' ? 50 : 10)
  };
  
  const yAxisPadding = { 
    top: config.yAxisArrowStart ? 20 : (config.yAxisLabelPosition === 'yAxisTop' ? 35 : 10), 
    bottom: config.yAxisArrowEnd ? 30 : 10 
  };

  const xTickFontSize = config.xAxisTickFontSize || 12;
  const yTickFontSize = config.yAxisTickFontSize || 12;
  const xLabelFontSize = config.xAxisLabelFontSize || 12;
  const yLabelFontSize = config.yAxisLabelFontSize || 12;

  // --- X-Axis Label Configuration ---
  // 规范化的位置选项: left (左侧), center (居中), right (右侧), axisLabelRight (轴标签右侧)
  const xOffsetX = config.xAxisLabelOffsetX || 0;
  const xOffsetY = config.xAxisLabelOffsetY || 0;
  
  // 计算X轴标签的基础偏移，根据是否有箭头来调整
  const xAxisLabelBaseOffset = config.xAxisArrowEnd ? 0 : 15;
  
  let xAxisLabelProps: any = {
    value: config.xAxisLabel,
    fill: config.axisColor,
    fontSize: xLabelFontSize,
    style: { fontFamily: config.fontFamily },
  };

  switch (config.xAxisLabelPosition) {
    case 'left':
      xAxisLabelProps = {
        ...xAxisLabelProps,
        position: 'insideBottomLeft',
        dy: 10 + xOffsetY,
        dx: xOffsetX,
        offset: 0,
      };
      break;
    case 'center':
      xAxisLabelProps = {
        ...xAxisLabelProps,
        position: 'insideBottom',
        dy: 10 + xOffsetY,
        dx: xOffsetX,
        offset: 0,
      };
      break;
    case 'right':
      xAxisLabelProps = {
        ...xAxisLabelProps,
        position: 'insideBottomRight',
        dy: 10 + xOffsetY,
        dx: xOffsetX,
        offset: 0,
      };
      break;
    case 'axisLabelRight':
    default:
      // 轴标签右侧 - 在最后一个刻度标签的右边
      xAxisLabelProps = {
        ...xAxisLabelProps,
        position: 'right',
        dy: -2 + xOffsetY,
        dx: -8 + xAxisLabelBaseOffset + xOffsetX,
        offset: 0,
      };
      break;
  }


  // --- Y-Axis Label Configuration ---
  // 规范化的位置选项: top (顶部), center (居中), bottom (底部), yAxisTop (Y轴顶部)
  const yOffsetX = config.yAxisLabelOffsetX || 0;
  const yOffsetY = config.yAxisLabelOffsetY || 0;
  
  // 判断是否使用水平排列（仅对 yAxisTop 生效，其他位置根据 yAxisLabelVertical 决定）
  const isYAxisTopPosition = config.yAxisLabelPosition === 'yAxisTop';
  const isYLabelHorizontal = isYAxisTopPosition || !config.yAxisLabelVertical;
  
  // 计算Y轴标签的基础偏移，根据是否有箭头和文字方向来调整
  const yAxisLabelBaseOffset = config.yAxisArrowStart ? -15 : 0;
  
  // 计算垂直排列时需要的额外偏移，防止和轴标签重叠
  const verticalTextExtraOffset = config.yAxisLabelVertical ? -15 : 0;
  
  let yAxisLabelProps: any = {
    value: config.yAxisLabel,
    fill: config.axisColor,
    fontSize: yLabelFontSize,
    style: { fontFamily: config.fontFamily },
  };

  // Y轴标题水平基础偏移量（统一使用bottom位置的偏移量作为基准）
  const yAxisLabelBaseDx = config.yAxisLabelVertical ? -25 : 15;

  switch (config.yAxisLabelPosition) {
    case 'top':
      yAxisLabelProps = {
        ...yAxisLabelProps,
        position: 'insideTop',
        angle: config.yAxisLabelVertical ? -90 : 0,
        dy: yAxisLabelBaseOffset + (config.yAxisLabelVertical ? 0 : -5) + (config.yAxisLabelVertical ? yOffsetX : yOffsetY),
        dx: yAxisLabelBaseDx + (config.yAxisLabelVertical ? yOffsetY : yOffsetX),
        textAnchor: config.yAxisLabelVertical ? 'middle' : 'start',
      };
      break;
    case 'center':
      yAxisLabelProps = {
        ...yAxisLabelProps,
        position: 'insideLeft',
        angle: config.yAxisLabelVertical ? -90 : 0,
        dy: (config.yAxisLabelVertical ? 0 : 0) + (config.yAxisLabelVertical ? yOffsetX : yOffsetY),
        dx: yAxisLabelBaseDx + (config.yAxisLabelVertical ? yOffsetY : yOffsetX),
        textAnchor: 'middle',
      };
      break;
    case 'bottom':
      yAxisLabelProps = {
        ...yAxisLabelProps,
        position: 'insideBottomLeft',
        angle: config.yAxisLabelVertical ? -90 : 0,
        dy: (config.yAxisLabelVertical ? 0 : 5) + (config.yAxisLabelVertical ? yOffsetX : yOffsetY),
        dx: yAxisLabelBaseDx + (config.yAxisLabelVertical ? yOffsetY : yOffsetX),
        textAnchor: config.yAxisLabelVertical ? 'middle' : 'start',
      };
      break;
    case 'yAxisTop':
    default:
      // Y轴顶部 - 在Y轴箭头上方，水平显示
      yAxisLabelProps = {
        ...yAxisLabelProps,
        position: 'insideTop',
        dy: (config.yAxisArrowStart ? -40 : -25) + (config.yAxisLabelVertical ? yOffsetX : yOffsetY),
        dx: 20 + (config.yAxisLabelVertical ? yOffsetY : yOffsetX),
        textAnchor: 'middle',
        angle: 0,
      };
      break;
  }


  return (
    <div className="w-full flex flex-col bg-white p-4 rounded-xl border border-slate-200 shadow-sm" style={{ height: '500px' }}>
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
      
      <div className="flex-1 w-full h-full" ref={chartRef} style={{ fontFamily: config.fontFamily, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: config.legend ? 50 : 30,
              right: config.xAxisLabelPosition === 'axisLabelRight' && !config.xAxisArrowEnd ? 60 : 30,
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
              tick={{ 
                fill: config.axisColor, 
                fontSize: xTickFontSize,
                dy: config.xAxisTickLabelDistance + (config.xAxisTickType === 'outside' ? 0 : config.xAxisTickType === 'inside' ? -config.xAxisTickSize : -config.xAxisTickSize / 2)
              }}
              interval={config.xAxisTickInterval}
              minTickGap={8}
              tickLine={{ 
                stroke: config.axisColor,
                ...(config.xAxisTickType === 'inside' ? { transform: `translate(0, -${config.xAxisTickSize})` } : {}),
                ...(config.xAxisTickType === 'cross' ? { transform: `translate(0, -${config.xAxisTickSize / 2})` } : {})
              }}
              tickSize={config.xAxisTickType === 'cross' ? config.xAxisTickSize * 2 : config.xAxisTickSize}
              axisLine={{ 
                stroke: config.axisColor, 
                markerEnd: config.xAxisArrowEnd ? 'url(#arrow)' : undefined,
                markerStart: config.xAxisArrowStart ? 'url(#arrow)' : undefined
              }}
              padding={xAxisPadding}
            />
            
            <YAxis 
              label={config.showYAxisLabel ? yAxisLabelProps : undefined} 
              tick={{ 
                fill: config.axisColor, 
                fontSize: yTickFontSize,
                dx: -(config.yAxisTickLabelDistance + (config.yAxisTickType === 'outside' ? 0 : config.yAxisTickType === 'inside' ? config.yAxisTickSize : config.yAxisTickSize / 2))
              }}
              tickCount={config.yAxisTickInterval > 0 ? undefined : (config.yAxisTickCount || 5)}
              interval={config.yAxisTickInterval > 0 ? config.yAxisTickInterval : undefined}
              tickLine={{ 
                stroke: config.axisColor,
                ...(config.yAxisTickType === 'inside' ? { transform: `translate(${config.yAxisTickSize}, 0)` } : {}),
                ...(config.yAxisTickType === 'cross' ? { transform: `translate(${config.yAxisTickSize / 2}, 0)` } : {})
              }}
              tickSize={config.yAxisTickType === 'cross' ? config.yAxisTickSize * 2 : config.yAxisTickSize}
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
                activeDot={{ r: (config.dotSize || 4) + 4 }}
                dot={config.dots ? (props: any) => (
                  <CustomDot
                    cx={props.cx}
                    cy={props.cy}
                    size={config.dotSize || 4}
                    shape={config.dotShape || 'circle'}
                    fill={config.dotFilled ? s.color : '#fff'}
                    stroke={s.color}
                    strokeWidth={config.dotFilled ? 0 : 2}
                  />
                ) : false}
                label={(config.showLabels || isDraggableMode) ? (props: any) => {
                  const labelKey = `${s.dataKey}-${props.index}`;
                  const offset = labelOffsets[labelKey] || { dx: 0, dy: 0 };
                  // 应用整体偏移量
                  const totalOffset = {
                    dx: offset.dx + (config.labelOffsetX || 0),
                    dy: offset.dy + (config.labelOffsetY || 0)
                  };
                  return (
                    <DraggableLabel
                      {...props}
                      fill={s.color}
                      labelKey={labelKey}
                      offset={totalOffset}
                      onDrag={handleLabelDrag}
                      isDraggable={isDraggableMode}
                      fontSize={config.labelFontSize}
                      distance={config.labelDistance}
                      alwaysShow={isDraggableMode}
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