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
  `
};
