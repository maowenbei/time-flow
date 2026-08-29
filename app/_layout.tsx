import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TimerProvider } from '../src/state/TimerContext';
import { I18nProvider } from '../src/i18n';

export default function Layout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><I18nProvider><TimerProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></TimerProvider></I18nProvider></GestureHandlerRootView>;
}
