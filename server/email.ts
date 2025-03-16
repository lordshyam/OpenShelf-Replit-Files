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
    subject: 'Your OpenShelf Verification Code',
    text: `
Welcome to OpenShelf!

Your verification code is: ${code}

Enter this code to complete your registration.

If you didn't request this code, please ignore this email.

Best regards,
The OpenShelf Team
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1e3a8a; margin-bottom: 20px;">Welcome to OpenShelf!</h1>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Your verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <strong style="font-size: 32px; color: #1e3a8a; letter-spacing: 3px;">${code}</strong>
        </div>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Enter this code to complete your registration.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
      </div>
    `,
  };

  try {
    // Verify connection configuration
    await transporter.verify();

    // Send mail with defined transport object
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    console.log('Message ID:', info.messageId);
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