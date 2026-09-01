import { Image, StyleSheet, View } from 'react-native';
import { getTaskTag, TaskTagId } from '../constants/taskTags';
import { useTimer } from '../state/TimerContext';
import { getTaskTagLabel } from '../constants/taskTags';
import { useI18n } from '../i18n';
import { colors } from '../constants/colors';

export function TaskTagIcon({ tagId, size = 24 }: { tagId?: TaskTagId; size?: number }) {
  const { categories } = useTimer(); const { locale } = useI18n(); const tag = getTaskTag(tagId, categories); const label = getTaskTagLabel(tag, locale);
  if (tag.image) return <Image source={tag.image} style={{ width: size, height: size, transform: [{ scale: 1.2 }] }} resizeMode="contain" accessibilityLabel={label} />;
  return <View style={[styles.uncategorized, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel={label}><View style={[styles.dot, { backgroundColor: tag.color }]} /></View>;
}

const styles = StyleSheet.create({ uncategorized: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }, dot: { width: 8, height: 8, borderRadius: 4 } });
