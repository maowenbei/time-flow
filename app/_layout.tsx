import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TimerProvider } from '../src/state/TimerContext';
import { I18nProvider } from '../src/i18n';
import { AnalyticsLifecycle } from '../src/components/AnalyticsLifecycle';

export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><I18nProvider><AnalyticsLifecycle /><TimerProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></TimerProvider></I18nProvider></GestureHandlerRootView>;
}
