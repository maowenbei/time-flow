import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useAdaptiveLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableWidth = Math.max(0, width - insets.left - insets.right);
  const mode = availableWidth >= 1040 ? 'wide' : availableWidth >= 600 ? 'comfortable' : 'compact';
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  // Layout is chosen by space; the platform gate preserves Android and Web.
  const enabled = Platform.OS === 'ios' && (isPad || mode !== 'compact');
  return {
    enabled, isPad, mode, insets, width, height, availableWidth,
    wide: enabled && mode === 'wide',
    margin: mode === 'compact' ? 16 : 32,
    maxWidth: mode === 'wide' ? 1200 : 720,
  };
}

export type AdaptiveLayout = ReturnType<typeof useAdaptiveLayout>;
