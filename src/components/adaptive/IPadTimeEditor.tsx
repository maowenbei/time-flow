import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { border, typography } from '../../constants/design';
import { AdaptiveLayout } from '../../hooks/useAdaptiveLayout';

type Props = {
  layout: AdaptiveLayout;
  title: string;
  taskTitle: string;
  minutesLabel: string;
  value: string;
  error: string;
  clearLabel: string;
  backspaceLabel: string;
  cancelLabel: string;
  saveLabel: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

/** No native text input: this editor never requests an iPadOS keyboard. */
export function IPadTimeEditor(props: Props) {
  const { layout, value, onChange } = props;
  const [replaceValue, setReplaceValue] = useState(true);
  const keyHeight = Math.max(36, Math.min(54, Math.floor(layout.height * 0.065)));
  const digit = (key: string) => {
    onChange(replaceValue || value === '0' ? key : value + key);
    setReplaceValue(false);
  };
  const clear = () => { onChange(''); setReplaceValue(false); };
  const backspace = () => { onChange(replaceValue ? '' : value.slice(0, -1)); setReplaceValue(false); };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.body} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: layout.insets.top + 16, paddingBottom: 16, paddingLeft: layout.insets.left + 16, paddingRight: layout.insets.right + 16 }}>
        <Pressable accessible={false} onPress={props.onCancel} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.task} numberOfLines={1}>{props.taskTitle}</Text>
          <Text style={styles.label}>{props.minutesLabel}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={props.minutesLabel} accessibilityValue={{ text: value }} onPress={() => setReplaceValue(true)} style={styles.display}>
            <Text style={[styles.value, replaceValue && value.length > 0 && styles.selected]}>{value || '—'}</Text>
          </Pressable>
          {props.error ? <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={props.onCancel} style={[styles.action, styles.cancel]}><Text style={styles.cancelText}>{props.cancelLabel}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!value.length} onPress={props.onSave} style={[styles.action, styles.save, !value.length && styles.disabled]}><Text style={styles.saveText}>{props.saveLabel}</Text></Pressable>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.keyboard, { paddingBottom: layout.insets.bottom + 12, paddingLeft: layout.insets.left + 16, paddingRight: layout.insets.right + 16 }]}>
        <View style={styles.keys}>
          {['123', '456', '789'].map(row => (
            <View key={row} style={styles.row}>
              {row.split('').map(key => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key} onPress={() => digit(key)} style={({ pressed }) => [styles.key, { height: keyHeight }, pressed && styles.pressed]}><Text style={styles.digit}>{key}</Text></Pressable>)}
            </View>
          ))}
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={props.clearLabel} onPress={clear} style={({ pressed }) => [styles.key, styles.utility, { height: keyHeight }, pressed && styles.pressed]}><Text style={styles.utilityText}>{props.clearLabel}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="0" onPress={() => digit('0')} style={({ pressed }) => [styles.key, { height: keyHeight }, pressed && styles.pressed]}><Text style={styles.digit}>0</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={props.backspaceLabel} onPress={backspace} style={({ pressed }) => [styles.key, styles.utility, { height: keyHeight }, pressed && styles.pressed]}><Ionicons name="backspace-outline" size={24} color="#31564E" /></Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(20,50,44,.28)' },
  body: { flex: 1, minHeight: 0 },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 },
  title: { ...typography.sectionTitle, fontSize: 20, lineHeight: 26 },
  task: { ...typography.body, color: '#718681', marginTop: 5, marginBottom: 20 },
  label: { ...typography.label, marginBottom: 7 },
  display: { minHeight: 48, borderWidth: 1, borderColor: border.input, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9, alignItems: 'flex-start', justifyContent: 'center' },
  value: { ...typography.body, fontSize: 22, lineHeight: 28, color: '#183B35', fontVariant: ['tabular-nums'] },
  selected: { backgroundColor: '#DDF1EB' },
  error: { ...typography.caption, color: '#C85752', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  action: { flex: 1, minHeight: 46, padding: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancel: { backgroundColor: '#EEF5F2' },
  save: { backgroundColor: '#1F7A70' },
  disabled: { backgroundColor: '#A6BBB5' },
  cancelText: { ...typography.button, color: '#527069' },
  saveText: { ...typography.button, color: '#FFFFFF' },
  keyboard: { backgroundColor: '#E7ECEB', paddingTop: 12, borderTopWidth: 1, borderTopColor: border.subtle },
  keys: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  utility: { backgroundColor: '#D9E3DF' },
  pressed: { backgroundColor: '#BDDBD1' },
  digit: { ...typography.body, fontSize: 26, lineHeight: 32, color: '#183B35' },
  utilityText: { ...typography.button, color: '#31564E' },
});
