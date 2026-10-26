import { ReactNode } from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { AdaptiveLayout } from '../../hooks/useAdaptiveLayout';

type Props = ScrollViewProps & { layout: AdaptiveLayout; singleColumn?: boolean; children: ReactNode };

export function AdaptivePageFrame({ layout, singleColumn, children, contentContainerStyle, ...props }: Props) {
  if (!layout.enabled) return <ScrollView {...props} contentContainerStyle={contentContainerStyle}>{children}</ScrollView>;
  return <ScrollView {...props} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"} automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, paddingTop: layout.insets.top + 24, paddingBottom: layout.insets.bottom + 32, paddingLeft: layout.insets.left, paddingRight: layout.insets.right }}>
    <View style={{ width: '100%', maxWidth: singleColumn ? 720 : layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.margin }}>{children}</View>
  </ScrollView>;
}

export const adaptiveStyles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0 },
});
