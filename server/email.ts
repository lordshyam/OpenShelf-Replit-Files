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
    from: `"OpenShelf" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'OpenShelf Email Verification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e3a8a;">Welcome to OpenShelf!</h1>
        <p>Your verification code is: <strong style="font-size: 24px; color: #1e3a8a;">${code}</strong></p>
        <p>Enter this code to complete your registration.</p>
        <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };

  try {
    // Verify connection configuration
    await transporter.verify();

    // Send mail with defined transport object
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}