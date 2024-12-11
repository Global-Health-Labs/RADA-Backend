import nodemailer from "nodemailer";
import config from "../config";

console.log("Creating email transporter with config:", {
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.auth.user,
  },
});

const transporter = nodemailer.createTransport({
  ...config.smtp,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.auth.user,
    pass: config.smtp.auth.pass,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Verification Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails:", success);
  }
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  console.log("Attempting to send email:", {
    from: config.smtp.from,
    to,
    subject,
  });

  const mailOptions = {
    from: config.smtp.from,
    to,
    subject,
    html,
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
      "X-Mailer": "RADA Application",
      "Message-ID": `<${Date.now()}.${Math.random()
        .toString(36)
        .substring(2)}@${config.smtp.from?.split("@")[1]}>`,
      "List-Unsubscribe": `<mailto:${config.smtp.auth.user}>`,
      "Feedback-ID": "RADA-INVITE:appzoy",
      "X-Google-Original-From": config.smtp.from,
    },
    text: "Please enable HTML to view this email properly.",
    messageId: `<${Date.now()}.${Math.random().toString(36).substring(2)}@${
      config.smtp.from?.split("@")[1]
    }>`,
    envelope: {
      from: config.smtp.auth.user, // Use the authenticated sender
      to: to,
    },
    dsn: {
      id: Date.now().toString(),
      return: "headers",
      notify: ["success", "failure", "delay"],
      recipient: config.smtp.auth.user,
    },
  };

  try {
    console.log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: html.length,
      // Log first 500 characters of HTML to check format
      htmlPreview: html.substring(0, 500) + "...",
    });

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });
    return info;
  } catch (error) {
    console.error("Error sending email:", {
      error: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack,
    });
    throw error;
  }
};

export const sendResetPasswordEmail = async (
  email: string,
  resetLink: string
) => {
  const mailOptions = {
    from: `"RADA System" <${config.smtp.from}>`,
    to: email,
    subject: "RADA: Reset Your Password",
    html: `
      <h1>Reset Your Password</h1>
      <p>You have requested to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this password reset, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send reset password email:", error);
    throw error;
  }
};
