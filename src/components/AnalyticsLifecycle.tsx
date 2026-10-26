import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '../i18n';
import { setAnalyticsLocale, track } from '../services/analytics';

// Module scope survives React Strict Mode effect replays, not a new JS process.
let opened = false;
let wasBackgrounded = AppState.currentState === 'background';

export function AnalyticsLifecycle() {
  const { locale } = useI18n();
  useEffect(() => { setAnalyticsLocale(locale); }, [locale]);
  useEffect(() => {
    const onState = (state: string) => {
      if (state === 'background') wasBackgrounded = true;
      if (state !== 'active') return;
      if (!opened) {
        opened = true;
        track('app_open', { entry_source: 'cold_start' });
      } else if (wasBackgrounded) {
        track('app_open', { entry_source: 'foreground' });
      }
      wasBackgrounded = false;
    };
    onState(AppState.currentState);
    const subscription = AppState.addEventListener('change', onState);
    return () => subscription.remove();
  }, []);
  return null;
}
