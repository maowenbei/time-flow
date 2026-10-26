import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Task, liveTask, useTimer } from '../state/TimerContext';
import { fullTime } from '../utils/time';
import { TaskTagIcon } from './TaskTagIcon';
import { formatShortTime, useI18n } from '../i18n';
import { SwipeDelete } from './SwipeDelete';

import { colors } from '../constants/colors';
import { border, radius, typography } from '../constants/design';
import { timerDurationBucket, track } from '../services/analytics';
import { todayKey } from '../utils/time';
const completedTitleStyle = { ...typography.body, color: '#728780' };
const completedRowStyle = { paddingHorizontal: 17, paddingVertical: 8, gap: 14 };
const completedRestartStyle = { minWidth: 84 };
const completedShellStyle = { marginHorizontal: -14 };
export function TaskCard({ task, onLongPress, onPress, isDragging = false }: { task: Task; onLongPress?: () => void; onPress?: () => void; isDragging?: boolean }) {
  const timer = useTimer(); const { locale, t } = useI18n(); const live = liveTask(task, timer, timer.now); const isRunning = task.status === 'running'; const breakLocked = Boolean(timer.breakState);
  // Track user actions outside state updaters; settlement and timer logic stay unchanged.
  const runTimerAction = (action: 'start' | 'restart' | 'pause' | 'complete') => {
    const at = Date.now();
    const current = timer.tasks.find(item => item.id === task.id);
    // Always preserve the existing business call, even when no event is eligible.
    timer[action](task.id);
    if (!timer.ready || timer.breakState || !current) return;
    const settled = liveTask(current, timer, at);
    const starting = action === 'start' || action === 'restart';
    if (starting && (current.day !== todayKey(at) || settled.status === 'running')) return;
    if (!starting && settled.status !== 'running') return;
    const activeCount = timer.tasks.filter(item => item.day === todayKey(at) && liveTask(item, timer, at).status === 'running').length;
    const entrySource = action === 'restart' ? 'restart' : settled.status === 'paused' ? 'resume' : 'start';
    if (starting) track('timer_started', { active_task_count: activeCount + 1, entry_source: entrySource });
    else track(action === 'pause' ? 'timer_paused' : 'timer_completed', {
      active_task_count: Math.max(0, activeCount - 1),
      timer_duration_bucket: timerDurationBucket(settled.elapsedDuration),
    });
  };
  let content: React.ReactNode;
  const editIcon = (size: number) => <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('task.edit', { title: task.title })}><TaskTagIcon tagId={task.tagId} size={size} /></Pressable>;
  const editTitle = (style: any, metaStyle?: any) => <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} hitSlop={6} style={styles.titleButton} accessibilityRole="button" accessibilityLabel={t('task.edit', { title: task.title })}><Text numberOfLines={1} style={style}>{task.title}</Text>{metaStyle && live.allocatedDuration > 0 ? <Text numberOfLines={1} style={metaStyle}>{t('task.actualTime')} · {formatShortTime(live.allocatedDuration, locale)}</Text> : null}</Pressable>;
  if (task.status === 'completed') content = <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} style={[styles.completed, completedRowStyle]}>{editIcon(31)}<Ionicons name="checkmark-circle" size={16} color="#86AAA0" />{editTitle(completedTitleStyle, styles.completedMeta)}<Pressable onPress={event => { event.stopPropagation(); runTimerAction('restart'); }} hitSlop={8} style={[styles.restart, completedRestartStyle]}><Ionicons name="refresh" size={15} color="#1F7A70" /><Text style={styles.restartText}>{t('task.restart')}</Text></Pressable></Pressable>;
  else if (!isRunning) { const action = task.status === 'paused' ? t('task.resume') : t('task.start'); content = <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} style={styles.pending}>{editIcon(31)}{editTitle(styles.pendingTitle, styles.pendingMeta)}<Pressable onPress={event => { event.stopPropagation(); runTimerAction('start'); }} hitSlop={8} style={styles.start} accessibilityLabel={`${action} ${task.title}`}><Ionicons name="play" size={12} color="#1F7A70" /><Text style={styles.startText}>{action}</Text></Pressable></Pressable>; }
  else content = <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} style={styles.running}><View style={styles.heading}>{editIcon(32)}<View style={styles.pulse} />{editTitle(styles.runningTitle)}</View><View style={styles.times}><View><Text style={styles.caption}>{t('task.runningTime')}</Text><Text style={styles.elapsed}>{fullTime(live.elapsedDuration)}</Text></View><View style={styles.actual}><Text style={styles.caption}>{t('task.actualTime')}</Text><Text style={styles.allocated}>{fullTime(live.allocatedDuration)}</Text></View></View><View style={styles.actions}><Pressable onPress={event => { event.stopPropagation(); runTimerAction('pause'); }} style={styles.secondary}><Ionicons name="pause" size={15} color="#43655F" /><Text style={styles.secondaryText}>{t('task.pause')}</Text></Pressable><Pressable onPress={event => { event.stopPropagation(); runTimerAction('complete'); }} style={styles.complete}><Ionicons name="checkmark" size={16} color="#FFFFFF" /><Text style={styles.completeText}>{t('task.complete')}</Text></Pressable></View></Pressable>;
  return <View style={[styles.cardShell, task.status === 'completed' && completedShellStyle, isDragging && styles.dragging, breakLocked && styles.locked]}><SwipeDelete enabled={!isDragging && !breakLocked} label={t('task.delete')} onDelete={() => { if (!timer.ready || timer.breakState || !timer.tasks.some(item => item.id === task.id)) return; timer.remove(task.id); track('task_deleted', { entry_source: 'today', task_status: task.status }); }}><View style={styles.card}>{content}</View></SwipeDelete></View>;
}

