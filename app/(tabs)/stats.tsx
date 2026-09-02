import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TaskTagIcon } from '../../src/components/TaskTagIcon';
import { DismissibleHint } from '../../src/components/DismissibleHint';
import { getTaskTagLabel } from '../../src/constants/taskTags';
import { formatHistoryDay, formatShortTime, formatWeekday, useI18n } from '../../src/i18n';
import { liveTask, useTimer } from '../../src/state/TimerContext';
import { todayKey } from '../../src/utils/time';

type Period = 'week' | 'month';
type DayTotal = { day: string; value: number };
const dayDate = (day: string) => new Date(`${day}T12:00:00`);
const dayKey = (date: Date) => todayKey(date.getTime());

function periodDays(period: Period, offset: number, now: number) {
  const start = dayDate(todayKey(now));
  if (period === 'week') {
    start.setDate(start.getDate() - 6 + offset * 7);
    return Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return dayKey(date); });
  }
  start.setDate(1); start.setMonth(start.getMonth() + offset);
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => { const date = new Date(start); date.setDate(index + 1); return dayKey(date); });
}

function periodTitle(locale: 'zh-CN' | 'en', period: Period, days: string[]) {
  if (period === 'month') return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(dayDate(days[0]));
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  return `${formatter.format(dayDate(days[0]))} – ${formatter.format(dayDate(days[days.length - 1]))}`;
}

function detailDateLabel(locale: 'zh-CN' | 'en', day: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(dayDate(day));
}

function heatColor(value: number, max: number) {
  if (!value) return '#F8FBF9';
  return `rgba(31, 122, 112, ${0.18 + 0.82 * value / max})`;
}

export default function Stats() {
  const timer = useTimer(); const { locale, t } = useI18n();
  const [period, setPeriod] = useState<Period>('week'); const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const days = useMemo(() => periodDays(period, periodOffset, timer.now), [period, periodOffset, timer.now]);
  const copy = locale === 'zh-CN'
    ? { month: '本月', previous: '上一周期', next: '下一周期', total: '周期投入', noPeriodData: '该周期暂无记录', noDayData: '当天暂无记录', today: '今天' }
    : { month: 'This month', previous: 'Previous period', next: 'Next period', total: 'Period total', noPeriodData: 'No time recorded in this period', noDayData: 'No time recorded on this day', today: 'Today' };

  const tasks = useMemo(() => timer.tasks.map(task => liveTask(task, timer, timer.now)), [timer.tasks, timer.now]);
  const totalsByDay = useMemo(() => {
    const result = new Map(days.map(day => [day, 0]));
    tasks.forEach(task => { if (result.has(task.day)) result.set(task.day, (result.get(task.day) ?? 0) + task.allocatedDuration); });
    return result;
  }, [days, tasks]);
  const dayTotals = useMemo(() => days.map(day => ({ day, value: totalsByDay.get(day) ?? 0 })), [days, totalsByDay]);
  const periodTotal = useMemo(() => dayTotals.reduce((sum, item) => sum + item.value, 0), [dayTotals]); const max = Math.max(...dayTotals.map(item => item.value), 1);
  const activeSelectedDay = selectedDay && days.includes(selectedDay) ? selectedDay : null;
  const detailDays = activeSelectedDay ? [activeSelectedDay] : days; const detailTotal = activeSelectedDay ? (totalsByDay.get(activeSelectedDay) ?? 0) : periodTotal;
  const tagTotals = timer.categories.map(tag => ({ tag, value: tasks.filter(task => detailDays.includes(task.day) && task.tagId === tag.id).reduce((sum, task) => sum + task.allocatedDuration, 0) })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  const isCurrentPeriod = periodOffset === 0;
  const detailDate = activeSelectedDay ? (activeSelectedDay === todayKey(timer.now) ? copy.today : detailDateLabel(locale, activeSelectedDay)) : periodTitle(locale, period, days);
  const monthLeadingBlanks = period === 'month' ? dayDate(days[0]).getDay() : 0;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.title}>{t('stats.title')}</Text><Text style={styles.subtitle}>{t('stats.subtitle')}</Text>
    <View style={styles.periodControls}>
      <View style={styles.segmented}><PeriodButton label={t('stats.last7Days')} active={period === 'week'} onPress={() => { setSelectedDay(null); setPeriod('week'); setPeriodOffset(0); }} /><PeriodButton label={copy.month} active={period === 'month'} onPress={() => { setSelectedDay(null); setPeriod('month'); setPeriodOffset(0); }} /></View>
      <View style={styles.paging}><Pressable onPress={() => { setSelectedDay(null); setPeriodOffset(current => current - 1); }} accessibilityRole="button" accessibilityLabel={copy.previous} style={styles.pageButton}><Ionicons name="chevron-back" size={18} color="#527069" /></Pressable><Text numberOfLines={1} style={styles.periodTitle}>{periodTitle(locale, period, days)}</Text><Pressable onPress={() => { setSelectedDay(null); setPeriodOffset(current => current + 1); }} disabled={isCurrentPeriod} accessibilityRole="button" accessibilityLabel={copy.next} style={[styles.pageButton, isCurrentPeriod && styles.pageButtonDisabled]}><Ionicons name="chevron-forward" size={18} color="#527069" /></Pressable></View>
    </View>
    <Pressable onPress={() => setSelectedDay(null)} accessibilityRole="button" accessibilityLabel={copy.total} style={[styles.totalCard, !activeSelectedDay && styles.totalCardActive]}><Text style={styles.totalLabel}>{copy.total}</Text><Text style={styles.totalValue}>{formatShortTime(periodTotal, locale)}</Text></Pressable>
    <View style={styles.chart}><Text style={styles.chartTitle}>{periodTitle(locale, period, days)}</Text>{period === 'week' ? <WeekChart days={dayTotals} max={max} selectedDay={activeSelectedDay} locale={locale} today={todayKey(timer.now)} todayLabel={copy.today} onSelect={setSelectedDay} /> : <MonthCalendar days={dayTotals} max={max} leadingBlanks={monthLeadingBlanks} selectedDay={activeSelectedDay} locale={locale} onSelect={setSelectedDay} />}</View>
    <View style={styles.tagStats}><View style={styles.detailHeader}><Text style={styles.chartTitle}>{activeSelectedDay ? detailDate : periodTitle(locale, period, days)}</Text><Text style={styles.detailTime}>{formatShortTime(detailTotal, locale)}</Text></View>{tagTotals.length ? tagTotals.map(({ tag, value }) => <View key={tag.id} style={styles.tagStatRow}><TaskTagIcon tagId={tag.id} size={26} /><View style={styles.tagStatMain}><View style={styles.tagStatHeading}><Text style={styles.tagStatLabel}>{getTaskTagLabel(tag, locale)}</Text><Text style={styles.tagStatValue}>{formatShortTime(value, locale)} · {Math.round(value / detailTotal * 100)}%</Text></View><View style={styles.tagTrack}><View style={[styles.tagFill, { width: `${Math.max(4, value / detailTotal * 100)}%`, backgroundColor: tag.color }]} /></View></View></View>) : <Text style={styles.tagEmpty}>{activeSelectedDay ? copy.noDayData : copy.noPeriodData}</Text>}</View>
    {timer.ready && !timer.dismissedHints.includes('stats-allocation') ? <DismissibleHint title={t('stats.noDoubleCountTitle')} dismissLabel={t('hints.dismiss')} onDismiss={() => timer.dismissHint('stats-allocation')}>{t('stats.noDoubleCountText')}</DismissibleHint> : null}
  </ScrollView>;
}

