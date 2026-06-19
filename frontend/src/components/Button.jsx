import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function Button({ title, onPress, loading, disabled, variant = 'navy', icon, style }) {
  const { colors: COLORS } = useTheme();

  const bg = variant === 'green'
    ? { backgroundColor: COLORS.green }
    : variant === 'outline'
    ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.border }
    : { backgroundColor: COLORS.navy };

  const textColor = variant === 'outline' ? COLORS.text : COLORS.white;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        bg,
        { shadowColor: COLORS.navy },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? icon : null}
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%', paddingVertical: 15,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
