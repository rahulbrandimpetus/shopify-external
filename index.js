const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MSG91_AUTH_KEY = '463132Awxuuk2JeBE68907772P1';
const TEMPLATE_ID = '68908c4c54373b4ee64cbb52'; // From your example

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;
  
  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid mobile number' });
  }
  
  try {
    // Using the exact format from MSG91 example
    const url = `https://control.msg91.com/api/v5/otp?mobile=91${mobile}&authkey=${MSG91_AUTH_KEY}&otp_expiry=1&template_id=${TEMPLATE_ID}&realTimeResponse=1`;
    
    const response = await axios.post(url, {
      "Param1": "value1",
      "Param2": "value2", 
      "Param3": "value3"
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('MSG91 Send OTP Response:', response.data);
    
    // MSG91 returns success in different formats, check multiple conditions
    if (response.status === 200) {
      res.status(200).json({ 
        success: true, 
        message: 'OTP sent successfully',
        data: response.data 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Failed to send OTP', 
        data: response.data 
      });
    }
  } catch (err) {
    console.error('Error sending OTP:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: err?.response?.data || err.message || 'Failed to send OTP',
      message: 'Failed to send OTP. Please check your MSG91 configuration.'
    });
  }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { mobile, otp } = req.body;
  
  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: 'Mobile number and OTP are required' });
  }
  
  try {
    const response = await axios.get(`https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile}`, {
      headers: {
        'authkey': MSG91_AUTH_KEY,
      }
    });

    console.log('MSG91 Verify OTP Response:', response.data);
    
    // Check for success response
    if (response.data && response.data.type === 'success') {
      res.status(200).json({ 
        success: true, 
        message: 'OTP verified successfully',
        data: response.data 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP or OTP expired',
        data: response.data 
      });
    }
  } catch (err) {
    console.error('Error verifying OTP:', err.response?.data || err.message);
    
    // Handle specific MSG91 error responses
    if (err.response?.status === 400) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP or OTP expired',
        error: err.response.data 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: err?.response?.data || err.message || 'Failed to verify OTP',
        message: 'Failed to verify OTP. Please try again.'
      });
    }
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'OTP Service is running',
    endpoints: ['/send-otp', '/verify-otp'],
    msg91_configured: !!MSG91_AUTH_KEY
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MSG91 Auth Key: ${MSG91_AUTH_KEY ? 'Configured' : 'Missing'}`);
  console.log(`Template ID: ${TEMPLATE_ID}`);
});