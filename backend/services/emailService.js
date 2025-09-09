require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Configure SendGrid with API key
console.log('🔑 EmailService: Setting SendGrid API key...');
console.log('🔑 EmailService: API Key length:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 'NOT SET');
console.log('🔑 EmailService: API Key starts with SG.:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.startsWith('SG.') : 'NOT SET');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email service class
class EmailService {
  constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@uofttriathlon.com';
  }

  // Send waitlist promotion email
  async sendWaitlistPromotion(userEmail, userName, workoutTitle, workoutDate, workoutTime, workoutId) {
    try {
      console.log('📧 EmailService.sendWaitlistPromotion called with:', { userEmail, userName, workoutTitle, workoutDate, workoutTime, workoutId, fromEmail: this.fromEmail });
      console.log('🔑 SendGrid API Key length:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 'NOT SET');
      console.log('🔑 SendGrid API Key starts with SG.:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.startsWith('SG.') : 'NOT SET');
      
      const msg = {
        to: userEmail,
        from: this.fromEmail,
        subject: `🎉 You're off the waitlist for ${workoutTitle}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🎉 You're off the waitlist!</h1>
            </div>
            
            <div style="padding: 20px; background-color: #f9fafb;">
              <p>Hi ${userName},</p>
              
              <p>Great news! You've been promoted from the waitlist and are now signed up for the workout! 🎉</p>
              
              <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Workout Details:</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li><strong>Workout:</strong> ${workoutTitle}</li>
                  <li><strong>Date:</strong> ${new Date(workoutDate).toLocaleDateString()}</li>
                  <li><strong>Time:</strong> ${workoutTime}</li>
                </ul>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #92400e;">Need to cancel?</h3>
                <p>If you can no longer attend this workout, you can cancel your signup without any penalty. Since you were promoted from the waitlist, cancelling will not count as an absence.</p>
                <p><a href="http://localhost:3000/workout/${workoutId}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Cancel Workout Signup</a></p>
              </div>
              
              <p>We're excited to see you at the workout! 🚀</p>
              
              <p>Best regards,<br>
              UofT Triathlon Club Team</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>This email was sent to ${userEmail}</p>
              <p>UofT Triathlon Club - Building champions, one triathlon at a time</p>
            </div>
          </div>
        `,
        text: `
You're off the waitlist!

Hi ${userName},

Great news! You've been promoted from the waitlist and are now signed up for the workout!

Workout Details:
- Workout: ${workoutTitle}
- Date: ${new Date(workoutDate).toLocaleDateString()}
- Time: ${workoutTime}

Need to cancel?
If you can no longer attend this workout, you can cancel your signup without any penalty. Since you were promoted from the waitlist, cancelling will not count as an absence.

Cancel your signup here: http://localhost:3000/workout/${workoutId}

We're excited to see you at the workout!

Best regards,
UofT Triathlon Club Team

This email was sent to ${userEmail}
UofT Triathlon Club - Building champions, one triathlon at a time
        `
      };

      const response = await sgMail.send(msg);
      console.log(`✅ Waitlist promotion email sent to ${userEmail}`);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ Error sending waitlist promotion email:', error);
      if (error.response) {
        console.error('SendGrid response body:', error.response.body);
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Send general notification email
  async sendNotification(userEmail, userName, subject, message) {
    try {
      const msg = {
        to: userEmail,
        from: this.fromEmail,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🏊‍♂️ UofT Triathlon Club</h1>
            </div>
            
            <div style="padding: 20px; background-color: #f9fafb;">
              <p>Hi ${userName},</p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                ${message}
              </div>
              
              <p>Best regards,<br>
              UofT Triathlon Club Team</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>This email was sent to ${userEmail}</p>
              <p>UofT Triathlon Club - Building champions, one triathlon at a time</p>
            </div>
          </div>
        `,
        text: `
UofT Triathlon Club

Hi ${userName},

${message}

Best regards,
UofT Triathlon Club Team

This email was sent to ${userEmail}
UofT Triathlon Club - Building champions, one triathlon at a time
        `
      };

      const response = await sgMail.send(msg);
      console.log(`✅ Notification email sent to ${userEmail}`);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ Error sending notification email:', error);
      if (error.response) {
        console.error('SendGrid response body:', error.response.body);
      }
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Send member acceptance email
  async sendMemberAcceptance(userEmail, userName) {
    try {
      console.log('📧 EmailService.sendMemberAcceptance called with:', { userEmail, userName, fromEmail: this.fromEmail });
      
      const msg = {
        to: userEmail,
        from: this.fromEmail,
        subject: `🎉 Welcome to UofT Triathlon Club!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🏊‍♂️ UofT Triathlon Club</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #dc2626; margin-top: 0;">Congratulations ${userName}!</h2>
              
              <p style="font-size: 16px; line-height: 1.6; color: #333;">
                You have been accepted as a member of the UofT Triathlon Club! 🎉
              </p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                <h3 style="color: #dc2626; margin-top: 0;">What's Next?</h3>
                <ul style="color: #333; line-height: 1.6;">
                  <li><strong>Access the Forum:</strong> You now have access to the team forum to sign up for workouts and events</li>
                  <li><strong>Sign Up for Workouts:</strong> Browse available workouts and secure your spot</li>
                  <li><strong>Connect with Teammates:</strong> Join discussions and stay updated with team activities</li>
                </ul>
              </div>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin-top: 0;">⚠️ Important Attendance Policy</h3>
                <p style="color: #856404; margin: 0; line-height: 1.6;">
                  <strong>Space is limited for workouts.</strong> If you get <strong>3 absences</strong>, you will be banned from signing up for workouts for <strong>1 week</strong>. 
                  This ensures fair access for all members.
                </p>
              </div>
              
              <div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
                <h3 style="color: #0c5460; margin-top: 0;">🔄 Important: Logout and Login</h3>
                <p style="color: #0c5460; margin: 0; line-height: 1.6;">
                  To see your new member privileges, please <strong>logout</strong> and then <strong>log back in</strong> to your account.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || process.env.WEB_URL || process.env.WEBSITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/forum" 
                   style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access the Forum
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If you have any questions, feel free to reach out to us at <a href="mailto:info@uoft-tri.club" style="color: #dc2626;">info@uoft-tri.club</a>
              </p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
              <p style="margin: 0;">UofT Triathlon Club | <a href="mailto:info@uoft-tri.club" style="color: #dc2626;">info@uoft-tri.club</a></p>
            </div>
          </div>
        `
      };

      const response = await sgMail.send(msg);
      console.log(`✅ Member acceptance email sent to ${userEmail}`);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ Error sending member acceptance email:', error);
      if (error.response) {
        console.error('SendGrid response body:', error.response.body);
      }
      throw new Error(`Failed to send member acceptance email: ${error.message}`);
    }
  }

  // Test email service
  async testConnection() {
    try {
      const msg = {
        to: 'test@example.com',
        from: this.fromEmail,
        subject: 'Test Email from UofT Triathlon Club',
        text: 'This is a test email to verify SendGrid configuration.'
      };

      await sgMail.send(msg);
      console.log('✅ SendGrid connection test successful');
      return true;
    } catch (error) {
      console.error('❌ SendGrid connection test failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
