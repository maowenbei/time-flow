import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { TaskTagIcon } from "../src/components/TaskTagIcon";
import {
  getSystemIconImage,
  getTaskTagLabel,
  systemIconChoices,
  TaskTag,
  uncategorizedTagId,
} from "../src/constants/taskTags";
import {
  languageModeLabel,
  languageSettingsCopy,
  LanguageMode,
  useI18n,
} from "../src/i18n";
import { useTimer } from "../src/state/TimerContext";

import { colors } from "../src/constants/colors";
import { border, radius, space, typography } from "../src/constants/design";
import {
  notificationStatus,
  requestNotificationPermission,
} from "../src/services/reminders";

const reminderHours = Array.from({ length: 24 }, (_, hour) => hour);
const reminderMinutes = Array.from({ length: 12 }, (_, index) => index * 5);
const wheelItemHeight = 44;

export default function Settings() {
  const router = useRouter();
  const timer = useTimer();
  const { locale, languageMode, setLanguageMode, t } = useI18n();
  const [editing, setEditing] = useState<TaskTag | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [iconUri, setIconUri] = useState<string | undefined>();
  const [systemIconId, setSystemIconId] = useState<string | undefined>();
  const [compressing, setCompressing] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [notificationsDenied, setNotificationsDenied] = useState(false);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [draftReminderTime, setDraftReminderTime] = useState({ hour: 9, minute: 0 });
  const categoryEditorProgress = useRef(new Animated.Value(0)).current;
  const closeEditor = () => {
    setEditing(null);
    setIsAdding(false);
    setName("");
    setIconUri(undefined);
    setSystemIconId(undefined);
  };
  const closeCategorySheet = () => {
    categoryEditorProgress.setValue(0);
    closeEditor();
    setCategoryVisible(false);
  };
  const openCategoryEditor = () => {
    categoryEditorProgress.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(categoryEditorProgress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };
  const returnToCategoryList = () => {
    Animated.timing(categoryEditorProgress, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) closeEditor();
    });
  };
  const openEditor = (category: TaskTag) => {
    if (category.id === uncategorizedTagId) return;
    setEditing(category);
    setName(getTaskTagLabel(category, locale));
    setIconUri(category.iconUri);
    setSystemIconId(
      category.systemIconId ??
        (systemIconChoices.some((icon) => icon.id === category.id)
          ? category.id
          : undefined),
    );
    openCategoryEditor();
  };
  const openAddCategory = () => {
    setEditing(null);
    setIsAdding(true);
    setName("");
    setIconUri(undefined);
    setSystemIconId(undefined);
    openCategoryEditor();
  };
  const pickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("settings.photoPermissionTitle"),
        t("settings.photoPermissionText"),
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled) return;
    setCompressing(true);
    try {
      const image = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 128 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      if (image.base64) setIconUri(`data:image/jpeg;base64,${image.base64}`);
    } catch {
      Alert.alert(
        t("settings.iconProcessFailedTitle"),
        t("settings.iconProcessFailedText"),
      );
    } finally {
      setCompressing(false);
    }
  };
  const save = () => {
    if (!name.trim()) return;
    if (editing) timer.updateCategory(editing.id, name, iconUri, systemIconId);
    else timer.addCategory(name, iconUri, systemIconId);
    returnToCategoryList();
  };
  const confirmDelete = (category: TaskTag) => {
    const count = timer.tasks.filter(
      (task) => task.tagId === category.id,
    ).length;
    Alert.alert(
      t("settings.deleteTitle", { label: getTaskTagLabel(category, locale) }),
      count
        ? t("settings.deleteWithTasks", { count })
        : t("settings.deleteWithoutTasks"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            timer.deleteCategory(category.id);
            returnToCategoryList();
          },
        },
      ],
    );
  };
  useEffect(() => {
    notificationStatus()
      .then((status) =>
        setNotificationsDenied(!status.granted && status.canAskAgain === false),
      )
      .catch(() => undefined);
  }, []);
  const changeReminder = async (
    key: "startEnabled" | "longEnabled",
    value: boolean,
  ) => {
    if (value) {
      const status = await requestNotificationPermission();
      setNotificationsDenied(!status.granted && status.canAskAgain === false);
      if (!status.granted) return;
    }
    timer.setReminders({ ...timer.reminders, [key]: value });
  };
  const updateReminderTime = (
    part: "startHour" | "startMinute",
    value: string,
  ) => {
    const parsed = Number(value);
    const limit = part === "startHour" ? 23 : 59;
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= limit)
      timer.setReminders({ ...timer.reminders, [part]: parsed });
  };
  const openTimePicker = () => {
    setDraftReminderTime({
      hour: timer.reminders.startHour,
      minute: Math.floor(timer.reminders.startMinute / 5) * 5,
    });
    setTimePickerVisible(true);
  };
  const selectReminderTime = (part: "hour" | "minute", index: number) => {
    const values = part === "hour" ? reminderHours : reminderMinutes;
    setDraftReminderTime((time) => ({
      ...time,
      [part]: values[Math.max(0, Math.min(index, values.length - 1))],
    }));
  };
  const saveReminderTime = () => {
    timer.setReminders({
      ...timer.reminders,
      startHour: draftReminderTime.hour,
      startMinute: draftReminderTime.minute,
    });
    setTimePickerVisible(false);
  };
  const categoryEditorVisible = Boolean(editing || isAdding);
  const preview = iconUri ? { uri: iconUri } : getSystemIconImage(systemIconId);
  const languageCopy = languageSettingsCopy(locale);
  const chooseLanguage = (mode: LanguageMode) => {
    setLanguageMode(mode);
    setLanguageVisible(false);
  };
  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/today");
            }}
            style={styles.back}
            hitSlop={10}
            accessibilityLabel={t("common.cancel")}
          >
            <Ionicons name="chevron-back" size={23} color="#31564E" />
          </Pressable>
          <Pressable onLongPress={() => { if (__DEV__) router.push("/debug-reminders"); }} delayLongPress={650} style={styles.titleWrap} accessibilityLabel="Open reminder debug menu">
            <Text pointerEvents="none" style={styles.titleText}>{t("common.settings")}</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionTitle}>{languageCopy.title}</Text>
        <Pressable
          onPress={() => setLanguageVisible(true)}
          style={[styles.list, styles.languageToggle]}
          accessibilityRole="button"
        >
          <View style={styles.languageIcon}>
            <Ionicons name="language-outline" size={21} color="#1F7A70" />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>{languageCopy.title}</Text>
            <Text style={styles.meta}>{languageModeLabel(languageMode, locale)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8AA09A" />
        </Pressable>
        <Text style={styles.sectionTitle}>{t("reminders.title")}</Text>
        <View style={[styles.list, styles.remindersList]}>
          <View style={styles.reminderBlock}>
            <View style={styles.reminderMain}>
              <View style={styles.grow}>
                <Text style={styles.name}>{t("reminders.start")}</Text>
                <Text style={styles.meta}>{t("reminders.startHint")}</Text>
              </View>
              <View style={styles.reminderSwitchSlot}>
                <Switch
                  value={timer.reminders.startEnabled}
                  onValueChange={(value) => changeReminder("startEnabled", value)}
                  trackColor={{ true: "#82C4B5" }}
                />
              </View>
              </View>
            {timer.reminders.startEnabled ? (
              <View style={styles.reminderDetails}>
                <Text style={styles.detailLabel}>{t("reminders.days")}</Text>
                <View style={styles.segment}>
                  <Pressable
                    onPress={() => timer.setReminders({ ...timer.reminders, startFrequency: "weekdays" })}
                    style={[styles.segmentButton, timer.reminders.startFrequency === "weekdays" && styles.segmentSelected]}
                  >
                    <Text style={styles.segmentText}>{t("reminders.weekdays")}</Text>
                    {timer.reminders.startFrequency === "weekdays" ? <Ionicons name="checkmark" size={16} color="#1F7A70" /> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => timer.setReminders({ ...timer.reminders, startFrequency: "daily" })}
                    style={[styles.segmentButton, timer.reminders.startFrequency === "daily" && styles.segmentSelected]}
                  >
                    <Text style={styles.segmentText}>{t("reminders.daily")}</Text>
                    {timer.reminders.startFrequency === "daily" ? <Ionicons name="checkmark" size={16} color="#1F7A70" /> : null}
                  </Pressable>
                </View>
                <Text style={styles.detailLabel}>{t("reminders.time")}</Text>
                <Pressable onPress={openTimePicker} style={styles.timeButton}>
                  <Ionicons name="time-outline" size={19} color="#1F7A70" />
                  <Text style={styles.timeButtonText}>{String(timer.reminders.startHour).padStart(2, "0")}:{String(timer.reminders.startMinute).padStart(2, "0")}</Text>
                  <Ionicons name="chevron-forward" size={17} color="#8AA09A" />
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={[styles.row, styles.reminderLongRow]}>
            <View style={styles.grow}>
              <Text style={styles.name}>{t("reminders.long")}</Text>
              <Text style={styles.meta}>{t("reminders.longHint")}</Text>
            </View>
            <View style={styles.reminderSwitchSlot}>
              <Switch value={timer.reminders.longEnabled} onValueChange={(value) => changeReminder("longEnabled", value)} trackColor={{ true: "#82C4B5" }} />
            </View>
          </View>
        </View>
        {notificationsDenied ? (
          <Pressable onPress={() => Linking.openSettings()} style={styles.permission}>
            <Text style={styles.permissionTitle}>{t("reminders.permissionDenied")}</Text>
            <Text style={styles.permissionAction}>{t("reminders.openSettings")}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.sectionTitle}>{t("settings.categoryManagement")}</Text>
        <Pressable
          onPress={() => setCategoryVisible(true)}
          style={[styles.list, styles.categoryToggle]}
          accessibilityRole="button"
        >
          <View style={styles.languageIcon}>
            <Ionicons name="pricetags-outline" size={20} color="#1F7A70" />
          </View>
          <View style={styles.grow}>
            <Text style={styles.name}>{t("settings.categoryManagement")}</Text>
            <Text style={styles.meta}>{t("settings.categoryNote")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#8AA09A" />
        </Pressable>
      </ScrollView>
      <Modal visible={categoryVisible} transparent animationType="slide" onRequestClose={categoryEditorVisible ? returnToCategoryList : closeCategorySheet}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropDismiss} onPress={categoryEditorVisible ? returnToCategoryList : closeCategorySheet} />
          <View style={styles.categorySheet}>
            <Text style={styles.sheetTitle}>{t("settings.categoryManagement")}</Text>
            <Text style={styles.sheetSubtitle}>{t("settings.categoryNote")}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.categorySheetList}>
              <View style={styles.list}>
                {timer.categories.map((category) => {
                  const label = getTaskTagLabel(category, locale);
                  return (
                    <Pressable key={category.id} onPress={() => openEditor(category)} disabled={category.id === uncategorizedTagId} style={styles.row}>
                      <TaskTagIcon tagId={category.id} size={36} />
                      <View style={styles.grow}>
                        <Text style={styles.name}>{label}</Text>
                        <Text style={styles.meta}>{category.id === uncategorizedTagId ? t("settings.systemCategory") : t("settings.taskCount", { count: timer.tasks.filter((task) => task.tagId === category.id).length, taskWord: timer.tasks.filter((task) => task.tagId === category.id).length === 1 ? t("common.task") : t("common.tasks") })}</Text>
                      </View>
                      <Ionicons name={category.id === uncategorizedTagId ? "lock-closed-outline" : "chevron-forward"} size={18} color="#8AA09A" />
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={openAddCategory} style={styles.add}>
                <Ionicons name="add" size={20} color="#1F7A70" />
                <Text style={styles.addText}>{t("settings.addCategory")}</Text>
              </Pressable>
            </ScrollView>
            {categoryEditorVisible ? (
              <Animated.View
                style={[
                  styles.categoryEditorScreen,
                  {
                    opacity: categoryEditorProgress,
                    transform: [{ translateX: categoryEditorProgress.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }],
                  },
                ]}
              >
                <View style={styles.editorHeader}>
                  <Pressable onPress={returnToCategoryList} hitSlop={10} style={styles.editorBack} accessibilityLabel={t("common.cancel")}>
                    <Ionicons name="chevron-back" size={22} color="#31564E" />
                  </Pressable>
                  <Text style={styles.sheetTitle}>{editing ? t("settings.editCategory") : t("settings.addCategory")}</Text>
                </View>
                <ScrollView style={styles.categoryEditorScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryEditorContent}>
                  <Text style={styles.label}>{t("settings.categoryName")}</Text>
                  <TextInput value={name} onChangeText={(value) => setName(value.slice(0, 12))} placeholder={t("settings.categoryNamePlaceholder")} style={styles.input} />
                  <Text style={styles.label}>{t("settings.categoryIcon")}</Text>
                  <View style={styles.iconLine}>
                    <View style={styles.largeIcon}>{preview ? <Image source={preview} style={iconUri ? styles.previewPhoto : styles.previewIcon} /> : <Ionicons name="image-outline" size={23} color="#A7BBB5" />}</View>
                    <Pressable onPress={pickIcon} disabled={compressing} style={styles.photo}><Text style={styles.photoText}>{compressing ? t("settings.compressing") : t("settings.chooseFromPhotos")}</Text></Pressable>
                  </View>
                  <View style={styles.grid}>{systemIconChoices.map((icon) => <Pressable key={icon.id} onPress={() => { setSystemIconId(icon.id); setIconUri(undefined); }} style={[styles.icon, systemIconId === icon.id && !iconUri && styles.selected]}><Image source={getSystemIconImage(icon.id)} style={styles.image} /></Pressable>)}</View>
                  <View style={styles.actions}>
                    {editing ? <Pressable onPress={() => confirmDelete(editing)} style={styles.delete}><Text style={styles.deleteText}>{t("common.delete")}</Text></Pressable> : null}
                    <Pressable onPress={returnToCategoryList} style={styles.cancel}><Text>{t("common.cancel")}</Text></Pressable>
                    <Pressable onPress={save} style={styles.save}><Text style={styles.saveText}>{t("common.save")}</Text></Pressable>
                  </View>
                </ScrollView>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal visible={languageVisible} transparent animationType="slide" onRequestClose={() => setLanguageVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropDismiss} onPress={() => setLanguageVisible(false)} />
          <ScrollView style={styles.languageSheet} contentContainerStyle={styles.languageSheetContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>{languageCopy.title}</Text>
            <Text style={styles.sheetSubtitle}>{languageCopy.subtitle}</Text>
            {(["auto", "zh-CN", "zh-Hant", "en", "es", "fr", "pt-BR", "de", "it", "ja", "ko", "ru", "tr", "id"] as LanguageMode[]).map((mode) => (
              <Pressable key={mode} onPress={() => chooseLanguage(mode)} style={styles.languageOption}>
                <Text style={styles.name}>{mode === "auto" ? languageCopy.automatic : languageModeLabel(mode, locale)}</Text>
                <Ionicons name={languageMode === mode ? "checkmark-circle" : "ellipse-outline"} size={22} color={languageMode === mode ? "#1F7A70" : "#A4B5B0"} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={timePickerVisible} transparent animationType="slide" onRequestClose={() => setTimePickerVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropDismiss} onPress={() => setTimePickerVisible(false)} />
          <View style={styles.timeSheet}>
            <Text style={styles.sheetTitle}>{t("reminders.time")}</Text>
            <View style={styles.timePickerRow}>
              {(["hour", "minute"] as const).map((part) => (
                <View key={part} style={styles.timeWheel}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    snapToInterval={wheelItemHeight}
                    decelerationRate="fast"
                    contentOffset={{ x: 0, y: (part === "hour" ? draftReminderTime.hour : draftReminderTime.minute / 5) * wheelItemHeight }}
                    contentContainerStyle={styles.timeWheelContent}
                    onMomentumScrollEnd={(event) => selectReminderTime(part, Math.round(event.nativeEvent.contentOffset.y / wheelItemHeight))}
                    onScrollEndDrag={(event) => selectReminderTime(part, Math.round(event.nativeEvent.contentOffset.y / wheelItemHeight))}
                  >
                    {(part === "hour" ? reminderHours : reminderMinutes).map((value) => (
                      <View key={value} style={styles.wheelItem}>
                        <Text style={[styles.wheelValue, value === draftReminderTime[part] && styles.wheelValueSelected]}>{String(value).padStart(2, "0")}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View pointerEvents="none" style={styles.wheelSelection} />
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => setTimePickerVisible(false)} style={styles.cancel}><Text>{t("common.cancel")}</Text></Pressable>
              <Pressable onPress={saveReminderTime} style={styles.save}><Text style={styles.saveText}>{t("common.save")}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7FAF8" },
  content: { padding: space.page, paddingTop: 59, paddingBottom: 42 },
  header: {
    height: 42,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  back: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: "#EEF5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    ...typography.sectionTitle,
    fontSize: 20,
    lineHeight: 26,
    color: "#183B35",
  },
  titleWrap: { position: "absolute", left: 0, right: 0, height: 42, alignItems: "center", justifyContent: "center" },
  titleText: { fontSize: 19, fontWeight: "800", color: "#183B35" },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    color: "#183B35",
    marginTop: 28,
  },
  note: { fontSize: 14, color: "#7C918B", marginTop: 6, marginBottom: 22 },
  list: { backgroundColor: "#FFFFFF", borderRadius: radius.card, overflow: "hidden" },
  languageToggle: {
    marginTop: 12,
    minHeight: 70,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  languageContent: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.card,
    paddingHorizontal: 17,
  },
  categoryToggle: {
    marginTop: 12,
    minHeight: 70,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  categoryContent: { marginTop: 10 },
  row: {
    minHeight: 70,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderColor: "#EEF3F1",
  },
  remindersList: { marginTop: 12 },
  reminderBlock: { borderBottomWidth: 1, borderColor: "#EEF3F1" },
  reminderMain: { height: 70, paddingLeft: 17, flexDirection: "row", alignItems: "center" },
  reminderSwitchSlot: { width: 68, height: 70, marginRight: 8, alignItems: "center", justifyContent: "center" },
  reminderLongRow: { paddingLeft: 17, paddingRight: 0, gap: 0 },
  reminderDetails: { paddingHorizontal: 17, paddingTop: 12, paddingBottom: 17 },
  detailLabel: { ...typography.caption, fontWeight: "600", color: "#687E77", marginTop: 4, marginBottom: 7 },
  segment: { flexDirection: "row", gap: 8 },
  segmentButton: { flex: 1, minHeight: 44, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#F0F5F3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  segmentSelected: { backgroundColor: "#DDF1EB" },
  segmentText: { ...typography.label, color: "#31564E" },
  timeButton: { height: 48, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#F0F5F3", flexDirection: "row", alignItems: "center", gap: 9 },
  timeButtonText: { flex: 1, fontSize: 17, fontWeight: "800", color: "#294842", fontVariant: ["tabular-nums"] },
  permission: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: "#FFF7E6", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  permissionTitle: { ...typography.label, color: "#84651C" },
  permissionAction: { ...typography.label, color: "#1F7A70" },
  languageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  name: typography.cardTitle,
  meta: { ...typography.caption, color: "#728780", marginTop: 4 },
  add: {
    height: 56,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#BFDCD4",
    backgroundColor: "#EEF8F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
  addText: { ...typography.button, color: "#1F7A70" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,50,44,.3)",
    justifyContent: "flex-end",
  },
  backdropDismiss: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.page,
    paddingBottom: 38,
  },
  categorySheet: {
    height: "65%",
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: "hidden",
    padding: space.page,
    paddingBottom: 28,
  },
  categoryEditorScreen: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.page,
    paddingHorizontal: space.page,
    paddingBottom: space.page,
  },
  editorHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  editorBack: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF5F2", alignItems: "center", justifyContent: "center" },
  categoryEditorScroll: { flex: 1 },
  categoryEditorContent: { paddingBottom: 4 },
  categorySheetList: { flex: 1, marginTop: 4 },
  languageSheet: {
    maxHeight: "65%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  languageSheetContent: { padding: space.page, paddingBottom: 38 },
  timeSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 38 },
  timePickerRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 18 },
  timeWheel: { width: 104, height: 132, position: "relative", overflow: "hidden" },
  timeWheelContent: { paddingVertical: wheelItemHeight },
  wheelItem: { height: wheelItemHeight, alignItems: "center", justifyContent: "center" },
  wheelValue: { fontSize: 24, lineHeight: 30, fontWeight: "600", color: "#B5C4C0", fontVariant: ["tabular-nums"] },
  wheelValueSelected: { fontSize: 30, fontWeight: "800", color: "#183B35" },
  wheelSelection: { position: "absolute", top: wheelItemHeight, left: 0, right: 0, height: wheelItemHeight, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#DDE9E5", backgroundColor: "rgba(238,248,245,.38)" },
  sheetTitle: { ...typography.sectionTitle, fontSize: 20, lineHeight: 26, color: "#183B35" },
  sheetSubtitle: {
    fontSize: 13,
    color: "#80938E",
    marginTop: 5,
    marginBottom: 12,
  },
  languageOption: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    ...typography.label,
    marginTop: 17,
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: border.input,
    paddingHorizontal: 14,
    ...typography.body,
  },
  iconLine: { flexDirection: "row", gap: 14, alignItems: "center" },
  largeIcon: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: "#F4F8F6",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 42, height: 42, resizeMode: "contain" },
  previewIcon: { width: 36, height: 36, resizeMode: "contain" },
  previewPhoto: { width: "100%", height: "100%", resizeMode: "cover" },
  photo: { padding: 12, borderRadius: 10, backgroundColor: "#EEF8F5" },
  photoText: { color: "#1F7A70", fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  icon: {
    width: "18%",
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4ECE9",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { borderColor: "#1F7A70", backgroundColor: "#EAF6F2" },
  actions: { flexDirection: "row", gap: 9, marginTop: 24 },
  delete: { padding: 14, borderRadius: 13, backgroundColor: "#FFF0EF" },
  deleteText: { color: "#C85752", fontWeight: "800" },
  cancel: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: "#EEF5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  save: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: "#1F7A70",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { ...typography.button, color: "#FFFFFF" },
});
