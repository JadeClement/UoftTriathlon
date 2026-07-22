require('dotenv').config();
const sgMail = require('@sendgrid/mail');

console.log('🔍 Testing SendGrid connection...');
console.log('API Key length:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 'NOT SET');
console.log('From Email:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');

// Set the API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Test with a simple email send (this will verify the API key)
async function testConnection() {
  try {
    const testMsg = {
      to: 'test@example.com', // This won't actually send, just tests the connection
      from: process.env.SENDGRID_FROM_EMAIL || 'test@example.com',
      subject: 'Test Connection',
      text: 'This is a test to verify SendGrid connection'
    };
    
    // Try to send (this will fail due to invalid recipient, but will test the API key)
    await sgMail.send(testMsg);
    
  } catch (error) {
    // We expect this to fail due to invalid recipient, but we can check the error type
    if (error.code === 400 && error.message.includes('Invalid to address')) {
      console.log('✅ SendGrid API key is valid! (Expected error for invalid recipient)');
      console.log('Error details:', error.message);
    } else if (error.code === 401) {
      console.error('❌ SendGrid API key is invalid or expired');
      console.error('Error details:', error.message);
    } else {
      console.error('❌ SendGrid connection failed with unexpected error:');
      console.error('Status:', error.code);
      console.error('Message:', error.message);
    }
    
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  }
}

testConnection();
