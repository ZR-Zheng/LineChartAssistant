import { useEffect, useId, useState } from 'react';
import { cachedPictographImage, loadPictographImage } from '../pictographAssets';
import type { PictographSymbol } from '../pictographSymbols';

function EmbeddedImage({ name, filter }: { name: PictographSymbol; filter?: string }) {
  const [loaded, setLoaded] = useState<{ name: PictographSymbol; href: string }>();
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

function TintedIcon({ name, size, color }: { name: PictographSymbol; size: number; color: string }) {
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

const outlinePaths: Partial<Record<PictographSymbol, string>> = {
  circle: 'M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0Z',
  square: 'M3 3h18v18H3Z',
  triangle: 'M12 3 22 21H2Z',
  diamond: 'M12 2 22 12 12 22 2 12Z',
  star: 'm12 2 3 6.5 7 .9-5 5 1.2 7-6.2-3.4-6.2 3.4L7 14.4l-5-5 7-.9Z',
  heart: 'M12 21 4 13C-2 7 6 1 12 7c6-6 14 0 8 6Z',
};

export default function PictographIcon({ name, color, colored, outline, size = 24 }: {
  name: PictographSymbol; color: string; colored: boolean; outline: boolean; size?: number;
}) {
  const path = outline && !colored ? outlinePaths[name] : undefined;
  if (path) return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
  </svg>;
  if (colored) return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <EmbeddedImage name={name} />
    </svg>
  );
  return <TintedIcon name={name} size={size} color={color} />;
}
