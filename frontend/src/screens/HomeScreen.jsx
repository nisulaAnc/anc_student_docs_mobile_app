import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar,
  Modal, TextInput, ActivityIndicator, Image, FlatList, RefreshControl,
  Animated, Dimensions, Switch, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  getCounsellors, setupTwoFactor, enableTwoFactor, sendTwoFactorEmailCode,
} from '../services/api';
import { decode as atob } from 'base-64';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isCfRole = (role) => {
  const value = normalizeRole(role);
  return value.includes('center function') || value.includes('center-function') || value === 'cf';
};
const isCounsellorRole = (role) => normalizeRole(role).includes('counsellor');

export default function HomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold });
  const requestedUniversity = String(route.params?.studentUniversity || '').toUpperCase();
  const [homeUniversity, setHomeUniversity] = useState(
    requestedUniversity === 'ANC' || requestedUniversity === 'UWL' ? requestedUniversity : null
  );
  useEffect(() => {
    if (homeUniversity || requestedUniversity) return;
    AsyncStorage.getItem('studentUniversity').then((storedUniversity) => {
      const normalizedUniversity = String(storedUniversity || '').toUpperCase();
      if (normalizedUniversity === 'ANC' || normalizedUniversity === 'UWL') {
        setHomeUniversity(normalizedUniversity);
      }
    });
  }, [homeUniversity, requestedUniversity]);
  const homeLogo = homeUniversity === 'UWL'
    ? require('../../assets/UWL-Logo.png')
    : homeUniversity === 'ANC'
      ? require('../../assets/logo.png')
      : require('../../assets/Docs logo.png');

  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(Dimensions.get('window').width));
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [settingsState, setSettingsState] = useState({
    enabled: false,
    loading: false,
    setupVisible: false, // New: to show QR code setup
    secret: '',          // New: TOTP secret
    qrCodeUri: '',       // New: QR code URI
    manualCode: '',      // New: Manual setup code
    otp: '',             // 6-digit code from authenticator
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const token = await AsyncStorage.getItem('counsellorSession');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const normalizedUser = {
              id: payload.id || payload.email || payload.name || 'counsellor',
              name: payload.name || '',
              email: payload.email || '',
              role: payload.role || '',
              lastLogin: payload.lastLogin || payload.last_login || null,
              twoFactorEnabled: !!(payload.twoFactorEnabled || payload.two_fa_enabled),
            };
            setSessionUser(normalizedUser);
            setSettingsState(prev => ({ ...prev, enabled: normalizedUser.twoFactorEnabled }));
          } else {
            setSessionUser(null);
          }
        } else {
          setSessionUser(null);
        }
      } catch (e) {
        setSessionUser(null);
          setSettingsState(prev => ({ ...prev, enabled: false }));
      } finally {
        setSessionLoading(false);
      }
    });
    return unsubscribe;
  }, [navigation]);



  const ROLES = [
    {
      screen: 'CFDashboard',
      params: {},
      icon: 'grid',
      color: '#8B5CF6',
      label: 'Center Function Dashboard',
      desc: 'View statistics, check document status & send reminders',
      protected: true,
      type: 'cf',
    },
    {
      screen: 'CFDashboard',
      params: {},
      icon: 'documents',
      color: '#ecaa48',
      label: 'Counsellor Dashboard',
      desc: 'View your students\' completed & pending documents',
      protected: true,
      type: 'counsellor',
    },
    {
      screen: 'CFRegistration',
      params: {},
      icon: 'person-add',
      color: COLORS.navy,
      label: 'Center Function Registration',
      desc: 'Register a new student and notify their counsellor',
      protected: true,
      type: 'cf',
    },
    {
      screen: 'QRScan',
      params: { mode: 'counsellor' },
      icon: 'list',
      color: COLORS.blue,
      label: 'Counsellor Portal',
      desc: 'Select the student programme and notify the student',
      protected: true,
      type: 'counsellor',
    },
    {
      screen: 'QRScan',
      params: { mode: 'student' },
      icon: 'cloud-upload',
      color: COLORS.green,
      label: 'Student Portal',
      desc: 'Submit required documents for registration',
      protected: false,
    },
  ];

  const handleRolePress = async (role) => {
    if (role.protected) {
      try {
        const token = await AsyncStorage.getItem('counsellorSession');
        if (token) {
          const parts = token.split('.');
          const payload = parts.length === 3 ? JSON.parse(atob(parts[1])) : {};
          const activeRole = payload.role || sessionUser?.role || '';

          // A Counsellor trying to access a CF-only tile → redirect to their scoped dashboard
          if (role.type === 'cf' && isCounsellorRole(activeRole)) {
            navigation.navigate('CFDashboard', {
              counsellorName: payload.name || sessionUser?.name,
              counsellorEmail: payload.email || sessionUser?.email,
            });
            return;
          }

          // A CF user trying to access the Counsellor tile → redirect to their full dashboard
          if (role.type === 'counsellor' && isCfRole(activeRole)) {
            navigation.navigate('CFDashboard', {});
            return;
          }

          if (role.type === 'counsellor') {
            navigation.navigate(role.screen, {
              counsellorName: payload.name || sessionUser?.name,
              counsellorEmail: payload.email || sessionUser?.email,
            });
            return;
          }

          navigation.navigate(role.screen, role.params);
          return;
        }

        navigation.navigate('StaffLogin', {
          type: role.type,
          redirectTo: role.screen,
          redirectParams: role.params,
        });
      } catch (e) {
        navigation.navigate('StaffLogin', {
          type: role.type,
          redirectTo: role.screen,
          redirectParams: role.params,
        });
      }
      return;
    }

    navigation.navigate(role.screen, role.params);
  };



  const openMenu = () => {
    setMenuVisible(true);
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: Dimensions.get('window').width,
      duration: 220,
      useNativeDriver: false,
    }).start(() => setMenuVisible(false));
  };

  const handleLogout = async (clearCache = false) => {
    try {
      if (clearCache) {
        await AsyncStorage.clear();
      } else {
        await AsyncStorage.removeItem('counsellorSession');
      }
      setSessionUser(null);
    } catch (e) {
      console.warn('Unable to clear counsellor session:', e);
    } finally {
      closeMenu();
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache & Logout',
      'This will log you out and clear all local app data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: async () => {
        await handleLogout(true);
        }},
      ]
    );
  };

  useEffect(() => {
    setSettingsState((prev) => ({ ...prev, enabled: !!sessionUser?.twoFactorEnabled, codeSent: false, otp: '' }));
  }, [sessionUser]);

  const handleSettingsTwoFactorToggle = async (nextEnabled) => {
  const email = sessionUser?.email;
  if (!email) {
    Alert.alert('Error', 'No email found for your account.');
    return;
  }

  // If enabling 2FA, first set up the TOTP secret and QR code
  if (nextEnabled) {
    setSettingsState((prev) => ({ ...prev, loading: true, codeSent: false, otp: '' }));
    try {
      const res = await setupTwoFactor({ email, name: sessionUser?.name || 'Staff' });
      if (res.data?.success && res.data?.data) {
        setSettingsState((prev) => ({
          ...prev,
          loading: false,
          setupVisible: true,
          secret: res.data.data.secret,
          qrCodeUri: res.data.data.qr_code_uri,
          manualCode: res.data.data.manual_code,
          otp: '',
        }));
        return;
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to initialize 2FA setup.');
      }
    } catch (e) {
      console.error('Error setting up 2FA:', e);
      Alert.alert('Error', e.response?.data?.message || 'Unable to initialize 2FA setup. Please try again.');
    } finally {
      setSettingsState((prev) => ({ ...prev, loading: false }));
    }
    return;
  }

  // Disabling 2FA
  setSettingsState((prev) => ({ ...prev, loading: true }));
  try {
    const res = await enableTwoFactor({ email, enabled: false, method: 'totp' });
    if (res.data?.success) {
      if (res.data.token) {
        await AsyncStorage.setItem('counsellorSession', res.data.token);
      }
      setSessionUser((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
      setSettingsState((prev) => ({ ...prev, enabled: false }));
      Alert.alert('Success', 'Two-Factor Authentication has been disabled.');
    } else {
      Alert.alert('Error', res.data?.message || 'Failed to disable 2FA.');
    }
  } catch (e) {
    console.error('Error disabling 2FA:', e);
    Alert.alert('Error', e.response?.data?.message || 'Unable to disable 2FA.');
  } finally {
    setSettingsState((prev) => ({ ...prev, loading: false, codeSent: false, otp: '' }));
  }
};

const handleConfirmSettingsCode = async () => {
  const email = sessionUser?.email;
  if (!email) {
    Alert.alert('Error', 'No email found for your account.');
    return;
  }
  
  if (settingsState.otp.trim().length !== 6) {
    Alert.alert('Error', 'Please enter a valid 6-digit verification code.');
    return;
  }

  setSettingsState((prev) => ({ ...prev, loading: true }));
  try {
      const res = await enableTwoFactor({
      email,
      otp: settingsState.otp.trim(),
      secret: settingsState.secret,
      enabled: true,
      method: 'totp'
    });
    if (res.data?.success) {
      if (res.data.token) {
        await AsyncStorage.setItem('counsellorSession', res.data.token);
      }
      setSessionUser((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
      setSettingsState((prev) => ({ ...prev, enabled: true, codeSent: false, otp: '' }));
      Alert.alert('Success', 'Two-Factor Authentication has been enabled.');
      setSettingsState((prev) => ({ ...prev, codeSent: false, otp: '', setupVisible: false }));
      setSettingsVisible(false);
    } else {
      Alert.alert('Error', res.data?.message || 'Failed to enable 2FA. Please check your code and try again.');
    }
  } catch (e) {
    console.error('Error enabling 2FA:', e);
    Alert.alert('Error', e.response?.data?.message || 'Invalid verification code. Please try again.');
  } finally {
    setSettingsState((prev) => ({ ...prev, loading: false }));
  }
};

  const profileType = isCounsellorRole(sessionUser?.role) ? 'counsellor' : 'cf';
  const visibleRoles = ROLES.filter((role) => role.label === 'Student Portal');
  const menuRoles = ROLES.filter((role) => {
    if (role.label === 'Student Portal') return false;
    if (!sessionUser) return true;
    return isCounsellorRole(sessionUser.role)
      ? role.type === 'counsellor'
      : role.type === 'cf';
  });
  const twoFactorEnabled = !!sessionUser?.twoFactorEnabled;
  const profileLastLogin = sessionUser?.lastLogin
    ? new Date(sessionUser.lastLogin).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : 'N/A';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
      <LinearGradient colors={[COLORS.navy, COLORS.blue]} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity style={{ position: 'absolute', top: insets.top + 16, left: 20, zIndex: 10 }} onPress={openMenu}>
          <Ionicons name="menu" size={26} color={COLORS.white} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 10 }}>
          <View style={styles.logoMark}>
            <Image source={homeLogo} style={{ width:52, height: 52, borderRadius: 8 }} resizeMode="contain" />
          </View>
          {/* <Text style={[styles.brand, fontsLoaded && styles.poppinsSemiBold]}>Student Docs</Text> */}
          <Text style={[styles.brand, fontsLoaded && styles.poppinsSemiBold, { textAlign: 'center' }]}>Document Management {'\n'} System</Text>
          {/* <Text style={styles.tag}>Document Portal</Text> */}
        </View>

        <View style={styles.heroActions} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.sub}>Select your role to continue.</Text>

        {sessionLoading ? null : visibleRoles.map((r) => (
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
                    {/* <Text style={styles.lockBadgeTxt}>PIN Protected</Text> */}
                  </View>
                )}
              </View>
              <Text style={styles.cardDesc}>{r.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        ))}

        <Text style={styles.footer}>© {new Date().getFullYear()} UWL Branch Campus Operated By ANC Education, {'\n'}Sri Lanka</Text>
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="none">
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={closeMenu} />
          <Animated.View style={[styles.drawerPanel, { transform: [{ translateX: menuAnimation }] }]}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                {/* <Ionicons name="person" size={24} color={COLORS.white} /> */}
                <Image source={homeLogo} style={{ width: 24, height: 24, borderRadius: 6 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                {/* <Text style={[styles.drawerTitle, fontsLoaded && styles.poppinsSemiBold]}>Student Docs</Text> */}
                <Text style={[styles.drawerTitle, fontsLoaded && styles.poppinsSemiBold]}>DMS</Text>
                {/* <Text style={styles.drawerSubtitle}>Secure staff portal</Text> */}
              </View>
              <TouchableOpacity onPress={closeMenu}>
                <Ionicons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { closeMenu(); navigation.navigate('Home'); }}>
              <Ionicons name="home-outline" size={18} color={COLORS.navy} />
              <Text style={styles.drawerItemText}>Home</Text>
            </TouchableOpacity>
            {menuRoles.map((role) => (
              <TouchableOpacity
                key={role.label}
                style={styles.drawerItem}
                onPress={() => { closeMenu(); handleRolePress(role); }}
              >
                <Ionicons name={role.icon} size={18} color={role.color} />
                <Text style={styles.drawerItemText}>{role.label}</Text>
              </TouchableOpacity>
            ))}
            {sessionUser ? (
              <>
                <TouchableOpacity style={styles.drawerItem} onPress={() => { closeMenu(); setProfileVisible(true); }}>
                  <Ionicons name="person-circle-outline" size={18} color={COLORS.navy} />
                  <Text style={styles.drawerItemText}>My Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={() => { closeMenu(); setSettingsVisible(true); }}>
                  <Ionicons name="settings-outline" size={18} color={COLORS.navy} />
                  <Text style={styles.drawerItemText}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color={COLORS.navy} />
                  <Text style={styles.drawerItemText}>Logout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.drawerItem} onPress={handleClearCache}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                  <Text style={[styles.drawerItemText, { color: COLORS.red }]}>Clear Cache</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Animated.View>
        </View>
      </Modal>



      <Modal visible={profileVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.settingsCard, { maxHeight: '80%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsTitle}>My Profile</Text>
                <TouchableOpacity onPress={() => setProfileVisible(false)}>
                  <Ionicons name="close" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <View style={styles.profileRow}>
                <Ionicons name="person-circle-outline" size={48} color={COLORS.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{sessionUser?.name || 'Staff Account'}</Text>
                  <Text style={styles.profileMeta}>{sessionUser?.email || 'No email'}</Text>
                </View>
              </View>

              <View style={[styles.profileDetailBox, { marginTop: 16 }]}>
                <View style={styles.profileDetailRow}>
                  <Text style={styles.profileDetailLabel}>Full Name</Text>
                  <Text style={styles.profileDetailValue}>{sessionUser?.name || 'N/A'}</Text>
                </View>
                <View style={[styles.profileDetailRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
                  <Text style={styles.profileDetailLabel}>Email</Text>
                  <Text style={styles.profileDetailValue}>{sessionUser?.email || 'N/A'}</Text>
                </View>
                <View style={[styles.profileDetailRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
                  <Text style={styles.profileDetailLabel}>Role</Text>
                  <Text style={styles.profileDetailValue}>{sessionUser?.role || 'Staff'}</Text>
                </View>
                <View style={[styles.profileDetailRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
                  <Text style={styles.profileDetailLabel}>Last Login</Text>
                  <Text style={styles.profileDetailValue}>{profileLastLogin}</Text>
                </View>
                <View style={[styles.profileDetailRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
                  <Text style={styles.profileDetailLabel}>2FA</Text>
                  <Text style={styles.profileDetailValue}>{twoFactorEnabled ? 'Enabled' : 'Disabled'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.profileActionBtn, { marginTop: 16 }]}
                onPress={() => {
                  setProfileVisible(false);
                  navigation.navigate('ForgotPassword', {
                    email: sessionUser?.email || '',
                    type: profileType,
                    mode: 'profile',
                  });
                }}
              >
                {/* <Ionicons name="key-outline" size={18} color={COLORS.navy} /> */}
                <Text style={styles.profileActionBtnText}>Change Password</Text>
              </TouchableOpacity>

              <View style={[styles.profileDetailBox, { marginTop: 12, backgroundColor: COLORS.navy + '10' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {/* <Ionicons name="shield-checkmark" size={18} color={COLORS.navy} /> */}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.navy }}>Account Security</Text>
                </View>
                <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
                  {twoFactorEnabled
                    ? 'Two-Factor Authentication is enabled. A verification code will be sent to your email when you sign in.'
                    : 'Two-Factor Authentication is currently disabled. Enable it in Settings to add an extra layer of security to your account.'}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.settingsCard, { maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 20 }} >
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsTitle}>Settings</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                  <Ionicons name="close" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <View style={styles.settingsSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsLabel}>Two-Factor Authentication</Text>
                  <Text style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                    {twoFactorEnabled
                      ? 'Two-factor authentication is enabled. A 6-digit verification code will be sent to your email when you sign in.'
                      : 'Enable two-factor authentication to add an extra layer of security to your account.'}
                  </Text>
                </View>
                <Switch
                  value={settingsState.enabled}
                  onValueChange={handleSettingsTwoFactorToggle}
                  thumbColor={COLORS.white}
                  trackColor={{ false: COLORS.border, true: COLORS.blue }}
                  disabled={settingsState.loading}
                />
              </View>

              {settingsState.setupVisible ? (
                <View style={styles.settingsBox}>
                  <Text style={styles.settingsBoxText}>
                    Scan the QR code with your authenticator app, or enter the setup key manually. Then enter the 6-digit code from the app to verify.
                  </Text>
                  {settingsState.qrCodeUri ? (
                    <View style={styles.qrCard}>
                      <Text style={styles.qrTitle}>Set Up Authenticator</Text>

                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                            settingsState.qrCodeUri
                          )}`,
                        }}
                        style={styles.qrImage}
                      />

                      {/* <Text style={styles.qrText}>
                        Scan the QR code with your authenticator app.
                      </Text> */}

                      <Text
                        style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center' }} > OR </Text>

                      {/* Manual Code */}
                      <View style={styles.manualCodeRow}>
                        <Text style={styles.manualCodeText} selectable>
                          {settingsState.manualCode}
                        </Text>

                        <TouchableOpacity
                          style={styles.copyCodeBtn}
                          onPress={async () => {
                            await Clipboard.setStringAsync(settingsState.manualCode);
                            Alert.alert('Copied', 'Manual setup key copied to clipboard.');
                          }}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={18}
                            color={COLORS.navy}
                          />
                          {/* <Text style={styles.copyCodeText}>Copy</Text> */}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  <View style={{ marginTop: 10 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: COLORS.navy,
                        marginBottom: 5,
                      }}
                    >
                      Verification Code
                    </Text>

                    <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>
                      Enter the 6-digit code shown in your authenticator app.
                    </Text>

                    <TextInput style={[ styles.twoFactorInput, { 
                          textAlign: 'center',
                          fontSize: 20,
                          fontWeight: '700',
                          letterSpacing: 6,
                          marginBottom: 8,
                        },
                      ]}
                      value={settingsState.otp}
                      onChangeText={(text) =>
                        setSettingsState((prev) => ({
                          ...prev,
                          otp: text.replace(/\D/g, '').slice(0, 6),
                        }))
                      }
                      placeholder="000000"
                      placeholderTextColor={COLORS.muted}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={6}
                      returnKeyType="done"
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginTop: 4 }]}
                    onPress={handleConfirmSettingsCode}
                    disabled={settingsState.loading || settingsState.otp.trim().length !== 6}
                  >
                    <Text style={styles.secondaryBtnText}>{settingsState.loading ? 'Verifying...' : 'Confirm code'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={[styles.profileDetailBox, { marginTop: 12, backgroundColor: COLORS.navy + '10' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Ionicons name="information-circle" size={18} color={COLORS.navy} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.navy }}>About Two-Factor Authentication</Text>
                </View>
                <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
                  Two-factor authentication adds an extra layer of security. When enabled, you'll need your password and a 6-digit code from your authenticator app to sign in.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  hero: { alignItems: 'center', paddingBottom: 32, position: 'relative' },
  heroActions: { position: 'absolute', top: 20, right: 20 },
  heroProfileWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, gap: 10 },
  heroProfileInfo: { alignItems: 'flex-end', justifyContent: 'center' },
  heroProfileName: { color: '#fff', fontSize: 13, fontWeight: '700', maxWidth: 120 },
  heroProfileRole: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' },
  heroLogoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  heroLogoutTxt: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  logoMark: {
    width: 60, height: 60, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    overflow: 'hidden'
  },
  brand: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  poppinsSemiBold: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' },
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
  footer: { textAlign: 'center', color: COLORS.muted, fontSize: 12, marginTop: 360 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.35)' },
  drawerPanel: { width: '78%', backgroundColor: COLORS.white, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  drawerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  drawerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  drawerSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  drawerItemText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  settingsCard: { width: '90%', maxWidth: 420, backgroundColor: COLORS.white, borderRadius: 20, padding: 20 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  settingsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  settingsText: { fontSize: 13, color: COLORS.muted, marginBottom: 12 },
  settingsSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingVertical: 8 },
  settingsLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  settingsBox: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: COLORS.bg },
  settingsBoxText: { fontSize: 12, color: COLORS.muted, marginBottom: 8 },
  qrCard: { marginTop: 8, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  qrTitle: { fontSize: 12, fontWeight: '700', color: COLORS.navy, marginBottom: 8 },
  qrImage: { width: 180, height: 180, marginBottom: 8, borderRadius: 12 },
  qrText: { fontSize: 12, color: COLORS.text, textAlign: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 16 },
  profileName: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  profileMeta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  profileDetailBox: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 14 },
  profileDetailRow: { paddingVertical: 0 },
  profileDetailLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileDetailValue: { fontSize: 13, fontWeight: '700', color: COLORS.navy, marginTop: 4 },
  profileActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.navy, borderRadius: 12, paddingVertical: 12 },
  profileActionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
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
    width: '100%', padding: 10, fontSize: 28, letterSpacing: 12,
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
  twoFactorSection: { width: '100%', marginBottom: 16, padding: 12, borderRadius: 14, backgroundColor: COLORS.bg },
  twoFactorTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, marginBottom: 4 },
  staffEmailInput: { width: '100%', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 13, color: COLORS.text, marginBottom: 8 },
  twoFactorSub: { fontSize: 12, color: COLORS.muted, marginBottom: 10 },
  twoFactorBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: COLORS.navy },
  twoFactorBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  twoFactorCard: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  twoFactorHint: { fontSize: 12, color: COLORS.text, marginBottom: 8 },
  twoFactorInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, fontSize: 14, color: COLORS.text, marginBottom: 8 },
  manualCodeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.bg, paddingLeft: 12, overflow: 'hidden' },
  manualCodeText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.navy, letterSpacing: 1 },
  copyCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 11, borderLeftWidth: 1, borderLeftColor: COLORS.border, backgroundColor: COLORS.white },
  copyCodeText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  twoFactorActions: { flexDirection: 'row', gap: 8 },
  secondaryBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.navy },
  secondaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  qrCodeText: { marginTop: 8, fontSize: 11, color: COLORS.muted },
  pinBtnDisabled: { opacity: 0.45 },
  pinBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pinCancelBtn: { paddingVertical: 10 },
  pinCancelTxt: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },

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

  ccOverlay: { flex: 1, backgroundColor: 'rgba(10,36,99,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  ccCard: {
    width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: COLORS.white, borderRadius: 28,
    padding: 26, shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.3, shadowRadius: 48, elevation: 24,
  },
  ccCloseBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 2,
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  ccHeader: { alignItems: 'center', marginBottom: 20, paddingTop: 6 },
  ccIconWrap: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
  },
  ccTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: 6, textAlign: 'center' },
  ccSubtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 6 },

  ccToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 20, backgroundColor: COLORS.bg, borderRadius: 14, padding: 4 },
  ccToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  ccToggleBtnActive: { backgroundColor: COLORS.navy },
  ccToggleTxt: { fontSize: 12.5, fontWeight: '700', color: COLORS.muted },
  ccToggleTxtActive: { color: '#fff' },

  ccFieldGroup: { marginBottom: 14 },
  ccFieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: COLORS.navy, opacity: 0.7, marginBottom: 7 },
  ccInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14, height: 50,
  },
  ccInputIcon: { flexShrink: 0 },
  ccInputValue: { flex: 1, fontSize: 14, color: COLORS.navy, fontWeight: '600' },
  ccInputPlaceholder: { flex: 1, fontSize: 14, color: COLORS.muted },
  ccTextInput: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600', height: '100%' },
  ccPinTextInput: { letterSpacing: 6, fontWeight: '800' },

  ccDropdownList: {
    marginTop: 8, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    backgroundColor: COLORS.white, padding: 8,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  ccDropdownSearch: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 10, fontSize: 13, color: COLORS.text, marginBottom: 8,
  },
  ccDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10 },
  ccDropdownItemTxt: { fontSize: 13.5, color: COLORS.text, fontWeight: '600' },
  ccDropdownEmpty: { fontSize: 12.5, color: COLORS.muted, textAlign: 'center', paddingVertical: 14 },

  ccPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15, marginTop: 4,
  },
});