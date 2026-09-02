import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type DismissibleHintProps = {
  children: ReactNode;
  dismissLabel: string;
  onDismiss: () => void;
  title?: string;
};

export function DismissibleHint({ children, dismissLabel, onDismiss, title }: DismissibleHintProps) {
  return <View style={styles.notice} accessibilityRole="summary">
    <View style={styles.copy}>{title ? <Text style={styles.title}>{title}</Text> : null}<Text style={styles.text}>{children}</Text></View>
    <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={dismissLabel} style={styles.close}>
      <Ionicons name="close" size={18} color="#6E8880" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  notice:{marginTop:18,padding:17,paddingRight:10,borderRadius:20,backgroundColor:'#EEF5F2',flexDirection:'row',alignItems:'flex-start',gap:8},
  copy:{flex:1,minWidth:0}, title:{fontSize:15,fontWeight:'800',color:'#46655E'}, text:{fontSize:13,lineHeight:20,color:'#718983',marginTop:3},
  close:{width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',marginTop:-3},
});
