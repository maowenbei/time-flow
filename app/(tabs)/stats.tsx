import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TaskTagIcon } from "../../src/components/TaskTagIcon";
import { DismissibleHint } from "../../src/components/DismissibleHint";
import { getTaskTagLabel } from "../../src/constants/taskTags";
import {
  AppLocale,
  formatHistoryDay,
  formatShortTime,
  formatWeekday,
  useI18n,
} from "../../src/i18n";
import { liveTask, Task, useTimer } from "../../src/state/TimerContext";
import { todayKey } from "../../src/utils/time";
import { border, radius, space, typography } from "../../src/constants/design";

type Period = "week" | "month";
type DayTotal = { day: string; value: number };
type ProjectTotal = { title: string; value: number };
const dayDate = (day: string) => new Date(`${day}T12:00:00`);
const dayKey = (date: Date) => todayKey(date.getTime());
const formatChartTime = (value: number, locale: AppLocale) => {
  const minutes = Math.round(value / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const compactUnit = (duration: number) =>
    formatShortTime(duration, locale).replace(/\s/g, "\u00A0");

  // Keep each time unit intact.  The chart columns are narrow, so a normal
  // space in e.g. "10 min" can otherwise wrap the number and unit apart.
  return hours && remainingMinutes
    ? `${compactUnit(hours * 60 * 60000)}\n${compactUnit(remainingMinutes * 60000)}`
    : compactUnit(value);
};

function periodDays(period: Period, offset: number, now: number) {
  const start = dayDate(todayKey(now));
  if (period === "week") {
    start.setDate(start.getDate() - 6 + offset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return dayKey(date);
    });
  }
  start.setDate(1);
  start.setMonth(start.getMonth() + offset);
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(index + 1);
    return dayKey(date);
  });
}

