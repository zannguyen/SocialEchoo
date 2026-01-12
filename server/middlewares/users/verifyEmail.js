const nodemailer = require("nodemailer");
const UserPreference = require("../../models/preference.model");
const User = require("../../models/user.model");
const EmailVerification = require("../../models/email.model");
const { query, validationResult } = require("express-validator");
const { verifyEmailHTML } = require("../../utils/emailTemplates");

const CLIENT_URL = process.env.CLIENT_URL;

// Validate query
const verifyEmailValidation = [
  query("email").isEmail().normalizeEmail(),
  query("code").isLength({ min: 5, max: 5 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    next();
  },
];

// ================= SEND EMAIL =================
const sendVerificationEmail = async (req, res) => {
  const USER = process.env.EMAIL;
  const PASS = process.env.PASSWORD;
  const { email, name } = req.body;

  const verificationCode = Math.floor(10000 + Math.random() * 90000);
  const verificationLink = `${CLIENT_URL}/auth/verify?code=${verificationCode}&email=${email}`;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: USER,
        pass: PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // check SMTP
    await transporter.verify();
    console.log("SMTP ready");

    const info = await transporter.sendMail({
      from: `"SocialEcho" <${USER}>`,
      to: email,
      subject: "Verify your email address",
      html: verifyEmailHTML(name, verificationLink, verificationCode),
    });

    await new EmailVerification({
      email,
      verificationCode,
      messageId: info.messageId,
      for: "signup",
    }).save();

    res.status(200).json({
      message: `Verification email sent to ${email}`,
    });
  } catch (err) {
    console.error("Mail error:", err.message);

    res.status(500).json({
      message: "Failed to send verification email",
    });
  }
};

// ================= VERIFY =================
const verifyEmail = async (req, res, next) => {
  const { code, email } = req.query;

  try {
    const [isVerified, verification] = await Promise.all([
      User.findOne({ email, isEmailVerified: true }),
      EmailVerification.findOne({ email, verificationCode: code }),
    ]);

    if (isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (!verification) {
      return res
        .status(400)
        .json({ message: "Verification code invalid or expired" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { isEmailVerified: true },
      { new: true }
    );

    await Promise.all([
      EmailVerification.deleteMany({ email }),
      new UserPreference({
        user: updatedUser,
        enableContextBasedAuth: true,
      }).save(),
    ]);

    req.userId = updatedUser._id;
    req.email = updatedUser.email;
    next();
  } catch (error) {
    console.error("Verify email error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  sendVerificationEmail,
  verifyEmail,
  verifyEmailValidation,
};
