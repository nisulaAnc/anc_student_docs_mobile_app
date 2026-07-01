import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../components/TopBar';
import AlertBox from '../components/AlertBox';
import { getCfDashboardStats, sendPendingReminder } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CFDashboardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  // Retrieve optional counsellorName and email to restrict the dashboard to that counsellor's students
  const counsellorName = route.params?.counsellorName || null;
  const counsellorEmail = route.params?.counsellorEmail || null;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'complete', 'pending'
  const [remindingToken, setRemindingToken] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setAlert(null);
    try {
      const params = {};
      // Only scope the dashboard to a single counsellor when this screen was
      // explicitly opened as a counsellor-specific view (i.e. counsellorName was
      // passed via navigation). Previously the counsellor's saved login session
      // token was ALWAYS attached, even when opening the plain "CF Portal
      // Dashboard" (staff view). That meant once anyone had logged in as a
      // counsellor on the device, the CF Portal Dashboard silently filtered
      // down to just that counsellor's students instead of showing the total
      // across all students. Restricting the token lookup to the counsellor
      // flow fixes both dashboards:
      //  - CF Portal Dashboard (no counsellorName) -> always shows ALL students
      //  - Counsellor Dashboard (counsellorName set) -> shows only that
      //    counsellor's own ("regarding") students
      if (counsellorName) {
        params.counsellor_name = counsellorName;
        if (counsellorEmail) {
          params.counsellor_email = counsellorEmail;
        }
        const token = await AsyncStorage.getItem('counsellorSession');
        if (token) {
          params.counsellor_token = token;
        }
      }
      const res = await getCfDashboardStats(params);
      if (res.data?.success) {
        setStats(res.data.data);
      } else {
        setAlert({ type: 'error', msg: 'Failed to retrieve stats.' });
      }
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Cannot load dashboard stats.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats(true);
  }, []);

  const handleSendReminder = async (student) => {
    setRemindingToken(student.token);
    try {
      const res = await sendPendingReminder(student.token);
      if (res.data?.success) {
        Alert.alert(
          '✅ Reminder Sent',
          `A pending document reminder email has been successfully sent to ${student.student_name} at ${student.student_email}.`
        );
      } else {
        Alert.alert('Error', 'Failed to send reminder.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Error occurred while sending reminder.');
    } finally {
      setRemindingToken(null);
    }
  };

  if (loading && !stats) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        <Text style={styles.loadTxt}>Loading Dashboard Data...</Text>
      </View>
    );
  }

  // Filter and Sort students
  const filteredStudents = (stats?.student_list || [])
    .filter(student => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        student.student_name.toLowerCase().includes(q) ||
        student.cf_number.toLowerCase().includes(q) ||
        student.student_email.toLowerCase().includes(q) ||
        (student.counsellor_name || '').toLowerCase().includes(q);

      if (filterMode === 'complete') return matchesSearch && student.status === 'complete';
      if (filterMode === 'pending') return matchesSearch && student.status === 'pending';
      return matchesSearch;
    })
    .sort((a, b) => {
      const nameA = a.student_name.toLowerCase();
      const nameB = b.student_name.toLowerCase();
      if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const completedPct = stats?.total_students > 0
    ? Math.round((stats.completed_students / stats.total_students) * 100)
    : 0;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TopBar onBack={() => navigation.goBack()} title={counsellorName ? `${counsellorName}'s Students` : "CF Portal Dashboard"} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.navy}
            colors={[COLORS.navy]}
          />
        }
      >
        {alert ? <AlertBox type={alert.type} message={alert.msg} /> : null}

        {/* Refresh hint */}
        <View style={styles.refreshHint}>
          <Ionicons name="refresh-outline" size={13} color={COLORS.muted} />
          <Text style={styles.refreshHintTxt}>Pull down to refresh</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderTopColor: COLORS.navy }]}>
              <Ionicons name="people-outline" size={20} color={COLORS.navy} style={styles.statIcon} />
              <Text style={styles.statValue}>{stats?.total_students || 0}</Text>
              <Text style={styles.statLabel}>Total Students</Text>
            </View>
            <View style={[styles.statBox, { borderTopColor: COLORS.blue }]}>
              <Ionicons name="documents-outline" size={20} color={COLORS.blue} style={styles.statIcon} />
              <Text style={[styles.statValue, { color: COLORS.blue }]}>{stats?.total_uploaded_documents || 0}</Text>
              <Text style={styles.statLabel}>Docs Uploaded</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderTopColor: COLORS.green }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.green} style={styles.statIcon} />
              <Text style={[styles.statValue, { color: COLORS.green }]}>{stats?.completed_students || 0}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={[styles.statBox, { borderTopColor: '#F59E0B' }]}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" style={styles.statIcon} />
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats?.pending_students || 0}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* Overall progress bar */}
          {stats?.total_students > 0 && (
            <View style={styles.overallProgressBox}>
              <View style={styles.overallProgressRow}>
                <Text style={styles.overallProgressLabel}>Overall Completion</Text>
                <Text style={[styles.overallProgressPct, { color: completedPct === 100 ? COLORS.green : COLORS.navy }]}>
                  {completedPct}%
                </Text>
              </View>
              <View style={styles.overallProgressBar}>
                <View style={[styles.overallProgressFill, {
                  width: `${completedPct}%`,
                  backgroundColor: completedPct === 100 ? COLORS.green : COLORS.navy,
                }]} />
              </View>
              <Text style={styles.overallProgressSub}>
                {stats.completed_students} of {stats.total_students} students completed
              </Text>
            </View>
          )}
        </View>

        {/* Filter / Search section */}
        <View style={styles.filterSection}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color={COLORS.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, CF, email, counsellor..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Pills */}
          <View style={styles.pillsRow}>
            {[
              { mode: 'all', label: 'ALL', color: COLORS.navy },
              { mode: 'complete', label: 'COMPLETED', color: COLORS.green },
              { mode: 'pending', label: 'PENDING', color: '#F59E0B' },
            ].map(({ mode, label, color }) => (
              <TouchableOpacity
                key={mode}
                style={[styles.pill, filterMode === mode && { backgroundColor: color, borderColor: color }]}
                onPress={() => setFilterMode(mode)}
              >
                <Text style={[styles.pillText, filterMode === mode && styles.pillTextActive]}>
                  {label} ({
                    mode === 'all' ? stats?.student_list?.length || 0 :
                      mode === 'complete' ? stats?.completed_students || 0 :
                        stats?.pending_students || 0
                  })
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sort control */}
        <View style={styles.sortRow}>
          <Text style={styles.sectionTitle}>
            Students ({filteredStudents.length})
          </Text>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
          >
            <Ionicons
              name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={COLORS.navy}
            />
            <Text style={styles.sortBtnTxt}>A–Z</Text>
          </TouchableOpacity>
        </View>

        {/* Student List */}
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>No students match the selected filters.</Text>
          </View>
        ) : (
          filteredStudents.map((student) => {
            const completedDocs = student.uploaded_count;
            const totalDocs = student.required_count;
            const missingCount = Math.max(0, totalDocs - completedDocs);
            const pct = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;
            const isComplete = student.status === 'complete';

            return (
              <View key={student.token} style={styles.studentCard}>
                {/* Header block */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.studentName} numberOfLines={1}>{student.student_name}</Text>
                    <Text style={styles.studentMeta}>CF: {student.cf_number}</Text>
                    <Text style={styles.studentMeta}>Counsellor: {student.counsellor_name}</Text>
                    <Text style={styles.studentEmail} numberOfLines={1}>{student.student_email}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isComplete
                      ? { backgroundColor: COLORS.green + '18', borderColor: COLORS.green + '44' }
                      : { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }
                  ]}>
                    <Ionicons
                      name={isComplete ? 'checkmark-circle' : 'time'}
                      size={12}
                      color={isComplete ? COLORS.green : '#D97706'}
                    />
                    <Text style={[
                      styles.statusBadgeText,
                      { color: isComplete ? COLORS.green : '#D97706' }
                    ]}>
                      {isComplete ? 'Done' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Doc counts summary */}
                <View style={styles.docCountsRow}>
                  <View style={[styles.docCountChip, { backgroundColor: COLORS.green + '12' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                    <Text style={[styles.docCountChipTxt, { color: COLORS.green }]}>
                      {completedDocs} Completed
                    </Text>
                  </View>
                  {missingCount > 0 && (
                    <View style={[styles.docCountChip, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="alert-circle" size={14} color="#D97706" />
                      <Text style={[styles.docCountChipTxt, { color: '#D97706' }]}>
                        {missingCount} Missing
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressTextRow}>
                    <Text style={styles.progressLabel}>Documents Progress</Text>
                    <Text style={[styles.progressCount, { color: isComplete ? COLORS.green : COLORS.navy }]}>
                      {completedDocs} / {totalDocs}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[
                      styles.progressBarFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: isComplete ? COLORS.green : COLORS.blue,
                      }
                    ]} />
                  </View>
                </View>

                {/* Uploaded Documents */}
                {student.uploaded_documents && student.uploaded_documents.length > 0 && (
                  <View style={[styles.docListSection, { backgroundColor: COLORS.green + '08', borderColor: COLORS.green + '30' }]}>
                    <View style={styles.docListTitleRow}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                      <Text style={[styles.docListTitle, { color: COLORS.green }]}>
                        Uploaded Documents ({student.uploaded_documents.length})
                      </Text>
                    </View>
                    {student.uploaded_documents.map((doc, idx) => (
                      <View key={idx} style={styles.docItemRow}>
                        <Ionicons name="document-text" size={12} color={COLORS.green} />
                        <Text style={[styles.docItemText, { color: COLORS.text }]}>{doc}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Missing Documents */}
                {student.missing_documents && student.missing_documents.length > 0 && (
                  <View style={[styles.docListSection, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                    <View style={styles.docListTitleRow}>
                      <Ionicons name="alert-circle" size={14} color="#D97706" />
                      <Text style={[styles.docListTitle, { color: '#D97706' }]}>
                        Missing Documents ({student.missing_documents.length})
                      </Text>
                    </View>
                    {student.missing_documents.map((doc, idx) => (
                      <View key={idx} style={styles.docItemRow}>
                        <Ionicons name="close-circle" size={12} color="#D97706" />
                        <Text style={[styles.docItemText, { color: '#92400E' }]}>{doc}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reminder Button — only for pending students */}
                {!isComplete && (
                  <TouchableOpacity
                    style={[styles.reminderBtn, remindingToken === student.token && styles.reminderBtnDisabled]}
                    onPress={() => handleSendReminder(student)}
                    disabled={remindingToken === student.token}
                    activeOpacity={0.8}
                  >
                    {remindingToken === student.token ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.reminderBtnText}>Sending...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="mail" size={16} color="#fff" />
                        <Text style={styles.reminderBtnText}>Send Pending Reminder Email</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  loadTxt: { color: COLORS.muted, marginTop: 12, fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 40 },

  refreshHint: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginBottom: 12 },
  refreshHintTxt: { fontSize: 11, color: COLORS.muted },

  // Stats
  statsContainer: { marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3,
    alignItems: 'center',
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon: { marginBottom: 6 },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: COLORS.navy },

  overallProgressBox: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  overallProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  overallProgressLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  overallProgressPct: { fontSize: 14, fontWeight: '800' },
  overallProgressBar: { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  overallProgressFill: { height: '100%', borderRadius: 4 },
  overallProgressSub: { fontSize: 11, color: COLORS.muted },

  // Filter
  filterSection: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, height: 44, marginBottom: 10 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  clearBtn: { padding: 4 },
  pillsRow: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  pillText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  pillTextActive: { color: '#fff' },

  // Section header
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  sortBtnTxt: { fontSize: 11, fontWeight: '700', color: COLORS.navy },

  // Empty
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },

  // Student Card
  studentCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
    shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  studentName: { fontSize: 15, fontWeight: '800', color: COLORS.navy, marginBottom: 2 },
  studentMeta: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginBottom: 1 },
  studentEmail: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // Doc count chips
  docCountsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  docCountChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  docCountChipTxt: { fontSize: 12, fontWeight: '700' },

  // Progress
  progressSection: { marginBottom: 10 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
  progressCount: { fontSize: 12, fontWeight: '800' },
  progressBarBg: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  // Doc lists
  docListSection: { borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 8 },
  docListTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  docListTitle: { fontSize: 12, fontWeight: '800' },
  docItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3 },
  docItemText: { fontSize: 12, lineHeight: 17, flex: 1 },

  // Reminder button
  reminderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0A2463', paddingVertical: 12, borderRadius: 10, marginTop: 4,
  },
  reminderBtnDisabled: { opacity: 0.6 },
  reminderBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});