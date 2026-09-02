import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, ScrollView, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { decode as atob } from 'base-64';
import { loginStaff, forgotPassword, getCounsellors, sendLoginOtp } from '../services/api';

// Role helpers
const isCFRole = (role) => String(role || '').toLowerCase().includes('center function');
const isCounsellorRole = (role) => String(role || '').toLowerCase().includes('counsellor');

export default function StaffLoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  // 'cf' → Center Function; 'counsellor' → Counsellor
  const type = route.params?.type || 'cf';
  const isCF = type === 'cf';
  const redirectTo = route.params?.redirectTo;
  const redirectParams = route.params?.redirectParams || {};

  const titleLabel = isCF ? 'Center Function Login' : 'Counsellor Login';
  const roleFilter = isCF ? isCFRole : isCounsellorRole;
  const filterLabel = isCF ? 'Center Function' : 'Counsellor';

  const [allCounsellors, setAllCounsellors] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [selected, setSelected] = useState(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState('email'); // 'email' | 'totp'
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef(null);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load counsellors
  const loadCounsellors = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await getCounsellors();
      if (res.data?.success) {
        const all = res.data.data || [];
        const roleFiltered = all.filter((c) => roleFilter(c.role));
        setAllCounsellors(roleFiltered);
        setFilteredList(roleFiltered);
        if (!roleFiltered.length) {
          setListError(`No ${filterLabel} staff found. Contact the administrator.`);
        }
      } else {
        setListError('Unable to load staff list.');
      }
    } catch (err) {
      setListError(err.response?.data?.message || err.message || 'Unable to load staff list.');
    } finally {
      setListLoading(false);
    }
  }, [filterLabel, roleFilter]);

  useEffect(() => {
    loadCounsellors();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return () => { if (resendTimer.current) clearInterval(resendTimer.current); };
  }, [loadCounsellors]);

  // Search filter
  useEffect(() => {
    const q = searchText.toLowerCase();
    if (!q) {
      setFilteredList(allCounsellors);
    } else {
      setFilteredList(
        allCounsellors.filter(
          (c) => c.name.toLowerCase().includes(q)
        )
      );
    }
  }, [searchText, allCounsellors]);

  // Handlers
  const handleSelectCounsellor = (item) => {
    setSelected(item);
    setPickerVisible(false);
    setSearchText('');
    setError('');
    // Reset 2FA state when a different account is selected
    setShow2fa(false);
    setCodeSent(false);
    setOtpCode('');
    setResendCooldown(0);
    if (resendTimer.current) clearInterval(resendTimer.current);
  };

  // Start a 60-second resend cooldown
  const startResendCooldown = () => {
    setResendCooldown(60);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Manually trigger sending of a login OTP to the user's email
  const triggerLoginOtp = async (emailAddress) => {
    try {
      await sendLoginOtp({ email: emailAddress });
      setCodeSent(true);
      startResendCooldown();
    } catch (e) {
      // Non-fatal — the backend already auto-sent one during login, this is just resend
      console.warn('sendLoginOtp warning:', e.message);
    }
  };

  const handleLogin = async () => {
  setError('');
  if (!selected) return setError('Please select your name.');
  if (!password.trim()) return setError('Please enter your password.');

  setLoading(true);
  try {
    const res = await loginStaff({
      email: selected.email,
      password: password.trim(),
      otp: otpCode.trim(),
      role: isCF ? 'Center Function' : 'Counsellor',
    });

    if (res.data?.success) {
      await AsyncStorage.setItem('counsellorSession', res.data.token);
      const counsellor = res.data.counsellor || selected;
      const destinationParams = isCF
        ? redirectParams
        : {
          ...redirectParams,
          counsellorName: counsellor.name || selected.name,
          counsellorEmail: counsellor.email || selected.email,
        };

      navigation.replace(redirectTo || 'Home', destinationParams);
    } else {
      setError(res.data?.message || 'Login failed.');
    }
  } catch (e) {
    const data = e.response?.data || {};
    const msg = data.message || e.message || 'Login failed.';

    if (data.requires_2fa) {
      const method = data.two_fa_method || 'email';
      setTwoFaMethod(method);
      setShow2fa(true);
      // Backend already auto-sent the email OTP — start the cooldown timer
      if (method === 'email') {
        setCodeSent(true);
        startResendCooldown();
        setError('');
      } else {
        setError('Enter the 6-digit code from your authenticator app.');
      }
    } else {
      setError(msg);
    }
  } finally {
    setLoading(false);
  }
};

  const handleForgot = async () => {
    if (!selected) return setError('Please select your name to identify your account, then tap "Forgot password".');
    if (!selected.email) return setError('This staff member has no email on file. Contact the administrator.');

    setForgotLoading(true);
    setError('');
    try {
      await forgotPassword({ email: selected.email });
      setForgotSent(true);
      setError('');
      navigation.navigate('ForgotPassword', { email: selected.email, type });
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Unable to send reset email. Try again.';
      setError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const maskEmail = (email) => {
    if (!email || !email.includes('@')) return email;

    const [, domain] = email.split('@');
    return `xxxxx@${domain}`;
  };

  // Render
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>{titleLabel}</Text>
            <Text style={styles.subtitle}>
              {isCF
                ? 'Sign in to manage student registrations and documents.'
                : 'Sign in to view and manage your students.'}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* Name picker */}
            <Text style={styles.label}>Full Name</Text>
            <TouchableOpacity
              style={[styles.picker, !selected && !!error && styles.pickerErr]}
              onPress={() => { setPickerVisible(true); setSearchText(''); }}
              activeOpacity={0.8}
            >
              {/* <Ionicons name="person-circle-outline" size={20} color={selected ? COLORS.navy : COLORS.muted} style={{ marginRight: 10 }} /> */}
              <Text style={[styles.pickerText, !selected && styles.pickerPlaceholder]} numberOfLines={1}>
                {selected ? selected.name : `Select ${filterLabel} name...`}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
            </TouchableOpacity>

            {/* Auto-filled info */}
            {selected && (
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  {/* <Ionicons name="mail-outline" size={14} color={COLORS.navy} /> */}
                  {/* <Text style={styles.infoText}>Email: {selected.email}</Text> */}
                  <Text style={styles.infoText}>
                    Email: {maskEmail(selected.email)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  {/* <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.navy} /> */}
                  <Text style={styles.infoText}>Role: {selected.role || filterLabel}</Text>
                </View>
              </View>
            )}

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* 2FA section — shown when server requires it */}
            {show2fa && (
              <View>
                {/* Status banner */}
                {twoFaMethod === 'email' && (
                  <View style={styles.otpSentBox}>
                    <Ionicons name="mail-open-outline" size={16} color="#1447B8" />
                    <Text style={styles.otpSentText}>
                      {codeSent
                        ? `A 6-digit verification code was sent to ${selected?.email}. Check your inbox (and spam folder).`
                        : 'Sending verification code to your email…'}
                    </Text>
                  </View>
                )}

                <Text style={styles.label}>Verification Code (2FA)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={twoFaMethod === 'totp' ? '6-digit authenticator code' : '6-digit code from your email'}
                  placeholderTextColor={COLORS.muted}
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                {/* Resend button (email method only) */}
                {twoFaMethod === 'email' && (
                  <TouchableOpacity
                    style={[styles.resendBtn, resendCooldown > 0 && styles.resendBtnDisabled]}
                    disabled={resendCooldown > 0}
                    onPress={() => triggerLoginOtp(selected?.email)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={14}
                      color={resendCooldown > 0 ? COLORS.muted : COLORS.navy}
                    />
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: COLORS.muted }]}>
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend code to email'}
                    </Text>
                  </TouchableOpacity>
                )}

                {twoFaMethod === 'totp' && (
                  <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 6, lineHeight: 17 }}>
                    Open your authenticator app (e.g. Google Authenticator) and enter the 6-digit code.
                  </Text>
                )}
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Forgot password success */}
            {forgotSent && (
              <View style={styles.successBox}>
                <Ionicons name="mail-open-outline" size={16} color="#16A34A" />
                <Text style={styles.successText}>
                  A password reset code was sent to {selected?.email}. Open the app, go to Reset Password and enter the code.
                </Text>
              </View>
            )}

            {/* Login button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={styles.btnContent}>
                    {/* <Ionicons name="log-in-outline" size={18} color="#fff" /> */}
                    <Text style={styles.btnText}>Sign In</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            {/* Forgot password */}
            <TouchableOpacity
              onPress={handleForgot}
              disabled={forgotLoading}
              style={styles.link}
              activeOpacity={0.7}
            >
              {forgotLoading
                ? <ActivityIndicator size="small" color={COLORS.navy} />
                : <Text style={styles.linkText}>Forgot password? Send reset code</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or</Text>
              <View style={styles.divLine} />
            </View>

            {/* Register link */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('StaffRegister', { type })}
              activeOpacity={0.8}
            >
              {/* <Ionicons name="person-add-outline" size={16} color={COLORS.navy} /> */}
              <Text style={styles.registerText}>Create an account</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Counsellor picker modal ── */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>

            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select {filterLabel}</Text>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setSearchText(''); }}>
                <Ionicons name="close-circle" size={26} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={COLORS.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor={COLORS.muted}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.muted} />
                </TouchableOpacity>
              )}
            </View>

            {listLoading ? (
              <ActivityIndicator color={COLORS.navy} style={{ marginTop: 24 }} />
            ) : listError ? (
              <View style={styles.listErrorBox}>
                <Ionicons name="warning-outline" size={20} color="#D97706" />
                <Text style={styles.listErrorText}>{listError}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item, index) => `${item.email}_${index}`}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  <View style={styles.listEmpty}>
                    <Ionicons name="search-outline" size={32} color={COLORS.muted} />
                    <Text style={styles.listEmptyText}>No results found</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.listItem, selected?.email === item.email && styles.listItemSelected]}
                    onPress={() => handleSelectCounsellor(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatar, selected?.email === item.email && { backgroundColor: COLORS.blue }]}>
                      <Text style={styles.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName}>{item.name}</Text>
                      {item.role && <Text style={styles.listRole}>{item.role}</Text>}
                    </View>
                    {selected?.email === item.email && (
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.blue} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: 20 },

    backBtn: {
      alignSelf: 'flex-start',
      padding: 8,
      marginBottom: 16,
      borderRadius: 10,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    headerBlock: { alignItems: 'center', marginBottom: 28 },
    iconCircle: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: COLORS.navy,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
      shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
    },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.navy, textAlign: 'center' },
    subtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 20 },

    card: {
      backgroundColor: COLORS.white, borderRadius: 20,
      padding: 22,
      borderWidth: 1, borderColor: COLORS.border,
      shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08, shadowRadius: 18, elevation: 4,
    },

    label: {
      fontSize: 11, fontWeight: '700', letterSpacing: 1.1,
      textTransform: 'uppercase', color: COLORS.navy, opacity: 0.7,
      marginBottom: 6, marginTop: 14,
    },

    picker: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    },
    pickerErr: { borderColor: '#DC2626' },
    pickerText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.navy },
    pickerPlaceholder: { fontWeight: '400', color: COLORS.muted },

    infoCard: {
      marginTop: 10, backgroundColor: COLORS.navy + '0D',
      borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: COLORS.navy + '20',
      gap: 6,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    infoText: { fontSize: 13, color: COLORS.navy, fontWeight: '600', flex: 1 },

    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14,
    },
    inputFlex: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 13 },
    eyeBtn: { padding: 6 },

    input: {
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 14, color: COLORS.text,
    },

    toggle2faLink: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 10, alignSelf: 'flex-start',
    },
    toggle2faText: { fontSize: 12, color: COLORS.muted, fontStyle: 'italic' },

    otpSentBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12,
      marginTop: 14, borderWidth: 1, borderColor: '#BFDBFE',
    },
    otpSentText: { flex: 1, fontSize: 13, color: '#1447B8', lineHeight: 18 },

    resendBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 10, alignSelf: 'flex-start',
      paddingVertical: 6, paddingHorizontal: 10,
      borderRadius: 8, borderWidth: 1, borderColor: COLORS.navy,
    },
    resendBtnDisabled: { borderColor: COLORS.border },
    resendText: { fontSize: 12, color: COLORS.navy, fontWeight: '600' },

    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12,
      marginTop: 14, borderWidth: 1, borderColor: '#FECACA',
    },
    errorText: { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },

    successBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
      marginTop: 14, borderWidth: 1, borderColor: '#BBF7D0',
    },
    successText: { flex: 1, fontSize: 13, color: '#16A34A', lineHeight: 18 },

    btn: {
      backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 15,
      alignItems: 'center', justifyContent: 'center', marginTop: 22,
      shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    link: { alignItems: 'center', marginTop: 14 },
    linkText: { fontSize: 13, color: COLORS.navy, fontWeight: '600' },

    divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
    divLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    divText: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },

    registerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: COLORS.navy, borderRadius: 14, paddingVertical: 13,
    },
    registerText: { color: COLORS.navy, fontWeight: '700', fontSize: 15 },

    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: COLORS.white,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, maxHeight: '80%',
    },
    sheetHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14,
    },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navy },

    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

    listItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10,
    },
    listItemSelected: { backgroundColor: COLORS.blue + '12' },
    avatar: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    listName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    listRole: { fontSize: 11, color: COLORS.blue, fontWeight: '600', marginTop: 2 },
    separator: { height: 1, backgroundColor: COLORS.border },

    listErrorBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    listErrorText: { fontSize: 13, color: '#D97706', textAlign: 'center' },
    listEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
    listEmptyText: { fontSize: 14, color: COLORS.muted },
  });
