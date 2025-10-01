const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  try {
    // Verify nodemailer is loaded correctly
    if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
      throw new Error('Nodemailer not properly loaded');
    }

    // Note: It's createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      // Add these for better reliability
      tls: {
        rejectUnauthorized: false
      }
    });

    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw error;
  }
};

/**
 * Send verification email to user
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {string} verificationUrl - URL for email verification
 */
const sendVerificationEmail = async (email, firstName, verificationUrl) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Soely'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
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
            }
            .button {
              display: inline-block;
              padding: 14px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${process.env.APP_NAME || 'Soely'}</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName}! 👋</h2>
              <p>Thank you for signing up with ${process.env.APP_NAME || 'Soely'}!</p>
              <p>To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
              
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>
              
              <div class="note">
                <p><strong>Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with us, please ignore this email.</p>
              </div>
              
              <p>If the button above doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea; font-size: 14px;">${verificationUrl}</p>
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

To complete your registration and start using your account, please verify your email address by visiting the following link:

${verificationUrl}

Note: This verification link will expire in 24 hours. If you didn't create an account with us, please ignore this email.

If you have any questions, please contact our support team.

${process.env.APP_NAME || 'Soely'}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {string} resetUrl - URL for password reset
 */
const sendPasswordResetEmail = async (email, firstName, resetUrl) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Soely'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request',
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
            }
            .button {
              display: inline-block;
              padding: 14px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px 30px;
              text-align: center;
              color: #666;
              font-size: 14px;
              border-top: 1px solid #e9ecef;
            }
            .note {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${process.env.APP_NAME || 'Soely'}</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hi ${firstName},</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              
              <div class="note">
                <p><strong>Note:</strong> This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              </div>
              
              <p>If the button doesn't work, copy and paste this link:</p>
              <p style="word-break: break-all; color: #667eea; font-size: 14px;">${resetUrl}</p>
            </div>
            <div class="footer">
              <p><strong>${process.env.APP_NAME || 'Soely'}</strong></p>
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset Request

Hi ${firstName},

We received a request to reset your password. Visit the following link to create a new password:

${resetUrl}

Note: This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email.

${process.env.APP_NAME || 'Soely'}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};