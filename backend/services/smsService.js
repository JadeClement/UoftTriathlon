require('dotenv').config();
const twilio = require('twilio');

// Initialize Twilio client (you'll need to add these to your environment variables)
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_account_sid_here';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_auth_token_here';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890'; // Your Twilio number

// Create Twilio client
const client = twilio(accountSid, authToken);

// Send waitlist promotion SMS
const sendWaitlistPromotionSMS = async (userPhone, userName, workoutTitle, workoutDate) => {
  try {
    // Format the workout date
    const formattedDate = new Date(workoutDate).toLocaleDateString();
    
    // Create the SMS message
    const message = await client.messages.create({
      body: `🎉 UofT Triathlon Club: Hi ${userName}! You've been promoted from the waitlist for "${workoutTitle}" on ${formattedDate}. You're now officially signed up! Check the forum for details.`,
      from: fromNumber,
      to: userPhone
    });

    console.log('📱 Waitlist promotion SMS sent successfully');
    console.log('📱 Message SID:', message.sid);
    console.log('📱 To:', userPhone);
    
    return true;
  } catch (error) {
    console.error('❌ Error sending waitlist promotion SMS:', error);
    
    // Log specific Twilio error details
    if (error.code) {
      console.error('📱 Twilio Error Code:', error.code);
      console.error('📱 Twilio Error Message:', error.message);
    }
    
    return false;
  }
};

// Send both email and SMS (combo function)
const sendWaitlistPromotionNotification = async (userEmail, userPhone, userName, workoutTitle, workoutDate) => {
  try {
    // Import email service
    const emailService = require('./emailService');
    
    // Send both notifications
    const emailPromise = emailService.sendWaitlistPromotion(userEmail, userName, workoutTitle, workoutDate, workoutTime, null);
    const smsPromise = sendWaitlistPromotionSMS(userPhone, userName, workoutTitle, workoutDate);
    
    // Wait for both to complete
    const [emailSent, smsSent] = await Promise.allSettled([emailPromise, smsPromise]);
    
    console.log('📧 Email result:', emailSent.status === 'fulfilled' ? 'Success' : 'Failed');
    console.log('📱 SMS result:', smsSent.status === 'fulfilled' ? 'Success' : 'Failed');
    
    return {
      email: emailSent.status === 'fulfilled' && emailSent.value,
      sms: smsSent.status === 'fulfilled' && smsSent.value
    };
  } catch (error) {
    console.error('❌ Error sending combined notification:', error);
    return { email: false, sms: false };
  }
};

module.exports = {
  sendWaitlistPromotionSMS,
  sendWaitlistPromotionNotification
};