function periodTitle(locale: AppLocale, period: Period, days: string[]) {
  if (period === "month")
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
    }).format(dayDate(days[0]));
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(dayDate(days[0]))} – ${formatter.format(dayDate(days[days.length - 1]))}`;
}

function detailDateLabel(locale: AppLocale, day: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
  }).format(dayDate(day));
}

function heatColor(value: number, max: number) {
  if (!value) return "#F8FBF9";
  return `rgba(31, 122, 112, ${0.18 + (0.82 * value) / max})`;
}

export default function Stats() {
  const timer = useTimer();
  const { locale, t } = useI18n();
  const [period, setPeriod] = useState<Period>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);
  const days = useMemo(
    () => periodDays(period, periodOffset, timer.now),
    [period, periodOffset, timer.now],
  );
  const copy = {
    month: t("stats.month"),
    previous: t("stats.previous"),
    next: t("stats.next"),
    total: t("stats.total"),
    noPeriodData: t("stats.noPeriodData"),
    noDayData: t("stats.noDayData"),
    today: t("stats.today"),
  };

  const tasks = useMemo(
    () => timer.tasks.map((task) => liveTask(task, timer, timer.now)),
    [timer.tasks, timer.now],
  );
  const totalsByDay = useMemo(() => {
    const result = new Map(days.map((day) => [day, 0]));
    tasks.forEach((task) => {
      if (result.has(task.day))
        result.set(
          task.day,
          (result.get(task.day) ?? 0) + task.allocatedDuration,
        );
    });
    return result;
  }, [days, tasks]);
  const dayTotals = useMemo(
    () => days.map((day) => ({ day, value: totalsByDay.get(day) ?? 0 })),
    [days, totalsByDay],
  );
  const periodTotal = useMemo(
    () => dayTotals.reduce((sum, item) => sum + item.value, 0),
    [dayTotals],
  );
  const max = Math.max(...dayTotals.map((item) => item.value), 1);
  const activeSelectedDay =
    selectedDay && days.includes(selectedDay) ? selectedDay : null;
  const detailDays = activeSelectedDay ? [activeSelectedDay] : days;
  const detailTotal = activeSelectedDay
    ? (totalsByDay.get(activeSelectedDay) ?? 0)
    : periodTotal;
  const tagTotals = timer.categories
    .map((tag) => {
      const groupedProjects = new Map<string, ProjectTotal>();
      tasks
        .filter(
          (task) => detailDays.includes(task.day) && task.tagId === tag.id,
        )
        .forEach((task: Task) => {
          const title = task.title.trim();
          const existing = groupedProjects.get(title);
          groupedProjects.set(title, {
            title,
            value: (existing?.value ?? 0) + task.allocatedDuration,
          });
        });
      return {
        tag,
        value: [...groupedProjects.values()].reduce(
          (sum, project) => sum + project.value,
          0,
        ),
        projects: [...groupedProjects.values()]
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const isCurrentPeriod = periodOffset === 0;
  const detailDate = activeSelectedDay
    ? activeSelectedDay === todayKey(timer.now)
      ? copy.today
      : detailDateLabel(locale, activeSelectedDay)
    : periodTitle(locale, period, days);
  const monthLeadingBlanks = period === "month" ? dayDate(days[0]).getDay() : 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("stats.title")}</Text>
      <Text style={styles.subtitle}>{t("stats.subtitle")}</Text>
      <View style={styles.periodControls}>
        <View style={styles.segmented}>
          <PeriodButton
            label={t("stats.last7Days")}
            active={period === "week"}
            onPress={() => {
              setSelectedDay(null);
              setPeriod("week");
              setPeriodOffset(0);
            }}
          />
          <PeriodButton
            label={copy.month}
            active={period === "month"}
            onPress={() => {
              setSelectedDay(null);
              setPeriod("month");
              setPeriodOffset(0);
            }}
          />
        </View>
        <View style={styles.paging}>
          <Pressable
            onPress={() => {
              setSelectedDay(null);
              setPeriodOffset((current) => current - 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={copy.previous}
            style={styles.pageButton}
          >
            <Ionicons name="chevron-back" size={18} color="#527069" />
          </Pressable>
          <Text numberOfLines={1} style={styles.periodTitle}>
            {periodTitle(locale, period, days)}
          </Text>
          <Pressable
            onPress={() => {
              setSelectedDay(null);
              setPeriodOffset((current) => current + 1);
            }}
            disabled={isCurrentPeriod}
            accessibilityRole="button"
            accessibilityLabel={copy.next}
            style={[
              styles.pageButton,
              isCurrentPeriod && styles.pageButtonDisabled,
            ]}
          >
            <Ionicons name="chevron-forward" size={18} color="#527069" />
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => setSelectedDay(null)}
        accessibilityRole="button"
        accessibilityLabel={copy.total}
        style={[styles.totalCard, !activeSelectedDay && styles.totalCardActive]}
      >
        <Text style={styles.totalLabel}>{copy.total}</Text>
        <Text style={styles.totalValue}>
          {formatShortTime(periodTotal, locale)}
        </Text>
      </Pressable>
      <View style={styles.chart}>
        {period === "week" ? (
          <WeekChart
            days={dayTotals}
            max={max}
            selectedDay={activeSelectedDay}
            locale={locale}
            today={todayKey(timer.now)}
            todayLabel={copy.today}
            onSelect={setSelectedDay}
          />
        ) : (
          <MonthCalendar
            days={dayTotals}
            max={max}
            leadingBlanks={monthLeadingBlanks}
            selectedDay={activeSelectedDay}
            locale={locale}
            onSelect={setSelectedDay}
          />
        )}
      </View>
      <View style={styles.tagStats}>
        <View style={styles.detailHeader}>
          <Text style={styles.chartTitle}>
            {activeSelectedDay ? detailDate : periodTitle(locale, period, days)}
          </Text>
          <Text style={styles.detailTime}>
            {formatShortTime(detailTotal, locale)}
          </Text>
        </View>
        {tagTotals.length ? (
          tagTotals.map(({ tag, value, projects }) => {
            const expanded = expandedTagIds.includes(tag.id);
            return (
              <View key={tag.id} style={styles.tagStatRow}>
                <Pressable
                  onPress={() =>
                    setExpandedTagIds((current) =>
                      current.includes(tag.id)
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${getTaskTagLabel(tag, locale)} ${formatShortTime(value, locale)}`}
                  style={styles.tagStatPress}
                >
                  <TaskTagIcon tagId={tag.id} size={26} />
                  <View style={styles.tagStatMain}>
                    <View style={styles.tagStatHeading}>
                      <View style={styles.tagValueWrap}>
                        <Text style={styles.tagStatLabel}>
                          {getTaskTagLabel(tag, locale)}
                        </Text>
                        <Text style={styles.tagStatValue}>
                          {formatShortTime(value, locale)} ·{" "}
                          {Math.round((value / detailTotal) * 100)}%
                        </Text>
                      </View>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={15}
                        color="#77908A"
                      />
                    </View>
                    <View style={styles.tagTrack}>
                      <View
                        style={[
                          styles.tagFill,
                          {
                            width: `${Math.max(4, (value / detailTotal) * 100)}%`,
                            backgroundColor: tag.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={styles.projectList}>
                    {projects.map((project) => (
                      <View key={project.title} style={styles.projectRow}>
                        <Text numberOfLines={1} style={styles.projectTitle}>
                          {project.title}
                        </Text>
                        <Text style={styles.projectTime}>
                          {formatShortTime(project.value, locale)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.tagEmpty}>
            {activeSelectedDay ? copy.noDayData : copy.noPeriodData}
          </Text>
        )}
      </View>
      {timer.ready && !timer.dismissedHints.includes("stats-allocation") ? (
        <DismissibleHint
          title={t("stats.noDoubleCountTitle")}
          dismissLabel={t("hints.dismiss")}
          onDismiss={() => timer.dismissHint("stats-allocation")}
        >
          {t("stats.noDoubleCountText")}
        </DismissibleHint>
      ) : null}
    </ScrollView>
  );
}

function WeekChart({
  days,
  max,
  selectedDay,
  locale,
  today,
  todayLabel,
  onSelect,
}: {
  days: DayTotal[];
  max: number;
  selectedDay: string | null;
  locale: AppLocale;
  today: string;
  todayLabel: string;
  onSelect: (day: string) => void;
}) {
  return (
    <View style={styles.bars}>
      {days.map(({ day, value }) => {
        const selected = day === selectedDay;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            accessibilityRole="button"
            accessibilityLabel={formatHistoryDay(locale, day)}
            accessibilityState={{ selected }}
            style={[styles.barItem, selected && styles.barItemSelected]}
          >
            <View style={styles.barArea}>
              <Text
                numberOfLines={2}
                style={[styles.barValue, selected && styles.barValueSelected]}
              >
                {value ? formatChartTime(value, locale) : ""}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: value ? Math.max(5, (112 * value) / max) : 3 },
                  selected && styles.barSelected,
                ]}
              />
            </View>
            <Text
              style={[styles.barLabel, selected && styles.barLabelSelected]}
            >
              {day === today ? todayLabel : formatWeekday(locale, day)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthCalendar({
  days,
  max,
  leadingBlanks,
  selectedDay,
  locale,
  onSelect,
}: {
  days: DayTotal[];
  max: number;
  leadingBlanks: number;
  selectedDay: string | null;
  locale: AppLocale;
  onSelect: (day: string) => void;
}) {
  const cells: Array<DayTotal | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  return (
    <View style={styles.calendar}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.calendarWeek}>
            {week.map((item, dayIndex) => {
              if (!item)
                return (
                  <View
                    key={`blank-${weekIndex}-${dayIndex}`}
                    style={styles.calendarCell}
                  />
                );
              const selected = item.day === selectedDay;
              return (
                <View key={item.day} style={styles.calendarCell}>
                  <Pressable
                    onPress={() => onSelect(item.day)}
                    accessibilityRole="button"
                    accessibilityLabel={formatHistoryDay(locale, item.day)}
                    accessibilityState={{ selected }}
                    style={[
                      styles.calendarButton,
                      { backgroundColor: heatColor(item.value, max) },
                      selected && styles.calendarDaySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDate,
                        item.value > max * 0.48 && styles.calendarDateLight,
                      ]}
                    >
                      {dayDate(item.day).getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );
}

function PeriodButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.periodButton, active && styles.periodButtonActive]}
    >
      <Text
        style={[
          styles.periodButtonText,
          active && styles.periodButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7FAF8" },
  content: { padding: space.page, paddingTop: 65, paddingBottom: 32 },
  title: typography.pageTitle,
  subtitle: { ...typography.secondary, marginTop: 6, marginBottom: 22 },
  periodControls: { gap: 12 },
  segmented: {
    height: 43,
    padding: 4,
    backgroundColor: "#EAF2EF",
    borderRadius: radius.control,
    flexDirection: "row",
  },
  periodButton: {
    flex: 1,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonActive: {
    backgroundColor: "#FFF",
    shadowColor: "#1A3D35",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  periodButtonText: { ...typography.label, color: "#6D8780" },
  periodButtonTextActive: { color: "#1D473E" },
  paging: {
    height: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF5F2",
  },
  pageButtonDisabled: { opacity: 0.35 },
  periodTitle: { ...typography.body, fontWeight: "600", color: "#46655E" },
  totalCard: {
    marginTop: 14,
    marginHorizontal: 8,
    backgroundColor: "#DDF1EB",
    borderRadius: radius.card,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  totalCardActive: { borderWidth: 1, borderColor: "#8BCBBB" },
  totalLabel: { ...typography.label, color: "#5C7A73" },
  totalValue: {
    ...typography.timerCompact,
    fontSize: 29,
    lineHeight: 35,
    color: "#173F37",
    marginTop: 5,
  },
  chart: {
    marginTop: 18,
    backgroundColor: "#FFF",
    borderRadius: radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: border.soft,
  },
  chartTitle: { ...typography.cardTitle, color: "#3A5A53" },
  bars: {
    height: 168,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: 0,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    borderRadius: 8,
    paddingTop: 2,
  },
  barItemSelected: { backgroundColor: "#EEF8F5" },
  barArea: {
    height: 130,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    backgroundColor: "#B8D8D0",
    borderRadius: 6,
    width: "62%",
    minWidth: 5,
  },
  barSelected: { backgroundColor: "#1F7A70" },
  barValue: {
    fontSize: 10,
    lineHeight: 12,
    color: "#728780",
    marginBottom: 4,
    fontWeight: "600",
    textAlign: "center",
  },
  barValueSelected: { color: "#2B665B" },
  barLabel: { fontSize: 12, lineHeight: 16, color: "#728780", marginTop: 6 },
  barLabelSelected: { color: "#1F7A70", fontWeight: "600" },
  weekdayRow: { flexDirection: "row", marginTop: 14, marginBottom: 6 },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: "#728780",
  },
  calendar: { gap: 2 },
  calendarWeek: { height: 32, flexDirection: "row", gap: 2 },
  calendarCell: { flex: 1 },
  calendarButton: {
    flex: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF4F1",
  },
  calendarDaySelected: { borderColor: "#174E44", borderWidth: 2 },
  calendarDate: {
    ...typography.caption,
    fontWeight: "600",
    color: "#658078",
    textAlign: "center",
  },
  calendarDateLight: { color: "#FFF" },
  tagStats: {
    marginTop: 18,
    backgroundColor: "#FFF",
    borderRadius: radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: border.soft,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailTime: {
    ...typography.cardTitle,
    color: "#3A5A53",
    fontVariant: ["tabular-nums"],
  },
  tagStatRow: { marginTop: 14 },
  tagStatPress: { flexDirection: "row", alignItems: "center", gap: 10 },
  tagStatMain: { flex: 1 },
  tagStatHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tagStatLabel: { ...typography.body, fontWeight: "600", color: "#46655E" },
  tagValueWrap: { gap: 2 },
  tagStatValue: { ...typography.caption, fontWeight: "600" },
  tagTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EDF3F0",
    overflow: "hidden",
  },
  tagFill: { height: "100%", borderRadius: 3 },
  projectList: {
    marginLeft: 36,
    marginTop: 9,
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 12,
    borderRadius: 10,
    backgroundColor: "#F9FBFA",
    gap: 7,
  },
  projectRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  projectTitle: {
    ...typography.secondary,
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    color: "#59736C",
  },
  projectTime: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 16,
    minWidth: 42,
    textAlign: "right",
    fontWeight: "400",
    color: "#58786F",
    fontVariant: ["tabular-nums"],
  },
  tagEmpty: { ...typography.secondary, paddingVertical: 13 },
  note: {
    marginTop: 18,
    padding: 19,
    borderRadius: radius.card,
    backgroundColor: "#EEF5F2",
  },
  noteTitle: { ...typography.cardTitle, color: "#46655E" },
  noteText: { ...typography.secondary, color: "#718983", marginTop: 7 },
});
