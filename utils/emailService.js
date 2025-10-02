const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  try {
    // Verify nodemailer is loaded correctly
    if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
      throw new Error('Nodemailer not properly loaded');
    }

    // Debug: Log environment variables (remove in production)
    console.log('SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_EMAIL ? '***' : 'NOT SET',
      pass: process.env.SMTP_PASSWORD ? '***' : 'NOT SET'
    });

    // Check if credentials are available
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      throw new Error('SMTP credentials not configured. Please set SMTP_EMAIL and SMTP_PASSWORD environment variables.');
    }

    // Note: It's createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      },
      // Add these for better reliability
      tls: {
        rejectUnauthorized: false
      },
      debug: process.env.NODE_ENV === 'development', // Enable debug in development
      logger: process.env.NODE_ENV === 'development' // Enable logging in development
    });

    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw error;
  }
};
/**
 * Send OTP email to user
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {string} otp - 6-digit OTP code
 */
const sendOTPEmail = async (email, firstName, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Soely'}" <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Your Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            margin-bottom: 20px;
            font-size: 16px;
            color: #555;
          }
          .otp-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 8px;
            color: white;
            margin: 0;
            font-family: 'Courier New', monospace;
          }
          .otp-label {
            color: rgba(255,255,255,0.9);
            font-size: 14px;
            margin-top: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            margin: 5px 0;
          }
          .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .note p {
            margin: 0;
            color: #856404;
            font-size: 14px;
          }
          .info-box {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box p {
            margin: 0;
            color: #0d47a1;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME || 'Soely'}</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>Thank you for signing up with ${process.env.APP_NAME || 'Soely'}!</p>
            <p>To verify your email address, please use the following One-Time Password (OTP):</p>
            
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
              <p class="otp-label">Verification Code</p>
            </div>
            
            <div class="info-box">
              <p><strong>How to use:</strong> Enter this code in the verification screen of the app to complete your registration.</p>
            </div>
            
            <div class="note">
              <p><strong>Important:</strong> This OTP will expire in 10 minutes. If you didn't create an account with us, please ignore this email.</p>
            </div>
            
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              For security reasons, never share this OTP with anyone. ${process.env.APP_NAME || 'Soely'} will never ask you for this code.
            </p>
          </div>
          <div class="footer">
            <p><strong>${process.env.APP_NAME || 'Soely'}</strong></p>
            <p>If you have any questions, please contact our support team.</p>
            <p style="margin-top: 15px; color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName}!

Thank you for signing up with ${process.env.APP_NAME || 'Soely'}!

To verify your email address, please use the following One-Time Password (OTP):

${otp}

Important: 
- This OTP will expire in 10 minutes
- Never share this code with anyone
- If you didn't create an account with us, please ignore this email

Enter this code in the verification screen of the app to complete your registration.

${process.env.APP_NAME || 'Soely'}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

/**
 * Send Password Reset OTP email to user
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {string} otp - 6-digit OTP code
 */
const sendPasswordResetOTPEmail = async (email, firstName, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Soely'}" <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Password Reset Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            margin-bottom: 20px;
            font-size: 16px;
            color: #555;
          }
          .otp-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 8px;
            color: white;
            margin: 0;
            font-family: 'Courier New', monospace;
          }
          .otp-label {
            color: rgba(255,255,255,0.9);
            font-size: 14px;
            margin-top: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            margin: 5px 0;
          }
          .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning-box p {
            margin: 0;
            color: #856404;
            font-size: 14px;
          }
          .security-box {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .security-box p {
            margin: 0;
            color: #721c24;
            font-size: 14px;
          }
          .info-box {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box p {
            margin: 0;
            color: #0d47a1;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME || 'Soely'}</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}!</h2>
            <p>We received a request to reset your password. If you didn't make this request, please ignore this email and your password will remain unchanged.</p>
            <p>To reset your password, please use the following One-Time Password (OTP):</p>
            
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
              <p class="otp-label">Password Reset Code</p>
            </div>
            
            <div class="info-box">
              <p><strong>How to use:</strong> Enter this code in the password reset screen of the app to verify your identity and create a new password.</p>
            </div>
            
            <div class="warning-box">
              <p><strong>Important:</strong> This OTP will expire in 10 minutes. If you didn't request a password reset, please secure your account immediately.</p>
            </div>
            
            <div class="security-box">
              <p><strong>Security Notice:</strong> Never share this OTP with anyone. ${process.env.APP_NAME || 'Soely'} staff will never ask you for this code via email, phone, or any other means.</p>
            </div>
            
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you didn't request this password reset, someone may be trying to access your account. Please change your password immediately and contact our support team.
            </p>
          </div>
          <div class="footer">
            <p><strong>${process.env.APP_NAME || 'Soely'}</strong></p>
            <p>If you have any questions or concerns, please contact our support team immediately.</p>
            <p style="margin-top: 15px; color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${firstName}!

We received a request to reset your password for your ${process.env.APP_NAME || 'Soely'} account.

To reset your password, please use the following One-Time Password (OTP):

${otp}

Important: 
- This OTP will expire in 10 minutes
- Never share this code with anyone
- If you didn't request a password reset, please secure your account immediately

Enter this code in the password reset screen of the app to verify your identity and create a new password.

If you didn't request this password reset, someone may be trying to access your account. Please change your password immediately and contact our support team.

${process.env.APP_NAME || 'Soely'}
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset OTP email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset OTP email:', error);
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetOTPEmail
};