import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { allowsTightening, fixedSize, font, foregroundStyle, frame, layoutPriority, lineLimit, minimumScaleFactor, monospacedDigit, padding, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { isRunningInExpoGo } from 'expo';
import type { LiveActivityFactory } from 'expo-widgets';

export type ThreadFlowActivityProps = {
  taskLabel: string;
  tasksInProgressLabel: string;
  taskCount: number;
  startedAt: string;
  tasks: Array<{ id: string; title: string; actualDuration: string }>;
};

const ThreadFlowActivity = (props: ThreadFlowActivityProps) => {
  'widget';
  const Timer = ({ startedAt }: Pick<ThreadFlowActivityProps, 'startedAt'>) => (
    <Text timerInterval={{ lower: new Date(startedAt), upper: new Date('2100-01-01') }} countsDown={false} modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#8ACFC3'), lineLimit(1), minimumScaleFactor(0.8), frame({ width: 68, alignment: 'trailing' })]} />
  );
  const ActivitySummary = () => props.taskCount === 1
    ? <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle('#F2F2F2'), lineLimit(1), truncationMode('tail'), allowsTightening(true), layoutPriority(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{props.taskLabel}</Text>
    : <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle('#F2F2F2'), lineLimit(1), truncationMode('tail'), allowsTightening(true), layoutPriority(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{props.tasksInProgressLabel}</Text>;
  const ExpandedTitle = () => <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle('#F2F2F2'), lineLimit(1), truncationMode('tail'), allowsTightening(true), layoutPriority(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{props.taskCount === 1 ? props.taskLabel : props.tasksInProgressLabel}</Text>;
  const TaskRow = ({ task }: { task: ThreadFlowActivityProps['tasks'][number] }) => <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ weight: 'medium' }), foregroundStyle('#F2F2F2'), lineLimit(1), truncationMode('tail'), allowsTightening(true), layoutPriority(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{task.title}</Text><Text modifiers={[font({ design: 'monospaced', weight: 'medium' }), monospacedDigit(), foregroundStyle('#E0E0E0'), lineLimit(1), fixedSize({ horizontal: true, vertical: false }), frame({ minWidth: 64, alignment: 'trailing' })]}>{task.actualDuration}</Text></HStack>;
  const Header = () => <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><ActivitySummary /><Timer startedAt={props.startedAt} /></HStack>;
  return {
    banner: <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 12 })]}><Header />{props.tasks.map(task => <TaskRow key={task.id} task={task} />)}</VStack>,
    compactLeading: <ActivitySummary />,
    compactTrailing: <Timer startedAt={props.startedAt} />,
    minimal: <Timer startedAt={props.startedAt} />,
    expandedLeading: <VStack alignment="leading" spacing={3} modifiers={[padding({ horizontal: 12, top: 12 })]}><ExpandedTitle /></VStack>,
    expandedTrailing: <VStack alignment="trailing" spacing={3} modifiers={[padding({ horizontal: 12, top: 12 })]}><Timer startedAt={props.startedAt} /></VStack>,
    expandedBottom: <VStack alignment="leading" spacing={8} modifiers={[padding({ horizontal: 12, top: 8, bottom: 12 })]}>{props.tasks.map(task => <TaskRow key={task.id} task={task} />)}</VStack>,
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
