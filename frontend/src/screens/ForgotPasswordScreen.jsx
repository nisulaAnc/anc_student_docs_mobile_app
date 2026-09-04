import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { resetPassword, changePassword } from '../services/api';

export default function ForgotPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const emailParam = route.params?.email || '';
  const type = route.params?.type || 'cf';
  const mode = route.params?.mode || 'reset';

  const [email, setEmail] = useState(emailParam);
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleReset = async () => {
    setError('');
    setSuccess('');

    const emailTrimmed = email.trim().toLowerCase();

    if (!emailTrimmed) return setError('Please enter your email address.');

    if (mode === 'profile') {
      if (!currentPassword.trim()) return setError('Please enter your current password.');
    } else if (!resetCode.trim()) {
      return setError('Please enter the reset code sent to your email.');
    }

    if (!newPassword) return setError('Please enter a new password.');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (newPassword !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const payload = mode === 'profile'
        ? {
          email: emailTrimmed,
          currentPassword: currentPassword.trim(),
          newPassword,
          confirmPassword: confirm,
        }
        : {
          email: emailTrimmed,
          token: resetCode.trim(),
          newPassword,
          confirmPassword: confirm,
        };

      const res = mode === 'profile'
        ? await changePassword(payload)
        : await resetPassword(payload);

      if (res.data?.success) {
        const successMessage = mode === 'profile'
          ? 'Password changed successfully!'
          : 'Password reset successfully! You can now log in with your new password.';
        setSuccess(successMessage);
        setCurrentPassword('');
        setResetCode('');
        setNewPass('');
        setConfirm('');
      } else {
        setError(res.data?.message || 'Failed to update password.');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

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
            {/* <View style={styles.iconCircle}>
              <Ionicons name="key" size={28} color="#fff" />
            </View> */}
            <Text style={styles.title}>{mode === 'profile' ? 'Change Password' : 'Reset Password'}</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@ancedu.com"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {mode !== 'profile' && (
              <>
                <Text style={styles.label}>Reset Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter the reset code from your email"
                  placeholderTextColor={COLORS.muted}
                  value={resetCode}
                  onChangeText={(text) => setResetCode(text.replace(/\s+/g, '').slice(0, 128))}
                  autoCapitalize="none"
                  keyboardType="default"
                />
              </>
            )}

            {mode === 'profile' && (
              <>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="Enter your current password"
                    placeholderTextColor={COLORS.muted}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrentPass}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPass((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showCurrentPass ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* New password */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Enter new password (min. 6 chars)"
                placeholderTextColor={COLORS.muted}
                value={newPassword}
                onChangeText={setNewPass}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Re-enter new password"
                placeholderTextColor={COLORS.muted}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConf}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
              <TouchableOpacity onPress={() => setShowConf((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showConf ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

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

            {/* Reset button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <View style={styles.btnContent}>
                    {/* <Ionicons name="lock-closed" size={18} color="#fff" /> */}
                    <Text style={styles.btnText}>{mode === 'profile' ? 'Update Password' : 'Reset Password'}</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            {/* Back to login */}
            {!!success && (
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => navigation.navigate('StaffLogin', { type })}
                activeOpacity={0.8}
              >
                <Ionicons name="log-in-outline" size={16} color={COLORS.navy} />
                <Text style={styles.loginText}>Back to Sign In</Text>
              </TouchableOpacity>
            )}

          </View>
        </Animated.View>
      </ScrollView>
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
      backgroundColor: '#F59E0B',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
      shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.navy, textAlign: 'center' },
    subtitle: {
      fontSize: 13, color: COLORS.muted, textAlign: 'center',
      marginTop: 6, lineHeight: 19, paddingHorizontal: 20,
    },

    card: {
      backgroundColor: COLORS.white, borderRadius: 20, padding: 22,
      borderWidth: 1, borderColor: COLORS.border,
      shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08, shadowRadius: 18, elevation: 4,
    },

    stepBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: COLORS.blue + '10', borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: COLORS.blue + '30', marginBottom: 4,
    },
    stepText: { flex: 1, fontSize: 13, color: COLORS.blue, lineHeight: 19 },

    label: {
      fontSize: 11, fontWeight: '700', letterSpacing: 1.1,
      textTransform: 'uppercase', color: COLORS.navy, opacity: 0.7,
      marginBottom: 6, marginTop: 14,
    },

    input: {
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 14, color: COLORS.text,
    },
    codeInput: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 13, letterSpacing: 1,
    },

    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
      borderRadius: 12, paddingHorizontal: 14,
    },
    inputFlex: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 13 },
    eyeBtn: { padding: 6 },

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

    loginBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: COLORS.navy, borderRadius: 14, paddingVertical: 13,
      marginTop: 14,
    },
    loginText: { color: COLORS.navy, fontWeight: '700', fontSize: 15 },
  });
