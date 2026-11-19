import { AXIS_ARROWHEADS, DEFAULT_AXIS_ARROWHEAD, isAxisArrowhead } from '../chart';
import type { ChartEdit, ChartStyle } from '../types';

export default function AxisArrowheadField({ style, onEdit }: { style: ChartStyle; onEdit: ChartEdit }) {
  return (
    <label title="横轴与纵轴共用箭头样式">箭头样式
      <select aria-label="横纵轴箭头样式" value={style.axisArrowhead ?? DEFAULT_AXIS_ARROWHEAD} onChange={event => {
        const axisArrowhead = event.target.value;
        if (isAxisArrowhead(axisArrowhead)) onEdit(current => ({ ...current, style: { ...current.style, axisArrowhead } }));
      }}>
        {Object.entries(AXIS_ARROWHEADS).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
      </select>
    </label>
  );
}
