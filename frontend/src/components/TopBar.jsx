import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function TopBar({ onBack, rightText }) {
  const { theme, toggleTheme, colors: COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(COLORS);
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
            <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
          </View>
          {!onBack && (
            <View>
              <Text style={styles.logoName}>ANC Student Docs</Text>
              <Text style={styles.logoTag}>Document Portal</Text>
            </View>
          )}
        </View>
      </View>
      {rightText ? (
        <View style={styles.chip}>
          <Ionicons name="mail-outline" size={12} color={COLORS.accent} />
          <Text style={[styles.chipText, { color: COLORS.blue }]} numberOfLines={1}>{rightText}</Text>
        </View>
      ) : <View style={{ flex: 1 }} />}

      <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
        <Ionicons
          name={theme === 'dark' ? 'sunny' : 'moon'}
          size={20}
          color={theme === 'dark' ? '#FFD700' : COLORS.navy}
        />
      </TouchableOpacity>
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
});