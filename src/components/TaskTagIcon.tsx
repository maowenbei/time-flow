import { Image, StyleSheet, View } from 'react-native';
import { getTaskTag, TaskTagId } from '../constants/taskTags';
import { useTimer } from '../state/TimerContext';

export function TaskTagIcon({ tagId, size = 24 }: { tagId?: TaskTagId; size?: number }) {
  const { categories } = useTimer(); const tag = getTaskTag(tagId, categories);
  const isOriginalIcon = ['work', 'study', 'exercise', 'life'].includes(tag.systemIconId ?? tag.id);
  if (tag.image) return <Image source={tag.image} style={{ width: size, height: size, transform: [{ scale: isOriginalIcon ? 1.42 : 1.2 }] }} resizeMode="contain" accessibilityLabel={tag.label} />;
  return <View style={[styles.uncategorized, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel={tag.label}><View style={[styles.dot, { backgroundColor: tag.color }]} /></View>;
}

const styles = StyleSheet.create({ uncategorized: { backgroundColor: '#F1F5F3', alignItems: 'center', justifyContent: 'center' }, dot: { width: 8, height: 8, borderRadius: 4 } });