const styles = StyleSheet.create({
  cardShell:{marginBottom:9}, dragging:{opacity:.92}, locked:{opacity:.65}, card:{backgroundColor:'#FFFFFF',borderRadius:radius.card,overflow:'hidden'}, running:{borderRadius:radius.card,padding:18,borderWidth:1,borderColor:'#D5E7E2',shadowColor:'#1E4A42',shadowOpacity:.06,shadowRadius:14,elevation:2}, heading:{flexDirection:'row',alignItems:'center',gap:10},pulse:{width:9,height:9,borderRadius:5,backgroundColor:'#38A890'},titleButton:{flex:1,minWidth:0,justifyContent:'center'},runningTitle:{...typography.sectionTitle,fontSize:17,color:'#183B35'},times:{flexDirection:'row',marginTop:18},actual:{marginLeft:48},caption:{...typography.caption,marginBottom:4},elapsed:{...typography.timerCompact,letterSpacing:.4,color:'#203E39'},allocated:{...typography.timerCompact,letterSpacing:.4,color:'#1F7A70'},actions:{flexDirection:'row',gap:10,marginTop:18},secondary:{flex:1,height:42,borderRadius:radius.control,backgroundColor:'#F2F7F5',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},secondaryText:{...typography.button,color:'#43655F'},complete:{flex:1,height:42,borderRadius:radius.control,backgroundColor:'#1F7A70',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},completeText:{...typography.button,color:'#FFFFFF'},pending:{minHeight:70,borderRadius:radius.card,paddingHorizontal:17,paddingVertical:8,alignItems:'center',flexDirection:'row',borderWidth:1,borderColor:border.soft,gap:14},pendingTitle:{...typography.cardTitle},pendingMeta:{...typography.caption,color:'#728780',marginTop:3},start:{minWidth:84,height:48,paddingHorizontal:13,borderRadius:radius.control,backgroundColor:'#EEF8F5',justifyContent:'center',flexDirection:'row',gap:8,alignItems:'center'},startText:{...typography.button,color:'#1F7A70'},completed:{minHeight:70,flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:6,gap:9},completedTitle:{...typography.body,color:'#728780',textDecorationLine:'line-through'},completedMeta:{...typography.caption,color:'#728780',marginTop:3},restart:{minWidth:88,height:48,paddingHorizontal:13,borderRadius:radius.control,backgroundColor:'#EEF8F5',justifyContent:'center',flexDirection:'row',alignItems:'center',gap:8},restartText:{...typography.button,fontSize:13,color:'#1F7A70'}
});
