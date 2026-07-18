const jwt = require("jsonwebtoken");
const { pool } = require("../config/database.js"); // adjust path to your db config file

exports.verifyToken = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token (throws if expired or invalid)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }
    
    const result = await pool.query(
      `SELECT admin_id, full_name, username, email, is_active
       FROM indian_big_bazaar_admin
       WHERE admin_id = $1`,
      [decoded.adminId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found",
      });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated",
      });
    }

    req.admin = {
      adminId: admin.admin_id,
      fullName: admin.full_name,
      username: admin.username,
      email: admin.email,
    };

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};