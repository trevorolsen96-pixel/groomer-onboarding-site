import nodemailer from "nodemailer";

function createTransporter() {
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!appPassword) {
    throw new Error("Missing GMAIL_APP_PASSWORD environment variable.");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "support@wagzly.com",
      pass: appPassword,
    },
  });
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const transporter = createTransporter();
  const firstName = name.split(" ")[0] || "there";
  const year = new Date().getFullYear();

  await transporter.sendMail({
    from: '"Wagzly" <support@wagzly.com>',
    to,
    subject: "Reset your Wagzly password",
    text: [
      `Hi ${firstName},`,
      "",
      "We received a request to reset your Wagzly password.",
      "",
      "Click the link below to set a new password:",
      "",
      resetUrl,
      "",
      "This link expires in 24 hours. If you didn't request a password reset, you can safely ignore this email.",
      "",
      "— The Wagzly Team",
      "support@wagzly.com",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Wagzly password</title>
</head>
<body style="margin:0;padding:0;background-color:#faf8f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px 40px;">

    <div style="background:#ffffff;border-radius:20px;padding:40px 36px;border:1px solid #ede8e4;">

      <div style="margin-bottom:32px;">
        <span style="font-size:20px;font-weight:800;color:#2e2430;letter-spacing:-0.3px;">Wagzly</span>
      </div>

      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#2e2430;line-height:1.3;">
        Reset your password
      </h1>

      <p style="margin:0 0 8px;color:#7a6b75;font-size:15px;line-height:1.65;">
        Hi ${firstName}, we received a request to reset your Wagzly password.
      </p>

      <p style="margin:0 0 28px;color:#7a6b75;font-size:15px;line-height:1.65;">
        Click the button below to choose a new password.
      </p>

      <a href="${resetUrl}"
         style="display:inline-block;background:#c58fa1;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;padding:14px 28px;letter-spacing:0.1px;">
        Reset my password
      </a>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f0ebe7;">
        <p style="margin:0;color:#b0a0aa;font-size:13px;line-height:1.55;">
          This link expires in <strong>24 hours</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.
        </p>
        <p style="margin:10px 0 0;color:#b0a0aa;font-size:13px;line-height:1.55;">
          Having trouble with the button? Copy and paste this link into your browser:<br>
          <span style="word-break:break-all;color:#c58fa1;">${resetUrl}</span>
        </p>
      </div>

    </div>

    <p style="text-align:center;color:#c4b8bf;font-size:12px;margin-top:20px;line-height:1.5;">
      © ${year} Wagzly &nbsp;·&nbsp;
      <a href="https://wagzly.com" style="color:#c4b8bf;text-decoration:none;">wagzly.com</a>
      &nbsp;·&nbsp;
      <a href="mailto:support@wagzly.com" style="color:#c4b8bf;text-decoration:none;">support@wagzly.com</a>
    </p>

  </div>
</body>
</html>`,
  });
}

export async function sendPasswordSetupEmail({
  to,
  name,
  setupUrl,
}: {
  to: string;
  name: string;
  setupUrl: string;
}): Promise<void> {
  const transporter = createTransporter();
  const firstName = name.split(" ")[0] || "there";
  const year = new Date().getFullYear();

  await transporter.sendMail({
    from: '"Wagzly" <support@wagzly.com>',
    to,
    subject: "Set up your Wagzly password",
    text: [
      `Hi ${firstName},`,
      "",
      "Your Wagzly account is ready! Your 14-day free trial has started.",
      "",
      "Click the link below to set your password and access your dashboard:",
      "",
      setupUrl,
      "",
      "This link expires in 24 hours. If you did not sign up for Wagzly, you can safely ignore this email.",
      "",
      "— The Wagzly Team",
      "support@wagzly.com",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set up your Wagzly password</title>
</head>
<body style="margin:0;padding:0;background-color:#faf8f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px 40px;">

    <div style="background:#ffffff;border-radius:20px;padding:40px 36px;border:1px solid #ede8e4;">

      <div style="margin-bottom:32px;">
        <span style="font-size:20px;font-weight:800;color:#2e2430;letter-spacing:-0.3px;">Wagzly</span>
      </div>

      <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#2e2430;line-height:1.3;">
        Welcome, ${firstName}! Your account is ready.
      </h1>

      <p style="margin:0 0 8px;color:#7a6b75;font-size:15px;line-height:1.65;">
        Your Wagzly business account has been created and your <strong style="color:#2e2430;">14-day free trial</strong> has started.
      </p>

      <p style="margin:0 0 28px;color:#7a6b75;font-size:15px;line-height:1.65;">
        Click the button below to set your password and get started.
      </p>

      <a href="${setupUrl}"
         style="display:inline-block;background:#c58fa1;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;padding:14px 28px;letter-spacing:0.1px;">
        Set my password
      </a>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f0ebe7;">
        <p style="margin:0;color:#b0a0aa;font-size:13px;line-height:1.55;">
          This link expires in <strong>24 hours</strong>. If you did not sign up for Wagzly, you can safely ignore this email.
        </p>
        <p style="margin:10px 0 0;color:#b0a0aa;font-size:13px;line-height:1.55;">
          Having trouble with the button? Copy and paste this link into your browser:<br>
          <span style="word-break:break-all;color:#c58fa1;">${setupUrl}</span>
        </p>
      </div>

    </div>

    <p style="text-align:center;color:#c4b8bf;font-size:12px;margin-top:20px;line-height:1.5;">
      © ${year} Wagzly &nbsp;·&nbsp;
      <a href="https://wagzly.com" style="color:#c4b8bf;text-decoration:none;">wagzly.com</a>
      &nbsp;·&nbsp;
      <a href="mailto:support@wagzly.com" style="color:#c4b8bf;text-decoration:none;">support@wagzly.com</a>
    </p>

  </div>
</body>
</html>`,
  });
}
