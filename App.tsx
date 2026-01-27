import React, { useState } from 'react';
import { ChartDataPoint, ChartConfig, ChartSeries, ParsingStatus } from './types';
import ChartDisplay from './components/ChartDisplay';
import Controls from './components/Controls';
import { LineChart as LineChartIcon } from 'lucide-react';

const DEFAULT_CONFIG: ChartConfig = {
  title: 'Chart Title',
  xAxisLabel: 'Category',
  yAxisLabel: 'Value',
  grid: true,
  dots: true,
  strokeWidth: 2,
  smooth: true,
  legend: true,
  axisColor: '#64748b', // Slate-500
  
  xAxisArrowStart: false,
  xAxisArrowEnd: false,
  yAxisArrowStart: false,
  yAxisArrowEnd: true, // Defaulting Y axis to have an upward arrow usually
  
  xAxisStartZero: false,
  yAxisStartZero: true,
  xAxisMin: 'auto',
  xAxisMax: 'auto',
  yAxisMin: 'auto',
  yAxisMax: 'auto',
  xAxisTickFontSize: 12,
  yAxisTickFontSize: 12,
  xAxisTickInterval: 0,
  yAxisTickCount: 5,
  yAxisTickInterval: 0,
  xAxisTickType: 'outside',
  yAxisTickType: 'outside',
  xAxisTickSize: 6,
  yAxisTickSize: 6,
  xAxisTickLabelDistance: 0,
  yAxisTickLabelDistance: 0,
  showLabels: false,
  labelFontSize: 11,
  labelDistance: 5,

  showXAxisLabel: true,
  showYAxisLabel: true,
  
  xAxisLabelPosition: 'rightEnd',
  yAxisLabelPosition: 'aboveArrow',
  xAxisLabelFontSize: 12,
  yAxisLabelFontSize: 12,
  xAxisLabelOffsetX: 0,
  xAxisLabelOffsetY: 0,
  yAxisLabelOffsetX: 0,
  yAxisLabelOffsetY: 0,
  fontFamily: '"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
};

const DEFAULT_DATA = `Month, Sales, Expenses
Jan, 4000, 2400
Feb, 3000, 1398
Mar, 2000, 9800
Apr, 2780, 3908
May, 1890, 4800
Jun, 2390, 3800`;

function App() {
  const [inputData, setInputData] = useState(DEFAULT_DATA);
  const [parsingStatus, setParsingStatus] = useState<ParsingStatus>(ParsingStatus.IDLE);
  
  // Chart State
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CONFIG);
  const [series, setSeries] = useState<ChartSeries[]>([]);

  const parseRawInputToData = (input: string) => {
    const lines = input.trim().split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error("Insufficient data. Please provide a header row and at least one data row.");
    }

    const headerLine = lines[0];
    const delimiters = [',', '\t', ';'];
    
    let delimiter = ',';
    let maxCount = 0;
    for (const d of delimiters) {
      const count = headerLine.split(d).length - 1;
      if (count > maxCount) {
        maxCount = count;
        delimiter = d;
      }
    }

    const parseLine = (line: string) => {
      return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    };

    const headers = parseLine(headerLine);
    const dataRows = lines.slice(1);
    const numericColumnIndices: number[] = [];
    
    const checkLimit = Math.min(dataRows.length, 5);
    for (let colIdx = 1; colIdx < headers.length; colIdx++) {
      let isNumeric = true;
      let hasData = false;
      for (let r = 0; r < checkLimit; r++) {
        const row = parseLine(dataRows[r]);
        if (row.length > colIdx) {
          hasData = true;
          const val = parseFloat(row[colIdx]);
          if (isNaN(val)) {
            isNumeric = false;
            break;
          }
        }
      }
      if (isNumeric && hasData) {
        numericColumnIndices.push(colIdx);
      }
    }

    const seriesIndices = numericColumnIndices.length > 0 
      ? numericColumnIndices 
      : headers.map((_, i) => i).slice(1);

    const seriesKeys = seriesIndices.map(i => headers[i]);
    const data: ChartDataPoint[] = [];

    dataRows.forEach(line => {
      const row = parseLine(line);
      if (row.length === 0) return;

      const label = row[0] || "";
      const point: ChartDataPoint = { label };

      seriesIndices.forEach((colIdx) => {
        const key = headers[colIdx];
        const val = parseFloat(row[colIdx]);
        point[key] = isNaN(val) ? 0 : val;
      });

      data.push(point);
    });

    return {
      data,
      seriesKeys,
      suggestedConfig: {
        title: "Chart Title",
        xAxisLabel: headers[0] || "Category",
        yAxisLabel: seriesKeys.length === 1 ? seriesKeys[0] : "Value",
        xAxisLabelPosition: 'rightEnd',
        yAxisLabelPosition: 'aboveArrow',
      }
    };
  };

  const handleParse = async () => {
    setParsingStatus(ParsingStatus.PARSING);
    try {
      const result = parseRawInputToData(inputData);
      
      setChartData(result.data);
      setChartConfig(prev => ({ ...prev, ...result.suggestedConfig }));
      
      const colors = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#9333ea', '#0891b2'];
      const newSeries = result.seriesKeys.map((key, index) => ({
        dataKey: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        color: colors[index % colors.length]
      }));
      setSeries(newSeries);
      
      setParsingStatus(ParsingStatus.SUCCESS);
    } catch (error) {
      setParsingStatus(ParsingStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <LineChartIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Line Chart Assistant</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-4 h-[calc(100vh-8rem)] lg:sticky lg:top-24">
            <Controls 
              inputData={inputData}
              setInputData={setInputData}
              config={chartConfig}
              setConfig={setChartConfig}
              series={series}
              setSeries={setSeries}
              onParse={handleParse}
              status={parsingStatus}
            />
          </div>

          {/* Right Area - Chart & Insight */}
          <div className="lg:col-span-8 space-y-6">
            <ChartDisplay 
              data={chartData}
              config={chartConfig}
              series={series}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;