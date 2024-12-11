export const generateInvitationEmail = (
  fullname: string,
  email: string,
  password: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
      margin: 20px 0;
      border: 1px solid #eee;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .content {
      background-color: white;
      padding: 20px;
      border-radius: 6px;
      border: 1px solid #eee;
    }
    .credentials {
      background-color: #f3f4f6;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .credentials p {
      margin: 5px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to RADA</h1>
    </div>
    
    <div class="content">
      <p>Dear ${fullname},</p>
      
      <p>You have been invited to join RADA. An account has been created for you with the following credentials:</p>
      
      <div class="credentials">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
      </div>
      
      <p>For security reasons, please change your password after your first login.</p>
      
      <a href="${process.env.FRONTEND_URL}/login" class="button">Login to RADA</a>
      
      <p>If you have any questions or need assistance, please don't hesitate to contact the administrator.</p>
    </div>
    
    <div class="footer">
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;