function WeekChart({ days, max, selectedDay, locale, today, todayLabel, onSelect }: { days: DayTotal[]; max: number; selectedDay: string | null; locale: 'zh-CN' | 'en'; today: string; todayLabel: string; onSelect: (day: string) => void }) {
  return <View style={styles.bars}>{days.map(({ day, value }) => { const selected = day === selectedDay; return <Pressable key={day} onPress={() => onSelect(day)} accessibilityRole="button" accessibilityLabel={formatHistoryDay(locale, day)} accessibilityState={{ selected }} style={[styles.barItem, selected && styles.barItemSelected]}><View style={styles.barArea}><Text style={[styles.barValue, selected && styles.barValueSelected]}>{value ? formatShortTime(value, locale) : ''}</Text><View style={[styles.bar, { height: value ? Math.max(5, 112 * value / max) : 3 }, selected && styles.barSelected]} /></View><Text style={[styles.barLabel, selected && styles.barLabelSelected]}>{day === today ? todayLabel : formatWeekday(locale, day)}</Text></Pressable>; })}</View>;
}

function MonthCalendar({ days, max, leadingBlanks, selectedDay, locale, onSelect }: { days: DayTotal[]; max: number; leadingBlanks: number; selectedDay: string | null; locale: 'zh-CN' | 'en'; onSelect: (day: string) => void }) {
  const weekday = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2023, 0, index + 1)));
  const cells: Array<DayTotal | null> = [...Array.from({ length: leadingBlanks }, () => null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return <><View style={styles.weekdayRow}>{weekday.map((label, index) => <Text key={index} style={styles.weekdayLabel}>{label}</Text>)}</View><View style={styles.calendar}>{weeks.map((week, weekIndex) => <View key={weekIndex} style={styles.calendarWeek}>{week.map((item, dayIndex) => { if (!item) return <View key={`blank-${weekIndex}-${dayIndex}`} style={styles.calendarCell} />; const selected = item.day === selectedDay; return <View key={item.day} style={styles.calendarCell}><Pressable onPress={() => onSelect(item.day)} accessibilityRole="button" accessibilityLabel={formatHistoryDay(locale, item.day)} accessibilityState={{ selected }} style={[styles.calendarButton, { backgroundColor: heatColor(item.value, max) }, selected && styles.calendarDaySelected]}><Text style={[styles.calendarDate, item.value > max * .48 && styles.calendarDateLight]}>{dayDate(item.day).getDate()}</Text></Pressable></View>; })}</View>)}</View></>;
}

function PeriodButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.periodButton, active && styles.periodButtonActive]}><Text style={[styles.periodButtonText, active && styles.periodButtonTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#F7FAF8'},content:{padding:22,paddingTop:65,paddingBottom:32},title:{fontSize:28,fontWeight:'800',color:'#183B35'},subtitle:{fontSize:14,color:'#7C918B',marginTop:6,marginBottom:22},periodControls:{gap:12},segmented:{height:43,padding:4,backgroundColor:'#EAF2EF',borderRadius:14,flexDirection:'row'},periodButton:{flex:1,borderRadius:10,alignItems:'center',justifyContent:'center'},periodButtonActive:{backgroundColor:'#FFF',shadowColor:'#1A3D35',shadowOpacity:.08,shadowRadius:4,elevation:1},periodButtonText:{fontSize:13,fontWeight:'700',color:'#6D8780'},periodButtonTextActive:{color:'#1D473E'},paging:{height:35,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},pageButton:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF5F2'},pageButtonDisabled:{opacity:.35},periodTitle:{fontSize:14,fontWeight:'800',color:'#46655E'},totalCard:{marginTop:14,backgroundColor:'#DDF1EB',borderRadius:20,padding:18},totalCardActive:{borderWidth:1,borderColor:'#8BCBBB'},totalLabel:{fontSize:13,color:'#5C7A73',fontWeight:'700'},totalValue:{fontSize:29,fontWeight:'800',color:'#173F37',marginTop:5,fontVariant:['tabular-nums']},chart:{marginTop:18,backgroundColor:'#FFF',borderRadius:21,padding:18,borderWidth:1,borderColor:'#E8EFEC'},chartTitle:{fontSize:15,fontWeight:'800',color:'#3A5A53'},bars:{height:160,flexDirection:'row',alignItems:'flex-end',gap:6,marginTop:12},barItem:{flex:1,alignItems:'center',height:'100%',borderRadius:9,paddingTop:2},barItemSelected:{backgroundColor:'#EEF8F5'},barArea:{height:132,justifyContent:'flex-end',width:'100%',alignItems:'center'},bar:{backgroundColor:'#B8D8D0',borderRadius:6,width:'62%',minWidth:5},barSelected:{backgroundColor:'#1F7A70'},barValue:{fontSize:9,color:'#849A93',marginBottom:4,fontWeight:'700'},barValueSelected:{color:'#2B665B'},barLabel:{fontSize:11,color:'#80938E',marginTop:6},barLabelSelected:{color:'#1F7A70',fontWeight:'800'},weekdayRow:{flexDirection:'row',marginTop:14,marginBottom:6},weekdayLabel:{flex:1,textAlign:'center',fontSize:11,color:'#8A9C98'},calendar:{gap:2},calendarWeek:{height:42,flexDirection:'row',gap:2},calendarCell:{flex:1},calendarButton:{flex:1,borderRadius:9,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:'#EEF4F1'},calendarDaySelected:{borderColor:'#174E44',borderWidth:2},calendarDate:{fontSize:12,lineHeight:15,fontWeight:'700',color:'#658078',textAlign:'center'},calendarDateLight:{color:'#FFF'},tagStats:{marginTop:18,backgroundColor:'#FFF',borderRadius:21,padding:18,borderWidth:1,borderColor:'#E8EFEC'},detailHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},detailTime:{fontSize:15,fontWeight:'800',color:'#3A5A53',fontVariant:['tabular-nums']},tagStatRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:14},tagStatMain:{flex:1},tagStatHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6},tagStatLabel:{fontSize:14,fontWeight:'700',color:'#46655E'},tagStatValue:{fontSize:12,color:'#77908A'},tagTrack:{height:6,borderRadius:3,backgroundColor:'#EDF3F0',overflow:'hidden'},tagFill:{height:'100%',borderRadius:3},tagEmpty:{fontSize:13,lineHeight:20,color:'#91A39E',paddingVertical:13},note:{marginTop:18,padding:19,borderRadius:20,backgroundColor:'#EEF5F2'},noteTitle:{fontSize:15,fontWeight:'800',color:'#46655E'},noteText:{fontSize:13,lineHeight:20,color:'#718983',marginTop:7}
});
