import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { border } from '../../constants/design';

export function AdaptiveTaskGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { padding: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, borderColor: border.subtle, backgroundColor: '#FFFFFF' },
});
