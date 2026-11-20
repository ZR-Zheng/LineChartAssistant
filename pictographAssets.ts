import { isPictographSymbol, PICTOGRAPH_SYMBOLS } from './pictographSymbols';
import type { PictographSymbol } from './pictographSymbols';

const loaders = {
  activities: () => import('./assets/noto-pictographs-activities.json').then(module => module.default),
  objects: () => import('./assets/noto-pictographs-everyday.json').then(module => module.default),
  food: () => import('./assets/noto-pictographs-food.json').then(module => module.default),
  animals: () => import('./assets/noto-pictographs-animals.json').then(module => module.default),
  nature: () => import('./assets/noto-pictographs-nature.json').then(module => module.default),
  transport: () => import('./assets/noto-pictographs-transport.json').then(module => module.default),
  places: () => import('./assets/noto-pictographs-places.json').then(module => module.default),
  symbols: () => import('./assets/noto-pictographs-symbols.json').then(module => module.default),
};

type Library = keyof typeof loaders;
const notoLibraries = {
  school: 'objects', transport: 'transport', sports: 'activities', festivals: 'activities',
  food: 'food', animals: 'animals', nature: 'nature', places: 'places', shapes: 'symbols', expressions: 'symbols',
} satisfies Record<(typeof PICTOGRAPH_SYMBOLS)[PictographSymbol][1], Library>;

const libraries = new Map<Library, Promise<Record<string, string>>>();
const embeddedImages = new Map<PictographSymbol, string>();

export function cachedPictographImage(name: PictographSymbol) {
  return embeddedImages.get(name);
}

export async function loadPictographImage(name: PictographSymbol) {
  const cached = embeddedImages.get(name);
  if (cached) return cached;

  const library = notoLibraries[PICTOGRAPH_SYMBOLS[name][1]];
  let request = libraries.get(library);
  if (!request) {
    request = loaders[library]().catch(error => {
      libraries.delete(library);
      throw error;
    });
    libraries.set(library, request);
  }

  const artwork = (await request)[name];
  if (!artwork) throw new Error(`无法加载图标 ${name}。`);

  // Many chart cells can request the same icon while its library is loading.
  const image = embeddedImages.get(name) ?? `data:image/svg+xml,${encodeURIComponent(artwork)}`;
  embeddedImages.set(name, image);
  return image;
}

export async function hydratePictographImages(svg: SVGSVGElement) {
  const images = Array.from(svg.querySelectorAll<SVGImageElement>('image[data-pictograph-symbol]'));
  if (!images.length) return;
  await Promise.all(images.map(async image => {
    const name = image.getAttribute('data-pictograph-symbol');
    if (!isPictographSymbol(name)) throw new Error('导出图标无效。');
    image.setAttribute('href', await loadPictographImage(name));
    image.removeAttribute('data-pictograph-symbol');
  }));

  const { default: license } = await import('./assets/noto-pictographs-license.json');
  const metadata = svg.ownerDocument.createElementNS(svg.namespaceURI, 'metadata');
  metadata.textContent = [license.source, license.notice, license.changes, license.license].join('\n\n');
  svg.prepend(metadata);
}
