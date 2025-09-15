const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

// Configure AWS SES
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testEmailDeliverability() {
  try {
    console.log('🧪 Testing email deliverability...');
    console.log('📧 From:', process.env.AWS_FROM_EMAIL);
    console.log('🌍 Region:', process.env.AWS_REGION || 'us-east-1');
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    const params = {
      Source: `UofT Triathlon Club <${process.env.AWS_FROM_EMAIL}>`,
      Destination: {
        ToAddresses: [testEmail],
      },
      Message: {
        Subject: {
          Data: 'Test Email - Deliverability Check',
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Deliverability Test</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1E3A8A, #1E40AF); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                  <h1 style="margin: 0; font-size: 28px;">✅ Deliverability Test</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">UofT Triathlon Club</p>
                </div>
                
                <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                  <h2 style="color: #1E3A8A; margin-top: 0;">Email Configuration Test</h2>
                  <p>This is a test email to check if your emails are being delivered to the inbox instead of spam.</p>
                  
                  <div style="background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937;">✅ If you see this email in your inbox:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                      <li>Your DNS records are properly configured</li>
                      <li>Your domain authentication is working</li>
                      <li>Your emails should not go to spam</li>
                    </ul>
                  </div>
                  
                  <div style="background: #fef2f2; padding: 20px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0;">
                    <h3 style="color: #dc2626; margin-top: 0;">❌ If this email went to spam:</h3>
                    <ul style="color: #dc2626; margin: 0; padding-left: 20px;">
                      <li>Check your SPF, DKIM, and DMARC DNS records</li>
                      <li>Verify your domain in AWS SES Console</li>
                      <li>Request production access if in sandbox mode</li>
                    </ul>
                  </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f3f4f6; border-radius: 8px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    This is an automated test email from the UofT Triathlon Club website.
                  </p>
                </div>
              </body>
              </html>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Deliverability Test - UofT Triathlon Club\n\nThis is a test email to check if your emails are being delivered to the inbox instead of spam.\n\nIf you see this email in your inbox, your DNS records are properly configured and your emails should not go to spam.\n\nIf this email went to spam, check your SPF, DKIM, and DMARC DNS records and verify your domain in AWS SES Console.`,
            Charset: 'UTF-8',
          },
        },
      },
      Tags: [
        {
          Name: 'EmailType',
          Value: 'Test'
        },
        {
          Name: 'Source',
          Value: 'Deliverability-Test'
        }
      ]
    };

    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.MessageId);
    console.log('📬 Check your inbox (and spam folder) for the test email');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Check if the email arrived in your inbox or spam folder');
    console.log('2. If it went to spam, set up DNS records (SPF, DKIM, DMARC)');
    console.log('3. Verify your domain in AWS SES Console');
    console.log('4. Request production access if still in sandbox mode');
    
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Check your AWS credentials are correct');
    console.log('2. Verify your domain is verified in AWS SES');
    console.log('3. Make sure you have the correct permissions');
  }
}

// Run the test
testEmailDeliverability();
