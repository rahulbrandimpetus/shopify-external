const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MSG91_AUTH_KEY = '463132Awxuuk2JeBE68907772P1'; // Replace this

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;
  try {
    const response = await axios.post(`https://control.msg91.com/api/v5/otp`, {
      mobile: `91${mobile}`,
      template_id: 'YOUR_TEMPLATE_ID', // Replace with your approved template ID
    }, {
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ success: true, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.response?.data || 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/verify-otp', async (req, res) => {
  const { mobile, otp } = req.body;
  try {
    const response = await axios.get(`https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=91${mobile}`, {
      headers: {
        'authkey': MSG91_AUTH_KEY,
      }
    });

    if (response.data && response.data.type === 'success') {
      res.status(200).json({ success: true, message: 'OTP verified' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err?.response?.data || 'Failed to verify OTP' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
