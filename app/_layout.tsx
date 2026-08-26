import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TimerProvider } from '../src/state/TimerContext';

export default function Layout() {
  return <TimerProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></TimerProvider>;
}
