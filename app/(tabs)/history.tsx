import { IPadTimeEditor } from '../../src/components/adaptive/IPadTimeEditor';
import { useAdaptiveLayout } from '../../src/hooks/useAdaptiveLayout';
import { AdaptivePageFrame } from '../../src/components/adaptive/AdaptivePageFrame';
import { AdaptiveModalFrame } from '../../src/components/adaptive/AdaptiveModalFrame';
import { HistoryLayout } from '../../src/components/adaptive/HistoryLayout';
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from 'expo-router';
import { dayAgeBucket, timerDurationBucket, track } from '../../src/services/analytics';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SwipeDelete } from "../../src/components/SwipeDelete";
import { DismissibleHint } from "../../src/components/DismissibleHint";
import { TaskTagIcon } from "../../src/components/TaskTagIcon";
import { getTaskTagLabel, TaskTagId } from "../../src/constants/taskTags";
import { formatHistoryDay, formatShortTime, useI18n } from "../../src/i18n";
import { hasDuplicateTask, liveTask, Task, useTimer } from "../../src/state/TimerContext";
import { todayKey } from "../../src/utils/time";

import { colors } from "../../src/constants/colors";
import { border, radius, space, typography } from "../../src/constants/design";
const statusOrder: Record<Task["status"], number> = {
  running: 0,
  paused: 1,
  completed: 2,
  pending: 3,
};
const compactDayHeader = { paddingVertical: 11 };

