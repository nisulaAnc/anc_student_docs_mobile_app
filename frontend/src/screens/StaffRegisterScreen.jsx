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
import { registerStaff, getCounsellors } from '../services/api';

// Role helpers
const isCFRole = (role) => String(role || '').toLowerCase().includes('center function');
const isCounsellorRole = (role) => String(role || '').toLowerCase().includes('counsellor');

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;

  const [username, domain] = email.split('@');

  return `${'x'.repeat(username.length)}@${domain}`;
};

export default function StaffRegisterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  // 'cf' → Center Function; 'counsellor' → Counsellor
  const type = route.params?.type || 'cf';
  const isCF = type === 'cf';

  const titleLabel = isCF ? 'Center Function Registration' : 'Counsellor Registration';
  const roleFilter = isCF ? isCFRole : isCounsellorRole;
  const filterLabel = isCF ? 'Center Function' : 'Counsellor';

  const [allCounsellors, setAllCounsellors] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [selected, setSelected] = useState(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  }, [loadCounsellors]);

  // Search filter
  useEffect(() => {
    const q = searchText.toLowerCase();
    setFilteredList(
      !q
        ? allCounsellors
        : allCounsellors.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        )
    );
  }, [searchText, allCounsellors]);

  // Register
  const handleRegister = async () => {
    setError('');
    setSuccess('');

    if (!selected) return setError('Please select your name from the list.');
    if (!password.trim()) return setError('Please enter a password.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await registerStaff({
        name: selected.name,
        email: selected.email,
        password: password.trim(),
        role: selected.role || (isCF ? 'Center Function' : 'Counsellor'),
      });

      if (res.data?.success) {
        setSuccess(res.data.message || 'Your account has been verified!');

        // Brief success message, then navigate
        setTimeout(() => {
          // After successful registration, navigate to the login screen
          // so the user can log in with their new credentials.
          navigation.replace('StaffLogin', { type });
        }, 2000);
      } else {
        setError(res.data?.message || 'Registration failed.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
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
              Create your account to access the ANC Student Docs portal.
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
                {selected ? selected.name : `Select your ${filterLabel} name...`}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
            </TouchableOpacity>

            {/* Auto-filled email */}
            {selected && (
              <>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.input, styles.readOnly]}>
                  {/* <Ionicons name="mail-outline" size={16} color={COLORS.navy} /> */}
                  <Text style={styles.readOnlyText}>{maskEmail(selected.email)}</Text>
                </View>

                <Text style={styles.label}>Role</Text>
                <View style={[styles.input, styles.readOnly]}>
                  {/* <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.navy} /> */}
                  <Text style={styles.readOnlyText}>{selected.role || filterLabel}</Text>
                </View>
              </>
            )}

            {/* Password */}
            <Text style={styles.label}>Password (Minimum 6 characters)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Create a password"
                placeholderTextColor={COLORS.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.muted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Password strength hint */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[6, 8, 12].map((threshold) => (
                  <View
                    key={threshold}
                    style={[
                      styles.strengthBar,
                      password.length >= threshold && {
                        backgroundColor:
                          threshold <= 6 ? '#DC2626' :
                            threshold <= 8 ? '#F59E0B' : '#16A34A',
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 6 ? 'Too short' : password.length < 8 ? 'Weak' : password.length < 12 ? 'Good' : 'Strong'}
                </Text>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Success */}
            {!!success && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.successText}>{success}</Text>
              </View>
            )}

            {/* Note about email verification */}
            {!success && (
              <View style={styles.noteBox}>
                {/* <Ionicons name="information-circle-outline" size={16} color={COLORS.blue} /> */}
                <Text style={styles.noteText}>
                  After registration, check your email to confirm your account.
                </Text>
              </View>
            )}

            {/* Register button */}
            <TouchableOpacity
              style={[styles.btn, (loading || !!success) && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading || !!success}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={styles.btnContent}>
                    {/* <Ionicons name="checkmark-done-outline" size={18} color="#fff" /> */}
                    <Text style={styles.btnText}>Create Account</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>already have an account?</Text>
              <View style={styles.divLine} />
            </View>

            {/* Login link */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => navigation.navigate('StaffLogin', { type })}
              activeOpacity={0.8}
            >
              {/* <Ionicons name="log-in-outline" size={16} color={COLORS.navy} /> */}
              <Text style={styles.loginText}>Sign In</Text>
            </TouchableOpacity>

          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Counsellor picker modal ── */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select {filterLabel}</Text>
              <TouchableOpacity onPress={() => { setPickerVisible(false); setSearchText(''); }}>
                <Ionicons name="close-circle" size={26} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

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
                    onPress={() => { setSelected(item); setPickerVisible(false); setSearchText(''); setError(''); }}
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
      alignSelf: 'flex-start', padding: 8, marginBottom: 16,
      borderRadius: 10, backgroundColor: COLORS.white,
      borderWidth: 1, borderColor: COLORS.border,
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
    subtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 16 },

    card: {
      backgroundColor: COLORS.white, borderRadius: 20, padding: 22,
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

    input: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    },
    readOnly: { backgroundColor: COLORS.navy + '08', borderColor: COLORS.navy + '30' },
    readOnlyText: { flex: 1, fontSize: 14, color: COLORS.navy, fontWeight: '600' },

    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14,
    },
    inputFlex: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 13 },
    eyeBtn: { padding: 6 },

    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    strengthBar: {
      flex: 1, height: 4, borderRadius: 2,
      backgroundColor: COLORS.border,
    },
    strengthLabel: { fontSize: 11, color: COLORS.muted, width: 52 },

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

    noteBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: COLORS.blue + '0D', borderRadius: 10, padding: 12,
      marginTop: 14, borderWidth: 1, borderColor: COLORS.blue + '25',
    },
    noteText: { flex: 1, fontSize: 12, color: COLORS.blue, lineHeight: 18 },

    btn: {
      backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 15,
      alignItems: 'center', justifyContent: 'center', marginTop: 22,
      shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 18 },
    divLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    divText: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },

    loginBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: COLORS.navy, borderRadius: 14, paddingVertical: 13,
    },
    loginText: { color: COLORS.navy, fontWeight: '700', fontSize: 15 },

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
