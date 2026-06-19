import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../components/TopBar';
import CardHeader from '../components/CardHeader';
import AlertBox from '../components/AlertBox';
import OTPInput from '../components/OTPInput';
import Button from '../components/Button';
import UploadBox from '../components/UploadBox';
import {
  getStudentTokenInfo, studentRequestOTP,
  studentVerifyOTP, submitDocuments,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

const PHASE = { LOAD: 0, REQUEST: 1, VERIFY: 2, UPLOAD: 3, DONE: 4 };

export default function StudentPortalScreen({ navigation, route }) {
  const { token } = route.params;
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);
  const infoStyles = createInfoStyles(COLORS);
  const [phase, setPhase] = useState(PHASE.LOAD);
  const [data, setData] = useState(null);
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [otp, setOtp] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [files, setFiles] = useState({});
  const [agreementFile, setAgreementFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => { loadToken(); }, []);

  const loadToken = async () => {
    try {
      const res = await getStudentTokenInfo(token);
      setData(res.data.data);
      setPhase(PHASE.REQUEST);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
      setPhase(PHASE.REQUEST);
    }
  };

  const requestOTP = async () => {
    setLoading(true); setAlert(null);
    try {
      const res = await studentRequestOTP(token);
      setAlert({ type: 'success', msg: res.data.message });
      setPhase(PHASE.VERIFY);
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || e.message });
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (otp.replace(/\s/g, '').length < 6) { setOtpErr('Enter the complete 6-digit code'); return; }
    setOtpErr(''); setLoading(true);
    try {
      const res = await studentVerifyOTP(token, otp);
      const docs = res.data.data?.required_documents || [];
      setRequiredDocs(docs);
      setFiles({});
      setAlert(null);
      setPhase(PHASE.UPLOAD);
    } catch (e) {
      setOtpErr(e.response?.data?.message || 'Invalid OTP. Try again.');
    } finally { setLoading(false); }
  };

  const handleFile = (index, file) => setFiles((prev) => ({ ...prev, [index]: file }));
  const handleRemove = (index) => setFiles((prev) => { const c = { ...prev }; delete c[index]; return c; });

  const uploadedCount = Object.keys(files).length + (agreementFile ? 1 : 0);
  const totalDocs = requiredDocs.length + 1;

  const handleSubmit = async () => {
    if (uploadedCount === 0) { setAlert({ type: 'error', msg: 'Please upload at least one document.' }); return; }
    setLoading(true); setAlert(null);
    try {
      const fileArr = [];
      const labels = [];
      
      Object.keys(files).sort((a, b) => Number(a) - Number(b)).forEach((k) => {
        const file = files[k];
        const label = requiredDocs[k] || `Document ${Number(k) + 1}`;
        const ext = file.name.split('.').pop();
        const cleanLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
        const customName = `${data.cf_number}_${cleanLabel}.${ext}`;
        
        fileArr.push({ ...file, name: customName });
        labels.push(label);
      });

      let finalAgreement = agreementFile;
      if (agreementFile) {
        const ext = agreementFile.name.split('.').pop();
        finalAgreement = { ...agreementFile, name: `${data.cf_number}_Agreement.${ext}` };
      }
      
      await submitDocuments(token, fileArr, labels, finalAgreement);
      setPhase(PHASE.DONE);
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || e.message });
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TopBar onBack={() => navigation.goBack()} rightText={data?.student_email} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {alert ? <AlertBox type={alert.type} message={alert.msg} /> : null}

        {/* ── LOADING ── */}
        {phase === PHASE.LOAD && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.navy} />
            <Text style={styles.loadTxt}>Loading portal...</Text>
          </View>
        )}

        {/* ── REQUEST OTP ── */}
        {phase === PHASE.REQUEST && (
          <View style={styles.card}>
            <CardHeader eyebrow="Step 3 · Identity Verification" title="Student Verification"
              subtitle="Confirm your identity before uploading documents." />
            <View style={styles.body}>
              {data && <StudentInfo data={data} infoStyles={infoStyles} COLORS={COLORS} />}
              <View style={styles.divider} />
              <Text style={styles.desc}>An OTP will be sent to <Text style={styles.bold}>{data?.student_email}</Text> to verify your identity.</Text>
              <Button title="Send OTP to My Email" onPress={requestOTP} loading={loading} style={{ marginTop: 20 }}
                icon={<Ionicons name="shield-checkmark" size={16} color="#fff" />} />
            </View>
          </View>
        )}

        {/* ── VERIFY OTP ── */}
        {phase === PHASE.VERIFY && (
          <View style={styles.card}>
            <CardHeader eyebrow="Step 3 · Identity Verification" title="Enter Your OTP"
              subtitle={`We sent a 6-digit code to ${data?.student_email}`} />
            <View style={[styles.body, { alignItems: 'center' }]}>
              <Text style={styles.secLabel}>Enter 6-digit code</Text>
              <OTPInput value={otp} onChange={setOtp} error={otpErr} />
              <Button title="Verify & Continue" onPress={verifyOTP} loading={loading}
                icon={<Ionicons name="arrow-forward" size={16} color="#fff" />} />
              <TouchableOpacity onPress={requestOTP} style={styles.resend}>
                <Text style={styles.resendTxt}>↺ Resend OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── UPLOAD DOCS ── */}
        {phase === PHASE.UPLOAD && (
          <>
            {/* Student info card */}
            <View style={[styles.card, { marginBottom: 12 }]}>
              <CardHeader eyebrow="Step 3 · Document Upload" title="Student Registration"
                subtitle="Identity verified ✓ — Upload your documents below." />
              <View style={styles.body}>
                {data && <StudentInfo data={data} infoStyles={infoStyles} COLORS={COLORS} />}
                {/* Progress */}
                <View style={styles.progressRow}>
                  <Text style={styles.progressTxt}>{uploadedCount} / {totalDocs} documents uploaded</Text>
                  <Text style={[styles.progressTxt, { color: uploadedCount === totalDocs ? COLORS.green : COLORS.accent }]}>
                    {uploadedCount === totalDocs ? '✓ Complete' : 'In Progress'}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: totalDocs > 0 ? `${(uploadedCount / totalDocs) * 100}%` : '0%',
                    backgroundColor: uploadedCount === totalDocs ? COLORS.green : COLORS.accent,
                  }]} />
                </View>
              </View>
            </View>

            {/* Document checklist info */}
            {requiredDocs.length > 0 && (
              <View style={styles.checklistInfo}>
                <Text style={styles.checklistTitle}>
                  Documents Required ({requiredDocs.length}):
                </Text>
                {requiredDocs.map((d, i) => (
                  <View key={i} style={styles.checklistRow}>
                    <Ionicons
                      name={files[i] ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14} color={files[i] ? COLORS.green : COLORS.muted}
                    />
                    <Text style={[styles.checklistItem, files[i] && { color: COLORS.green }]}>{d}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Upload info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={16} color={COLORS.blue} />
              <Text style={styles.infoBannerTxt}>
                Max 5MB per file · Allowed: <Text style={{ fontWeight: '700' }}>PDF, JPG, PNG</Text>
              </Text>
            </View>

            {/* Agreement Section */}
            <View style={[styles.card, { marginBottom: 16 }]}>
              <View style={styles.body}>
                <Text style={styles.secLabel}>Agreement</Text>
                
                <View style={styles.agreementInfoBox}>
                  <Text style={styles.agreementInfoTxt}>
                    <Text style={{ fontWeight: '700' }}>Download Agreement:</Text>{'\n'}
                    Please review the agreement carefully before signing.{'\n\n'}
                    <Text style={{ fontWeight: '700' }}>Upload Completed Agreement:</Text>{'\n'}
                    After signing, please scan the document and upload it in PDF format.
                  </Text>
                </View>

                {data?.agreement_template_url ? (
                  <TouchableOpacity 
                    style={styles.downloadBtn}
                    onPress={() => {
                      import('react-native').then(({ Linking }) => {
                        Linking.openURL(data.agreement_template_url);
                      });
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color={COLORS.blue} />
                    <Text style={styles.downloadBtnTxt}>Download Agreement Template</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.notFoundTxt}>Agreement_template.pdf not found.</Text>
                )}

                <UploadBox
                  index="agreement"
                  label="Upload Completed Agreement"
                  file={agreementFile}
                  onFile={(idx, f) => setAgreementFile(f)}
                  onRemove={() => setAgreementFile(null)}
                />
              </View>
            </View>

            {/* Upload cards */}
            <View style={styles.card}>
              <View style={styles.body}>
                <Text style={styles.secLabel}>Upload Documents</Text>
                {requiredDocs.map((label, i) => (
                  <UploadBox
                    key={i}
                    index={i}
                    label={label}
                    file={files[i] || null}
                    onFile={handleFile}
                    onRemove={handleRemove}
                  />
                ))}

                <Button
                  title={`Submit ${uploadedCount} Document${uploadedCount !== 1 ? 's' : ''}`}
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={uploadedCount === 0}
                  variant="green"
                  style={{ marginTop: 16 }}
                  icon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
                />
              </View>
            </View>
          </>
        )}

        {/* ── DONE ── */}
        {phase === PHASE.DONE && (
          <View style={styles.card}>
            <CardHeader eyebrow="Complete" title="Registration Submitted!" subtitle="Your documents have been received." variant="green" />
            <View style={[styles.body, { alignItems: 'center', paddingVertical: 36 }]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={36} color={COLORS.green} />
              </View>
              <Text style={styles.doneTitle}>Thank You, {data?.student_name}!</Text>
              <Text style={styles.doneDesc}>
                Your submission is complete. You will be contacted if any further action is required.
              </Text>
              <View style={styles.doneBadge}>
                <Ionicons name="document-text" size={16} color={COLORS.navy} />
                <Text style={styles.doneBadgeTxt}>{uploadedCount} document{uploadedCount !== 1 ? 's' : ''} uploaded</Text>
              </View>
              <Button title="Return Home" onPress={() => navigation.navigate('Home')} style={{ marginTop: 24 }} />
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function StudentInfo({ data, infoStyles, COLORS }) {
  return (
    <View style={infoStyles.grid}>
      <View style={[infoStyles.item, { flex: 1 }]}>
        <Text style={infoStyles.label}>CF Number</Text>
        <Text style={infoStyles.val}>{data.cf_number}</Text>
      </View>
      <View style={[infoStyles.item, { flex: 1 }]}>
        <Text style={infoStyles.label}>Student Name</Text>
        <Text style={infoStyles.val}>{data.student_name}</Text>
      </View>
      <View style={[infoStyles.item, infoStyles.full]}>
        <Text style={infoStyles.label}>Student Email</Text>
        <Text style={infoStyles.val}>{data.student_email}</Text>
      </View>
      <View style={[infoStyles.item, infoStyles.full]}>
        <Text style={infoStyles.label}>Programme</Text>
        <Text style={infoStyles.val}>{data.program}</Text>
      </View>
    </View>
  );
}

const createInfoStyles = (COLORS) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  item: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  full: { width: '100%' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 3 },
  val:   { fontSize: 13, fontWeight: '700', color: COLORS.text },
});

const createStyles = (COLORS) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { padding: 16, paddingBottom: 40 },
  center:  { alignItems: 'center', paddingVertical: 60 },
  loadTxt: { color: COLORS.muted, marginTop: 12, fontSize: 15 },
  card:    { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 4 },
  body:    { padding: 22 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  secLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 10 },
  desc:    { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  bold:    { fontWeight: '700', color: COLORS.navy },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 16 },
  downloadBtnTxt: { color: COLORS.blue, fontWeight: '600', fontSize: 14 },
  notFoundTxt: { fontSize: 12, color: COLORS.red, marginBottom: 16, fontStyle: 'italic' },
  agreementInfoBox: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, marginBottom: 16 },
  agreementInfoTxt: { fontSize: 13.5, color: COLORS.text, lineHeight: 20 },
  resend:  { marginTop: 14 },
  resendTxt: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
  progressRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  progressTxt:  { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  progressBar:  { height: 6, backgroundColor: COLORS.border, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  checklistInfo: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, marginBottom: 10 },
  checklistTitle:{ fontSize: 14, fontWeight: '700', color: COLORS.green, marginBottom: 8 },
  checklistRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  checklistItem: { fontSize: 13, color: COLORS.text, lineHeight: 18, flex: 1 },
  infoBanner:    { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  infoBannerTxt: { fontSize: 13, color: COLORS.text, flex: 1 },
  successIcon:   { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle:     { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  doneDesc:      { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginBottom: 14 },
  doneBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  doneBadgeTxt:  { color: COLORS.text, fontWeight: '700', fontSize: 13 },
});
