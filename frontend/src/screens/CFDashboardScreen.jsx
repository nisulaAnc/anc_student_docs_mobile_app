import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, TextInput, Alert, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../components/TopBar';
import CardHeader from '../components/CardHeader';
import AlertBox from '../components/AlertBox';
import Button from '../components/Button';
import { getCfDashboardStats, sendPendingReminder } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function CFDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors: COLORS } = useTheme();
  const styles = createStyles(COLORS);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'complete', 'pending'
  const [remindingToken, setRemindingToken] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setAlert(null);
    try {
      const res = await getCfDashboardStats();
      if (res.data?.success) {
        setStats(res.data.data);
      } else {
        setAlert({ type: 'error', msg: 'Failed to retrieve stats.' });
      }
    } catch (e) {
      setAlert({ type: 'error', msg: e.message || 'Cannot load dashboard stats.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (student) => {
    setRemindingToken(student.token);
    try {
      const res = await sendPendingReminder(student.token);
      if (res.data?.success) {
        Alert.alert('Reminder Sent', `A pending document reminder email has been successfully sent to ${student.student_name}.`);
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
      const matchesSearch = student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.cf_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.student_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.counsellor_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterMode === 'all') return matchesSearch;
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

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TopBar onBack={() => navigation.goBack()} title="CF Dashboard" />
      
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {alert ? <AlertBox type={alert.type} message={alert.msg} /> : null}

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderLeftColor: COLORS.navy }]}>
              <Text style={styles.statLabel}>Total Students</Text>
              <Text style={styles.statValue}>{stats?.total_students || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: COLORS.blue }]}>
              <Text style={styles.statLabel}>Uploaded Docs</Text>
              <Text style={styles.statValue}>{stats?.total_uploaded_documents || 0}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderLeftColor: COLORS.green }]}>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={[styles.statValue, { color: COLORS.green }]}>{stats?.completed_students || 0}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: COLORS.red }]}>
              <Text style={styles.statLabel}>Pending/Incomplete</Text>
              <Text style={[styles.statValue, { color: COLORS.red }]}>{stats?.pending_students || 0}</Text>
            </View>
          </View>
        </View>

        {/* Filter / Search section */}
        <View style={styles.filterSection}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={COLORS.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search CF, name, or counsellor..."
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
            {['all', 'complete', 'pending'].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.pill,
                  filterMode === mode && styles.pillActive,
                  filterMode === mode && mode === 'complete' && { backgroundColor: COLORS.green },
                  filterMode === mode && mode === 'pending' && { backgroundColor: COLORS.red },
                  filterMode === mode && mode === 'all' && { backgroundColor: COLORS.navy }
                ]}
                onPress={() => setFilterMode(mode)}
              >
                <Text style={[styles.pillText, filterMode === mode && styles.pillTextActive]}>
                  {mode.toUpperCase()} ({
                    mode === 'all' ? stats?.student_list?.length || 0 :
                    mode === 'complete' ? stats?.completed_students || 0 :
                    stats?.pending_students || 0
                  })
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Student List */}
        <Text style={styles.sectionTitle}>Students & Document Status</Text>
        
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>No students found matches the filters.</Text>
          </View>
        ) : (
          filteredStudents.map((student) => (
            <View key={student.token} style={styles.studentCard}>
              {/* Header block */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.studentName}>{student.student_name}</Text>
                  <Text style={styles.studentMeta}>CF: {student.cf_number}  |  Counsellor: {student.counsellor_name}</Text>
                  <Text style={styles.studentEmail}>{student.student_email}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  student.status === 'complete' ? { backgroundColor: COLORS.green + '18' } : { backgroundColor: COLORS.red + '18' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    student.status === 'complete' ? { color: COLORS.green } : { color: COLORS.red }
                  ]}>
                    {student.status === 'complete' ? 'Completed' : 'Pending'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressLabel}>Documents Progress</Text>
                  <Text style={styles.progressCount}>{student.uploaded_count} / {student.required_count}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill, 
                    { 
                      width: `${(student.uploaded_count / student.required_count) * 100}%`,
                      backgroundColor: student.status === 'complete' ? COLORS.green : COLORS.blue 
                    }
                  ]} />
                </View>
              </View>

              {/* Document Lists */}
              <View style={styles.docListsContainer}>
                {student.uploaded_documents && student.uploaded_documents.length > 0 ? (
                  <View style={styles.docListSection}>
                    <Text style={[styles.docListTitle, { color: COLORS.green }]}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.green} /> Uploaded Documents:
                    </Text>
                    {student.uploaded_documents.map((doc, idx) => (
                      <Text key={idx} style={styles.docItemText}>• {doc}</Text>
                    ))}
                  </View>
                ) : null}

                {student.missing_documents && student.missing_documents.length > 0 ? (
                  <View style={styles.docListSection}>
                    <Text style={[styles.docListTitle, { color: COLORS.red }]}>
                      <Ionicons name="alert-circle" size={14} color={COLORS.red} /> Missing Documents:
                    </Text>
                    {student.missing_documents.map((doc, idx) => (
                      <Text key={idx} style={styles.docItemText}>• {doc}</Text>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Action Buttons */}
              {student.status === 'pending' ? (
                <TouchableOpacity
                  style={[styles.reminderBtn, remindingToken === student.token && styles.reminderBtnDisabled]}
                  onPress={() => handleSendReminder(student)}
                  disabled={remindingToken === student.token}
                >
                  {remindingToken === student.token ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.reminderBtnText}>Send Pending Reminder Email</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: 'center', alignItems: 'center', flex: 1 },
  loadTxt: { color: COLORS.muted, marginTop: 12, fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 40 },
  statsContainer: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  statBox: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 5, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  filterSection: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, height: 44, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  clearBtn: { padding: 4 },
  pillsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: COLORS.navy },
  pillText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  pillTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy, marginBottom: 12, marginTop: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },
  studentCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, shadowColor: COLORS.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10, marginBottom: 12 },
  studentName: { fontSize: 15, fontWeight: '800', color: COLORS.navy, marginBottom: 2 },
  studentMeta: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginBottom: 2 },
  studentEmail: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  progressSection: { marginBottom: 12 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  progressCount: { fontSize: 11, fontWeight: '800', color: COLORS.navy },
  progressBarBg: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  docListsContainer: { padding: 10, backgroundColor: COLORS.bg, borderRadius: 10, gap: 10, marginBottom: 12 },
  docListSection: {},
  docListTitle: { fontSize: 12, fontWeight: '800', marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  docItemText: { fontSize: 12, color: COLORS.text, paddingLeft: 4, marginBottom: 2 },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, paddingVertical: 12, borderRadius: 10 },
  reminderBtnDisabled: { opacity: 0.6 },
  reminderBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
