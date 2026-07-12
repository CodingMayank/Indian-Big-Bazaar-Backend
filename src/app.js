const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const hpp = require("hpp");
const morgan = require("morgan");

const rateLimiter = require("./middlewares/rateLimiter.js");
// const routes = require("./routes");
const notFoundMiddleware = require("./middlewares/notfound.js");
const errorMiddleware = require("./middlewares/error.js");

const app = express();

app.disable("x-powered-by");

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);

app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split(","),
        credentials: true,
    })
);

app.use(hpp());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(cookieParser());

app.use(compression());

if (process.env.NODE_ENV === "production") {
    app.use(morgan("combined"));
} else {
    app.use(morgan("dev"));
}

app.use(rateLimiter);

app.get("/health", (req, res) => {
    const timestamp = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date());

    res.status(200).json({
        success: true,
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        timestamp,
    });
});

// app.use("/api/v1", routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;