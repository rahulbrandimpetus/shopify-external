// app.js - Main application file for Back4App
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const admin = require('firebase-admin');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],
  credentials: true
}));

// Rate limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 OTP requests per windowMs
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/send-otp', otpLimiter);
app.use('/api/resend-otp', otpLimiter);
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

// In-memory storage for OTP sessions (use Redis in production)
const otpSessions = new Map();

// Utility functions
function generateSessionId() {
  return require('crypto').randomBytes(32).toString('hex');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidIndianMobile(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  return /^(\+91|91)?[6-9][0-9]{9}$/.test(cleanNumber);
}

function formatPhoneNumber(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
    return '+' + cleanNumber;
  } else if (cleanNumber.startsWith('91')) {
    return '+91' + cleanNumber.substring(2);
  } else if (cleanNumber.length === 10) {
    return '+91' + cleanNumber;
  }
  return phoneNumber;
}

// Validation middleware
const validateSendOTP = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidIndianMobile(value)) {
        throw new Error('Please provide a valid Indian mobile number');
      }
      return true;
    })
];

const validateVerifyOTP = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid session ID'),
  body('otpCode')
    .notEmpty()
    .withMessage('OTP code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
];

const validateFormSubmit = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidIndianMobile(value)) {
        throw new Error('Please provide a valid Indian mobile number');
      }
      return true;
    }),
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required')
];

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Send OTP
app.post('/api/send-otp', validateSendOTP, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { phoneNumber } = req.body;
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    console.log(`Attempting to send OTP to: ${formattedPhone}`);

    // Generate session ID and OTP
    const sessionId = generateSessionId();
    const otpCode = generateOTP();
    
    try {
      // Send OTP using Firebase Admin SDK
      const customToken = await admin.auth().createCustomToken('otp-service');
      
      // Store OTP session
      otpSessions.set(sessionId, {
        phoneNumber: formattedPhone,
        otpCode: otpCode,
        attempts: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
        verified: false
      });

      // In production, you would send actual SMS here
      // For now, we'll log the OTP (remove this in production)
      console.log(`OTP for ${formattedPhone}: ${otpCode}`);

      // Clean up expired sessions
      cleanupExpiredSessions();

      res.json({
        success: true,
        message: 'OTP sent successfully',
        sessionId: sessionId,
        // Remove this in production - only for testing
        ...(process.env.NODE_ENV === 'development' && { otpCode: otpCode })
      });

    } catch (firebaseError) {
      console.error('Firebase error:', firebaseError);
      throw new Error('Failed to send OTP. Please try again.');
    }

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP. Please try again later.'
    });
  }
});

// Verify OTP
app.post('/api/verify-otp', validateVerifyOTP, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { sessionId, otpCode } = req.body;

    // Get session
    const session = otpSessions.get(sessionId);

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired session. Please request a new OTP.'
      });
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      otpSessions.delete(sessionId);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check if already verified
    if (session.verified) {
      return res.status(400).json({
        success: false,
        message: 'This session has already been verified.'
      });
    }

    // Check attempts limit
    if (session.attempts >= 3) {
      otpSessions.delete(sessionId);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Increment attempts
    session.attempts += 1;

    // Verify OTP
    if (session.otpCode !== otpCode) {
      otpSessions.set(sessionId, session);
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - session.attempts} attempts remaining.`
      });
    }

    // Mark as verified
    session.verified = true;
    session.verifiedAt = Date.now();
    otpSessions.set(sessionId, session);

    console.log(`OTP verified successfully for: ${session.phoneNumber}`);

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      phoneNumber: session.phoneNumber
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed. Please try again.'
    });
  }
});

// Resend OTP
app.post('/api/resend-otp', validateSendOTP, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { phoneNumber, sessionId } = req.body;
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // If sessionId provided, check if it exists
    if (sessionId) {
      const existingSession = otpSessions.get(sessionId);
      if (existingSession && !existingSession.verified) {
        // Delete old session
        otpSessions.delete(sessionId);
      }
    }

    // Generate new session
    const newSessionId = generateSessionId();
    const otpCode = generateOTP();

    // Store new OTP session
    otpSessions.set(newSessionId, {
      phoneNumber: formattedPhone,
      otpCode: otpCode,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
      verified: false,
      isResend: true
    });

    console.log(`Resent OTP for ${formattedPhone}: ${otpCode}`);

    // Clean up expired sessions
    cleanupExpiredSessions();

    res.json({
      success: true,
      message: 'OTP resent successfully',
      sessionId: newSessionId,
      // Remove this in production - only for testing
      ...(process.env.NODE_ENV === 'development' && { otpCode: otpCode })
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.'
    });
  }
});

// Submit form
app.post('/api/submit-form', validateFormSubmit, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { name, email, phoneNumber, sessionId } = req.body;
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Verify session exists and is verified
    const session = otpSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session. Please verify your phone number first.'
      });
    }

    if (!session.verified) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not verified. Please complete verification first.'
      });
    }

    if (session.phoneNumber !== formattedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number mismatch. Please verify the correct number.'
      });
    }

    // Check if session is still valid (not older than 30 minutes from verification)
    const maxSessionAge = 30 * 60 * 1000; // 30 minutes
    if (Date.now() - session.verifiedAt > maxSessionAge) {
      otpSessions.delete(sessionId);
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please verify your phone number again.'
      });
    }

    console.log('Submitting form data:', { name, email, phoneNumber: formattedPhone });

    try {
      // Submit to ECF endpoint
      const formData = new URLSearchParams();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('number', formattedPhone);
      formData.append('verified_phone', 'true');
      formData.append('backend_verified', 'true');
      formData.append('submission_timestamp', new Date().toISOString());

      const ecfResponse = await fetch('https://ecf.cirkleinc.com/api/form-submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Backend-OTP-Service/1.0'
        },
        body: formData
      });

      if (!ecfResponse.ok) {
        const errorText = await ecfResponse.text();
        console.error('ECF submission failed:', errorText);
        throw new Error('External form submission failed');
      }

      console.log('Form submitted successfully to ECF');

      // Clean up session after successful submission
      otpSessions.delete(sessionId);

      res.json({
        success: true,
        message: 'Form submitted successfully',
        submittedAt: new Date().toISOString()
      });

    } catch (submitError) {
      console.error('Form submission error:', submitError);
      throw new Error('Failed to submit form. Please try again.');
    }

  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Form submission failed. Please try again.'
    });
  }
});

// Get session status (optional - for debugging)
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = otpSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  // Return session info without sensitive data
  res.json({
    success: true,
    session: {
      phoneNumber: session.phoneNumber.replace(/(\+91)(\d{6})(\d{4})/, '$1******$3'),
      verified: session.verified,
      attempts: session.attempts,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    }
  });
});

// Cleanup function for expired sessions
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of otpSessions.entries()) {
    if (now > session.expiresAt) {
      otpSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;