require('dotenv').config();
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// Configure AWS SES
console.log('🔑 EmailService: Setting up AWS SES...');
console.log('🔑 EmailService: AWS Region:', process.env.AWS_REGION || 'us-east-1');
console.log('🔑 EmailService: AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? `SET (${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...)` : 'NOT SET');
console.log('🔑 EmailService: AWS Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? `SET (${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 8)}...)` : 'NOT SET');
console.log('🔑 EmailService: AWS From Email:', process.env.AWS_FROM_EMAIL || 'NOT SET');
console.log('🔑 EmailService: AWS From Name:', process.env.AWS_FROM_NAME || 'NOT SET');

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Email service class
class EmailService {
  constructor() {
    this.fromEmail = process.env.AWS_FROM_EMAIL || 'info@uoft-tri.club';
    this.fromName = process.env.AWS_FROM_NAME || 'UofT Triathlon Club';
  }

  // Send email using AWS SES
  async sendEmail(to, subject, htmlContent, textContent = null, replyTo = null) {
    try {
      console.log('📧 EmailService.sendEmail called with:', { to, subject, fromEmail: this.fromEmail, replyTo });
      
      const params = {
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8',
            },
            ...(textContent && {
              Text: {
                Data: textContent,
                Charset: 'UTF-8',
              },
            }),
          },
        },
        ...(replyTo && {
          ReplyToAddresses: Array.isArray(replyTo) ? replyTo : [replyTo],
        }),
      };

      const command = new SendEmailCommand(params);
      console.log('🔍 DEBUG: About to send email via AWS SES with params:', JSON.stringify(params, null, 2));
      const result = await sesClient.send(command);
      
      console.log('✅ Email sent successfully:', result.MessageId);
      console.log('🔍 DEBUG: Full AWS SES result:', JSON.stringify(result, null, 2));
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send waitlist promotion email
  async sendWaitlistPromotion(userEmail, userName, workoutTitle, workoutDate, workoutTime, workoutId) {
    try {
      console.log('📧 EmailService.sendWaitlistPromotion called with:', { userEmail, userName, workoutTitle, workoutDate, workoutTime, workoutId, fromEmail: this.fromEmail });
      
      const subject = `🎉 You're off the waitlist for ${workoutTitle}!`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Waitlist Promotion</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 You're Off the Waitlist!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">UofT Triathlon Club</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #1E3A8A; margin-top: 0;">Great news, ${userName}!</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">You've been promoted from the waitlist and are now officially signed up for:</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937;">${workoutTitle}</h3>
              <p style="margin: 5px 0; color: #6b7280;"><strong>📅 Date:</strong> ${workoutDate}</p>
              ${workoutTime ? `<p style="margin: 5px 0; color: #6b7280;"><strong>⏰ Time:</strong> ${workoutTime}</p>` : ''}
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #f59e0b; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ Important Reminders</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li>Space is limited - if you can't make it, please cancel your signup</li>
              <li>Check the forum for any last-minute updates</li>
              <li>Arrive on time to secure your spot</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://uoft-tri.club/forum" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Workout Details
            </a>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p>UofT Triathlon Club | <a href="https://uoft-tri.club" style="color: #3b82f6;">uoft-tri.club</a></p>
          </div>
        </body>
        </html>
      `;

      const textContent = `
        🎉 You're Off the Waitlist!
        
        Great news, ${userName}!
        
        You've been promoted from the waitlist and are now officially signed up for:
        
        ${workoutTitle}
        📅 Date: ${workoutDate}
        ${workoutTime ? `⏰ Time: ${workoutTime}` : ''}
        
        ⚠️ Important Reminders:
        - Space is limited - if you can't make it, please cancel your signup
        - Check the forum for any last-minute updates
        - Arrive on time to secure your spot
        
        View workout details: https://uoft-tri.club/forum
        
        UofT Triathlon Club | uoft-tri.club
      `;

      return await this.sendEmail(userEmail, subject, htmlContent, textContent, this.fromEmail);
    } catch (error) {
      console.error('❌ Error sending waitlist promotion email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordReset(userEmail, resetToken) {
    try {
      console.log('📧 EmailService.sendPasswordReset called with:', { userEmail, resetToken, fromEmail: this.fromEmail });
      
      const resetUrl = `${process.env.FRONTEND_URL || 'https://uoft-tri.club'}/reset-password?token=${resetToken}`;
      const subject = 'Reset Your Password - UofT Triathlon Club';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">UofT Triathlon Club</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #1E3A8A; margin-top: 0;">Reset Your Password</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">You requested to reset your password for your UofT Triathlon Club account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 25px;">
            <h3 style="color: #dc2626; margin-top: 0;">⚠️ Security Notice</h3>
            <ul style="color: #dc2626; margin: 0; padding-left: 20px;">
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p>UofT Triathlon Club | <a href="https://uoft-tri.club" style="color: #3b82f6;">uoft-tri.club</a></p>
          </div>
        </body>
        </html>
      `;

      const textContent = `
        🔐 Password Reset - UofT Triathlon Club
        
        You requested to reset your password for your UofT Triathlon Club account.
        
        Reset your password: ${resetUrl}
        
        ⚠️ Security Notice:
        - This link will expire in 1 hour
        - If you didn't request this reset, please ignore this email
        - Never share this link with anyone
        
        UofT Triathlon Club | uoft-tri.club
      `;

      return await this.sendEmail(userEmail, subject, htmlContent, textContent, this.fromEmail);
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send member acceptance email
  async sendMemberAcceptance(userEmail, userName) {
    try {
      console.log('📧 EmailService.sendMemberAcceptance called with:', { userEmail, userName, fromEmail: this.fromEmail });
      
      const subject = 'Welcome to UofT Triathlon Club! 🏃‍♂️';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to UofT Triathlon Club</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🏃‍♂️ Welcome to the Club!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">UofT Triathlon Club</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #1E3A8A; margin-top: 0;">Congratulations, ${userName}!</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">Your membership has been confirmed! You now have full access to the club forum and can sign up for workouts.</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #1f2937;">🎯 What's Next?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li>Sign up for workouts in the forum</li>
                <li>Connect with other club members</li>
                <li>Stay updated on club events and races</li>
              </ul>
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #f59e0b; margin-bottom: 25px;">
            <h3 style="color: #92400e; margin-top: 0;">⚠️ Important Club Rules</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li><strong>Attendance Policy:</strong> 3 absences = 1 week ban from signups</li>
              <li><strong>Space is Limited:</strong> Sign up early for popular workouts</li>
              <li><strong>Cancel if Needed:</strong> Give others a chance if you can't make it</li>
            </ul>
          </div>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border: 1px solid #0ea5e9; margin-bottom: 25px;">
            <h3 style="color: #0c4a6e; margin-top: 0;">🔄 Important: Logout & Login</h3>
            <p style="color: #0c4a6e; margin: 0;">To see all the new features, please logout and log back in to your account.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://uoft-tri.club/logout" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Logout & Login to Access Forum
            </a>
          </div>
          
          <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p>UofT Triathlon Club | <a href="https://uoft-tri.club" style="color: #3b82f6;">uoft-tri.club</a></p>
          </div>
        </body>
        </html>
      `;

      const textContent = `
        🏃‍♂️ Welcome to UofT Triathlon Club!
        
        Congratulations, ${userName}!
        
        Your membership has been confirmed! You now have full access to the club forum and can sign up for workouts.
        
        🎯 What's Next?
        - Sign up for workouts in the forum
        - Connect with other club members
        - Stay updated on club events and races
        
        ⚠️ Important Club Rules:
        - Attendance Policy: 3 absences = 1 week ban from signups
        - Space is Limited: Sign up early for popular workouts
        - Cancel if Needed: Give others a chance if you can't make it
        
        🔄 Important: Logout & Login
        To see all the new features, please logout and log back in to your account.
        
        Logout and login: https://uoft-tri.club/logout
        
        UofT Triathlon Club | uoft-tri.club
      `;

      return await this.sendEmail(userEmail, subject, htmlContent, textContent, this.fromEmail);
    } catch (error) {
      console.error('❌ Error sending member acceptance email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send role change notification email
  async sendRoleChangeNotification(userEmail, userName, oldRole, newRole) {
    try {
      console.log('📧 EmailService.sendRoleChangeNotification called with:', { userEmail, userName, oldRole, newRole, fromEmail: this.fromEmail });
      console.log('🔍 DEBUG: AWS credentials check - Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
      console.log('🔍 DEBUG: AWS credentials check - Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.log('🔍 DEBUG: AWS credentials check - Region:', process.env.AWS_REGION || 'us-east-1');
      console.log('🔍 DEBUG: AWS credentials check - From Email:', this.fromEmail);
      
      const getRoleDisplayName = (role) => {
        switch (role) {
          case 'pending': return 'Pending Member';
          case 'member': return 'Member';
          case 'exec': return 'Executive';
          case 'administrator': return 'Administrator';
          default: return role;
        }
      };

      const oldRoleDisplay = getRoleDisplayName(oldRole);
      const newRoleDisplay = getRoleDisplayName(newRole);
      
      // Different subject and tone based on new role
      const isPending = newRole === 'pending';
      const subject = isPending 
        ? `Your UofT Triathlon Club membership has expired`
        : `🎉 Your role has been updated to ${newRoleDisplay}!`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Role Change Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${isPending ? '#dc2626, #ef4444' : '#1E3A8A, #1E40AF'}); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">${isPending ? '⚠️ Membership Expired' : '🎉 Role Updated!'}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">UofT Triathlon Club</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: ${isPending ? '#dc2626' : '#1E3A8A'}; margin-top: 0;">${isPending ? 'Hello' : 'Congratulations'}, ${userName}!</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">${isPending 
              ? 'Your membership in the UofT Triathlon Club has expired and your role has been changed to pending.'
              : 'Your role in the UofT Triathlon Club has been updated:'
            }</p>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${isPending ? '#dc2626' : '#10b981'}; margin: 20px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #6b7280; font-size: 14px;">Current Role:</span>
                <span style="color: #1f2937; font-weight: 600; font-size: 16px;">${newRoleDisplay}</span>
              </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid ${isPending ? '#dc2626' : '#3b82f6'}; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #1f2937;">${isPending ? '⚠️ What This Means' : '🎯 What This Means'}</h3>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                ${isPending ? `
                  <li>You no longer have access to the club forum and member discussions</li>
                  <li>You cannot sign up for workouts and events</li>
                  <li>You will need to reapply for membership to regain access</li>
                  <li>Contact club administrators if you believe this is an error</li>
                ` : newRole === 'member' ? `
                  <li>Access to the club forum and all member discussions</li>
                  <li>Ability to sign up for workouts and events</li>
                  <li>Full participation in club activities</li>
                ` : newRole === 'exec' ? `
                  <li>All member privileges plus executive responsibilities</li>
                  <li>Access to executive-only discussions and planning</li>
                  <li>Ability to help organize club events and activities</li>
                ` : newRole === 'administrator' ? `
                  <li>Full administrative access to the club platform</li>
                  <li>Ability to manage members and approve applications</li>
                  <li>Access to all club data and administrative functions</li>
                ` : `
                  <li>Your role has been updated with new permissions</li>
                  <li>Please log out and log back in to access your new privileges</li>
                `}
              </ul>
            </div>
            
            ${!isPending ? `
            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>📝 Important:</strong> To access your new permissions, please log out and log back into your account.
              </p>
            </div>
            ` : `
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>⚠️ Notice:</strong> Your access has been restricted. Please contact club administrators if you need assistance or believe this is an error.
              </p>
            </div>
            `}
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              If you have any questions, please contact the club administrators.
            </p>
          </div>
        </body>
        </html>
      `;

      const textContent = isPending ? `
Hello ${userName},

Your membership in the UofT Triathlon Club has expired and your role has been changed to pending.

This means:
- You no longer have access to the club forum and member discussions
- You cannot sign up for workouts and events
- You will need to reapply for membership to regain access
- Contact club administrators if you believe this is an error

If you have any questions, please contact the club administrators.

Best regards,
UofT Triathlon Club
      ` : `
Congratulations ${userName}!

Your role in the UofT Triathlon Club has been updated to ${newRoleDisplay}.

To access your new permissions, please log out and log back into your account.

If you have any questions, please contact the club administrators.

Best regards,
UofT Triathlon Club
      `;

      return await this.sendEmail(userEmail, subject, htmlContent, textContent, this.fromEmail);
    } catch (error) {
      console.error('❌ Error sending role change notification email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();