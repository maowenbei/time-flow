import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { today: 'time-outline', history: 'albums-outline', stats: 'bar-chart-outline' };
export default function TabsLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: '#1F7A70', tabBarInactiveTintColor: '#9AA6A2', tabBarStyle: { height: 76, paddingTop: 8, backgroundColor: '#FCFDFC', borderTopColor: '#E8EEEB' }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} color={color} size={size} /> })}>
    <Tabs.Screen name="today" options={{ title: '今天' }} /><Tabs.Screen name="history" options={{ title: '记录' }} /><Tabs.Screen name="stats" options={{ title: '统计' }} />
  </Tabs>;
}
