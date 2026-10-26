import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { border, typography } from '../../constants/design';

type Props = {
  leftTitle?: string;
  rightTitle?: string;
  left: ReactNode;
  right: ReactNode;
  scroll?: 'page' | 'internal';
  leftFramed?: boolean;
  rightFramed?: boolean;
};

/** Shared column proportions, with decoration only where the content needs it. */
export function AdaptiveSplitPanels({ leftTitle, rightTitle, left, right, scroll = 'page', leftFramed = false, rightFramed = false }: Props) {
  const internal = scroll === 'internal';
  return (
    <View style={[styles.columns, internal && styles.fill]}>
      <View style={[styles.left, internal && styles.stretch, rightFramed && !leftFramed && styles.leftHeadingInset]}>
        <View style={[leftFramed && styles.frame, internal && styles.fill]}>
          {leftTitle ? <View style={styles.heading}><Text style={styles.title}>{leftTitle}</Text></View> : null}
          {internal ? <ScrollView style={styles.fill} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{left}</ScrollView> : left}
        </View>
      </View>
      <View style={[styles.right, internal && styles.stretch]}>
        <View style={[rightFramed && styles.frame, internal && styles.fill]}>
          {rightTitle ? <View style={styles.heading}><Text style={styles.title}>{rightTitle}</Text></View> : null}
          {internal ? <ScrollView style={styles.fill} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{right}</ScrollView> : right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  fill: { flex: 1, minHeight: 0 },
  stretch: { alignSelf: 'stretch', minHeight: 0 },
  leftHeadingInset: { paddingTop: 20 },
  left: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  right: { flexGrow: 3, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  frame: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: border.subtle, backgroundColor: '#FFFFFF' },
  heading: { minHeight: 40, justifyContent: 'center', marginBottom: 12 },
  title: { ...typography.sectionTitle, fontSize: 17, lineHeight: 24 },
  scrollContent: { paddingBottom: 12 },
});
