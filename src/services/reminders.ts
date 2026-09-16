import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const KIND = 'threadflow-reminder';
type Copy = { startTitle: string; startBody: string; twoHourTitle: string; twoHourBody: string; threeHourTitle: string; threeHourBody: string };

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

async function cancel(kind: 'start' | 'long') {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(requests.filter(request => request.content.data?.[KIND] === kind).map(request => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

export async function notificationStatus() { return Notifications.getPermissionsAsync(); }
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('threadflow-reminders', { name: 'ThreadFlow reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: null });
  const current = await Notifications.getPermissionsAsync();
  return current.granted ? current : Notifications.requestPermissionsAsync();
}
export async function openNotificationSettings() { return Notifications.getPermissionsAsync(); }

export async function syncStartReminder(enabled: boolean, frequency: 'weekdays' | 'daily', hour: number, minute: number, copy: Copy) {
  await cancel('start');
  if (!enabled) return;
  const days = frequency === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];
  await Promise.all(days.map(weekday => Notifications.scheduleNotificationAsync({ content: { title: copy.startTitle, body: copy.startBody, data: { [KIND]: 'start' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId: 'threadflow-reminders' } as never })));
}

export async function syncLongReminders(enabled: boolean, hasRunningTasks: boolean, lastTaskActivityAt: number | undefined, copy: Copy) {
  await cancel('long');
  if (!enabled || !hasRunningTasks || !lastTaskActivityAt) return;
  const milestones = [{ hours: 2, title: copy.twoHourTitle, body: copy.twoHourBody }, { hours: 3, title: copy.threeHourTitle, body: copy.threeHourBody }];
  await Promise.all(milestones.map(({ hours, title, body }) => {
    const date = new Date(lastTaskActivityAt + hours * 60 * 60 * 1000);
    if (date.getTime() <= Date.now()) return Promise.resolve();
    return Notifications.scheduleNotificationAsync({ content: { title, body, data: { [KIND]: 'long', hours } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'threadflow-reminders' } as never });
  }));
}

/** Development-only convenience: verifies the system notification path without waiting. */
export async function scheduleDebugNotification(title: string, body: string, kind: 'start' | 'long', hours?: 2 | 3) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { [KIND]: kind, ...(hours ? { hours } : {}) } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 } as never,
  });
}
