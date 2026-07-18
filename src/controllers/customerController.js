const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database.js");

// POST /customer/signup
exports.customerSignup = async (req, res) => {
    try {
        const { username, email, full_name, phone_number, password } = req.body;

        // 1. Basic validation
        if (!username || !email || !full_name || !phone_number || !password) {
            return res.status(400).json({
                success: false,
                message: "username, email, full_name, phone_number and password are required",
            });
        }

        // 2. Check uniqueness for username, email, phone_number individually
        const existingCheck = await pool.query(
            `SELECT username, email, phone_number
             FROM indian_big_bazaar_customer
             WHERE username = $1 OR email = $2 OR phone_number = $3`,
            [username, email, phone_number]
        );

        if (existingCheck.rows.length > 0) {
            const conflicts = [];

            for (const row of existingCheck.rows) {
                if (row.username === username && !conflicts.includes("username")) {
                    conflicts.push("username");
                }
                if (row.email === email && !conflicts.includes("email")) {
                    conflicts.push("email");
                }
                if (row.phone_number === phone_number && !conflicts.includes("phone_number")) {
                    conflicts.push("phone_number");
                }
            }

            return res.status(409).json({
                success: false,
                message: `${conflicts.join(", ")} already in use`,
                conflicts, // e.g. ["email"] or ["username", "phone_number"]
            });
        }

        // 3. Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // 4. Insert into DB
        const result = await pool.query(
            `INSERT INTO indian_big_bazaar_customer
                (full_name, username, email, phone_number, password_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING customer_id, full_name, username, email, phone_number, is_active, created_at`,
            [full_name, username, email, phone_number, password_hash]
        );

        return res.status(201).json({
            success: true,
            message: "Customer registered successfully",
            customer: result.rows[0],
        });
    } catch (error) {
        // Fallback safety net — handles a race condition where two signups
        // for the same username/email/phone land at almost the same time,
        // both pass the pre-check above, then the DB's UNIQUE constraint
        // still catches the second one
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Username, email or phone number already exists",
            });
        }

        console.error("Customer signup error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// POST /customer/login
exports.customerLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Basic validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        // 2. Fetch customer by username
        const result = await pool.query(
            `SELECT customer_id, full_name, username, email, phone_number, password_hash, is_active
             FROM indian_big_bazaar_customer
             WHERE username = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const customer = result.rows[0];

        // 3. Check if account is active
        if (!customer.is_active) {
            return res.status(403).json({
                success: false,
                message: "This account has been deactivated",
            });
        }

        // 4. Compare password
        const isPasswordValid = await bcrypt.compare(password, customer.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        // 5. Generate JWT valid for 24 hours
        const token = jwt.sign(
            {
                customerId: customer.customer_id,
                username: customer.username,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        // 6. Update last_login_at
        await pool.query(
            `UPDATE indian_big_bazaar_customer
             SET last_login_at = CURRENT_TIMESTAMP
             WHERE customer_id = $1`,
            [customer.customer_id]
        );

        // 7. Send response
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            customer: {
                customerId: customer.customer_id,
                fullName: customer.full_name,
                username: customer.username,
                email: customer.email,
                phoneNumber: customer.phone_number,
            },
        });
    } catch (error) {
        console.error("Customer login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


exports.getMe = async (req, res) => {
    return res.status(200).json({
        success: true,
        customer: req.customer,
    });
};