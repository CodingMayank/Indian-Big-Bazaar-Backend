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

        // 3. Make sure this is actually a customer token, not an admin token
        if (!decoded.customerId) {
            return res.status(403).json({
                success: false,
                message: "Invalid token for this resource",
            });
        }

        // 4. Re-check customer still exists and is active
        const result = await pool.query(
            `SELECT customer_id, full_name, username, email, phone_number, is_active
             FROM indian_big_bazaar_customer
             WHERE customer_id = $1`,
            [decoded.customerId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Customer account not found",
            });
        }

        const customer = result.rows[0];

        if (!customer.is_active) {
            return res.status(403).json({
                success: false,
                message: "This account has been deactivated",
            });
        }

        // 5. Attach customer info to req
        req.customer = {
            customerId: customer.customer_id,
            fullName: customer.full_name,
            username: customer.username,
            email: customer.email,
            phoneNumber: customer.phone_number,
        };

        next();
    } catch (error) {
        console.error("Customer token verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};