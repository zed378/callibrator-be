const crypto = require("crypto");

// ==========================================
// GENERATE OTP
// ==========================================

exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ==========================================
// HASH OTP
// ==========================================

exports.hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};
