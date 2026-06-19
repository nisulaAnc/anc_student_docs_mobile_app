import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, FlatList, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../components/TopBar';
import CardHeader from '../components/CardHeader';
import AlertBox from '../components/AlertBox';
import Button from '../components/Button';
import {
  getCounsellorTokenInfo, getPrograms, selectProgram,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

const PHASE = { LOAD: 0, PROGRAM: 1, DONE: 2, ERROR: 3 };

export default function CounsellorPortalScreen({ navigation, route }) {
  const { token } = route.params;
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const [phase, setPhase] = useState(PHASE.LOAD);
  const [data, setData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [selected, setSelected] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => { loadToken(); }, []);

  const loadToken = async () => {
    try {
      const res = await getCounsellorTokenInfo(token);
      setData(res.data.data);
      await loadPrograms();
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
      setPhase(PHASE.ERROR);
    }
  };

  const loadPrograms = async () => {
    setLoading(true); setAlert(null);
    try {
      const r = await getPrograms();
      setPrograms(r.data.data || []);
      setAlert(null);
      setPhase(PHASE.PROGRAM);
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || e.message });
    } finally { setLoading(false); }
  };

  const confirmProgram = async () => {
    if (!selected) { setAlert({ type: 'error', msg: 'Please select a programme.' }); return; }
    setLoading(true); setAlert(null);
    try {
      await selectProgram(token, selected);
      setPhase(PHASE.DONE);
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || e.message });
    } finally { setLoading(false); }
  };

  const InfoGrid = () => (
    <View style={styles.infoGrid}>
      <InfoItem label="CF Number" value={data?.cf_number} COLORS={COLORS} />
      <InfoItem label="Student" value={data?.student_name} COLORS={COLORS} />
      <InfoItem label="Email" value={data?.student_email} full COLORS={COLORS} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TopBar onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {alert ? <AlertBox type={alert.type} message={alert.msg} /> : null}

        {phase === PHASE.LOAD && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.navy} />
            <Text style={styles.loadTxt}>Loading portal...</Text>
          </View>
        )}

        {phase === PHASE.ERROR && (
          <View style={styles.card}>
            <CardHeader eyebrow="Problem" title="Unable to load counsellor portal" subtitle="Please check your link or try again later." />
            <View style={styles.body}>
              <Text style={styles.desc}>{alert?.msg || 'There was an issue loading this session.'}</Text>
              <Button title="Return Home" onPress={() => navigation.navigate('Home')} style={{ marginTop: 20 }} />
            </View>
          </View>
        )}

        {phase === PHASE.PROGRAM && (
          <View style={styles.card}>
            <CardHeader eyebrow="Step 2 · Programme Selection" title="Select Programme" subtitle="Choose the student's programme." />
            <View style={styles.body}>
              {data && <InfoGrid />}
              <Text style={styles.secLabel}>Programme</Text>
              <TouchableOpacity style={styles.picker} onPress={() => { setShowPicker(true); setSearchQuery(''); }}>
                <Text style={selected ? styles.pickerVal : styles.pickerPh} numberOfLines={2}>
                  {selected || 'Select programme...'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
              </TouchableOpacity>
              <Button title="Confirm & Send Student Link" onPress={confirmProgram} loading={loading}
                disabled={!selected} style={{ marginTop: 20 }}
                icon={<Ionicons name="arrow-forward" size={16} color="#fff" />} />
            </View>
          </View>
        )}

      </ScrollView>

      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Select Programme</Text>
              <TouchableOpacity onPress={() => { setShowPicker(false); setSearchQuery(''); }}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search programme..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={programs.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())))}
              keyExtractor={(i) => i.product_code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pItem, selected === item.label && styles.pItemSel]}
                  onPress={() => { setSelected(item.label); setShowPicker(false); }}
                >
                  <View style={styles.pBadge}><Text style={styles.pBadgeTxt}>{item.degree}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pLabel}>{item.label}</Text>
                    {item.description ? <Text style={styles.pDesc} numberOfLines={1}>{item.description}</Text> : null}
                  </View>
                  {selected === item.label && <Ionicons name="checkmark-circle" size={20} color={COLORS.navy} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoItem({ label, value, full, COLORS }) {
  return (
    <View style={[
      { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, flex: 1 },
      full && { width: '100%' },
    ]}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.navy }} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', paddingVertical: 60 },
  loadTxt: { color: COLORS.muted, marginTop: 12, fontSize: 15 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 4 },
  body: { padding: 24 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  secLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 10 },
  desc: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  bold: { fontWeight: '700', color: COLORS.navy },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, gap: 8 },
  pickerVal: { flex: 1, fontSize: 14, color: COLORS.navy, fontWeight: '600' },
  pickerPh: { flex: 1, fontSize: 14, color: COLORS.muted },
  resend: { marginTop: 14, padding: 10 },
  resendTxt: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: 10 },
  doneDesc: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 12 },
  pItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 4 },
  pItemSel: { backgroundColor: COLORS.accent + '18' },
  pBadge: { backgroundColor: COLORS.navy, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 42, alignItems: 'center' },
  pBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  pDesc: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
});	
