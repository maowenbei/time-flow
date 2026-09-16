import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { isRunningInExpoGo } from 'expo';
import type { LiveActivityFactory, UserInteractionEvent } from 'expo-widgets';

export type ThreadFlowActivityProps = {
  appName: string;
  taskLabel: string;
  runningLabel: string;
  pauseLabel: string;
  taskCount: number;
  startedAt: string;
};

const ThreadFlowActivity = (props: ThreadFlowActivityProps) => {
  'widget';
  const Timer = ({ startedAt }: Pick<ThreadFlowActivityProps, 'startedAt'>) => (
    <Text timerInterval={{ lower: new Date(startedAt), upper: new Date('2100-01-01') }} countsDown={false} modifiers={[font({ weight: 'bold', design: 'rounded' })]} />
  );
  const taskSummary = props.taskCount === 1 ? props.taskLabel : `${props.runningLabel} ${props.taskCount}`;
  return {
    banner: <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 12 })]}><Text modifiers={[font({ weight: 'bold' }), foregroundStyle('#1F7A70')]}>{props.appName} · {props.runningLabel}</Text><Text>{taskSummary}</Text><Timer startedAt={props.startedAt} /><Button label={props.pauseLabel} target="pause-all" modifiers={[buttonStyle('borderedProminent')]} /></VStack>,
    compactLeading: <Text modifiers={[font({ weight: 'bold' }), foregroundStyle('#1F7A70')]}>{props.appName}</Text>,
    compactTrailing: <Timer startedAt={props.startedAt} />,
    minimal: <Text>⏸</Text>,
    expandedLeading: <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 12 })]}><Text modifiers={[font({ weight: 'bold' }), foregroundStyle('#1F7A70')]}>{props.appName}</Text><Text>{taskSummary}</Text></VStack>,
    expandedTrailing: <VStack alignment="trailing" spacing={4} modifiers={[padding({ all: 12 })]}><Timer startedAt={props.startedAt} /><Text>{props.runningLabel}</Text></VStack>,
    expandedBottom: <HStack spacing={10} modifiers={[padding({ all: 12 })]}><Text>{props.taskCount === 1 ? props.taskLabel : `${props.taskCount} ${props.runningLabel}`}</Text><Button label={props.pauseLabel} target="pause-all" modifiers={[buttonStyle('borderedProminent')]} /></HStack>,
  };
};

type ExpoWidgets = typeof import('expo-widgets');

let liveActivity: LiveActivityFactory<ThreadFlowActivityProps> | null | undefined;
let expoWidgets: ExpoWidgets | null | undefined;

/**
 * Expo Go does not ship the ExpoWidgets native module. Loading it lazily keeps
 * the rest of the app usable there, while preserving Live Activities in an
 * iOS development or production build that includes the module.
 */
function getExpoWidgets(): ExpoWidgets | null {
  if (expoWidgets !== undefined) return expoWidgets;
  // Do not even resolve the package in Expo Go: its iOS entry point throws
  // while looking up the missing ExpoWidgets native module.
  if (isRunningInExpoGo()) {
    expoWidgets = null;
    return expoWidgets;
  }
  try {
    expoWidgets = require('expo-widgets') as ExpoWidgets;
  } catch {
    expoWidgets = null;
  }
  return expoWidgets;
}

export function getThreadFlowActivity(): LiveActivityFactory<ThreadFlowActivityProps> | null {
  if (liveActivity !== undefined) return liveActivity;
  const widgets = getExpoWidgets();
  liveActivity = widgets ? widgets.createLiveActivity<ThreadFlowActivityProps>('ThreadFlowActivity', ThreadFlowActivity) : null;
  return liveActivity;
}

export function addThreadFlowInteractionListener(listener: (event: UserInteractionEvent) => void) {
  return getExpoWidgets()?.addUserInteractionListener(listener);
}
