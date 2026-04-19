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

export function buildPlaceSlug(name: string) {
  return slugifyPlaceName(name) || 'place';
}

export function isLegacyPlaceSlug(slug: string) {
  return slug.includes('--');
}
