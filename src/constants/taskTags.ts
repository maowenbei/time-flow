import { ImageSourcePropType } from 'react-native';

export type TaskTagId = string;
export type TaskTag = {
  id: TaskTagId;
  label: string;
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
};

export const systemIconChoices = [
  { id: 'work', label: '工作' },
  { id: 'study', label: '学习' },
  { id: 'exercise', label: '运动' },
  { id: 'life', label: '生活' },
  { id: 'calendar', label: '日程' },
  { id: 'health', label: '健康' },
  { id: 'shopping', label: '购物' },
  { id: 'rest', label: '休息' },
  { id: 'commute', label: '出行' },
  { id: 'favorite', label: '收藏' },
] as const;

export function getSystemIconImage(systemIconId?: string) {
  return systemIconId ? builtInImages[systemIconId] : undefined;
}

export const starterTaskTags: TaskTag[] = [
  { id: 'work', label: '工作', color: '#1F7A70', systemIconId: 'work' },
  { id: 'study', label: '学习', color: '#4C8B80', systemIconId: 'study' },
  { id: 'exercise', label: '运动', color: '#3B9A82', systemIconId: 'exercise' },
  { id: 'life', label: '生活', color: '#6D9C8E', systemIconId: 'life' },
  { id: 'uncategorized', label: '未分类', color: '#AABCB7' },
];

export const tagColors = ['#1F7A70', '#4C8B80', '#3B9A82', '#6D9C8E', '#739CBB', '#B98A61'];
export const uncategorizedTagId = 'uncategorized';

export function createStarterTaskTags() {
  return starterTaskTags.map(tag => ({ ...tag }));
}

export function getTaskTag(tagId: TaskTagId | undefined, tags: TaskTag[]): ResolvedTaskTag {
  const fallback = tags.find(tag => tag.id === uncategorizedTagId) ?? starterTaskTags[starterTaskTags.length - 1];
  const tag = tags.find(item => item.id === tagId) ?? fallback;
  return { ...tag, image: tag.iconUri ? { uri: tag.iconUri } : getSystemIconImage(tag.systemIconId ?? tag.id) };
}
