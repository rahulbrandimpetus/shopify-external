const express = require('express');
const app = express();

// Use Back4app's port or default to 3000 for local development
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Enable CORS for frontend testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

// Predefined valid emails
const validEmails = [
  'john@example.com',
  'jane@example.com',
  'admin@test.com',
  'user@demo.com',
  'test@gmail.com',
  'sample@yahoo.com'
];

// Base route - show API info
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Email Validation API - Hosted on Back4app',
    status: 'Running',
    endpoints: {
      'POST /validate': 'Validate email via POST body {"email": "test@example.com"}',
      'GET /validate': 'Validate email via query parameter ?email=test@example.com',
      'GET /emails': 'Get list of all valid emails',
      'GET /health': 'Health check endpoint'
    },
    validEmails: validEmails,
    examples: {
      'POST': 'Send POST to /validate with body: {"email": "jane@example.com"}',
      'GET': `/validate?email=john@example.com`
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// GET /validate - Validate email via query parameter
app.get('/validate', (req, res) => {
  const email = req.query.email;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email query parameter is required. Example: /validate?email=test@example.com'
    });
  }
  
  const isValid = validEmails.includes(email.toLowerCase());
  
  res.json({
    success: true,
    email: email,
    isValid: isValid,
    message: isValid ? 'Email is valid!' : 'Email is not valid!',
    timestamp: new Date().toISOString()
  });
});

// POST /validate - Validate email via POST body
app.post('/validate', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required in request body. Example: {"email": "test@example.com"}'
    });
  }
  
  const isValid = validEmails.includes(email.toLowerCase());
  
  res.json({
    success: true,
    email: email,
    isValid: isValid,
    message: isValid ? 'Email is valid!' : 'Email is not valid!',
    timestamp: new Date().toISOString()
  });
});

// GET /emails - Get list of all valid emails
app.get('/emails', (req, res) => {
  res.json({
    success: true,
    validEmails: validEmails,
    count: validEmails.length,
    message: 'List of all valid emails',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email Validation API is running on Back4app!',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*path', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found. Visit / for API documentation.',
    requestedPath: req.params.path,
    availableEndpoints: ['/', '/validate', '/emails', '/health']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Email Validation API running on port ${PORT}`);
  console.log(`📖 API Documentation available at root /`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;