import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Modal, FlatList, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function UploadBox({ index, label, file, onFile, onRemove }) {
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  // ── multi-page scan state ──
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scannedPages, setScannedPages] = useState([]);
  const [converting, setConverting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── request camera permission ──
  const ensureCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to scan documents.');
      return false;
    }
    return true;
  };

  // ── take one more photo (with crop) ──
  const takePage = async () => {
    if (!(await ensureCameraPermission())) return;
    try {
      const r = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: true,
        allowsEditing: true,   // ← enables built-in crop UI after each shot
        aspect: [3, 4],        // portrait crop guide (A4-ish)
      });
      if (!r.canceled && r.assets?.[0]) {
        const a = r.assets[0];
        setScannedPages((prev) => [...prev, { uri: a.uri, base64: a.base64 }]);
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  // ── open scan session (first page, with crop) ──
  const openScanModal = async () => {
    if (!(await ensureCameraPermission())) return;
    setScannedPages([]);
    setScanModalVisible(true);
    try {
      const r = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: true,
        allowsEditing: true,   // enables built-in crop UI after each shot
        aspect: [3, 4],        
      });
      if (!r.canceled && r.assets?.[0]) {
        const a = r.assets[0];
        setScannedPages([{ uri: a.uri, base64: a.base64 }]);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  // ── remove one scanned page ──
  const removePage = (pageIndex) => {
    setScannedPages((prev) => prev.filter((_, i) => i !== pageIndex));
  };

  // ── build multi-page PDF and finish ──
  const buildPDF = async () => {
    if (scannedPages.length === 0) {
      Alert.alert('No Pages', 'Please scan at least one page.');
      return;
    }
    setConverting(true);
    try {
      const pageHtml = scannedPages
        .map(
          (p, i) => `
          <div class="page">
            <img src="data:image/jpeg;base64,${p.base64}" />
          </div>${i < scannedPages.length - 1 ? '<div class="break"></div>' : ''}
        `
        )
        .join('');

      const html = `
        <html>
          <head>
            <style>
              @page { margin: 0; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { background: white; }
              .page {
                width: 100%;
                page-break-after: always;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              .page img {
                width: 100%;
                height: auto;
                display: block;
              }
              .break { page-break-after: always; }
            </style>
          </head>
          <body>
            ${pageHtml}
          </body>
        </html>
      `;

      const { uri: pdfUri } = await Print.printToFileAsync({ html });

      const pageCount = scannedPages.length;
      setScanModalVisible(false);
      setScannedPages([]);
      onFile(index, {
        uri: pdfUri,
        name: `scan_${index === 'agreement' ? 'agreement' : index + 1}_${pageCount}pg.pdf`,
        mimeType: 'application/pdf',
      });
    } catch (err) {
      console.error('PDF build error:', err);
      Alert.alert('Conversion Error', 'Failed to convert scans to PDF.');
    } finally {
      setConverting(false);
    }
  };

  // ── pick existing PDF ──
  const pickFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!r.canceled && r.assets?.[0]) {
        const a = r.assets[0];
        if (a.fileSize && a.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Maximum file size is 5 MB.');
          return;
        }
        onFile(index, { uri: a.uri, name: a.name, mimeType: a.mimeType });
      }
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  // ── open/preview file ──
  // expo-sharing handles the file:// → content:// URI conversion internally,
  // which avoids Android's FileUriExposedException. On Android it opens the
  // system app-chooser so the user can pick any installed PDF viewer.
  // On iOS it opens the standard share/preview sheet.
  const previewFile = async () => {
    if (!file?.uri) {
      Alert.alert('Error', 'No file to preview');
      return;
    }
    setPreviewLoading(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Preview Unavailable', 'No PDF viewer found on this device.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Open PDF with…',
        UTI: 'com.adobe.pdf', // iOS hint
      });
    } catch (err) {
      console.error('Error previewing file:', err);
      Alert.alert('Preview Error', 'Failed to open PDF. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── render ──
  return (
    <View style={[styles.box, file && styles.boxDone]}>
      <View style={styles.labelRow}>
        <View style={[styles.badge, file && styles.badgeDone]}>
          {file
            ? <Ionicons name="checkmark" size={12} color="#fff" />
            : <Text style={styles.badgeNum}>{index === 'agreement' ? '*' : index + 1}</Text>}
        </View>
        <Text style={styles.label} numberOfLines={3}>{label}</Text>
      </View>

      {file ? (
        <View style={styles.fileRow}>
          <Ionicons name="document-attach" size={16} color={COLORS.green} />
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          <TouchableOpacity
            onPress={previewFile}
            style={{ marginRight: 8 }}
            disabled={previewLoading}
          >
            {previewLoading ? (
              <ActivityIndicator size="small" color={COLORS.blue} />
            ) : (
              <Ionicons name="eye" size={20} color={COLORS.blue} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(index)}>
            <Ionicons name="close-circle" size={20} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={openScanModal}>
            <Ionicons name="camera" size={16} color={COLORS.navy} />
            <Text style={styles.actionTxt}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={pickFile}>
            <Ionicons name="document-text" size={16} color={COLORS.navy} />
            <Text style={styles.actionTxt}>Upload PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal remains the same as before */}
      <Modal
        visible={scanModalVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!converting) {
            setScanModalVisible(false);
            setScannedPages([]);
          }
        }}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                if (!converting) {
                  setScanModalVisible(false);
                  setScannedPages([]);
                }
              }}
              disabled={converting}
            >
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Scan Document</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.pageBanner}>
            <Ionicons name="images-outline" size={16} color={COLORS.blue} />
            <Text style={styles.pageBannerTxt}>
              {scannedPages.length === 0
                ? 'No pages yet — tap "Add Page" to scan'
                : `${scannedPages.length} page${scannedPages.length !== 1 ? 's' : ''} scanned`}
            </Text>
          </View>

          {scannedPages.length > 0 ? (
            <FlatList
              data={scannedPages}
              keyExtractor={(_, i) => String(i)}
              horizontal={false}
              numColumns={1}
              contentContainerStyle={styles.thumbGrid}
              renderItem={({ item, index: pi }) => (
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="contain" />
                  <View style={styles.thumbOverlay}>
                    <Text style={styles.thumbNum}>Page {pi + 1}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removePage(pi)}
                    disabled={converting}
                  >
                    <Ionicons name="close-circle" size={22} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="scan-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTxt}>Tap "Add Page" to start scanning</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.addPageBtn]}
              onPress={takePage}
              disabled={converting}
            >
              <Ionicons name="camera-outline" size={18} color={COLORS.navy} />
              <Text style={[styles.modalBtnTxt, { color: COLORS.navy }]}>Add Page</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalBtn,
                styles.buildPdfBtn,
                scannedPages.length === 0 && styles.disabledBtn,
              ]}
              onPress={buildPDF}
              disabled={scannedPages.length === 0 || converting}
            >
              {converting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={[styles.modalBtnTxt, { color: '#fff' }]}>
                    Create PDF ({scannedPages.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  box: {
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: 12, padding: 12, backgroundColor: COLORS.bg, marginBottom: 10,
  },
  boxDone: { borderColor: COLORS.green, backgroundColor: COLORS.bg, borderStyle: 'solid' },
  labelRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  badge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.muted,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, marginTop: 1, flexShrink: 0,
  },
  badgeDone: { backgroundColor: COLORS.green },
  badgeNum: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  label: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text, lineHeight: 18 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bg, borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: COLORS.green,
  },
  fileName: { flex: 1, fontSize: 12, color: COLORS.text, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1.5, borderColor: COLORS.navy,
    borderRadius: 8, paddingVertical: 7, backgroundColor: COLORS.bg,
  },
  actionTxt: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalCloseBtn: { padding: 6 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  pageBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  pageBannerTxt: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  thumbGrid: { padding: 12, gap: 14 },
  thumbWrap: {
    width: SCREEN_W - 24, margin: 0, borderRadius: 12, overflow: 'hidden',
    aspectRatio: 0.707, // A4 portrait
    backgroundColor: COLORS.border,
    position: 'relative',
    alignSelf: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  thumb: { width: '100%', height: '100%', backgroundColor: '#fff' },
  thumbOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, alignItems: 'center',
  },
  thumbNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  thumbRemove: { position: 'absolute', top: 6, right: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTxt: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },
  modalActions: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  addPageBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5, borderColor: COLORS.navy,
  },
  buildPdfBtn: {
    backgroundColor: COLORS.navy,
  },
  disabledBtn: { opacity: 0.4 },
  modalBtnTxt: { fontSize: 14, fontWeight: '700' },
});