import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function AlertBox({ type = 'success', message }) {
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  if (!message) return null;
  const isSuccess = type === 'success';
  return (
    <View style={[styles.box, isSuccess ? styles.success : styles.error]}>
      <Ionicons
        name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={isSuccess ? COLORS.green : COLORS.red}
        style={{ marginTop: 1 }}
      />
      <Text style={[styles.text, { color: isSuccess ? '#15803D' : COLORS.red }]}>{message}</Text>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 16,
  },
  success: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  error: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});