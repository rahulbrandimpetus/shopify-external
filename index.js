const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Enable CORS for frontend testing
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://rd-brandimp.myshopify.com/',
    'https://anotherdomain.com',
    'http://localhost:3000',  // for local development
    'http://localhost:8080'   // for local testing
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
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

// GET / - API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Email Validation API',
    endpoints: {
      'POST /validate': 'Validate email via POST body {"email": "test@example.com"}',
      'GET /validate': 'Validate email via query parameter ?email=test@example.com',
      'GET /emails': 'Get list of all valid emails'
    },
    validEmails: validEmails,
    examples: {
      'POST': 'Send POST to /validate with body: {"email": "jane@example.com"}',
      'GET': 'http://localhost:3000/validate?email=john@example.com'
    }
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
    message: 'List of all valid emails'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - FIXED: Use middleware function instead of '*' route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found. Visit / for API documentation.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Email Validation API running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}`);
  console.log(`✅ Test with query: http://localhost:${PORT}/validate?email=john@example.com`);
  console.log(`❌ Test invalid: http://localhost:${PORT}/validate?email=invalid@test.com`);
  console.log(`📋 All emails: http://localhost:${PORT}/emails`);
});

module.exports = app;