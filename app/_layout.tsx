import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TimerProvider } from '../src/state/TimerContext';
import { I18nProvider } from '../src/i18n';

export default function Layout() {
  return <I18nProvider><TimerProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></TimerProvider></I18nProvider>;
}
