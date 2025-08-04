const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MSG91_AUTH_KEY = '463132Awxuuk2JeBE68907772P1'; // Your actual auth key

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;
  
  if (!mobile || mobile.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid mobile number' });
  }
  
  try {
    const response = await axios.post(`https://control.msg91.com/api/v5/otp`, {
      mobile: `91${mobile}`,
      // Remove template_id if you don't have one, MSG91 will use default
    }, {
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('MSG91 Response:', response.data);
    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Error sending OTP:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: err?.response?.data || 'Failed to send OTP',
      message: 'Failed to send OTP. Please try again.'
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

    console.log('Verify Response:', response.data);
    
    if (response.data && response.data.type === 'success') {
      res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (err) {
    console.error('Error verifying OTP:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: err?.response?.data || 'Failed to verify OTP',
      message: 'Failed to verify OTP. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'OTP Service is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});