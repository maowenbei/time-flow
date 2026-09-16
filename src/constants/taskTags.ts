import { ImageSourcePropType } from 'react-native';

export type TaskTagId = string;
export type TaskTag = {
  id: TaskTagId;
  label?: string;
  isCustomLabel?: boolean;
  color: string;
  iconUri?: string;
  systemIconId?: string;
};
export type ResolvedTaskTag = TaskTag & { image?: ImageSourcePropType };

const builtInImages: Record<string, ImageSourcePropType | undefined> = {
  work: require('../../assets/task-tags/work.png'),
  study: require('../../assets/task-tags/study.png'),
  exercise: require('../../assets/task-tags/exercise.png'),
  life: require('../../assets/task-tags/life.png'),
  calendar: require('../../assets/task-tags/calendar.png'),
  health: require('../../assets/task-tags/health.png'),
  shopping: require('../../assets/task-tags/shopping.png'),
  rest: require('../../assets/task-tags/rest.png'),
  commute: require('../../assets/task-tags/commute.png'),
  favorite: require('../../assets/task-tags/favorite.png'),
  target: require('../../assets/task-tags/target.png'),
  wallet: require('../../assets/task-tags/wallet.png'),
  music: require('../../assets/task-tags/music.png'),
  meal: require('../../assets/task-tags/meal.png'),
  idea: require('../../assets/task-tags/idea.png'),
  game: require('../../assets/task-tags/game.png'),
  coffee: require('../../assets/task-tags/coffee.png'),
  camera: require('../../assets/task-tags/camera.png'),
  nature: require('../../assets/task-tags/nature.png'),
  palette: require('../../assets/task-tags/palette.png'),
  uncategorized: require('../../assets/task-tags/palette.png'),
};

export const systemIconChoices = [
  { id: 'work' }, { id: 'study' }, { id: 'exercise' }, { id: 'life' }, { id: 'calendar' },
  { id: 'health' }, { id: 'shopping' }, { id: 'rest' }, { id: 'commute' }, { id: 'target' },
  { id: 'wallet' }, { id: 'music' }, { id: 'meal' }, { id: 'idea' }, { id: 'game' },
  { id: 'coffee' }, { id: 'camera' }, { id: 'nature' }, { id: 'favorite' }, { id: 'palette' },
] as const;

export function getSystemIconImage(systemIconId?: string) {
  return systemIconId ? builtInImages[systemIconId] : undefined;
}

export const starterTaskTags: TaskTag[] = [
  { id: 'work', color: '#1F7A70', systemIconId: 'work' },
  { id: 'study', color: '#4C8B80', systemIconId: 'study' },
  { id: 'exercise', color: '#3B9A82', systemIconId: 'exercise' },
  { id: 'life', color: '#6D9C8E', systemIconId: 'life' },
  { id: 'uncategorized', color: '#AABCB7' },
];

export const tagColors = ['#1F7A70', '#4C8B80', '#3B9A82', '#6D9C8E', '#739CBB', '#B98A61'];
export const uncategorizedTagId = 'uncategorized';
const builtInTagIds = new Set(starterTaskTags.map(tag => tag.id));
const legacyChineseLabels: Record<string, string> = { work: '工作', study: '学习', exercise: '运动', life: '生活', uncategorized: '未分类' };
const builtInLabels = {
  en: { work: 'Work', study: 'Study', exercise: 'Exercise', life: 'Life', uncategorized: 'Uncategorized' },
  'zh-CN': legacyChineseLabels,
  'zh-Hant': { work: '工作', study: '學習', exercise: '運動', life: '生活', uncategorized: '未分類' },
  fr: { work: 'Travail', study: 'Études', exercise: 'Sport', life: 'Vie', uncategorized: 'Sans catégorie' },
  es: { work: 'Trabajo', study: 'Estudio', exercise: 'Ejercicio', life: 'Vida', uncategorized: 'Sin categoría' },
  'pt-BR': { work: 'Trabalho', study: 'Estudo', exercise: 'Exercício', life: 'Vida', uncategorized: 'Sem categoria' },
  it: { work: 'Lavoro', study: 'Studio', exercise: 'Esercizio', life: 'Vita', uncategorized: 'Senza categoria' },
  ru: { work: 'Работа', study: 'Учёба', exercise: 'Спорт', life: 'Жизнь', uncategorized: 'Без категории' },
  tr: { work: 'İş', study: 'Çalışma', exercise: 'Egzersiz', life: 'Yaşam', uncategorized: 'Kategorisiz' },
  id: { work: 'Kerja', study: 'Belajar', exercise: 'Olahraga', life: 'Hidup', uncategorized: 'Tanpa kategori' },
  ja: { work: '仕事', study: '学習', exercise: '運動', life: '生活', uncategorized: '未分類' },
  ko: { work: '업무', study: '학습', exercise: '운동', life: '생활', uncategorized: '미분류' },
  de: { work: 'Arbeit', study: 'Lernen', exercise: 'Sport', life: 'Leben', uncategorized: 'Nicht kategorisiert' },
} as const;

export function createStarterTaskTags() {
  return starterTaskTags.map(tag => ({ ...tag }));
}

export function isBuiltInTagId(id: string) { return builtInTagIds.has(id); }

export function isLegacyBuiltInLabel(id: string, label: string | undefined) { return legacyChineseLabels[id] === label; }

export function getTaskTagLabel(tag: TaskTag, locale: keyof typeof builtInLabels) {
  if (isBuiltInTagId(tag.id) && !tag.isCustomLabel) return builtInLabels[locale][tag.id as keyof typeof builtInLabels.en] ?? tag.id;
  return tag.label || builtInLabels[locale].uncategorized;
}

export function getTaskTag(tagId: TaskTagId | undefined, tags: TaskTag[]): ResolvedTaskTag {
  const fallback = tags.find(tag => tag.id === uncategorizedTagId) ?? starterTaskTags[starterTaskTags.length - 1];
  const tag = tags.find(item => item.id === tagId) ?? fallback;
  return { ...tag, label: tag.label ?? '', image: tag.iconUri ? { uri: tag.iconUri } : getSystemIconImage(tag.systemIconId ?? tag.id) };
}
