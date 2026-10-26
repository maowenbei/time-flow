import { ReactNode } from 'react';
import { View } from 'react-native';
import { AdaptiveSplitPanels } from './AdaptiveSplitPanels';

export function TodayLayout({ wide, overview, tasks }: { wide: boolean; overview: ReactNode; tasks: ReactNode }) {
  if (wide) return <AdaptiveSplitPanels left={overview} right={tasks} />;
  return <View>
    <View>{overview}</View>
    <View>{tasks}</View>
  </View>;
}
