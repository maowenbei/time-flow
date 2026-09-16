import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { space, typography } from '../constants/design';

type DismissibleHintProps = {
  children: ReactNode;
  dismissLabel: string;
  onDismiss: () => void;
  title?: string;
};

export function DismissibleHint({ children, dismissLabel, onDismiss, title }: DismissibleHintProps) {
  return <View style={styles.notice} accessibilityRole="summary">
    <Ionicons name="bulb-outline" size={15} color="#87A19A" style={styles.icon} />
    <View style={styles.copy}>{title ? <Text style={styles.title}>{title}</Text> : null}<Text style={styles.text}>{children}</Text></View>
    <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={dismissLabel} style={styles.close}>
      <Ionicons name="close" size={18} color="#6E8880" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  notice:{marginTop:18,paddingVertical:5,paddingRight:4,flexDirection:'row',alignItems:'flex-start',gap:space.xs},
  icon:{marginTop:2},
  copy:{flexShrink:1,minWidth:0}, title:{...typography.label,color:'#58736B'}, text:{...typography.caption,color:'#81948E',marginTop:2},
  close:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:-3},
});
