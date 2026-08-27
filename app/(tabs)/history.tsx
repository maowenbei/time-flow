import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { liveTask, Task, useTimer } from '../../src/state/TimerContext';
import { shortTime, todayKey } from '../../src/utils/time';
import { TaskTagIcon } from '../../src/components/TaskTagIcon';

const DELETE_WIDTH = 78;
const formatDay = (key: string) => key === todayKey() ? '今天' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${key}T12:00:00`));
const statusCopy: Record<Task['status'], string> = { completed: '已完成', running: '进行中', paused: '已暂停', pending: '未开始' };

function HistoryTaskRow({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (id: string) => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const close = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-DELETE_WIDTH, Math.min(0, gesture.dx))),
    onPanResponderRelease: (_, gesture) => Animated.spring(translateX, { toValue: gesture.dx < -42 ? -DELETE_WIDTH : 0, useNativeDriver: true }).start(),
    onPanResponderTerminate: close,
  })).current;

  return <View style={styles.swipeShell}>
    <Pressable onPress={() => onDelete(task.id)} style={styles.delete} accessibilityLabel={`删除${task.title}`}>
      <Ionicons name="trash-outline" size={18} color="#FFF" />
      <Text style={styles.deleteText}>删除</Text>
    </Pressable>
    <Animated.View {...panResponder.panHandlers} style={[styles.row, { transform: [{ translateX }] }]}>
      <Pressable onLongPress={() => { close(); onEdit(task); }} delayLongPress={450} style={styles.rowPress} accessibilityHint="长按可修改记录时间">
        <View style={styles.rowContent}>
          <View style={styles.rowHeading}>
            <TaskTagIcon tagId={task.tagId} size={30} />
            <Text style={styles.rowTitle}>{task.title}</Text>
            <Text style={styles.status}>{statusCopy[task.status]}</Text>
          </View>
          <Text style={styles.rowTime}>投入 {shortTime(task.allocatedDuration)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  </View>;
}

export default function History() {
  const timer = useTimer();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allocatedMinutes, setAllocatedMinutes] = useState('');
  const [timeError, setTimeError] = useState('');
  const groups = Object.entries(timer.tasks.reduce<Record<string, typeof timer.tasks>>((all, task) => {
    (all[task.day] ??= []).push(task);
    return all;
  }, {})).sort(([a], [b]) => b.localeCompare(a));

  const openEditor = (task: Task) => {
    setEditingTask(task);
    setAllocatedMinutes(String(Math.round(task.allocatedDuration / 60000)));
    setTimeError('');
  };
  const closeEditor = () => { setEditingTask(null); setTimeError(''); };
  const saveTimes = () => {
    const allocated = Number(allocatedMinutes);
    if (!editingTask || !Number.isInteger(allocated) || allocated < 0) {
      setTimeError('请输入不小于 0 的整数分钟。');
      return;
    }
    timer.updateAllocatedDuration(editingTask.id, allocated * 60000);
    closeEditor();
  };

  return <>
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>记录</Text>
      <Text style={styles.subtitle}>回看每天做过的事</Text>
      {groups.length ? groups.map(([day, tasks]) => {
        const expanded = day === expandedDay;
        const liveTasks = tasks.map(task => liveTask(task, timer, timer.now));
        const work = liveTasks.reduce((sum, task) => sum + task.allocatedDuration, 0);
        const completed = tasks.filter(task => task.status === 'completed');
        return <View key={day} style={styles.day}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${formatDay(day)}工作记录`} accessibilityState={{ expanded }} onPress={() => setExpandedDay(current => current === day ? null : day)} style={styles.dayHeader}>
            <View><Text style={styles.dayTitle}>{formatDay(day)}</Text><Text style={styles.dayMeta}>工作 {shortTime(work)} · 完成 {completed.length} 件</Text></View>
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color="#9DB0AA" />
          </Pressable>
          {expanded ? <View style={styles.rows}>{liveTasks.map(task => <HistoryTaskRow key={task.id} task={task} onEdit={openEditor} onDelete={timer.remove} />)}</View> : null}
        </View>;
      }) : <View style={styles.empty}><Ionicons name="albums-outline" size={33} color="#A9C7C0" /><Text style={styles.emptyTitle}>记录会在这里慢慢出现</Text><Text style={styles.emptyText}>完成一件事，留下一天的回忆。</Text></View>}
    </ScrollView>
    <Modal visible={editingTask !== null} transparent animationType="fade" onRequestClose={closeEditor}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>修改记录时间</Text>
          <Text style={styles.modalTask} numberOfLines={1}>{editingTask?.title}</Text>
          <Text style={styles.inputLabel}>实际投入（分钟）</Text>
          <TextInput value={allocatedMinutes} onChangeText={setAllocatedMinutes} keyboardType="number-pad" selectTextOnFocus style={styles.timeInput} />
          {timeError ? <Text style={styles.error}>{timeError}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={closeEditor} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable>
            <Pressable onPress={saveTimes} style={styles.save}><Text style={styles.saveText}>保存</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 22, paddingTop: 65, paddingBottom: 32 }, title: { fontSize: 28, fontWeight: '800', color: '#183B35' }, subtitle: { fontSize: 14, color: '#7C918B', marginTop: 6, marginBottom: 26 },
  day: { backgroundColor: '#FFF', borderRadius: 20, marginBottom: 13, borderWidth: 1, borderColor: '#E8EFEC', overflow: 'hidden' }, dayHeader: { padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, dayTitle: { fontSize: 16, fontWeight: '800', color: '#294842' }, dayMeta: { fontSize: 12, color: '#80938E', marginTop: 5 },
  rows: { borderTopWidth: 1, borderTopColor: '#F0F4F2', paddingVertical: 7 }, swipeShell: { position: 'relative', overflow: 'hidden' }, delete: { position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_WIDTH, backgroundColor: '#E4625E', alignItems: 'center', justifyContent: 'center', gap: 3 }, deleteText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  row: { minHeight: 66, backgroundColor: '#FFF' }, rowPress: { minHeight: 66, paddingHorizontal: 17, paddingVertical: 8, justifyContent: 'center' }, rowContent: { flex: 1 }, rowHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 }, rowTitle: { flex: 1, color: '#536C66', fontSize: 14, fontWeight: '600' }, status: { fontSize: 11, color: '#849792' }, rowTime: { fontSize: 12, color: '#78908A', marginTop: 4, marginLeft: 41 },
  empty: { alignItems: 'center', paddingTop: 130 }, emptyTitle: { fontSize: 16, fontWeight: '800', color: '#59736C', marginTop: 14 }, emptyText: { fontSize: 13, color: '#8A9E98', marginTop: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20, 50, 44, 0.35)', justifyContent: 'center', padding: 24 }, modalCard: { backgroundColor: '#FFF', borderRadius: 22, padding: 22 }, modalTitle: { fontSize: 19, fontWeight: '800', color: '#183B35' }, modalTask: { color: '#718681', fontSize: 14, marginTop: 5, marginBottom: 20 }, inputLabel: { color: '#526C65', fontSize: 13, fontWeight: '700', marginBottom: 7 }, timeInput: { height: 46, borderWidth: 1, borderColor: '#DDE9E5', borderRadius: 12, paddingHorizontal: 13, fontSize: 16, color: '#183B35', marginBottom: 15 }, error: { color: '#C85752', fontSize: 12, marginTop: -4, marginBottom: 10 }, modalActions: { flexDirection: 'row', gap: 10, marginTop: 5 }, cancel: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF5F2', borderRadius: 12 }, cancelText: { color: '#527069', fontWeight: '700' }, save: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1F7A70', borderRadius: 12 }, saveText: { color: '#FFF', fontWeight: '700' },
});
