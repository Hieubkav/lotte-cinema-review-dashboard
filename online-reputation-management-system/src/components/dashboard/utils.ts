// --- Heuristics for Tagging ---
export const TAG_MAP = {
  service: {
    label: 'Dịch vụ',
    keywords: ['phục vụ', 'nhân viên', 'service', 'staff', 'nhiệt tình', 'thái độ', 'không hài lòng', 'support', 'hỗ trợ'],
  },
  food: {
    label: 'Đồ ăn',
    keywords: ['bắp', 'nước', 'popcorn', 'drink', 'food', 'đồ ăn', 'com bo', 'combo'],
  },
  cleanliness: {
    label: 'Vệ sinh',
    keywords: ['sạch', 'bẩn', 'vệ sinh', 'mùi', 'clean', 'dirty', 'thơm', 'hôi'],
  },
  experience: {
    label: 'Trải nghiệm',
    keywords: ['phim', 'ghế', 'âm thanh', 'màn hình', 'movie', 'seat', 'sound', 'screen', 'trải nghiệm', 'ổn', 'tệ'],
  },
  price: {
    label: 'Giá cả',
    keywords: ['giá', 'đắt', 'rẻ', 'mắc', 'chi phí', 'tiền', 'price', 'expensive', 'cheap'],
  },
} as const;

export type TagKey = keyof typeof TAG_MAP;
export const TAG_KEYS = Object.keys(TAG_MAP) as TagKey[];
export const TAG_LABELS: Record<TagKey, string> = TAG_KEYS.reduce((acc, key) => {
  acc[key] = TAG_MAP[key].label;
  return acc;
}, {} as Record<TagKey, string>);

export const safeParseDate = (dateStr: any) => {
  if (!dateStr) return 0;
  const clean = typeof dateStr === 'string' ? dateStr.replace(/^\$D/, '') : dateStr;
  const parsed = new Date(clean).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

export function getTags(text: string = "") {
  if (!text) return [];
  const lowText = text.toLowerCase();
  const tags: TagKey[] = [];
  for (const key of TAG_KEYS) {
    if (TAG_MAP[key].keywords.some(k => lowText.includes(k))) tags.push(key);
  }
  return tags;
}
