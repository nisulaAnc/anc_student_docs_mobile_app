import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CardHeader({ eyebrow, title, subtitle, variant = 'blue' }) {
  const colors = variant === 'green'
    ? ['#15803D', '#16A34A']
    : ['#0A2463', '#1447B8'];
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  head: { padding: 28, paddingHorizontal: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 5 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
});