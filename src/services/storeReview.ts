import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { track } from './analytics';

const KEY = 'timeflow-review-request-v1';
let busy = false;
let consumed = false;
let debugArmed = false;
let debugBusy = false;
let debugGeneration = 0;

export function isReviewDebugEnabled(): boolean {
  return __DEV__ && debugArmed;
}

/** Session-only simulation; never modifies real usage days or invitation storage. */
export function setReviewDebugEnabled(enabled: boolean): void {
  if (!__DEV__) return;
  debugGeneration++;
  debugArmed = enabled;
}

export async function requestReviewForDebug(isStillSafe = () => true): Promise<'requested' | 'unavailable' | 'cancelled' | 'failed'> {
  if (!__DEV__ || Platform.OS !== 'ios') return 'unavailable';
  if (debugBusy || !isStillSafe()) return 'cancelled';
  debugBusy = true;
  try {
    if (!await StoreReview.isAvailableAsync()) return 'unavailable';
    if (!isStillSafe()) return 'cancelled';
    await StoreReview.requestReview();
    return 'requested';
  } catch {
    return 'failed';
  } finally {
    debugBusy = false;
  }
}

/** Recheck the live opportunity after every async boundary, including storage. */
export async function requestReviewSafely(isStillSafe: () => boolean): Promise<void> {
  if (__DEV__) {
    if (!debugArmed) return;
    const generation = debugGeneration;
    const valid = () => debugArmed && debugGeneration === generation && isStillSafe();
    const result = await requestReviewForDebug(valid);
    if (result === 'requested' && generation === debugGeneration) debugArmed = false;
    return;
  }
  if (Platform.OS !== 'ios' || __DEV__ || busy || consumed || !isStillSafe()) return;
  busy = true;
  try {
    if (await AsyncStorage.getItem(KEY)) { consumed = true; return; }
    if (!isStillSafe() || !await StoreReview.isAvailableAsync() || !isStillSafe()) return;
    await AsyncStorage.setItem(KEY, JSON.stringify({ requestedAt: Date.now() }));
    consumed = true;
    if (!isStillSafe()) {
      // No API invocation occurred. Restore eligibility for a new completion.
      await AsyncStorage.removeItem(KEY);
      consumed = false;
      return;
    }
    track('review_request_attempted');
    await StoreReview.requestReview();
  } catch {
    track('review_request_failed');
  } finally {
    busy = false;
  }
}

/** A cancelled opportunity stays cancelled even if the screen becomes safe again. */
export function createReviewOpportunity(isSafe: () => boolean, request = requestReviewSafely) {
  let generation = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { generation++; clearTimeout(timeout); timeout = undefined; };
  return {
    cancel,
    arm() {
      cancel();
      if (!isSafe()) return;
      const token = generation;
      timeout = setTimeout(() => {
        timeout = undefined;
        const valid = () => generation === token && isSafe();
        if (valid()) void request(valid);
      }, 600);
    },
  };
}
