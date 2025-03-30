import nodemailer from 'nodemailer';

// For development environment, we'll use a mock email service
// In production, this would be replaced with actual email credentials
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create a development or production transporter
let transporter: nodemailer.Transporter;

if (isDevelopment) {
  // In development, we'll just log the email content
  console.log('Using development email mode - emails will be logged instead of sent');
  transporter = {
    verify: async () => true,
    sendMail: async (mailOptions: any) => {
      console.log('============ DEVELOPMENT MODE: EMAIL NOT ACTUALLY SENT ============');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Verification Code: ${mailOptions.text.match(/verification code: (\d+)/)?.[1]}`);
      console.log('================================================================');
      return {
        response: 'Development mode - email logged instead of sent',
        messageId: `dev-${Date.now()}`,
      };
    },
  } as any;
} else {
  // In production, use real SMTP settings
  transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'sashwath1925@gmail.com', // Use the specified email
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  // In development mode, we don't need to check for email credentials
  if (!isDevelopment && !process.env.EMAIL_PASSWORD) {
    console.error('Missing email password');
    throw new Error('Email password is not configured');
  }

  const mailOptions = {
    from: {
      name: "OpenShelf Support",
      address: isDevelopment ? "dev@openshelf.app" : 'sashwath1925@gmail.com'
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
        <h1 style="color: #1e3a8a; margin-bottom: 20px;">Welcome to OpenShelf!</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151;">To complete your registration, please use this verification code:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <strong style="font-size: 32px; color: #1e3a8a; letter-spacing: 3px;">${code}</strong>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This code will expire in 30 minutes.</p>
        <p style="font-size: 14px; color: #6b7280;">Note: If you didn't create an account on OpenShelf, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent/logged successfully');
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}