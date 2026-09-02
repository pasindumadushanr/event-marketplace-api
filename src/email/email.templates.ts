export const EmailTemplates = {
  getContactConfirmationTemplate: (name: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Thank you for contacting us, ${name}!</h2>
      <p style="color: #475569; line-height: 1.6;">We have received your message and our team will get back to you as soon as possible.</p>
      <p style="color: #475569; line-height: 1.6;">In the meantime, feel free to explore our premium vendors.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated message from LuxeEvents.</p>
    </div>
  `,
  
  getAdminContactNotificationTemplate: (name: string, email: string, message: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">New Contact Inquiry</h2>
      <p><strong>From:</strong> ${name} (${email})</p>
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 15px;">
        <p style="color: #475569; margin: 0;">${message}</p>
      </div>
    </div>
  `,

  getVendorApprovalTemplate: (name: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Congratulations, ${name}!</h2>
      <p style="color: #475569; line-height: 1.6;">Your vendor application for LuxeEvents has been approved by our administrative team.</p>
      <p style="color: #475569; line-height: 1.6;">You can now log in to your Vendor Dashboard to create packages, manage bookings, and grow your business.</p>
      <div style="margin-top: 30px;">
        <a href="https://event-marketplace-web-woad.vercel.app/vendor" style="background-color: #D4AF37; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Welcome to the LuxeEvents Marketplace.</p>
    </div>
  `,

  getOtpVerificationTemplate: (name: string, otp: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Verify your email address</h2>
      <p style="color: #475569; line-height: 1.6;">Hi ${name},</p>
      <p style="color: #475569; line-height: 1.6;">Thank you for registering at LuxeEvents. Please use the following 6-digit code to verify your email address. This code will expire in 15 minutes.</p>
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0f172a;">${otp}</span>
      </div>
      <p style="color: #475569; line-height: 1.6;">If you did not request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">LuxeEvents Security Team</p>
    </div>
  `
};
