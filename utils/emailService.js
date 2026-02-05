const nodemailer = require('nodemailer');

// Create reusable transporter with Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // ✅ Use Gmail service instead of host/port
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Send activation email
const sendActivationEmail = async (email, firstName, activationToken) => {
  const transporter = createTransporter();
  const activationUrl = `${process.env.FRONTEND_URL}/activate/${activationToken}`;

  const mailOptions = {
    from: `"Cloud Drive" <${process.env.EMAIL_USER}>`, // ✅ Changed from EMAIL_FROM
    to: email,
    subject: 'Activate Your Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4285f4; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #4285f4; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Cloud Drive!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>Thank you for registering with Cloud Drive. To complete your registration and activate your account, please click the button below:</p>
            <p style="text-align: center;">
              <a href="${activationUrl}" class="button">Activate My Account</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4285f4;">${activationUrl}</p>
            <p><strong>This activation link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with us, please ignore this email.</p>
            <p>Best regards,<br>The Cloud Drive Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Activation email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending activation email:', error);
    throw new Error('Failed to send activation email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const transporter = createTransporter();
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"Cloud Drive" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ea4335; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #ea4335; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <p>We received a request to reset the password for your Cloud Drive account.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #ea4335;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>For security, this link can only be used once</li>
              </ul>
            </div>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            <p>Best regards,<br>The Cloud Drive Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send password changed confirmation email
const sendPasswordChangedEmail = async (email, firstName) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Cloud Drive" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Successfully Changed',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #34a853; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .success { background-color: #d4edda; border-left: 4px solid #28a745; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName},</h2>
            <div class="success">
              <strong>Success!</strong> Your password has been changed successfully.
            </div>
            <p>This is a confirmation that the password for your Cloud Drive account has been changed.</p>
            <p>If you made this change, no further action is required.</p>
            <p><strong>If you didn't make this change:</strong></p>
            <ul>
              <li>Please contact our support team immediately</li>
              <li>Your account may have been compromised</li>
            </ul>
            <p>Best regards,<br>The Cloud Drive Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password changed confirmation email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending password changed email:', error);
    // Don't throw error here, as password was already changed successfully
  }
};

module.exports = {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
};