import { NOTO_PICTOGRAPH_SYMBOLS } from './notoPictographSymbols';
import { isPictographSymbol } from './pictographSymbols';
import type { PictographSymbol } from './pictographSymbols';

export type EmbeddedSymbol = Exclude<PictographSymbol, 'soccer'>;

const loaders = {
  fluent: () => import('./assets/fluent-pictographs.json').then(module => module.default.icons),
  activities: () => import('./assets/noto-pictographs-activities.json').then(module => module.default),
  objects: () => import('./assets/noto-pictographs-everyday.json').then(module => module.default),
  food: () => import('./assets/noto-pictographs-food.json').then(module => module.default),
  nature: () => import('./assets/noto-pictographs-nature.json').then(module => module.default),
};

type Library = keyof typeof loaders;
type NotoSymbol = keyof typeof NOTO_PICTOGRAPH_SYMBOLS;
const notoLibraries = {
  school: 'objects', transport: 'objects', sports: 'activities', festivals: 'activities',
  food: 'food', animals: 'nature', nature: 'nature',
} satisfies Record<(typeof NOTO_PICTOGRAPH_SYMBOLS)[NotoSymbol][1], Library>;

const libraries = new Map<Library, Promise<Record<string, string>>>();
const embeddedImages = new Map<EmbeddedSymbol, string>();

function libraryFor(name: EmbeddedSymbol): Library {
  const noto = NOTO_PICTOGRAPH_SYMBOLS[name as NotoSymbol];
  return noto ? notoLibraries[noto[1]] : 'fluent';
}

export function cachedPictographImage(name: EmbeddedSymbol) {
  return embeddedImages.get(name);
}

export async function loadPictographImage(name: EmbeddedSymbol) {
  const cached = embeddedImages.get(name);
  if (cached) return cached;

  const library = libraryFor(name);
  let request = libraries.get(library);
  if (!request) {
    request = loaders[library]().catch(error => {
      libraries.delete(library);
      throw error;
    });
    libraries.set(library, request);
  }

  const artwork = (await request)[name];
  if (!artwork) throw new Error(`无法加载图符 ${name}。`);

  // Many chart cells can request the same icon while its library is loading.
  const image = embeddedImages.get(name) ?? `data:image/svg+xml,${encodeURIComponent(artwork)}`;
  embeddedImages.set(name, image);
  return image;
}

export async function hydratePictographImages(svg: SVGSVGElement) {
  const sources = new Set<'fluent' | 'noto'>();
  await Promise.all(Array.from(svg.querySelectorAll<SVGImageElement>('image[data-pictograph-symbol]'), async image => {
    const name = image.getAttribute('data-pictograph-symbol');
    if (!isPictographSymbol(name) || name === 'soccer') throw new Error('导出图符无效。');
    sources.add(libraryFor(name) === 'fluent' ? 'fluent' : 'noto');
    image.setAttribute('href', await loadPictographImage(name));
    image.removeAttribute('data-pictograph-symbol');
  }));

  if (!sources.size) return;
  const credits = await Promise.all([
    sources.has('fluent') ? import('./assets/fluent-pictographs.json').then(module => module.default.license) : '',
    sources.has('noto') ? import('./assets/noto-pictographs-license.json').then(({ default: license }) => (
      [license.source, license.notice, license.changes, license.license].join('\n\n')
    )) : '',
  ]);
  const metadata = svg.ownerDocument.createElementNS(svg.namespaceURI, 'metadata');
  metadata.textContent = credits.filter(Boolean).join('\n\n');
  svg.prepend(metadata);
}
