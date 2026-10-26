import { ReactNode } from 'react';
import { View } from 'react-native';
import { adaptiveStyles } from './AdaptivePageFrame';

export function StatsLayout({ wide, chart, details }: { wide: boolean; chart: ReactNode; details: ReactNode }) {
  return <View style={wide && adaptiveStyles.columns}>
    <View style={wide && adaptiveStyles.main}>{chart}</View>
    <View style={wide && adaptiveStyles.main}>{details}</View>
  </View>;
}
