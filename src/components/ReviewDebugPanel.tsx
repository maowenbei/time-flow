import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { isReviewDebugEnabled, requestReviewForDebug, setReviewDebugEnabled } from '../services/storeReview';
import { useTimer } from '../state/TimerContext';
import { REQUIRED_DAYS } from '../services/reviewUsage';

export function ReviewDebugPanel() {
  const timer = useTimer();
  const [armed, setArmed] = useState(isReviewDebugEnabled);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  if (!__DEV__) return null;

  const simulate = () => {
    setReviewDebugEnabled(true);
    setArmed(true);
    setMessage(`已模拟满足 ${REQUIRED_DAYS} 天条件。返回今日，完成任意一个正在计时或已暂停的任务，停留约 600 毫秒。`);
  };
  const direct = async () => {
    const result = await requestReviewForDebug(() => mounted.current && AppState.currentState === 'active');
    if (!mounted.current) return;
    setMessage({
      requested: '已调用系统评分 API。是否展示由系统决定，请在 iOS 开发包中验证。',
      unavailable: '当前环境不支持评分请求，请使用 iOS Development Build；TestFlight 不展示评分弹窗。',
      cancelled: '请求已取消或正在请求中。',
      failed: '系统评分请求失败，请检查原生模块并重试。',
    }[result]);
  };
  return <>
    <Text style={styles.section}>App Store 评分测试</Text>
    <View style={styles.card}>
      <Text style={styles.title}>实际使用天数：{timer.usageDays.length} / {REQUIRED_DAYS}</Text>
      <Text style={styles.copy}>仅开发模式可用。模拟条件只在本次运行中有效，不改使用天数，不读写正式邀请记录，也不上报评分事件。</Text>
      <Text style={styles.copy}>{armed ? '已开启完成任务模拟；可再次点击重新开启。' : '完成任务模拟未开启。'}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={simulate}><Text style={styles.buttonText}>模拟满足 {REQUIRED_DAYS} 天，完成任务后触发</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.button} onPress={direct}><Text style={styles.buttonText}>直接测试系统评分弹窗</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.reset} onPress={() => {
        setReviewDebugEnabled(false); setArmed(false); setMessage('已关闭模拟条件，待执行的模拟请求会取消。');
      }}><Text style={styles.resetText}>关闭评分模拟</Text></Pressable>
      {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
    </View>
  </>;
}

const styles = StyleSheet.create({
  section: { marginTop: 27, marginBottom: 10, fontSize: 17, fontWeight: '800', color: '#31564E' },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#FFF', marginBottom: 10 },
  title: { color: '#294842', fontSize: 15, fontWeight: '800' },
  copy: { color: '#526C65', marginTop: 8, lineHeight: 19 },
  button: { marginTop: 14, borderRadius: 11, paddingVertical: 11, alignItems: 'center', backgroundColor: '#1F7A70' },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  reset: { marginTop: 14, paddingVertical: 11, alignItems: 'center' },
  resetText: { color: '#1F7A70', fontWeight: '800', fontSize: 13 },
});