export default function History() {
  const layout = useAdaptiveLayout();
  useFocusEffect(useCallback(() => { track('history_viewed'); }, []));
  const timer = useTimer();
  const { locale, t } = useI18n();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allocatedMinutes, setAllocatedMinutes] = useState("");
  const [timeError, setTimeError] = useState("");
  const [editingDetails, setEditingDetails] = useState<Task | null>(null);
  const [detailsError, setDetailsError] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTagId, setEditingTagId] = useState<TaskTagId>("uncategorized");
  const timeTaskTitle = useRef('');
  const groups = Object.entries(
    timer.tasks.reduce<Record<string, Task[]>>((all, task) => {
      (all[task.day] ??= []).push(task);
      return all;
    }, {}),
  )
    .map(
      ([day, tasks]) =>
        [
          day,
          [...tasks].sort(
            (a, b) => statusOrder[a.status] - statusOrder[b.status],
          ),
        ] as [string, Task[]],
    )
    .sort(([a], [b]) => b.localeCompare(a));
  const openEditor = (task: Task) => {
    if (layout.isPad) Keyboard.dismiss();
    timeTaskTitle.current = task.title;
    setEditingTask(task);
    track('time_editor_opened', { day_age_bucket: dayAgeBucket(task.day) });
    setAllocatedMinutes(String(Math.round(task.allocatedDuration / 60000)));
    setTimeError("");
  };
  const closeEditor = () => {
    setEditingTask(null);
    if (!layout.isPad) setTimeError('');
  };
  const saveTimes = () => {
    const allocated = Number(allocatedMinutes);
    if (!editingTask || (layout.isPad && !allocatedMinutes.length) || !Number.isInteger(allocated) || allocated < 0) {
      setTimeError(t("history.invalidMinutes"));
      return;
    }
    const current = timer.tasks.find(task => task.id === editingTask.id);
    if (!timer.ready || !current) return;
    const before = liveTask(current, timer, Date.now()).allocatedDuration;
    const after = allocated * 60000;
    timer.updateAllocatedDuration(editingTask.id, after);
    if (before !== after) track('task_time_updated', { change_direction: after > before ? 'increase' : 'decrease', change_bucket: timerDurationBucket(Math.abs(after - before)), day_age_bucket: dayAgeBucket(current.day) });
    closeEditor();
  };
  const openDetails = (task: Task) => {
    setDetailsError(false);
    setEditingDetails(task);
    setEditingTitle(task.title);
    setEditingTagId(task.tagId);
  };
  const closeDetails = () => {
    setEditingDetails(null);
  };
  const saveDetails = () => {
    if (!editingDetails || !editingTitle.trim()) return;
    if (hasDuplicateTask(timer.tasks, editingDetails.day, editingTitle, editingTagId, editingDetails.id)) {
      setDetailsError(true);
      track('task_duplicate_blocked', { entry_source: 'history_edit' });
      return;
    }
    const current = timer.tasks.find(task => task.id === editingDetails.id);
    if (!timer.ready || !current) return;
    timer.updateTask(editingDetails.id, editingTitle, editingTagId);
    if (current.title !== editingTitle.trim() || current.tagId !== editingTagId) track('task_updated', { entry_source: 'history', name_changed: current.title !== editingTitle.trim(), category_changed: current.tagId !== editingTagId });
    closeDetails();
  };
  const dayTitle = (day: string) =>
    day === todayKey() ? t("stats.today") : formatHistoryDay(locale, day);
  const activeDay = groups.some(([day]) => day === expandedDay) ? expandedDay : groups[0]?.[0] ?? null;
  useEffect(() => {
    // Persist the default selection through a transition back to a narrow window.
    if (layout.wide && activeDay !== expandedDay) setExpandedDay(activeDay);
  }, [layout.wide, activeDay, expandedDay]);
  const renderDay = (day: string, tasks: Task[], variant: 'accordion' | 'date' | 'detail' = 'accordion') => {

    const expanded = variant === 'accordion' ? day === expandedDay : day === activeDay;
    const liveTasks = tasks.map((task) =>
      liveTask(task, timer, timer.now),
    );
    const work = liveTasks.reduce(
      (sum, task) => sum + task.allocatedDuration,
      0,
    );
    const completed = tasks.filter(
      (task) => task.status === "completed",
    );
    return (
      <View key={day} style={[styles.day, variant === 'detail' && { borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' }, variant === 'date' && { borderWidth: 0, borderRadius: 12, backgroundColor: expanded ? '#E3F3ED' : 'transparent' }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dayTitle(day)}
          accessibilityState={{ expanded }}
          onPress={() => {
            if (variant !== 'detail' && !expanded) track('history_day_expanded', { day_age_bucket: dayAgeBucket(day), task_count: tasks.length });
            if (variant === 'detail') return;
            setExpandedDay(variant === 'date' ? day : expanded ? null : day);
          }}
          disabled={variant === 'detail'}
          style={[styles.dayHeader, compactDayHeader, variant === 'date' && expanded && { backgroundColor: '#E3F3ED' }, variant === 'detail' && { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 }]}
        >
          <View style={variant !== 'accordion' && { flex: 1, minWidth: 0 }}>
            {variant !== 'detail' ? <Text style={styles.dayTitle}>{dayTitle(day)}</Text> : null}
            <Text style={[styles.dayMeta, variant === 'detail' && { marginTop: 0 }]}>
              {t("history.invested")} {formatShortTime(work, locale)} ·{" "}
              {locale === "fr"
                ? t("history.completed", { count: completed.length })
                : `${t("history.completed")} ${completed.length}`}
            </Text>
          </View>
          {variant !== 'detail' ? <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color="#9DB0AA"
          /> : null}
        </Pressable>
        {expanded && variant !== 'date' ? (
          <View style={[styles.rows, variant === 'detail' && { borderTopWidth: 0, borderRadius: 12, overflow: 'hidden' }]}>
            {liveTasks.map((task) => (
              <SwipeDelete
                key={task.id}
                actionVariant="compact"
                cornerRadius={0}
                label={t("task.delete")}
                onDelete={() => { if (!timer.ready || !timer.tasks.some(item => item.id === task.id)) return; timer.remove(task.id); track('task_deleted', { entry_source: 'history', task_status: task.status }); }}
              >
                <View style={styles.row}>
                  <Pressable
                    onPress={() => openDetails(task)}
                    onLongPress={() => openEditor(task)}
                    delayLongPress={450}
                    style={styles.rowPress}
                    accessibilityLabel={t("task.edit", {
                      title: task.title,
                    })}
                    accessibilityHint={t("history.editHint")}
                  >
                    <TaskTagIcon tagId={task.tagId} size={30} />
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {task.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.status}>
                      {t(`history.statuses.${task.status}`)}
                    </Text>
                    <Text numberOfLines={1} style={styles.rowTime}>
                      {formatShortTime(task.allocatedDuration, locale)}
                    </Text>
                  </Pressable>
                </View>
              </SwipeDelete>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const timeEditor = (
    <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{t("history.editTime")}</Text>
        <Text style={styles.modalTask} numberOfLines={1}>
          {editingTask?.title ?? timeTaskTitle.current}
        </Text>
        <Text style={styles.inputLabel}>{t("history.actualMinutes")}</Text>
        <TextInput
          value={allocatedMinutes}
          onChangeText={setAllocatedMinutes}
          keyboardType="number-pad"
          selectTextOnFocus
          style={styles.timeInput}
        />
        {timeError ? <Text style={styles.error}>{timeError}</Text> : null}
        <View style={styles.modalActions}>
          <Pressable onPress={closeEditor} style={styles.cancel}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable onPress={saveTimes} style={styles.save}>
            <Text style={styles.saveText}>{t("common.save")}</Text>
          </Pressable>
        </View>
    </View>
  );

  return (
    <>
      {layout.wide && groups.length > 0 ? <HistoryLayout layout={layout}
        datesTitle={t('adaptive.recordDates')} recordsTitle={activeDay ? dayTitle(activeDay) : ''}
        header={
          <>
            <Text style={styles.title}>{t("history.title")}</Text>
            <Text style={styles.subtitle}>{t("history.subtitle")}</Text>
          </>
        }
        dates={groups.map(([day, tasks]) => renderDay(day, tasks, 'date'))}
        details={groups.filter(([day]) => day === activeDay).map(([day, tasks]) => renderDay(day, tasks, 'detail'))}
        footer={
          <>
            {groups.length && !timer.dismissedHints.includes("history-actions") ? (
              <DismissibleHint
                dismissLabel={t("hints.dismiss")}
                onDismiss={() => timer.dismissHint("history-actions")}
              >
                {t("hints.historyActions")}
              </DismissibleHint>
            ) : null}
          </>
        }
      /> : (
      <AdaptivePageFrame layout={layout} style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("history.title")}</Text>
        <Text style={styles.subtitle}>{t("history.subtitle")}</Text>
        {groups.length ? (
          groups.map(([day, tasks]) => renderDay(day, tasks))
        ) : (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={33} color="#A9C7C0" />
            <Text style={styles.emptyTitle}>{t("history.emptyTitle")}</Text>
            <Text style={styles.emptyText}>{t("history.emptyText")}</Text>
          </View>
        )}
        {groups.length && !timer.dismissedHints.includes("history-actions") ? (
          <DismissibleHint
            dismissLabel={t("hints.dismiss")}
            onDismiss={() => timer.dismissHint("history-actions")}
          >
            {t("hints.historyActions")}
          </DismissibleHint>
        ) : null}
      </AdaptivePageFrame>)}
      <Modal
        visible={editingTask !== null}
        transparent
        presentationStyle="overFullScreen"
        supportedOrientations={layout.isPad ? ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right'] : undefined}
        animationType="fade"
        onRequestClose={closeEditor}
      >
        {layout.isPad ? (editingTask !== null ? <IPadTimeEditor
          layout={layout}
          title={t('history.editTime')}
          taskTitle={editingTask.title}
          minutesLabel={t('history.actualMinutes')}
          value={allocatedMinutes}
          error={timeError}
          clearLabel={t('adaptive.keypadClear')}
          backspaceLabel={t('adaptive.keypadBackspace')}
          cancelLabel={t('common.cancel')}
          saveLabel={t('common.save')}
          onChange={value => { setAllocatedMinutes(value); setTimeError(''); }}
          onCancel={closeEditor}
          onSave={saveTimes}
        /> : null) : <View style={styles.modalBackdrop}>{timeEditor}</View>}
      </Modal>
      <Modal
        visible={editingDetails !== null}
        transparent
        animationType="slide"
        onRequestClose={closeDetails}
      >
        <AdaptiveModalFrame layout={layout} legacyBackdrop={<Pressable style={styles.detailsBackdrop} onPress={closeDetails}></Pressable>} onDismiss={closeDetails}>
          <Pressable
            style={styles.detailsSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t("today.editTask")}</Text>
            <Text style={styles.detailsLabel}>{t("today.taskName")}</Text>
            <TextInput
              value={editingTitle}
              onChangeText={value => { setEditingTitle(value); setDetailsError(false); }}
              onSubmitEditing={Keyboard.dismiss}
              returnKeyType="done"
              blurOnSubmit
              placeholder={t("today.taskName")}
              placeholderTextColor="#9AA9A5"
              style={styles.detailsInput}
            />
            <Text style={styles.detailsLabel}>{t("today.taskCategory")}</Text>
            <View style={styles.tagGrid}>
              {timer.categories.map((tag) => {
                const label = getTaskTagLabel(tag, locale);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => { setEditingTagId(tag.id); setDetailsError(false); }}
                    style={[
                      styles.tagOption,
                      editingTagId === tag.id && styles.tagOptionSelected,
                    ]}
                    accessibilityLabel={t("today.chooseTaskCategory", {
                      label,
                    })}
                  >
                    <View style={styles.tagIconWrap}>
                      <TaskTagIcon tagId={tag.id} size={32} />
                    </View>
                    <Text style={styles.tagLabel}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {detailsError ? <Text accessibilityRole="alert" style={styles.error}>{t("today.duplicateTask")}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={closeDetails} style={styles.cancel}>
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={saveDetails}
                style={[
                  styles.save,
                  !editingTitle.trim() && styles.saveDisabled,
                ]}
              >
                <Text style={styles.saveText}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </AdaptiveModalFrame>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7FAF8" },
  content: { padding: space.page, paddingTop: 65, paddingBottom: 32 },
  title: typography.pageTitle,
  subtitle: { ...typography.secondary, marginTop: 6, marginBottom: 26 },
  day: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: border.soft,
    overflow: "hidden",
  },
  dayHeader: {
    padding: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitle: typography.sectionTitle,
  dayMeta: { ...typography.caption, marginTop: 3 },
  rows: { borderTopWidth: 1, borderTopColor: "#F0F4F2" },
  row: { minHeight: 66, backgroundColor: "#FFFFFF" },
  rowPress: {
    minHeight: 66,
    paddingHorizontal: 17,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: { ...typography.body, flex: 1, minWidth: 0, color: "#536C66" },
  status: { ...typography.caption, flexShrink: 0 },
  rowTime: {
    ...typography.caption,
    flexShrink: 0,
    fontWeight: "600",
    color: "#728780",
  },
  empty: { alignItems: "center", paddingTop: 130 },
  emptyTitle: { ...typography.sectionTitle, color: "#59736C", marginTop: 14 },
  emptyText: { ...typography.secondary, color: "#728780", marginTop: 7 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,50,44,.35)",
    justifyContent: "center",
    padding: space.xl,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    padding: space.page,
  },
  modalTitle: {
    ...typography.sectionTitle,
    fontSize: 20,
    lineHeight: 26,
    color: "#183B35",
  },
  modalTask: {
    ...typography.body,
    color: "#718681",
    marginTop: 5,
    marginBottom: 20,
  },
  inputLabel: { ...typography.label, marginBottom: 7 },
  timeInput: {
    height: 46,
    borderWidth: 1,
    borderColor: border.input,
    borderRadius: radius.control,
    paddingHorizontal: 13,
    ...typography.body,
    color: "#183B35",
    marginBottom: 15,
  },
  error: {
    ...typography.caption,
    color: "#C85752",
    marginTop: -4,
    marginBottom: 10,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 5 },
  cancel: {
    flex: 1,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF5F2",
    borderRadius: radius.control,
  },
  cancelText: { ...typography.button, color: "#527069" },
  save: {
    flex: 1,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1F7A70",
    borderRadius: radius.control,
  },
  saveDisabled: { backgroundColor: "#A6BBB5" },
  saveText: { ...typography.button, color: "#FFFFFF" },
  detailsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,50,44,.28)",
    justifyContent: "flex-end",
  },
  detailsSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.page,
    paddingBottom: 38,
  },
  detailsLabel: { ...typography.label, marginTop: 18, marginBottom: 7 },
  detailsInput: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: border.input,
    paddingHorizontal: 14,
    ...typography.body,
    color: "#183B35",
  },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 13 },
  tagOption: {
    width: "30%",
    minWidth: 92,
    flexGrow: 1,
    height: 104,
    borderRadius: radius.control,
    backgroundColor: "#F6FAF8",
    borderWidth: 1,
    borderColor: "#E4EEEA",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tagOptionSelected: {
    backgroundColor: "#E3F3ED",
    borderColor: "#1F7A70",
    borderWidth: 2,
  },
  tagIconWrap: { height: 38, justifyContent: "center" },
  tagLabel: { ...typography.button, color: "#42625B" },
});
