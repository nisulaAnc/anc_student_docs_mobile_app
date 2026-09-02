import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function TopBar({ onBack, rightText, title, rightElement, showSecurityIcon = false, university = 'ANC' }) {
  const { colors: COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(COLORS);
  const normalizedUniversity = String(university || '').toUpperCase();
  const logoSource = normalizedUniversity === 'UWL'
    ? require('../../assets/UWL-Logo.png')
    : normalizedUniversity === 'ANC'
      ? require('../../assets/logo.png')
      : require('../../assets/Docs logo.png');
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.leftContainer}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <Image source={logoSource} style={{ width: 22, height: 22 }} resizeMode="contain" />
          </View>
          {!onBack && (
            <View>
              <Text style={styles.logoName}>ANC Student Docs</Text>
              <Text style={styles.logoTag}>Document Portal</Text>
            </View>
          )}
          {onBack && title ? (
            <Text style={styles.barTitle} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>
      </View>

      {/* Right side: custom element, chip, or spacer */}
      {rightElement ? (
        rightElement
      ) : rightText ? (
        <View style={styles.chip}>
          <Ionicons name="mail-outline" size={12} color={COLORS.accent} />
          <Text style={[styles.chipText, { color: COLORS.blue }]} numberOfLines={1}>{rightText}</Text>
        </View>
      ) : <View style={{ flex: 1 }} />}

      {showSecurityIcon ? (
        <View style={styles.themeToggle}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.navy} />
        </View>
      ) : <View style={{ width: 36 }} />}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  bar: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  leftContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    padding: 4,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden'
  },
  logoName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  logoTag: { fontSize: 9, color: COLORS.accent, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700' },
  barTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, maxWidth: 180 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    maxWidth: 180,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  themeToggle: {
    marginLeft: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  authRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  authBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  authBtnPrimary: { backgroundColor: '#0A2463', borderColor: '#0A2463' },
  authBtnText: { fontSize: 13, color: '#0A2463', fontWeight: '700' },
  authBtnPrimaryText: { color: '#fff' },
});