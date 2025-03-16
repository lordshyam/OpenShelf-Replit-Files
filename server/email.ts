import nodemailer from 'nodemailer';

// Create a test account or use real Gmail credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // For development purposes
  }
});

export async function sendVerificationEmail(email: string, code: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email credentials are not configured');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'OpenShelf Email Verification',
    html: `
      <h1>Welcome to OpenShelf!</h1>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>Enter this code to complete your registration.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}