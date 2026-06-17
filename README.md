# ANC Student Docs — Mobile App

A full-stack mobile application (React Native + Expo) with an Express.js backend, MongoDB, and Google Sheets integration, mirroring the existing PHP web portal.

---

## 📁 Project Structure

```
anc-student-docs/
├── backend/                    ← Express.js REST API
│   ├── config/
│   │   ├── db.js               ← MongoDB connection
│   │   ├── googleSheets.js     ← Google Sheets service
│   │   └── credentials.json    ← ⚠️ Place your Google service account file here
│   ├── controllers/
│   │   ├── cfController.js     ← CF registration + counsellor OTP
│   │   ├── counsellorController.js ← Programme selection
│   │   └── studentController.js    ← Student OTP + document upload
│   ├── middleware/
│   │   ├── upload.js           ← Multer file upload config
│   │   └── errorHandler.js     ← Global error handler
│   ├── models/
│   │   ├── CfToken.js          ← MongoDB model for CF tokens
│   │   ├── StudentToken.js     ← MongoDB model for student tokens
│   │   └── Submission.js       ← MongoDB model for submissions
│   ├── routes/
│   │   ├── cfRoutes.js
│   │   ├── counsellorRoutes.js
│   │   └── studentRoutes.js
│   ├── utils/
│   │   ├── email.js            ← Nodemailer + OTP helpers
│   │   └── productDocuments.js ← Full product→document checklist map
│   ├── uploads/                ← Auto-created; stores uploaded files
│   ├── .env                    ← ⚠️ Edit this with your credentials
│   ├── server.js               ← Entry point
│   └── package.json
│
└── frontend/                   ← React Native (Expo) app
    ├── src/
    │   ├── constants/
    │   │   └── config.jsx       ← API_BASE_URL — change LOCAL_IP here
    │   ├── services/
    │   │   └── api.jsx          ← All Axios API calls
    │   ├── navigation/
    │   │   └── AppNavigator.jsx
    │   ├── components/
    │   │   ├── Button.jsx
    │   │   ├── Header.jsx
    │   │   ├── Input.jsx
    │   │   ├── OTPInput.jsx
    │   │   └── DocumentUploadCard.jsx  ← Scan / Gallery / Files upload
    │   └── screens/
    │       ├── HomeScreen.jsx
    │       ├── CFRegistrationScreen.jsx
    │       ├── CounsellorPortalScreen.jsx
    │       ├── StudentPortalScreen.jsx
    │       ├── QRScanScreen.jsx        ← QR code scanner + manual token
    │       └── SuccessScreen.jsx
    ├── App.jsx                 ← Root entry point
    ├── app.json                ← Expo config
    ├── babel.config.js
    └── package.json
```

---

## ⚙️ Backend Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Place credentials.json

Copy your Google service account `credentials.json` into:

```
backend/config/credentials.json
```

This is the same file you uploaded (`credentials.json`).

### 3. Configure .env

Edit `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://nisula_db:nisula%401234@ancstudentdocsmobile.fedfk9g.mongodb.net/anc_student_docs?appName=AncStudentDocsMobile
JWT_SECRET=anc_student_docs_jwt_secret_2024

SPREADSHEET_ID=1_uYfzirCYiT5GWDR915aKfB48wvTtcrNaH2MLKIniyU
GOOGLE_APPLICATION_CREDENTIALS=./config/credentials.json

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=nisula@ancedu.com
SMTP_PASSWORD=ylwd sbzg owpj rihb
FROM_EMAIL=nisula@ancedu.com
FROM_NAME=ANC Student Docs
```

### 4. Start the backend

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://0.0.0.0:5000`.

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/cf/counsellors` | List counsellors from Google Sheet |
| POST | `/api/cf/register` | Submit CF registration |
| POST | `/api/cf/counsellor/request-otp` | Send OTP to counsellor |
| POST | `/api/cf/counsellor/verify-otp` | Verify counsellor OTP |
| GET | `/api/cf/counsellor/token-info` | Get CF token details |
| GET | `/api/counsellor/programs` | List programmes from Google Sheet |
| POST | `/api/counsellor/select-program` | Select programme → send student link |
| POST | `/api/student/request-otp` | Send OTP to student |
| POST | `/api/student/verify-otp` | Verify student OTP + get document list |
| GET | `/api/student/token-info` | Get student token details |
| POST | `/api/student/submit-documents` | Upload documents (multipart) |
| GET | `/api/student/submission` | Get submission details |

---

## 📱 Frontend Setup

### 1. Find your local IP address

**Windows:**
```powershell
ipconfig
# Look for: IPv4 Address . . . 192.168.x.x
```

**macOS / Linux:**
```bash
ifconfig | grep "inet "
```

### 2. Set your IP in config

Edit `frontend/src/constants/config.jsx`:

```js
const LOCAL_IP = '192.168.1.100'; // ← Replace with YOUR IP
```

> **Android Emulator:** Uses `10.0.2.2` automatically (already handled).  
> **Physical Device / iOS Simulator:** Uses `LOCAL_IP` above.

### 3. Install dependencies

```bash
cd frontend
npm install
```

### 4. Start Expo

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone, or press:
- `a` — Android emulator
- `i` — iOS simulator

---

## 📱 App Workflow

### CF Department (index.php equivalent)
1. Open app → tap **CF Registration**
2. Fill CF number, student name, email, assign counsellor
3. Submit → counsellor receives email with portal link

### Counsellor (counsellor_portal.php equivalent)
1. Open email link or tap **Counsellor Portal** → scan QR / enter token
2. Request OTP → verify 6-digit code sent to counsellor email
3. Select student programme from dropdown
4. Confirm → student receives email with document upload link

### Student (registration_form.php equivalent)
1. Open email link or tap **Student Portal** → scan QR / enter token
2. Request OTP → verify 6-digit code sent to student email
3. View required documents checklist for their programme
4. Upload each document: **Scan** (camera) / **Gallery** / **Files** (PDF)
5. Submit → saved to MongoDB + synced to Google Sheet

---

## 🔗 Data Storage

All data is stored in **both MongoDB and Google Sheets** simultaneously:

| MongoDB Collection | Google Sheet Tab |
|---|---|
| `cftokens` | `CF_Tokens` |
| `studenttokens` | `Student_Tokens` |
| `submissions` | `Submissions` |

Master data (counsellors, programmes) is **read-only** from Google Sheets.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| App can't connect to backend | Check `LOCAL_IP` in `config.jsx` matches your machine |
| MongoDB connection error | Verify `MONGODB_URI` in `.env`; check network whitelist in Atlas |
| Google Sheets error | Ensure `credentials.json` is in `backend/config/` and service account has access to the sheet |
| Email not sending | Check SMTP credentials in `.env`; Gmail may need App Password |
| Camera not working | Accept camera permission on first launch |
| OTP not received | Check spam folder; verify SMTP settings |
