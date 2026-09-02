import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Log every request for debugging
api.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      err.message = 'Request timed out. Check your network.';
    } else if (!err.response) {
      err.message = `Cannot connect to server.\n\nMake sure:\n1. Backend is running (npm run dev)\n2. LOCAL_IP in config.jsx matches your machine IP\n3. Phone and PC are on same WiFi`;
    }
    return Promise.reject(err);
  }
);

// CF / Registration
export const getCounsellors = () => api.get('/cf/counsellors');

export const registerStudent = (data) => api.post('/cf/register', data);

export const verifyCfPin = (pin, type = 'cf', counsellor = null, otp = '', staffEmail = '') => api.post('/cf/verify-pin', { pin, type, counsellor, otp, staffEmail });

export const registerCounsellorAccount = (data) => api.post('/cf/counsellor/register', data);

export const resetCounsellorPin = (data) => api.post('/cf/counsellor/reset-pin', data);

export const setupTwoFactor = (data) => api.post('/cf/two-factor/setup', data);
export const sendTwoFactorEmailCode = (data) => api.post('/cf/two-factor/send-email-code', data);
export const enableTwoFactor = (data) => api.post('/cf/two-factor/enable', data);

// Staff auth (register/login/forgot/reset)
export const registerStaff = (data) => api.post('/cf/staff/register', data);
export const loginStaff = (data) => api.post('/cf/staff/login', data);
export const sendLoginOtp = (data) => api.post('/cf/staff/send-login-otp', data);
export const forgotPassword = (data) => api.post('/cf/staff/forgot-password', data);
export const resetPassword = (data) => api.post('/cf/staff/reset-password', data);

export const getCounsellorTokenInfo = (token) =>
  api.get('/cf/counsellor/token-info', { params: { token } });

export const getCfDashboardStats = (params) => api.get('/cf/dashboard-stats', { params });

export const sendPendingReminder = (token) => api.post('/cf/send-reminder', { token });

// Counsellor Portal
export const getPrograms = () => api.get('/counsellor/programs');

export const selectProgram = (cf_token, program_label) =>
  api.post('/counsellor/select-program', { cf_token, program_label });

// Student Portal
export const getStudentTokenInfo = (token) =>
  api.get('/student/token-info', { params: { token } });

export const submitDocuments = (token, files, docLabels, agreementFile = null) => {
  const formData = new FormData();
  formData.append('token', token);
  formData.append('doc_labels', JSON.stringify(docLabels));

  files.forEach((fileOrFiles, index) => {
    if (!fileOrFiles) return;
    const fileArray = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

    fileArray.forEach((file) => {
      const ext = (file.uri || '').split('.').pop().toLowerCase() || 'pdf';
      const mimeType = ext === 'pdf' ? 'application/pdf'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'png' ? 'image/png' : 'application/octet-stream';

      formData.append(`doc_${index}`, {
        uri: file.uri,
        name: file.name || `doc_${index}.${ext}`,
        type: mimeType,
      });
    });
  });

  if (agreementFile) {
    const ext = (agreementFile.uri || '').split('.').pop().toLowerCase() || 'pdf';
    formData.append('agreement', {
      uri: agreementFile.uri,
      name: agreementFile.name || `agreement.${ext}`,
      type: 'application/pdf',
    });
  }

  return api.post('/student/submit-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
};

export default api;
