import type { ChartEdit, DataHighlight, Series, SeriesStyle } from '../types';
import PictographSymbolField from './PictographSymbolField';

export default function ColumnIconField({ label, series, index, onEdit, onHighlight }: {
  label: string; series: Series; index: number; onEdit: ChartEdit; onHighlight: (highlight: DataHighlight) => void;
}) {
  const icon = series.style?.columnIcon;

  function update(columnIcon: SeriesStyle['columnIcon']) {
    onEdit(current => ({
      ...current,
      series: current.series.map((item, i) => i === index ? { ...item, style: { ...item.style, columnIcon } } : item),
    }));
    onHighlight({ series: index });
  }

  return <PictographSymbolField label={label} value={icon?.symbol ?? null} color={series.color}
    mode={icon?.colorMode ?? 'single'} outline={false}
    onChange={(symbol, colorMode) => update({ symbol, colorMode })}
    onModeChange={colorMode => { if (icon) update({ ...icon, colorMode }); }}
    onReset={icon ? () => update(undefined) : undefined} resetLabel="恢复普通柱形" />;
}
