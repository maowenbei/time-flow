import { ReactNode } from 'react';
import { View } from 'react-native';
import { AdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import { AdaptiveSplitPanels } from './AdaptiveSplitPanels';

export function HistoryLayout({ layout, header, dates, details, footer, datesTitle, recordsTitle }: { layout: AdaptiveLayout; header: ReactNode; dates: ReactNode; details: ReactNode; footer: ReactNode; datesTitle: string; recordsTitle: string }) {
  return <View style={{ flex: 1, backgroundColor: '#F7FAF8', paddingTop: layout.insets.top + 24, paddingBottom: layout.insets.bottom, paddingLeft: layout.insets.left, paddingRight: layout.insets.right }}>
    <View style={{ flex: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 32, paddingBottom: 24 }}>
      {header}
      <AdaptiveSplitPanels leftTitle={datesTitle} rightTitle={recordsTitle} left={dates} right={<>{details}{footer}</>} scroll="internal" leftFramed rightFramed />
    </View>
  </View>;
}
