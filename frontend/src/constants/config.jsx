import { Platform } from 'react-native';

// const LOCAL_IP = '192.168.8.101'; // <-- CHANGE THIS TO YOUR MACHINE IP
// const PORT = 5000;

// export const API_BASE_URL = `http://${LOCAL_IP}:${PORT}/api`;

// (limits.fileSize) so the client-side check and the server-side rejection agree.
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// export const API_BASE_URL = 'https://ancmoodle.com/dms/backend/api';

export const API_BASE_URL = 'https://anc-student-docs-mobile-app.vercel.app/api';

export const LIGHT_COLORS = {
  navy: '#0A2463',
  blue: '#1447B8',
  accent: '#2563EB',
  white: '#FFFFFF',
  bg: '#F1F5F9',
  border: '#E2E8F0',
  muted: '#94A3B8',
  text: '#334155',
  green: '#16A34A',
  red: '#DC2626',
};

export const DARK_COLORS = {
  navy: '#1E293B',
  blue: '#3B82F6',
  accent: '#60A5FA',
  white: '#0F172A',
  bg: '#020617',
  border: '#334155',
  muted: '#64748B',
  text: '#F8FAFC',
  green: '#22C55E',
  red: '#EF4444',
};

export const COLORS = LIGHT_COLORS;