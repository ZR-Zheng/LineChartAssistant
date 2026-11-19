import assets from '../assets/fluent-pictographs.json';
import { PICTOGRAPH_SYMBOLS } from '../pictographSymbols';
import type { PictographSymbol } from '../pictographSymbols';

const colorImages = Object.fromEntries(Object.entries(assets.icons).map(([name, svg]) => (
  [name, `data:image/svg+xml,${encodeURIComponent(svg)}`]
)));
export const PICTOGRAPH_ICON_LICENSE = assets.license;

export default function PictographIcon({ name, color, colored, outline, size = 24 }: {
  name: PictographSymbol; color: string; colored: boolean; outline: boolean; size?: number;
}) {
  if (colored) return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <image href={colorImages[name]} width={24} height={24} />
    </svg>
  );
  const [, Icon, group] = PICTOGRAPH_SYMBOLS[name];
  const fill = group === 'shapes' && !outline ? color : 'none';
  return <Icon size={size} color={color} fill={fill} strokeWidth={2} aria-hidden="true" />;
}
