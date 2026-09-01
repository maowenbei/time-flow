import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { colors } from '../constants/colors';
const DELETE_WIDTH = 104;

type SwipeDeleteProps = {
  actionVariant?: 'regular' | 'compact';
  children: ReactNode;
  cornerRadius?: number;
  enabled?: boolean;
  label: string;
  onDelete: () => void;
};

export function SwipeDelete({ actionVariant = 'regular', children, cornerRadius = 22, enabled = true, label, onDelete }: SwipeDeleteProps) {
  const swipeable = useRef<SwipeableMethods | null>(null);
  const deleteTask = () => { swipeable.current?.close(); onDelete(); };
  const compact = actionVariant === 'compact';
  const actions = () => <View style={[styles.rail, { borderTopRightRadius: cornerRadius, borderBottomRightRadius: cornerRadius }]}><Pressable onPress={deleteTask} accessibilityRole="button" accessibilityLabel={label} style={styles.action}><Ionicons name="trash-outline" size={compact ? 17 : 20} color="#BD514D" /><Text style={[styles.label, compact ? styles.labelCompact : styles.labelRegular]}>{label}</Text></Pressable></View>;

  return <ReanimatedSwipeable ref={swipeable} enabled={enabled} renderRightActions={actions} rightThreshold={DELETE_WIDTH / 2} dragOffsetFromRightEdge={8} friction={1.8} overshootRight={false} containerStyle={[styles.shell, { borderRadius: cornerRadius }]}>{children}</ReanimatedSwipeable>;
}

const styles = StyleSheet.create({
  shell:{overflow:'hidden'},
  rail:{width:DELETE_WIDTH,backgroundColor:'colors.surface3F2',alignItems:'center',justifyContent:'center',paddingHorizontal:8},
  action:{width:'100%',height:48,borderRadius:17,backgroundColor:'#FCE2E0',borderWidth:1,borderColor:'#F4C9C6',alignItems:'center',justifyContent:'center',gap:5},
  label:{fontWeight:'800',color:'#BD514D'},labelRegular:{fontSize:14},labelCompact:{fontSize:12},
});


