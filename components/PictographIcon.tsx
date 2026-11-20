import { useEffect, useId, useState } from 'react';
import { cachedPictographImage, loadPictographImage } from '../pictographAssets';
import type { EmbeddedSymbol } from '../pictographAssets';
import { PICTOGRAPH_SYMBOLS } from '../pictographSymbols';
import type { PictographSymbol } from '../pictographSymbols';

function EmbeddedImage({ name, filter }: { name: EmbeddedSymbol; filter?: string }) {
  const [loaded, setLoaded] = useState<{ name: EmbeddedSymbol; href: string }>();
  const href = loaded?.name === name ? loaded.href : cachedPictographImage(name);

  useEffect(() => {
    if (href) return;
    let active = true;
    loadPictographImage(name).then(image => {
      if (active) setLoaded({ name, href: image });
    }, () => {});
    return () => { active = false; };
  }, [name, href]);

  return (
    <>
      {!href && <rect x="3" y="3" width="18" height="18" rx="4" fill="#e6ebf4" data-editor-only="" />}
      <image data-pictograph-symbol={name} href={href} width={24} height={24} filter={filter} />
    </>
  );
}

function TintedIcon({ name, size, color }: { name: EmbeddedSymbol; size: number; color: string }) {
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
      <EmbeddedImage name={name} filter={`url(#${filter})`} />
    </svg>
  );
}

export default function PictographIcon({ name, color, colored, outline, size = 24 }: {
  name: PictographSymbol; color: string; colored: boolean; outline: boolean; size?: number;
}) {
  if (name === 'soccer') {
    const [, Soccer] = PICTOGRAPH_SYMBOLS.soccer;
    const ink = colored ? '#202938' : color;
    return <Soccer size={size} color={ink} style={{ color: ink }} aria-hidden="true" />;
  }
  if (colored) return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <EmbeddedImage name={name} />
    </svg>
  );
  const [, Icon, group] = PICTOGRAPH_SYMBOLS[name];
  if (!Icon) return <TintedIcon name={name} size={size} color={color} />;
  const fill = group === 'shapes' && !outline ? color : 'none';
  return <Icon size={size} color={color} fill={fill} strokeWidth={2} aria-hidden="true" />;
}
