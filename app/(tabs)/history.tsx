import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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
import { liveTask, Task, useTimer } from "../../src/state/TimerContext";
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
  const timer = useTimer();
  const { locale, t } = useI18n();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allocatedMinutes, setAllocatedMinutes] = useState("");
  const [timeError, setTimeError] = useState("");
  const [editingDetails, setEditingDetails] = useState<Task | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTagId, setEditingTagId] = useState<TaskTagId>("uncategorized");
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
    setEditingTask(task);
    setAllocatedMinutes(String(Math.round(task.allocatedDuration / 60000)));
    setTimeError("");
  };
  const closeEditor = () => {
    setEditingTask(null);
    setTimeError("");
  };
  const saveTimes = () => {
    const allocated = Number(allocatedMinutes);
    if (!editingTask || !Number.isInteger(allocated) || allocated < 0) {
      setTimeError(t("history.invalidMinutes"));
      return;
    }
    timer.updateAllocatedDuration(editingTask.id, allocated * 60000);
    closeEditor();
  };
  const openDetails = (task: Task) => {
    setEditingDetails(task);
    setEditingTitle(task.title);
    setEditingTagId(task.tagId);
  };
  const closeDetails = () => {
    setEditingDetails(null);
  };
  const saveDetails = () => {
    if (!editingDetails || !editingTitle.trim()) return;
    timer.updateTask(editingDetails.id, editingTitle, editingTagId);
    closeDetails();
  };
  const dayTitle = (day: string) =>
    day === todayKey() ? t("stats.today") : formatHistoryDay(locale, day);
  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("history.title")}</Text>
        <Text style={styles.subtitle}>{t("history.subtitle")}</Text>
        {groups.length ? (
          groups.map(([day, tasks]) => {
            const expanded = day === expandedDay;
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
              <View key={day} style={styles.day}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={dayTitle(day)}
                  accessibilityState={{ expanded }}
                  onPress={() =>
                    setExpandedDay((current) => (current === day ? null : day))
                  }
                  style={[styles.dayHeader, compactDayHeader]}
                >
                  <View>
                    <Text style={styles.dayTitle}>{dayTitle(day)}</Text>
                    <Text style={styles.dayMeta}>
                      {t("history.invested")} {formatShortTime(work, locale)} ·{" "}
                      {locale === "fr"
                        ? t("history.completed", { count: completed.length })
                        : `${t("history.completed")} ${completed.length}`}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={18}
                    color="#9DB0AA"
                  />
                </Pressable>
                {expanded ? (
                  <View style={styles.rows}>
                    {liveTasks.map((task) => (
                      <SwipeDelete
                        key={task.id}
                        actionVariant="compact"
                        cornerRadius={0}
                        label={t("task.delete")}
                        onDelete={() => timer.remove(task.id)}
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
          })
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
      </ScrollView>
      <Modal
        visible={editingTask !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("history.editTime")}</Text>
            <Text style={styles.modalTask} numberOfLines={1}>
              {editingTask?.title}
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
        </View>
      </Modal>
      <Modal
        visible={editingDetails !== null}
        transparent
        animationType="slide"
        onRequestClose={closeDetails}
      >
        <Pressable style={styles.detailsBackdrop} onPress={closeDetails}>
          <Pressable
            style={styles.detailsSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t("today.editTask")}</Text>
            <Text style={styles.detailsLabel}>{t("today.taskName")}</Text>
            <TextInput
              value={editingTitle}
              onChangeText={setEditingTitle}
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
                    onPress={() => setEditingTagId(tag.id)}
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
        </Pressable>
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
