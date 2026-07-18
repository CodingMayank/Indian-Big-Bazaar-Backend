const rateLimit = require("express-rate-limit");

const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MIN);
const maxRequests = Number(process.env.RATE_LIMIT_MAX);

const rateLimiter = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },

    skip: (req) => {
        return req.path === "/health";
    },
});

module.exports = rateLimiter;