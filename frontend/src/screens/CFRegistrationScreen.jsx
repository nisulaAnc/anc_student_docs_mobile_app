import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, FlatList, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../components/TopBar';
import CardHeader from '../components/CardHeader';
import AlertBox from '../components/AlertBox';
import Button from '../components/Button';
import { getCounsellors, registerStudent } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function CFRegistrationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const [cfNumber, setCfNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [counsellorName, setCounsellorName] = useState('');
  const [counsellors, setCounsellors] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => { fetchCounsellors(); }, []);

  const fetchCounsellors = async () => {
    try {
      const res = await getCounsellors();
      setCounsellors(res.data.data || []);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Cannot load counsellors.' });
    } finally { setLoadingC(false); }
  };

  const validate = () => {
    const e = {};
    if (!cfNumber.trim()) e.cfNumber = 'CF Number is required';
    if (!studentName.trim()) e.studentName = 'Student name is required';
    if (!studentEmail.trim()) e.studentEmail = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(studentEmail)) e.studentEmail = 'Enter a valid email';
    if (!counsellorName) e.counsellor = 'Please select a counsellor';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true); setAlert(null);
    try {
      await registerStudent({
        cf_number: cfNumber.trim(),
        student_name: studentName.trim(),
        student_email: studentEmail.trim().toLowerCase(),
        counsellor_name: counsellorName,
      });
      setAlert({ type: 'success', msg: `Registration submitted. ${counsellorName} has been notified by email.` });
      setCfNumber(''); setStudentName(''); setStudentEmail(''); setCounsellorName('');
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || e.message });
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TopBar onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <CardHeader eyebrow="Step 1 · CF Department" title="New Student Registration" subtitle="Fill in the student details and assign a counsellor." />
          <View style={styles.body}>
            {alert ? <AlertBox type={alert.type} message={alert.msg} /> : null}

            <Field label="CF Number" value={cfNumber} onChangeText={setCfNumber}
              placeholder="e.g. CF2024001" autoCapitalize="characters" error={errors.cfNumber} COLORS={COLORS} />

            <Field label="Student Full Name" value={studentName} onChangeText={setStudentName}
              placeholder="Enter student's full name" error={errors.studentName} COLORS={COLORS} />

            <Field label="Student Email" value={studentEmail} onChangeText={setStudentEmail}
              placeholder="student@example.com" keyboardType="email-address"
              autoCapitalize="none" error={errors.studentEmail} COLORS={COLORS} />

            {/* Counsellor picker */}
            <Text style={styles.label}>Assign Counsellor</Text>
            <TouchableOpacity
              style={[styles.picker, errors.counsellor && styles.pickerErr]}
              onPress={() => { setShowPicker(true); setSearchQuery(''); }}
            >
              <Text style={counsellorName ? styles.pickerVal : styles.pickerPh}>
                {counsellorName || 'Select a counsellor...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
            </TouchableOpacity>
            {errors.counsellor ? <Text style={styles.fieldErr}>{errors.counsellor}</Text> : null}

            <Button title="Submit & Notify Counsellor" onPress={handleSubmit} loading={loading} style={{ marginTop: 24 }}
              icon={<Ionicons name="send" size={16} color="#fff" />} />
          </View>
        </View>

      </ScrollView>

      {/* Counsellor picker modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Select Counsellor</Text>
              <TouchableOpacity onPress={() => { setShowPicker(false); setSearchQuery(''); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {loadingC
              ? <ActivityIndicator color={COLORS.navy} style={{ margin: 20 }} />
              : (
                <FlatList
                  data={counsellors.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase()))}
                  keyExtractor={(i) => i.email}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.cItem, counsellorName === item.name && styles.cItemSel]}
                      onPress={() => { setCounsellorName(item.name); setShowPicker(false); }}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{item.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cName}>{item.name}</Text>
                        <Text style={styles.cEmail}>{item.email}</Text>
                      </View>
                      {counsellorName === item.name && <Ionicons name="checkmark-circle" size={20} color={COLORS.navy} />}
                    </TouchableOpacity>
                  )}
                />
              )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, error, COLORS, ...props }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
        textTransform: 'uppercase', color: COLORS.navy, opacity: 0.75, marginBottom: 6,
      }}>{label}</Text>
      <TextInput
        style={[
          {
            padding: 12, backgroundColor: COLORS.bg,
            borderWidth: 1.5, borderColor: error ? COLORS.red : COLORS.border,
            borderRadius: 12, fontSize: 14, color: COLORS.text,
          },
        ]}
        placeholderTextColor={COLORS.muted}
        {...props}
      />
      {error ? <Text style={{ fontSize: 12, color: COLORS.red, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 4 },
  body: { padding: 24 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: COLORS.navy, opacity: 0.75, marginBottom: 6 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, marginBottom: 4 },
  pickerErr: { borderColor: COLORS.red },
  pickerVal: { fontSize: 14, color: COLORS.navy, fontWeight: '600' },
  pickerPh: { fontSize: 14, color: COLORS.muted },
  fieldErr: { fontSize: 12, color: COLORS.red, marginBottom: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 12 },
  cItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 4 },
  cItemSel: { backgroundColor: COLORS.accent + '18' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cEmail: { fontSize: 12, color: COLORS.muted },
});
