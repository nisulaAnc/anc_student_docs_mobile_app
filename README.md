# ANC Student Docs Mobile App

ANC Student Docs is a mobile-first document submission system for ANC education workflows. It connects three roles in one flow:

- CF staff register a student and request a counsellor assignment.
- Counsellors choose the student programme and trigger the next step.
- Students scan a QR code or enter a token, then upload the required documents.

The project is split into a mobile frontend and an API backend. It is designed for secure, structured document collection with email notifications, MongoDB persistence, Google Sheets synchronization, and Cloudinary file storage.

## What The App Does

The application automates a document handoff process that would otherwise require manual coordination.

1. A CF staff member creates a student registration record.
2. The backend generates a token and notifies the assigned counsellor by email.
3. The counsellor opens the portal, selects the student's programme, and sends the student upload link.
4. The student opens the portal through a QR code or manual token entry.
5. The student uploads the required documents and signed agreement.
6. The backend stores the submission, updates status, optionally syncs to Google Sheets, and sends email notifications.

The system is built to reduce repeated manual follow-up, keep submissions traceable, and make the process easier to use on a phone.

## Technology Stack

### Languages

- JavaScript on both frontend and backend
- React Native / JSX for the mobile app UI
- Node.js for the API server

### Frontend

- Expo
- React Native
- React Navigation
- Axios
- Expo Camera
- Expo Document Picker
- Expo File System
- Expo Linear Gradient
- Expo Sharing
- Expo Print
- AsyncStorage

### Backend

- Express
- MongoDB with Mongoose
- Multer and Cloudinary storage
- Google Sheets API
- Google Drive API
- Nodemailer
- JSON Web Token
- bcryptjs
- cors
- dotenv

### External Services

- MongoDB Atlas or another MongoDB deployment
- Cloudinary for file uploads
- Google Cloud service account credentials for Sheets and Drive access
- SMTP or mail provider for email delivery

## Project Structure

```text
backend/
  server.js
  config/
  controllers/
  middleware/
  models/
  routes/
  uploads/
  utils/

frontend/
  App.jsx
  app.json
  src/
    components/
    constants/
    context/
    navigation/
    screens/
    services/
```

## Main User Flows

### 1. CF Staff Registration

The CF staff member starts on the home screen, unlocks the CF registration flow with the PIN, and submits:

- CF number
- student name
- student email
- counsellor name

The backend then creates a CF token, saves it to MongoDB, appends it to Google Sheets if configured, and emails the counsellor with a QR code and token link.

### 2. Counsellor Programme Selection

The counsellor opens the portal using the token link or QR code. From there they:

- review the student details
- pick the student's programme from the list
- confirm the selection

When the selection is confirmed, the system creates a student token and emails the student a secure upload link.

### 3. Student Document Upload

The student opens the portal from the QR code or token and uploads the required documents.

The student can:

- see the exact document checklist for the selected programme
- download the agreement template
- upload documents one by one
- upload the signed agreement
- submit everything from the mobile app

The backend validates the token, uploads files to Cloudinary, stores the submission record, and sends completion or missing-document notifications.

## Backend Responsibilities

The backend exposes the API under `/api` and handles:

- health checks
- CF counsellor lookup and registration
- counsellor token lookup and PIN verification
- programme lookup and selection
- student token lookup
- document submission and validation
- file serving from `/uploads`

It also manages:

- MongoDB persistence for tokens and submissions
- email notifications
- Cloudinary uploads
- Google Sheets synchronization

## Frontend Responsibilities

The mobile app provides:

- a launch screen
- a home screen with role selection
- a protected CF registration screen
- a counsellor portal
- a student portal
- QR scanning plus manual token entry
- theme support through a shared context

The app is intended for phones and tablets and uses Expo permissions for camera and media access.

## Setup Requirements

Before running the project, make sure you have:

- Node.js installed
- npm installed
- a MongoDB connection string
- Cloudinary credentials
- Google Sheets / Drive credentials
- an SMTP or mail provider configuration
- a machine on the same network as the mobile device if you are testing on a physical phone

## Environment Variables

