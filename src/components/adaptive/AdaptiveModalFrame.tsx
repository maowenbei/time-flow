import { cloneElement, ReactElement } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { AdaptiveLayout } from '../../hooks/useAdaptiveLayout';

type Container = ReactElement<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;
type Props = {
  layout: AdaptiveLayout;
  legacyBackdrop: Container;
  children: Container;
  onDismiss?: () => void;
  // Sheets with their own scrolling need a bounded viewport, not another scroll view.
  internalScroll?: boolean;
};

export function AdaptiveModalFrame({ layout, legacyBackdrop, children, onDismiss, internalScroll }: Props) {
  if (!layout.isPad) return cloneElement(legacyBackdrop, {}, legacyBackdrop.props.children, children);
  const sheet = cloneElement(children, { style: [children.props.style, {
    width: '100%', borderRadius: 24, maxHeight: undefined,
    height: internalScroll ? '100%' : undefined,
  }] });
  return <KeyboardAvoidingView behavior="padding" style={{ flex: 1, paddingTop: layout.insets.top + 16, paddingBottom: layout.insets.bottom + 16, paddingLeft: layout.insets.left + 16, paddingRight: layout.insets.right + 16, backgroundColor: 'rgba(20,50,44,.28)' }}>
    <Pressable accessibilityLabel="Dismiss" accessible={false} onPress={onDismiss} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="box-none">
      {internalScroll ? <View style={{ width: '100%', maxWidth: 560, height: '85%', maxHeight: 720, borderRadius: 24, overflow: 'hidden' }}>{sheet}</View>
        : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ width: '100%', maxWidth: 560, flexGrow: 0, flexShrink: 1, borderRadius: 24 }} contentContainerStyle={{ flexGrow: 0 }}>{sheet}</ScrollView>}
    </View>
  </KeyboardAvoidingView>;
}
