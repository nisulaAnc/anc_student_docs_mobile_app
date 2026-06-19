import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function QRScanScreen({ navigation, route }) {
  const { mode } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();

  const targetScreen = mode === 'counsellor' ? 'CounsellorPortal' : 'StudentPortal';
  const title = mode === 'counsellor' ? 'Counsellor Portal' : 'Student Portal';

  const goToPortal = (token) => {
    const t = token.trim();
    if (!t) return;
    navigation.replace(targetScreen, { token: t });
  };

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    let token = data;
    try {
      const url = new URL(data);
      token = url.searchParams.get('token') || data;
    } catch (_) { }
    goToPortal(token);
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permRoot, { paddingTop: insets.top, backgroundColor: COLORS.white }]}>
        <Ionicons name="camera-outline" size={64} color={COLORS.muted} />
        <Text style={[styles.permTitle, { color: COLORS.navy }]}>Camera Permission Required</Text>
        <Text style={[styles.permSub, { color: COLORS.muted }]}>We need camera access to scan QR codes.</Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: COLORS.navy }]} onPress={requestPermission}>
          <Text style={styles.permBtnTxt}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowManual(true)} style={{ marginTop: 16 }}>
          <Text style={[styles.link, { color: COLORS.accent }]}>Enter token manually instead</Text>
        </TouchableOpacity>
        {showManual && (
          <ManualSheet
            token={manualToken} setToken={setManualToken}
            onGo={goToPortal} onClose={() => setShowManual(false)}
            COLORS={COLORS}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        {/* Top */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.scanTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Frame */}
        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <View style={[styles.corner, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 }]} />
            <View style={[styles.corner, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 }]} />
            <View style={[styles.corner, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 }]} />
            <View style={[styles.corner, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 }]} />
          </View>
          <Text style={styles.hint}>Point camera at QR code</Text>
        </View>

        {/* Bottom */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          {scanned && (
            <TouchableOpacity style={styles.rescan} onPress={() => setScanned(false)}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.rescanTxt}>Scan Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.manualBtn} onPress={() => setShowManual(true)}>
            <Ionicons name="keypad-outline" size={18} color="#fff" />
            <Text style={styles.manualTxt}>Enter Token Manually</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showManual && (
        <ManualSheet
          token={manualToken} setToken={setManualToken}
          onGo={goToPortal} onClose={() => setShowManual(false)}
          insets={insets} COLORS={COLORS}
        />
      )}
    </View>
  );
}

function ManualSheet({ token, setToken, onGo, onClose, insets = {}, COLORS }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.manualOverlay}
    >
      <View style={[styles.manualSheet, { paddingBottom: (insets.bottom || 0) + 16, backgroundColor: COLORS.white }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={[styles.sheetTitle, { color: COLORS.text }]}>Enter Token Manually</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.tokenInput, { borderColor: COLORS.border, color: COLORS.navy, backgroundColor: COLORS.bg }]}
          placeholder="Enter 8-digit token here..."
          placeholderTextColor={COLORS.muted}
          value={token}
          onChangeText={setToken}
          autoFocus={true}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numeric"
          maxLength={8}
        />
        <TouchableOpacity style={[styles.goBtn, { backgroundColor: COLORS.navy }]} onPress={() => onGo(token)}>
          <Text style={styles.goBtnTxt}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const C = 26;
const styles = StyleSheet.create({
  permRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  permSub: { textAlign: 'center', marginTop: 8, marginBottom: 24 },
  permBtn: { borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  permBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { fontSize: 14 },
  overlay: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.45)' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 250, height: 250 },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#fff', borderWidth: 3.5 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 20 },
  bottom: { backgroundColor: 'rgba(0,0,0,0.55)', padding: 20, alignItems: 'center', gap: 10 },
  rescan: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  rescanTxt: { color: '#fff', fontWeight: '600' },
  manualBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 10 },
  manualTxt: { color: '#fff', fontWeight: '600' },
  manualOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  manualSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  tokenInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 54, marginBottom: 14 },
  goBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  goBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
