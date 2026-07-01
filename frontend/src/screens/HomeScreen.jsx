import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar,
  Modal, TextInput, ActivityIndicator, Image, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { verifyCfPin, getCounsellors, registerCounsellorAccount, resetCounsellorPin } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const [destScreen, setDestScreen] = useState('CFRegistration');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const pinInputRef = useRef(null);

  // Counsellor login states
  const [isCounsellorFlow, setIsCounsellorFlow] = useState(false);
  const [counsellors, setCounsellors] = useState([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState(null);
  const [showCounsellorPicker, setShowCounsellorPicker] = useState(false);
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [showCreateCounsellorModal, setShowCreateCounsellorModal] = useState(false);
  const [showCounsellorDropdown, setShowCounsellorDropdown] = useState(false);
  const [showCounsellorNameDropdown, setShowCounsellorNameDropdown] = useState(false);
  const [createMode, setCreateMode] = useState('create');
  const [counsellorForm, setCounsellorForm] = useState({ name: '', email: '', pin: '', oldPin: '', newPin: '' });
  const [counsellorFormError, setCounsellorFormError] = useState('');
  const [counsellorFormLoading, setCounsellorFormLoading] = useState(false);

  useEffect(() => {
    // Prefetch counsellors list
    loadCounsellorList();
  }, []);

  const loadCounsellorList = async () => {
    try {
      const res = await getCounsellors();
      if (res.data?.success) {
        setCounsellors(res.data.data || []);
      }
    } catch (_) { }
  };

  const ROLES = [
    {
      screen: 'CFRegistration',
      params: {},
      icon: 'person-add',
      color: COLORS.navy,
      label: 'CF Registration',
      desc: 'Register a new student and notify their counsellor',
      protected: true,
      type: 'cf',
    },
    {
      screen: 'CFDashboard',
      params: {},
      icon: 'analytics',
      color: '#8B5CF6',
      label: 'CF Portal Dashboard',
      desc: 'View statistics, check document status & send reminders',
      protected: true,
      type: 'cf',
    },
    {
      screen: 'CFDashboard',
      params: {},
      icon: 'people',
      color: '#EC4899',
      label: 'Counsellor Dashboard',
      desc: 'View your students\' completed & pending documents',
      protected: true,
      type: 'counsellor',
    },
    {
      screen: 'QRScan',
      params: { mode: 'counsellor' },
      icon: 'shield-checkmark',
      color: COLORS.blue,
      label: 'Counsellor Portal',
      desc: 'Select the student programme and notify the student',
      protected: false,
    },
    {
      screen: 'QRScan',
      params: { mode: 'student' },
      icon: 'documents',
      color: COLORS.green,
      label: 'Student Portal',
      desc: 'Submit required documents for registration',
      protected: false,
    },
  ];

  const handleRolePress = (role) => {
    if (role.protected) {
      setPin('');
      setPinError('');
      setDestScreen(role.screen);
      if (role.type === 'counsellor') {
        setIsCounsellorFlow(true);
        setSelectedCounsellor(null);
        setShowCounsellorDropdown(false);
        setShowCounsellorPicker(false);
        setCreateMode('create');
        setCounsellorForm({ name: '', email: '', pin: '', oldPin: '', newPin: '' });
        setCounsellorFormError('');
        setShowCreateCounsellorModal(true);
      } else {
        setIsCounsellorFlow(false);
        setPinModalVisible(true);
        setTimeout(() => pinInputRef.current?.focus(), 300);
      }
    } else {
      navigation.navigate(role.screen, role.params);
    }
  };

  const handleCounsellorFormSubmit = async () => {
    if (createMode === 'create') {
      if (!counsellorForm.name.trim() || !counsellorForm.email.trim() || !counsellorForm.pin.trim()) {
        setCounsellorFormError('Please fill in name, email and PIN.');
        return;
      }

      if (counsellorForm.pin.length !== 6) {
        setCounsellorFormError('PIN must be exactly 6 digits.');
        return;
      }
    } else {
      if (!counsellorForm.email.trim() || !counsellorForm.oldPin.trim() || !counsellorForm.newPin.trim()) {
        setCounsellorFormError('Please fill in email, old PIN and new PIN.');
        return;
      }

      if (counsellorForm.oldPin.length !== 6 || counsellorForm.newPin.length !== 6) {
        setCounsellorFormError('PINs must be exactly 6 digits.');
        return;
      }
    }

    setCounsellorFormLoading(true);
    setCounsellorFormError('');
    try {
      const res = createMode === 'create'
        ? await registerCounsellorAccount(counsellorForm)
        : await resetCounsellorPin({ email: counsellorForm.email, oldPin: counsellorForm.oldPin, newPin: counsellorForm.newPin });

      if (res.data?.success) {
        setShowCreateCounsellorModal(false);
        setCounsellorForm({ name: '', email: '', pin: '', oldPin: '', newPin: '' });
        await loadCounsellorList();
        setCounsellorFormError('');
      } else {
        setCounsellorFormError(res.data?.message || 'Unable to save counsellor account.');
      }
    } catch (e) {
      setCounsellorFormError(e.response?.data?.message || 'Unable to save counsellor account.');
    } finally {
      setCounsellorFormLoading(false);
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
      if (isCounsellorFlow) {
        if (!selectedCounsellor) {
          setPinError('Please select a counsellor.');
          setPinLoading(false);
          return;
        }
        const res = await verifyCfPin(pin, 'counsellor', selectedCounsellor);
        if (res.data?.token) {
          await AsyncStorage.setItem('counsellorSession', res.data.token);
        }
        setPinModalVisible(false);
        setPin('');
        navigation.navigate('CFDashboard', { counsellorName: selectedCounsellor.name, counsellorEmail: selectedCounsellor.email });
      } else {
        await verifyCfPin(pin, 'cf');
        setPinModalVisible(false);
        setPin('');
        navigation.navigate(destScreen, {});
      }
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
                    <Text style={styles.lockBadgeTxt}>PIN Protected</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        ))}

        <Text style={styles.footer}>© {new Date().getFullYear()} ANC Education · Secure Document Portal</Text>
        <Text style={styles.footer}>Developed by Nisula Premaratne | IT Department</Text>
      </ScrollView>

      {/* Counsellor Picker Modal */}
      <Modal visible={showCounsellorPicker} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Select Your Name</Text>
              <TouchableOpacity onPress={() => setShowCounsellorPicker(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search your name..."
              placeholderTextColor={COLORS.muted}
              value={counsellorSearch}
              onChangeText={setCounsellorSearch}
            />
            <FlatList
              data={counsellors.filter(c => (c.name || '').toLowerCase().includes((counsellorSearch || '').toLowerCase()))}
              keyExtractor={(i) => i.email}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pItem, selectedCounsellor?.email === item.email && styles.pItemSel]}
                  onPress={() => {
                    setSelectedCounsellor(item);
                    setCounsellorForm((prev) => ({ ...prev, email: item.email, name: item.name }));
                    setShowCounsellorPicker(false);
                    setPinModalVisible(true);
                    setTimeout(() => pinInputRef.current?.focus(), 300);
                  }}
                >
                  <Ionicons name="person-outline" size={16} color={COLORS.navy} />
                  <Text style={styles.pLabel}>{item.name}</Text>
                  {selectedCounsellor?.email === item.email && <Ionicons name="checkmark-circle" size={18} color={COLORS.navy} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Create / Reset Counsellor Login Modal */}
      <Modal visible={showCreateCounsellorModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{createMode === 'create' ? 'Create Counsellor Login' : 'Reset Forgot PIN'}</Text>
              <TouchableOpacity onPress={() => { setShowCreateCounsellorModal(false); setCounsellorFormError(''); }}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, createMode === 'create' && styles.toggleBtnActive]}
                onPress={() => {
                  setCreateMode('create');
                  setCounsellorForm({ name: '', email: '', pin: '', oldPin: '', newPin: '' });
                  setCounsellorFormError('');
                }}
              >
                <Text style={[styles.toggleBtnText, createMode === 'create' && styles.toggleBtnTextActive]}>Create New</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, createMode === 'reset' && styles.toggleBtnActive]}
                onPress={() => {
                  setCreateMode('reset');
                  setCounsellorForm({ name: '', email: selectedCounsellor?.email || '', pin: '', oldPin: '', newPin: '' });
                  setCounsellorFormError('');
                }}
              >
                <Text style={[styles.toggleBtnText, createMode === 'reset' && styles.toggleBtnTextActive]}>Forgot PIN</Text>
              </TouchableOpacity>
            </View>

            {createMode === 'create' ? (
              <View style={styles.dropdownWrap}>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowCounsellorNameDropdown((prev) => !prev)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownLabel}>Counsellor name</Text>
                    <Text style={styles.dropdownValue}>{counsellorForm.name || 'Select counsellor name'}</Text>
                  </View>
                  <Ionicons name={showCounsellorNameDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
                </TouchableOpacity>

                {showCounsellorNameDropdown ? (
                  <View style={styles.dropdownList}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search counsellor name..."
                      placeholderTextColor={COLORS.muted}
                      value={counsellorSearch}
                      onChangeText={setCounsellorSearch}
                    />
                    <FlatList
                      data={counsellors.filter((c) => (c.name || '').toLowerCase().includes((counsellorSearch || '').toLowerCase()))}
                      keyExtractor={(item) => item.email}
                      style={{ maxHeight: 180 }}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.pItem}
                          onPress={() => {
                            setCounsellorForm((prev) => ({ ...prev, name: item.name, email: item.email }));
                            setShowCounsellorNameDropdown(false);
                            setCounsellorSearch('');
                          }}
                        >
                          <Ionicons name="person-outline" size={16} color={COLORS.navy} />
                          <Text style={styles.pLabel}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <TextInput
              style={styles.searchInput}
              placeholder="Counsellor email"
              placeholderTextColor={COLORS.muted}
              value={counsellorForm.email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={(t) => setCounsellorForm({ ...counsellorForm, email: t })}
            />

            {createMode === 'create' ? (
              <TextInput
                style={styles.searchInput}
                placeholder="New 6-digit PIN"
                placeholderTextColor={COLORS.muted}
                value={counsellorForm.pin}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                onChangeText={(t) => setCounsellorForm({ ...counsellorForm, pin: t.replace(/[^0-9]/g, '').slice(0, 6) })}
              />
            ) : (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Old 6-digit PIN"
                  placeholderTextColor={COLORS.muted}
                  value={counsellorForm.oldPin}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  onChangeText={(t) => setCounsellorForm({ ...counsellorForm, oldPin: t.replace(/[^0-9]/g, '').slice(0, 6) })}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="New 6-digit PIN"
                  placeholderTextColor={COLORS.muted}
                  value={counsellorForm.newPin}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  onChangeText={(t) => setCounsellorForm({ ...counsellorForm, newPin: t.replace(/[^0-9]/g, '').slice(0, 6) })}
                />
              </>
            )}

            {counsellorFormError ? (
              <View style={styles.pinErrorRow}>
                <Ionicons name="alert-circle" size={14} color={COLORS.red} />
                <Text style={styles.pinErrorTxt}>{counsellorFormError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.pinBtn, counsellorFormLoading && styles.pinBtnDisabled]}
              onPress={handleCounsellorFormSubmit}
              disabled={counsellorFormLoading}
            >
              {counsellorFormLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pinBtnTxt}>{createMode === 'create' ? 'Create Login' : 'Save New PIN'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => {
                setShowCreateCounsellorModal(false);
                setShowCounsellorPicker(true);
                setCounsellorFormError('');
              }}
            >
              <Text style={styles.linkBtnText}>Use existing counsellor login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Lock Modal */}
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
              <Text style={styles.pinTitle}>{isCounsellorFlow ? 'Counsellor Login' : 'CF Staff Access'}</Text>
              <Text style={styles.pinSub}>
                {isCounsellorFlow
                  ? `Logged in as: ${selectedCounsellor?.name}\nEnter Counsellor PIN`
                  : 'Enter your 6-digit PIN to continue'
                }
              </Text>
            </View>

            {/* Counsellor dropdown */}
            {isCounsellorFlow ? (
              <View style={styles.dropdownWrap}>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowCounsellorDropdown((prev) => !prev)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownLabel}>Counsellor name</Text>
                    <Text style={styles.dropdownValue}>{selectedCounsellor?.name || 'Select your name'}</Text>
                  </View>
                  <Ionicons name={showCounsellorDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.muted} />
                </TouchableOpacity>

                {showCounsellorDropdown ? (
                  <View style={styles.dropdownList}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search your name..."
                      placeholderTextColor={COLORS.muted}
                      value={counsellorSearch}
                      onChangeText={setCounsellorSearch}
                    />
                    <FlatList
                      data={counsellors.filter((c) => (c.name || '').toLowerCase().includes((counsellorSearch || '').toLowerCase()))}
                      keyExtractor={(item) => item.email}
                      style={{ maxHeight: 180 }}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.pItem, selectedCounsellor?.email === item.email && styles.pItemSel]}
                          onPress={() => {
                            setSelectedCounsellor(item);
                            setShowCounsellorDropdown(false);
                            setTimeout(() => pinInputRef.current?.focus(), 200);
                          }}
                        >
                          <Ionicons name="person-outline" size={16} color={COLORS.navy} />
                          <Text style={styles.pLabel}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

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

            <TouchableOpacity
              style={styles.pinCancelBtn}
              onPress={() => {
                setPinModalVisible(false);
                setPin('');
                setPinError('');
                setCreateMode('reset');
                setCounsellorForm({ name: '', email: selectedCounsellor?.email || '', pin: '', oldPin: '', newPin: '' });
                setCounsellorFormError('');
                setShowCreateCounsellorModal(true);
              }}
              disabled={pinLoading}
            >
              <Text style={styles.pinCancelTxt}>Forgot PIN?</Text>
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

  // PIN Modal 
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

  // Counsellor picker sheet
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: '100%', maxHeight: '60%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  searchInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  toggleBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  toggleBtnText: { color: COLORS.text, fontWeight: '700' },
  toggleBtnTextActive: { color: '#fff' },
  linkBtn: { marginTop: 8, alignItems: 'center' },
  linkBtnText: { color: COLORS.navy, fontWeight: '700', fontSize: 13 },
  dropdownWrap: { width: '100%', marginBottom: 12 },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  dropdownLabel: { fontSize: 11, color: COLORS.muted, marginBottom: 2 },
  dropdownValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    padding: 8,
  },
  pItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginBottom: 4 },
  pItemSel: { backgroundColor: COLORS.accent + '18' },
  pLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
});