import { useAdaptiveLayout } from '../../src/hooks/useAdaptiveLayout';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { colors } from '../../src/constants/colors';
import { border, typography } from '../../src/constants/design';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { today: 'time-outline', history: 'albums-outline', stats: 'bar-chart-outline' };
export default function TabsLayout() {
  const layout = useAdaptiveLayout();
  const { t } = useI18n();
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, ...(layout.isPad ? { tabBarLabelPosition: 'below-icon' as const } : {}), tabBarStyle: { height: layout.isPad ? 56 + layout.insets.bottom : 76, paddingTop: 8, backgroundColor: '#FFFFFF', borderTopColor: border.subtle, ...(layout.isPad ? { paddingBottom: layout.insets.bottom } : {}) }, tabBarLabelStyle: typography.tab, tabBarIcon: ({ focused, size }) => <Ionicons name={icons[route.name]} color={focused ? colors.primary : colors.textMuted} size={size} /> })}>
    <Tabs.Screen name="today" options={{ title: t('tabs.today') }} /><Tabs.Screen name="history" options={{ title: t('tabs.history') }} /><Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
  </Tabs>;
}



