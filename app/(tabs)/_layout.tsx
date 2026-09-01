import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { colors } from '../../src/constants/colors';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { today: 'time-outline', history: 'albums-outline', stats: 'bar-chart-outline' };
export default function TabsLayout() {
  const { t } = useI18n();
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: '#7C918B', tabBarStyle: { height: 76, paddingTop: 8, backgroundColor: '#FFFFFF', borderTopColor: '#E6EEEB' }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} color={color} size={size} /> })}>
    <Tabs.Screen name="today" options={{ title: t('tabs.today') }} /><Tabs.Screen name="history" options={{ title: t('tabs.history') }} /><Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
  </Tabs>;
}




