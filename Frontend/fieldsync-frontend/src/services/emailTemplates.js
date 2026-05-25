// Email Templates for Workforce Management System

export const emailTemplates = {
  // Invitation Email Template
  invitation: {
    subject: 'You\'re Invited to Join Our Team!',
    html: (companyName, inviterName, invitationToken, expiryDate) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 You're Invited!</h1>
            <p>Join ${companyName}'s Team</p>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>${inviterName} has invited you to join the ${companyName} team on our workforce management platform.</p>
            
            <h3>What You'll Get:</h3>
            <ul>
              <li>✅ Easy time tracking</li>
              <li>✅ Schedule management</li>
              <li>✅ Team communication</li>
              <li>✅ Mobile access</li>
            </ul>
            
            <p><strong>This invitation expires on ${expiryDate}</strong></p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}" class="button">
                Accept Invitation
              </a>
            </div>
            
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            
            <div class="footer">
              <p>This email was sent by ${companyName}'s Workforce Management System</p>
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (companyName, inviterName, invitationToken, expiryDate) => `
      You're invited to join ${companyName}'s team!
      
      ${inviterName} has invited you to join our workforce management platform.
      
      Features include:
      - Easy time tracking
      - Schedule management  
      - Team communication
      - Mobile access
      
      This invitation expires on ${expiryDate}
      
      Accept your invitation: ${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}
      
      If you didn't expect this invitation, you can safely ignore this email.
      
      © ${new Date().getFullYear()} ${companyName}. All rights reserved.
    `
  },

  // Welcome Email Template
  welcome: {
    subject: 'Welcome to the Team! 🎉',
    html: (employeeName, companyName, loginUrl, temporaryPassword = null) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to the Team</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .info-box { background: #e0f2fe; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to ${companyName}!</h1>
            <p>Your account is ready to use</p>
          </div>
          <div class="content">
            <p>Hi ${employeeName},</p>
            <p>Welcome to the ${companyName} team! Your account has been successfully created and you're ready to start using our workforce management system.</p>
            
            ${temporaryPassword ? `
            <div class="info-box">
              <h3>🔐 Your Login Details:</h3>
              <p><strong>Email:</strong> Your registered email address</p>
              <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
              <p><strong>Important:</strong> Please change your password after your first login.</p>
            </div>
            ` : ''}
            
            <h3>Getting Started:</h3>
            <ul>
              <li>📊 Track your work hours and attendance</li>
              <li>📅 View your work schedule</li>
              <li>📱 Use our mobile app for on-the-go access</li>
              <li>💬 Communicate with your team</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">
                Login to Your Account
              </a>
            </div>
            
            <p>If you have any questions or need help getting started, please contact your manager or our support team.</p>
            
            <div class="footer">
              <p>Welcome aboard! We're excited to have you on the team.</p>
              <p>This email was sent by ${companyName}'s Workforce Management System</p>
              <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (employeeName, companyName, loginUrl, temporaryPassword = null) => `
      Welcome to ${companyName}, ${employeeName}!
      
      Your account has been successfully created and you're ready to start using our workforce management system.
      
      ${temporaryPassword ? `
      Your Login Details:
      Email: Your registered email address
      Temporary Password: ${temporaryPassword}
      
      Important: Please change your password after your first login.
      ` : ''}
      
      Getting Started:
      - Track your work hours and attendance
      - View your work schedule  
      - Use our mobile app for on-the-go access
      - Communicate with your team
      
      Login to your account: ${loginUrl}
      
      If you have any questions or need help getting started, please contact your manager or our support team.
      
      Welcome aboard! We're excited to have you on the team.
      
      © ${new Date().getFullYear()} ${companyName}. All rights reserved.
    `
  },

  // Password Reset Email Template
  passwordReset: {
    subject: 'Reset Your Password',
    html: (employeeName, resetToken, expiryDate) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Secure Your Account</p>
          </div>
          <div class="content">
            <p>Hi ${employeeName},</p>
            <p>We received a request to reset your password for your workforce management account.</p>
            
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
            
            <p><strong>This reset link expires on ${expiryDate}</strong></p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}" class="button">
                Reset Your Password
              </a>
            </div>
            
            <h3>For your security:</h3>
            <ul>
              <li>🔒 This link can only be used once</li>
              <li>⏰ It expires in 1 hour for security</li>
              <li>🛡️ Never share this link with anyone</li>
            </ul>
            
            <p>If you continue to have trouble accessing your account, please contact your manager or our support team.</p>
            
            <div class="footer">
              <p>This email was sent by our Workforce Management System</p>
              <p>© ${new Date().getFullYear()} Workforce Management System. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (employeeName, resetToken, expiryDate) => `
      Password Reset Request
      
      Hi ${employeeName},
      
      We received a request to reset your password for your workforce management account.
      
      ⚠️ Security Notice:
      If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
      
      This reset link expires on ${expiryDate}
      
      Reset your password: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}
      
      For your security:
      - This link can only be used once
      - It expires in 1 hour for security
      - Never share this link with anyone
      
      If you continue to have trouble accessing your account, please contact your manager or our support team.
      
      © ${new Date().getFullYear()} Workforce Management System. All rights reserved.
    `
  }
};
