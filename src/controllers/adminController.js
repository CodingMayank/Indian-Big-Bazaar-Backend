const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database.js"); // adjust path to your db config file
const cloudinary = require("../config/cloudinary.js");

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "big_bazaar_products" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
};
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

// POST /admin/product
exports.createProduct = async (req, res) => {
    try {
        const { admin_id, product_name, price,category, stock_quantity, product_description } = req.body;

        // 1. Basic validation
        if (!admin_id || !product_name || !price || stock_quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "admin_id, product_name, price and stock_quantity are required",
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "product_image is required",
            });
        }

        const priceGBP = Number(price);
        if (isNaN(priceGBP) || priceGBP <= 0) {
            return res.status(400).json({
                success: false,
                message: "price must be a valid positive number",
            });
        }

        // 2. Check admin exists and is active
        const adminResult = await pool.query(
            `SELECT admin_id, is_active FROM indian_big_bazaar_admin WHERE admin_id = $1`,
            [admin_id]
        );

        if (adminResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        if (!adminResult.rows[0].is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive",
            });
        }

        // 3. Convert GBP -> INR
        const conversionRate = Number(process.env.GBP_TO_INR_RATE) || 105.5;
        const priceINR = Number((priceGBP * conversionRate).toFixed(2));

        // 4. Upload image to Cloudinary
        let uploadResult;
        try {
            uploadResult = await uploadToCloudinary(req.file.buffer);
        } catch (uploadErr) {
            console.error("Cloudinary upload error:", uploadErr);
            return res.status(502).json({
                success: false,
                message: "Image upload failed",
            });
        }

        // 5. Insert product
        const result = await pool.query(
            `INSERT INTO indian_big_bazaar_admin_products
                (admin_id, product_name, price_gbp, price_inr, stock_quantity, product_description, product_image,category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING product_id, product_name, price_gbp, price_inr, stock_quantity, product_description, product_image, created_at`,
            [
                admin_id,
                product_name,
                priceGBP,
                priceINR,
                stock_quantity,
                product_description || null,
                uploadResult.secure_url,
                category
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            product: result.rows[0],
        });
    } catch (error) {
        console.error("Create product error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// GET /admin/product/:admin_id
exports.getProductsByAdmin = async (req, res) => {
    try {
        const { admin_id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        if (!admin_id) {
            return res.status(400).json({
                success: false,
                message: "admin_id is required",
            });
        }

        // 1. Check admin exists and is active
        const adminResult = await pool.query(
            `SELECT admin_id, is_active FROM indian_big_bazaar_admin WHERE admin_id = $1`,
            [admin_id]
        );

        if (adminResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        if (!adminResult.rows[0].is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive",
            });
        }

        // 2. Get total count (for pagination info)
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM indian_big_bazaar_admin_products WHERE admin_id = $1`,
            [admin_id]
        );
        const totalProducts = Number(countResult.rows[0].count);

        // 3. Fetch products
        const result = await pool.query(
            `SELECT product_id, product_name, price_gbp, price_inr, stock_quantity,
                    product_description, product_image, created_at, updated_at
             FROM indian_big_bazaar_admin_products
             WHERE admin_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [admin_id, limit, offset]
        );

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            pagination: {
                total: totalProducts,
                page,
                limit,
                totalPages: Math.ceil(totalProducts / limit),
            },
            products: result.rows,
        });
    } catch (error) {
        console.error("Get products error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};