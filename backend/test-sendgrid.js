require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Set your SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Test email configuration
const msg = {
  to: 'jadecathclement@gmail.com', // CHANGE THIS to your actual email
  from: 'info@uofttriathlon.com', // This should match your verified sender
  subject: '🧪 Test Email from UofT Triathlon Club',
  text: 'This is a test email to verify SendGrid is working correctly!',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🧪 Test Email</h1>
      </div>
      
      <div style="padding: 20px; background-color: #f9fafb;">
        <h2>SendGrid Test Successful!</h2>
        <p>If you're reading this, your SendGrid setup is working perfectly! 🎉</p>
        
        <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">What This Means:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>✅ SendGrid API key is valid</li>
            <li>✅ Sender email is verified</li>
            <li>✅ Email service is ready to use</li>
          </ul>
        </div>
        
        <p>You can now send waitlist promotion emails and other notifications!</p>
      </div>
    </div>
  `
};

console.log('📧 Testing SendGrid email service...');
console.log('📧 From:', msg.from);
console.log('📧 To:', msg.to);
console.log('📧 Subject:', msg.subject);

// Send the test email
sgMail.send(msg)
  .then(() => {
    console.log('✅ Test email sent successfully!');
    console.log('📧 Check your inbox for the test email.');
  })
  .catch((error) => {
    console.error('❌ Test email failed:', error);
    
    if (error.response) {
      console.error('📧 SendGrid response body:', error.response.body);
      console.error('📧 SendGrid response status:', error.response.statusCode);
    }
    
    // Common error solutions
    if (error.code === 401) {
      console.log('💡 Solution: Check your SENDGRID_API_KEY in .env file');
    } else if (error.code === 403) {
      console.log('💡 Solution: Verify your sender email in SendGrid dashboard');
    } else if (error.code === 400) {
      console.log('💡 Solution: Check email format and recipient address');
    }
  });
