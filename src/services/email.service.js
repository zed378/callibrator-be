const nodemailer = require("nodemailer");

const fs = require("fs");

const path = require("path");

// ==========================================
// EMAIL TEMPLATES
// ==========================================

const activationTemplate = fs.readFileSync(
  path.join(__dirname, "../templates/template.html"),

  "utf8",
);

const otpTemplate = fs.readFileSync(
  path.join(__dirname, "../templates/otp.html"),

  "utf8",
);

// ==========================================
// TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

// ==========================================
// SEND EMAIL
// ==========================================

const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
  });
};

// ==========================================
// SEND ACTIVATION EMAIL
// ==========================================

const sendActivationEmail = async ({
  email,
  firstName,
  lastName,
  activationLink,
}) => {
  const html = mustache.render(activationTemplate, {
    firstName,
    lastName,
    link: activationLink,
  });

  return sendEmail({
    to: email,
    subject: "Account Activation",
    html,
  });
};

// ==========================================
// SEND OTP EMAIL
// ==========================================

const sendOtpEmail = async ({ email, firstName, lastName, otp }) => {
  const html = mustache.render(otpTemplate, {
    firstName,
    lastName,
    otp,
  });

  return sendEmail({
    to: email,
    subject: "Password Reset OTP",
    html,
  });
};

module.exports = {
  sendEmail,
  sendActivationEmail,
  sendOtpEmail,
};
