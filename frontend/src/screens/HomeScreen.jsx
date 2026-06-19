import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar,
  Modal, TextInput, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { verifyCfPin } from '../services/api';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  // ── PIN modal state ──
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const pinInputRef = useRef(null);

  const ROLES = [
    {
      screen: 'CFRegistration',
      params: {},
      icon: 'person-add',
      color: COLORS.navy,
      label: 'CF Registration',
      desc: 'Register a new student and notify their counsellor',
      protected: true,
    },
    {
      screen: 'QRScan',
      params: { mode: 'counsellor' },
      icon: 'shield-checkmark',
      color: COLORS.blue,
      label: 'Counsellor Portal',
      desc: 'Verify OTP and select the student programme',
      protected: false,
    },
    {
      screen: 'QRScan',
      params: { mode: 'student' },
      icon: 'documents',
      color: COLORS.green,
      label: 'Student Portal',
      desc: 'Verify OTP and submit required documents',
      protected: false,
    },
  ];

  const handleRolePress = (role) => {
    if (role.protected) {
      setPin('');
      setPinError('');
      setPinModalVisible(true);
      setTimeout(() => pinInputRef.current?.focus(), 300);
    } else {
      navigation.navigate(role.screen, role.params);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 6) {
      setPinError('Please enter the full 6-digit PIN.');
      return;
    }
    setPinLoading(true);
    setPinError('');
    try {
      await verifyCfPin(pin);
      setPinModalVisible(false);
      setPin('');
      navigation.navigate('CFRegistration', {});
    } catch (e) {
      setPinError(e.response?.data?.message || 'Incorrect PIN. Access denied.');
      setPin('');
      pinInputRef.current?.focus();
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <LinearGradient colors={[COLORS.navy, COLORS.blue]} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity style={{ position: 'absolute', top: insets.top + 16, right: 20 }} onPress={toggleTheme}>
          <Ionicons name={theme === 'dark' ? 'sunny' : 'moon'} size={26} color={theme === 'dark' ? '#FFD700' : COLORS.white} />
        </TouchableOpacity>
        <View style={styles.logoMark}>
          <Image source={require('../../assets/logo.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>ANC Student Docs</Text>
        <Text style={styles.tag}>Document Portal</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.sub}>Select your role to continue.</Text>

        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.label}
            style={styles.card}
            onPress={() => handleRolePress(r)}
            activeOpacity={0.82}
          >
            <View style={[styles.cardIcon, { backgroundColor: r.color + '18' }]}>
              <Ionicons name={r.icon} size={26} color={r.color} />
            </View>
            <View style={styles.cardText}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{r.label}</Text>
                {r.protected && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={10} color={COLORS.navy} />
                    <Text style={styles.lockBadgeTxt}>Staff Only</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        ))}

        <Text style={styles.footer}>© {new Date().getFullYear()} ANC Education · Secure Document Portal</Text>
      </ScrollView>

      {/* ── PIN Lock Modal ── */}
      <Modal
        visible={pinModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => { if (!pinLoading) { setPinModalVisible(false); setPin(''); setPinError(''); } }}
      >
        <View style={styles.modalBg}>
          <View style={[styles.pinSheet, { paddingBottom: insets.bottom + 16 }]}>

            {/* Header */}
            <View style={styles.pinHeader}>
              <View style={styles.pinIconWrap}>
                <Ionicons name="lock-closed" size={24} color={COLORS.navy} />
              </View>
              <Text style={styles.pinTitle}>CF Staff Access</Text>
              <Text style={styles.pinSub}>Enter your 6-digit PIN to continue</Text>
            </View>

            {/* PIN input */}
            <TextInput
              ref={pinInputRef}
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="● ● ● ● ● ●"
              placeholderTextColor={COLORS.muted}
              textAlign="center"
              onSubmitEditing={handlePinSubmit}
            />

            {/* Dot indicators */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
              ))}
            </View>

            {/* Error */}
            {pinError ? (
              <View style={styles.pinErrorRow}>
                <Ionicons name="alert-circle" size={14} color={COLORS.red} />
                <Text style={styles.pinErrorTxt}>{pinError}</Text>
              </View>
            ) : null}

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.pinBtn, (pin.length !== 6 || pinLoading) && styles.pinBtnDisabled]}
              onPress={handlePinSubmit}
              disabled={pin.length !== 6 || pinLoading}
            >
              {pinLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                    <Text style={styles.pinBtnTxt}>Verify & Enter</Text>
                  </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pinCancelBtn}
              onPress={() => { if (!pinLoading) { setPinModalVisible(false); setPin(''); setPinError(''); } }}
              disabled={pinLoading}
            >
              <Text style={styles.pinCancelTxt}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  hero: { alignItems: 'center', paddingBottom: 32 },
  logoMark: {
    width: 60, height: 60, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    overflow: 'hidden'
  },
  brand: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  tag: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '700', marginTop: 3 },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '800', color: COLORS.navy, marginTop: 4, marginBottom: 4 },
  sub: { fontSize: 14, color: COLORS.muted, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  cardIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  cardDesc: { fontSize: 13, color: COLORS.muted, lineHeight: 17 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.navy + '15', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  lockBadgeTxt: { fontSize: 10, fontWeight: '700', color: COLORS.navy },
  footer: { textAlign: 'center', color: COLORS.muted, fontSize: 12, marginTop: 20 },

  // ── PIN Modal ──
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pinSheet: {
    backgroundColor: COLORS.white, borderRadius: 24, width: '100%',
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 20,
  },
  pinHeader: { alignItems: 'center', marginBottom: 24 },
  pinIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.navy + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  pinTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: 4 },
  pinSub: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
  pinInput: {
    width: '100%', padding: 16, fontSize: 28, letterSpacing: 12,
    backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 14, color: COLORS.navy, fontWeight: '700',
    marginBottom: 16,
  },
  dotsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.border, borderWidth: 1.5, borderColor: COLORS.muted,
  },
  dotFilled: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pinErrorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.red + '12', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, width: '100%',
  },
  pinErrorTxt: { fontSize: 13, color: COLORS.red, fontWeight: '600', flex: 1 },
  pinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 15,
    width: '100%', marginBottom: 10,
  },
  pinBtnDisabled: { opacity: 0.45 },
  pinBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinCancelBtn: { paddingVertical: 10 },
  pinCancelTxt: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
});