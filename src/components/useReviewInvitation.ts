import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Keyboard } from 'react-native';
import { useTimer } from '../state/TimerContext';
import { isReviewEligible } from '../services/reviewUsage';
import { createReviewOpportunity, isReviewDebugEnabled } from '../services/storeReview';

export function useReviewInvitation(modalVisible: boolean) {
  const timer = useTimer();
  const focused = useRef(false);
  const latest = useRef({ timer, modalVisible });
  latest.current = { timer, modalVisible };
  const opportunity = useRef<ReturnType<typeof createReviewOpportunity> | null>(null);
  if (!opportunity.current) opportunity.current = createReviewOpportunity(() => {
    const { timer: current, modalVisible: modal } = latest.current;
    return current.ready && focused.current && !modal && AppState.currentState === 'active' && !Keyboard.isVisible()
      && !current.breakState && !current.tasks.some(task => task.status === 'running')
      && (isReviewDebugEnabled() || isReviewEligible(current.usageDays));
  });
  const previous = useRef<typeof timer.tasks | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; opportunity.current?.cancel(); };
  }, []));
  useEffect(() => {
    const cancel = () => opportunity.current?.cancel();
    const app = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    const keyboard = Keyboard.addListener('keyboardWillShow', cancel);
    const keyboardDid = Keyboard.addListener('keyboardDidShow', cancel);
    return () => { cancel(); app.remove(); keyboard.remove(); keyboardDid.remove(); };
  }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = timer.ready ? timer.tasks : null;
    if (!timer.ready || !focused.current || modalVisible || timer.breakState || timer.tasks.some(task => task.status === 'running')) {
      opportunity.current?.cancel();
      return;
    }
    // Hydration, history edits, and returning to a screen never create opportunities.
    const previouslyRunning = new Set(before?.filter(task => task.status === 'running').map(task => task.id));
    if (timer.tasks.some(task => task.status === 'completed' && previouslyRunning.has(task.id))) {
      opportunity.current?.arm();
    }
  }, [timer.ready, timer.tasks, timer.breakState, modalVisible]);
}
