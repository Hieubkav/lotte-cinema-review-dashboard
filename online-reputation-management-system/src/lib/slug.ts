export function slugifyPlaceName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function buildPlaceSlug(name: string, placeId: string) {
  const base = slugifyPlaceName(name) || 'place';
  return `${base}--${encodeURIComponent(placeId)}`;
}

export function extractPlaceIdFromSlug(slug: string) {
  const marker = '--';
  const index = slug.lastIndexOf(marker);
  if (index === -1) return null;
  const encodedPlaceId = slug.slice(index + marker.length);
  if (!encodedPlaceId) return null;

  try {
    return decodeURIComponent(encodedPlaceId);
  } catch {
    return null;
  }
}
