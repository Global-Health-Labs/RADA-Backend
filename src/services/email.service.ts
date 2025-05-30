import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import config from "../config";

// Create SES client
const sesClient = new SESClient({
  region: "us-east-1", // Using us-east-1 where the SES identity is verified
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  console.log("Attempting to send email:", {
    from: "radasys@ghlab.it", // Using the verified identity
    to,
    subject,
  });

  // Create the email parameters for SES
  const params: SendEmailCommandInput = {
    Source: "radasys@ghlab.it", // Using the verified identity
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: html,
          Charset: "UTF-8",
        },
        Text: {
          Data: "Please enable HTML to view this email properly.",
          Charset: "UTF-8",
        },
      },
    },
    // Optional configuration for message tags
    Tags: [
      {
        Name: "System",
        Value: "RADA",
      },
    ],
  };

  try {
    console.log("Sending email with SES:", {
      from: params.Source,
      to,
      subject,
      htmlLength: html.length,
      // Log first 500 characters of HTML to check format
      htmlPreview: html.substring(0, 500) + "...",
    });

    // Send the email using SES
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);

    console.log("Email sent successfully with SES:", {
      messageId: response.MessageId,
    });

    return response;
  } catch (error: any) {
    console.error("Error sending email with SES:", {
      error: error.message,
      code: error.$metadata?.httpStatusCode,
      stack: error.stack,
    });
    throw error;
  }
};

export const sendResetPasswordEmail = async (
  email: string,
  resetLink: string
) => {
  const htmlContent = `
    <h1>Reset Your Password</h1>
    <p>You have requested to reset your password. Click the link below to set a new password:</p>
    <p><a href="${resetLink}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this password reset, please ignore this email.</p>
  `;

  try {
    // Use the sendEmail function we already defined
    await sendEmail(email, "RADA: Reset Your Password", htmlContent);
  } catch (error) {
    console.error("Failed to send reset password email:", error);
    throw error;
  }
};
