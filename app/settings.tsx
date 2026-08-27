import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TaskTagIcon } from '../src/components/TaskTagIcon';
import { getSystemIconImage, systemIconChoices, TaskTag, uncategorizedTagId } from '../src/constants/taskTags';
import { useTimer } from '../src/state/TimerContext';

export default function Settings() {
  const router = useRouter();
  const timer = useTimer();
  const [editing, setEditing] = useState<TaskTag | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [iconUri, setIconUri] = useState<string | undefined>();
  const [systemIconId, setSystemIconId] = useState<string | undefined>();
  const [compressing, setCompressing] = useState(false);

  const closeEditor = () => {
    setEditing(null); setIsAdding(false); setName(''); setIconUri(undefined); setSystemIconId(undefined);
  };
  const openEditor = (category: TaskTag) => {
    if (category.id === uncategorizedTagId) return;
    setEditing(category); setName(category.label); setIconUri(category.iconUri);
    setSystemIconId(category.systemIconId ?? (systemIconChoices.some(icon => icon.id === category.id) ? category.id : undefined));
  };
  const openCreator = () => {
    setEditing(null); setIsAdding(true); setName(''); setIconUri(undefined); setSystemIconId(undefined);
  };
  const pickIcon = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '允许访问相册后才能选择分类图标。');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (picked.canceled) return;
    setCompressing(true);
    try {
      const image = await ImageManipulator.manipulateAsync(picked.assets[0].uri, [{ resize: { width: 128 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (image.base64) setIconUri(`data:image/jpeg;base64,${image.base64}`);
    } catch {
      Alert.alert('图标处理失败', '请换一张图片后重试。');
    } finally {
      setCompressing(false);
    }
  };
  const selectSystemIcon = (id: string) => {
    setSystemIconId(id);
    setIconUri(undefined);
  };
  const save = () => {
    if (!name.trim()) return;
    if (editing) timer.updateCategory(editing.id, name, iconUri, systemIconId);
    else timer.addCategory(name, iconUri, systemIconId);
    closeEditor();
  };
  const confirmDelete = (category: TaskTag) => {
    const affected = timer.tasks.filter(task => task.tagId === category.id).length;
    Alert.alert(`删除“${category.label}”`, affected ? `${affected} 个任务将转为未分类，任务和计时不会删除。` : '此操作不会影响任何任务。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { timer.deleteCategory(category.id); closeEditor(); } },
    ]);
  };
  const editorVisible = Boolean(editing || isAdding);
  const previewSource = iconUri ? { uri: iconUri } : getSystemIconImage(systemIconId);

  return <>
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="返回"><Ionicons name="chevron-back" size={23} color="#31564E" /></Pressable>
        <Text style={styles.title}>设置</Text><View style={styles.headerSpacer} />
      </View>
      <Text style={styles.sectionTitle}>分类管理</Text>
      <Text style={styles.sectionNote}>分类会用于任务列表和时间统计。</Text>
      <View style={styles.categoryList}>
        {timer.categories.map(category => <Pressable key={category.id} onPress={() => openEditor(category)} disabled={category.id === uncategorizedTagId} style={[styles.categoryRow, category.id === uncategorizedTagId && styles.categoryRowLocked]}>
          <TaskTagIcon tagId={category.id} size={36} />
          <View style={styles.categoryText}><Text style={styles.categoryName}>{category.label}</Text><Text style={styles.categoryMeta}>{category.id === uncategorizedTagId ? '系统默认分类，不可修改或删除' : `${timer.tasks.filter(task => task.tagId === category.id).length} 个任务`}</Text></View>
          {category.id === uncategorizedTagId ? <Ionicons name="lock-closed-outline" size={17} color="#A4B5B0" /> : <Ionicons name="chevron-forward" size={19} color="#8AA09A" />}
        </Pressable>)}
      </View>
      <Pressable onPress={openCreator} style={styles.addCategory}><Ionicons name="add" size={20} color="#1F7A70" /><Text style={styles.addCategoryText}>添加分类</Text></Pressable>
    </ScrollView>
    <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={closeEditor}>
      <Pressable style={styles.backdrop} onPress={closeEditor}>
        <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editing ? '编辑分类' : '添加分类'}</Text>
          <Text style={styles.inputLabel}>分类名称</Text>
          <TextInput value={name} onChangeText={value => setName(value.slice(0, 12))} placeholder="例如：阅读" placeholderTextColor="#9AA9A5" style={styles.nameInput} maxLength={12} />
          <Text style={styles.inputLabel}>分类图标</Text>
          <View style={styles.iconEditor}>
            <View style={styles.largeIcon}>{previewSource ? <Image source={previewSource} style={styles.customImage} resizeMode="contain" /> : <View style={styles.emptyIcon}><View style={styles.emptyDot} /></View>}</View>
            <View style={styles.iconActions}>
              <Pressable onPress={pickIcon} disabled={compressing} style={styles.iconAction}><Ionicons name="images-outline" size={17} color="#1F7A70" /><Text style={styles.iconActionText}>{compressing ? '正在压缩…' : '从相册选择'}</Text></Pressable>
              {iconUri || systemIconId ? <Pressable onPress={() => { setIconUri(undefined); setSystemIconId(undefined); }} style={styles.clearIcon}><Text style={styles.clearIconText}>移除图标</Text></Pressable> : null}
            </View>
          </View>
          <Text style={styles.inputLabel}>系统图标</Text>
          <View style={styles.iconGrid}>
            {systemIconChoices.map(icon => {
              const selected = systemIconId === icon.id && !iconUri;
              return <Pressable key={icon.id} onPress={() => selectSystemIcon(icon.id)} style={[styles.systemIcon, selected && styles.systemIconSelected]}>
                <Image source={getSystemIconImage(icon.id)} style={styles.systemIconImage} resizeMode="contain" />
              </Pressable>;
            })}
          </View>
          <Text style={styles.help}>相册图片会裁切为正方形，并压缩为 128px 小图后仅保存在本机。</Text>
          <View style={styles.actions}>
            {editing ? <Pressable onPress={() => confirmDelete(editing)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>删除</Text></Pressable> : null}
            <Pressable onPress={closeEditor} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable>
            <Pressable onPress={save} disabled={!name.trim() || compressing} style={[styles.save, (!name.trim() || compressing) && styles.saveDisabled]}><Text style={styles.saveText}>保存</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 22, paddingTop: 59, paddingBottom: 42 }, header: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#EEF5F2', alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 19, fontWeight: '800', color: '#183B35' }, headerSpacer: { width: 39 }, sectionTitle: { fontSize: 26, fontWeight: '800', color: '#183B35', marginTop: 28 }, sectionNote: { fontSize: 14, color: '#7C918B', marginTop: 6, marginBottom: 22 }, categoryList: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E8EFEC', overflow: 'hidden' }, categoryRow: { minHeight: 70, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: '#EEF3F1' }, categoryRowLocked: { backgroundColor: '#FBFCFC' }, categoryText: { flex: 1 }, categoryName: { fontSize: 15, fontWeight: '700', color: '#294842' }, categoryMeta: { fontSize: 12, color: '#82958F', marginTop: 4 }, addCategory: { height: 56, borderRadius: 17, borderWidth: 1, borderColor: '#BFDCD4', backgroundColor: '#EEF8F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 }, addCategoryText: { fontSize: 15, fontWeight: '800', color: '#1F7A70' }, backdrop: { flex: 1, backgroundColor: 'rgba(20,50,44,.3)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 38 }, handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#D8E3DF', alignSelf: 'center', marginBottom: 18 }, sheetTitle: { fontSize: 20, fontWeight: '800', color: '#183B35' }, inputLabel: { fontSize: 13, fontWeight: '700', color: '#526C65', marginTop: 17, marginBottom: 7 }, nameInput: { height: 48, borderRadius: 13, borderWidth: 1, borderColor: '#DDE9E5', paddingHorizontal: 14, fontSize: 16, color: '#183B35' }, iconEditor: { flexDirection: 'row', alignItems: 'center', gap: 14 }, largeIcon: { width: 66, height: 66, borderRadius: 18, backgroundColor: '#F4F8F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, customImage: { width: 58, height: 58, borderRadius: 15 }, emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EEF4F2', alignItems: 'center', justifyContent: 'center' }, emptyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#AABCB7' }, iconActions: { gap: 8, flex: 1 }, iconAction: { height: 35, borderRadius: 10, backgroundColor: '#EEF8F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, iconActionText: { fontSize: 13, fontWeight: '700', color: '#1F7A70' }, clearIcon: { height: 28, alignItems: 'center', justifyContent: 'center' }, clearIconText: { fontSize: 12, fontWeight: '700', color: '#738A84' }, iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, systemIcon: { width: '18.3%', height: 54, borderRadius: 12, borderWidth: 1, borderColor: '#E4ECE9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFDFC' }, systemIconSelected: { borderColor: '#1F7A70', backgroundColor: '#EAF6F2' }, systemIconImage: { width: 38, height: 38 }, help: { fontSize: 12, lineHeight: 18, color: '#899B96', marginTop: 10 }, actions: { flexDirection: 'row', gap: 9, marginTop: 24 }, deleteButton: { height: 46, paddingHorizontal: 15, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EF' }, deleteButtonText: { fontSize: 14, fontWeight: '800', color: '#C85752' }, cancel: { flex: 1, height: 46, borderRadius: 13, backgroundColor: '#EEF5F2', alignItems: 'center', justifyContent: 'center' }, cancelText: { fontWeight: '700', color: '#527069' }, save: { flex: 1, height: 46, borderRadius: 13, backgroundColor: '#1F7A70', alignItems: 'center', justifyContent: 'center' }, saveDisabled: { backgroundColor: '#A6BBB5' }, saveText: { fontWeight: '700', color: '#FFF' },
});