Do not commit real secrets to the repository. Use a local `.env` file for backend values and keep real credential files private.

### Backend `.env` Example

```bash
PORT=5000
MONGODB_URI=your_mongodb_connection_string
BASE_URL=http://your-server-ip:5000
CF_PIN=your_6_digit_staff_pin
ADMIN_EMAIL=your_admin_email

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_FOLDER=anc_student_docs

SPREADSHEET_ID=your_google_sheet_id
GOOGLE_CLIENT_EMAIL=your_google_service_account_email
GOOGLE_PRIVATE_KEY=your_google_service_account_private_key
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id

SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=your_sender_email
```

### Frontend Configuration

The frontend uses a local API base URL in `frontend/src/constants/config.jsx`:

- set `LOCAL_IP` to your machine's LAN IP address while testing on a real device
- keep the backend port aligned with the server, which defaults to `5000`

Example:

```js
const LOCAL_IP = '192.168.x.x';
const PORT = 5000;
```

## How To Run The Project

### 1. Install Dependencies

Install dependencies separately for the backend and frontend.

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Backend Secrets

Create a local `.env` file in `backend/` and fill in the required values from the environment variables section.

Also ensure any private Google credential file is kept local and never committed.

### 3. Configure the Frontend API URL

Open `frontend/src/constants/config.jsx` and update `LOCAL_IP` so the mobile app points to your machine.

This matters when you test on a physical phone because `localhost` would point to the phone itself, not your computer.

### 4. Start the Backend

```bash
cd backend
npm run dev
```

The API starts on port `5000` by default and exposes a health check at:

```text
/api/health
```

### 5. Start the Frontend

```bash
cd frontend
npm start
```

Expo will open the development tools so you can run the app on:

- Android emulator
- iOS simulator
- physical device through Expo Go / Expo development build

### 6. Test The Full Flow

Use the app in this order:

1. Open the home screen.
2. Enter the CF PIN to access CF registration.
3. Register a student and assign a counsellor.
4. Open the counsellor portal using the QR code or token.
5. Select the programme.
6. Open the student portal using the generated token.
7. Upload the required documents and agreement.
8. Confirm the backend stores the submission and sends notifications.

## Mobile Permissions

The Expo app requests permissions for:

- camera access for QR scanning
- photo library access for document selection
- file and media handling where supported by the platform

If the camera permission is denied, the app falls back to manual token entry.

## Document Rules

The upload flow is designed with these constraints:

- maximum file size is 5 MB per file
- supported formats include PDF, JPG, JPEG, PNG, DOC, and DOCX on the backend upload layer
- the student must upload all required documents before final submission
- the agreement is treated as part of the final document set

## API Overview

The main endpoints are:

- `GET /api/health` - service check
- `GET /api/cf/counsellors` - fetch counsellor list
- `POST /api/cf/register` - create a new CF registration
- `GET /api/cf/counsellor/token-info` - look up CF token details
- `POST /api/cf/verify-pin` - verify the staff PIN
- `GET /api/counsellor/programs` - fetch available programmes
- `POST /api/counsellor/select-program` - assign a programme and create the student token
- `GET /api/student/token-info` - fetch student token details and required documents
- `POST /api/student/submit-documents` - upload final documents

## Security Notes

- Keep all API keys and private secrets out of source control.
- Use environment variables for backend credentials.
- Keep Google service account files private.
- Replace the frontend IP placeholder only for local testing.

## Troubleshooting

### The mobile app cannot reach the backend

- confirm the backend is running
- confirm `LOCAL_IP` matches your computer's LAN IP
- confirm the phone and computer are on the same Wi-Fi network
- confirm the firewall allows traffic to port `5000`

### Token link does not open the expected portal

- check that the QR code or manual token was copied correctly
- confirm the backend database contains the token record
- confirm the token has not already been used

### Uploads fail or time out

- check the file type and size
- confirm Cloudinary credentials are configured
- confirm the network connection is stable
- retry with smaller files if needed

## Notes For Contributors

- Keep the frontend and backend flows in sync when changing token handling.
- Update the README whenever setup steps or external services change.
- Do not add real credentials to documentation or sample files.
