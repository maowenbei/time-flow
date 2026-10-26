import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getTaskTagLabel, uncategorizedTagId } from '../constants/taskTags';
import { useI18n } from '../i18n';
import { hasDuplicateTask, isValidTaskDay, useTimer } from '../state/TimerContext';
import { todayKey } from '../utils/time';

export function TaskDebugPanel() {
  const timer = useTimer();
  const { locale } = useI18n();
  const [day, setDay] = useState(() => todayKey());
  const [title, setTitle] = useState('');
  const [tagId, setTagId] = useState(uncategorizedTagId);
  const [message, setMessage] = useState('');
  if (!__DEV__) return null;
  const selectedTagId = timer.categories.some(tag => tag.id === tagId) ? tagId : uncategorizedTagId;
  const create = () => {
    if (!timer.ready) return;
    const date = day.trim();
    if (!isValidTaskDay(date)) {
      setMessage('请输入有效日期，格式为 YYYY-MM-DD，例如 2026-10-26。');
      return;
    }
    if (!title.trim()) { setMessage('请输入任务名称。'); return; }
    if (hasDuplicateTask(timer.tasks, date, title, selectedTagId)) {
      setMessage('该日期和分类下已存在同名任务，请修改名称或分类。');
      return;
    }
    timer.addDebugTask(title, selectedTagId, date);
    setMessage(`已在 ${date} 创建“${title.trim()}”，可到历史页查看。`);
    setTitle('');
  };
  return <>
    <Text style={styles.section}>任务调试</Text>
    <View style={styles.card}>
      <Text style={styles.title}>指定日期创建任务</Text>
      <Text style={styles.copy}>支持过去、今天和未来日期。创建的待开始任务会保存到本机。</Text>
      <Text style={styles.label}>任务日期（YYYY-MM-DD）</Text>
      <TextInput accessibilityLabel="任务日期" style={styles.input} value={day} onChangeText={value => { setDay(value); setMessage(''); }} placeholder="2026-10-26" placeholderTextColor="#82958F" autoCapitalize="none" autoCorrect={false} maxLength={10} />
      <Text style={styles.label}>任务名称</Text>
      <TextInput accessibilityLabel="任务名称" style={styles.input} value={title} onChangeText={value => { setTitle(value); setMessage(''); }} placeholder="输入任务名称" placeholderTextColor="#82958F" />
      <Text style={styles.label}>任务分类</Text>
      <View style={styles.tags}>{timer.categories.map(tag => <Pressable key={tag.id} accessibilityRole="button" accessibilityState={{ selected: selectedTagId === tag.id }} style={[styles.tag, selectedTagId === tag.id && styles.selectedTag]} onPress={() => { setTagId(tag.id); setMessage(''); }}><Text style={styles.tagText}>{getTaskTagLabel(tag, locale)}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !timer.ready }} disabled={!timer.ready} style={[styles.button, !timer.ready && styles.disabled]} onPress={create}><Text style={styles.buttonText}>创建指定日期任务</Text></Pressable>
      {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  section: { marginTop: 27, marginBottom: 10, fontSize: 17, fontWeight: '800', color: '#31564E' },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#FFF', marginBottom: 10 },
  title: { color: '#294842', fontSize: 15, fontWeight: '800' },
  copy: { color: '#526C65', marginTop: 8, lineHeight: 19 },
  label: { color: '#294842', marginTop: 14, marginBottom: 8, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#D8E5DF', borderRadius: 11, padding: 12, color: '#183B35', fontSize: 15 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D8E5DF' },
  selectedTag: { backgroundColor: '#DDF1EB', borderColor: '#1F7A70' },
  tagText: { color: '#27534A', fontWeight: '600' },
  button: { marginTop: 14, borderRadius: 11, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1F7A70' },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.5 },
});
