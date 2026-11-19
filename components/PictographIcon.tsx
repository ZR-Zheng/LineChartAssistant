import { useId } from 'react';
import fluent from '../assets/fluent-pictographs.json';
import notoActivities from '../assets/noto-pictographs-activities.json';
import notoEveryday from '../assets/noto-pictographs-everyday.json';
import notoFood from '../assets/noto-pictographs-food.json';
import notoNature from '../assets/noto-pictographs-nature.json';
import notoLicense from '../assets/noto-pictographs-license.json';
import { PICTOGRAPH_SYMBOLS } from '../pictographSymbols';
import type { PictographSymbol } from '../pictographSymbols';

const iconSources = { ...fluent.icons, ...notoActivities, ...notoEveryday, ...notoFood, ...notoNature } satisfies Record<PictographSymbol, string>;
const embeddedImages = new Map<PictographSymbol, string>();
export const PICTOGRAPH_ICON_LICENSES = {
  fluent: fluent.license,
  noto: [notoLicense.source, notoLicense.notice, notoLicense.changes, notoLicense.license].join('\n\n'),
};

function embeddedIcon(name: PictographSymbol) {
  let image = embeddedImages.get(name);
  if (!image) {
    image = `data:image/svg+xml,${encodeURIComponent(iconSources[name])}`;
    embeddedImages.set(name, image);
  }
  return image;
}

function TintedIcon({ href, size, color }: { href: string; size: number; color: string }) {
  const filter = `pictograph-tint-${useId().replace(/[^a-z\d_-]/gi, '')}`;
  const rgb = Number.parseInt(color.slice(1), 16);
  const matrix = [16, 8, 0].map(shift => {
    const channel = ((rgb >> shift) & 255) / 255;
    const brightness = 1 - channel;
    return `${0.2126 * brightness} ${0.7152 * brightness} ${0.0722 * brightness} 0 ${channel}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <filter id={filter} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={`${matrix} 0 0 0 1 0`} />
        </filter>
      </defs>
      <image href={href} width={24} height={24} filter={`url(#${filter})`} />
    </svg>
  );
}

export default function PictographIcon({ name, color, colored, outline, size = 24 }: {
  name: PictographSymbol; color: string; colored: boolean; outline: boolean; size?: number;
}) {
  if (colored) return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <image href={embeddedIcon(name)} width={24} height={24} />
    </svg>
  );
  const [, Icon, group] = PICTOGRAPH_SYMBOLS[name];
  if (!Icon) return <TintedIcon href={embeddedIcon(name)} size={size} color={color} />;
  const fill = group === 'shapes' && !outline ? color : 'none';
  return <Icon size={size} color={color} fill={fill} strokeWidth={2} aria-hidden="true" />;
}
