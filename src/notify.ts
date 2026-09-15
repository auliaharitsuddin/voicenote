import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Event } from './api';

const PLATFORM_LABEL: Record<Event['platform'], string> = { zoom: 'Zoom', teams: 'Teams', gmeet: 'Google Meet', other: 'Meeting' };

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return false;
    return (Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()) === 'granted';
  }
  const cur = await Notifications.getPermissionsAsync();
  const st = cur.granted ? cur : await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Pengingat meeting', importance: Notifications.AndroidImportance.MAX, sound: 'default' });
  }
  return st.granted;
}

// ponytail: web timers only fire while the tab is open; a service worker would be the upgrade if web-background alarms matter.
const webTimers: ReturnType<typeof setTimeout>[] = [];

/** Replace every scheduled reminder with the given upcoming events. Idempotent by design. */
export async function scheduleAll(events: Event[], remindMin: number): Promise<number> {
  const now = Date.now();
  const upcoming = events
    .map((e) => ({ e, fireAt: new Date(e.starts_at).getTime() - remindMin * 60_000 }))
    .filter(({ fireAt }) => fireAt > now + 5_000)
    .slice(0, 60);
  const body = (e: Event) => `${PLATFORM_LABEL[e.platform]} mulai ${remindMin} menit lagi`;

  if (Platform.OS === 'web') {
    webTimers.splice(0).forEach(clearTimeout);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
    for (const { e, fireAt } of upcoming) {
      // setTimeout caps at ~24.8 days; skip anything beyond that
      if (fireAt - now > 2_000_000_000) continue;
      webTimers.push(setTimeout(() => new Notification(e.title, { body: body(e) }), fireAt - now));
    }
    return webTimers.length;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const { e, fireAt } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: e.title, body: body(e), data: { eventId: e.id, link: e.link } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'reminders' },
    });
  }
  return upcoming.length;
}
