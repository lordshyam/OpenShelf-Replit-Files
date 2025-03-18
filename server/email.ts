import nodemailer from 'nodemailer';

// Create a test account or use real Gmail credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  debug: true, // Enable debugging
});

export async function sendVerificationEmail(email: string, code: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('Missing email credentials');
    throw new Error('Email credentials are not configured');
  }

  const mailOptions = {
    from: {
      name: "OpenShelf Support",
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Welcome to OpenShelf - Verify Your Email',
    text: `
Welcome to OpenShelf!

To complete your registration, please use this verification code: ${code}

This code will expire in 30 minutes.

Note: If you didn't create an account on OpenShelf, please ignore this email.

Best regards,
The OpenShelf Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <img src="https://openshelf.app/logo.png" alt="OpenShelf Logo" style="max-width: 150px; margin-bottom: 20px;" />
        <h1 style="color: #1e3a8a; margin-bottom: 20px;">Welcome to OpenShelf!</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151;">To complete your registration, please use this verification code:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <strong style="font-size: 32px; color: #1e3a8a; letter-spacing: 3px;">${code}</strong>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code will expire in 30 minutes.</p>
        <p style="font-size: 14px; color: #6b7280;">Note: If you didn't create an account on OpenShelf, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          This is a one-time verification email from OpenShelf. 
          Please add support@openshelf.app to your contacts to ensure delivery.
        </p>
      </div>
    `,
    headers: {
      'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
      'Precedence': 'bulk',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    }
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    console.log('Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}