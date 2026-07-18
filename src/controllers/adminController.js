const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database.js"); // adjust path to your db config file


// POST /admin/create
exports.createAdmin = async (req, res) => {
  try {
    const { full_name, username, email, password } = req.body;

    // 1. Basic validation
    if (!full_name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "full_name, username, email and password are required",
      });
    }

    // 2. Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // 3. Insert into DB
    const result = await pool.query(
      `INSERT INTO indian_big_bazaar_admin (full_name, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING admin_id, full_name, username, email, is_active, created_at`,
      [full_name, username, email, password_hash]
    );

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: result.rows[0],
    });
  } catch (error) {
    // Handle unique constraint violation (username/email already exists)
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    console.error("Create admin error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // 2. Fetch admin by username
    const result = await pool.query(
      `SELECT admin_id, full_name, username, email, password_hash, is_active
       FROM indian_big_bazaar_admin
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const admin = result.rows[0];

    // 3. Check if account is active
    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated",
      });
    }

    // 4. Compare password with stored hash
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // 5. Generate JWT valid for 24 hours
    const token = jwt.sign(
      {
        adminId: admin.admin_id,
        username: admin.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 6. Update last_login_at
    await pool.query(
      `UPDATE indian_big_bazaar_admin
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE admin_id = $1`,
      [admin.admin_id]
    );

    // 7. Send response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        adminId: admin.admin_id,
        fullName: admin.full_name,
        username: admin.username,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /admin/me  (protected by verifyToken middleware)
exports.getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin,
  });
};