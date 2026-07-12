require("dotenv").config();

const http = require("http");

const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        const server = http.createServer(app);

        server.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`Environment : ${process.env.NODE_ENV}`);
        });

        process.on("SIGTERM", () => {
            console.log("SIGTERM received. Shutting down gracefully...");

            server.close(() => {
                console.log("Server stopped.");
                process.exit(0);
            });
        });

        process.on("SIGINT", () => {
            console.log("SIGINT received. Shutting down gracefully...");

            server.close(() => {
                console.log("Server stopped.");
                process.exit(0);
            });
        });
    } catch (error) {
        console.error("Failed to start server");
        console.error(error);
        process.exit(1);
    }
};

startServer();

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception");
    console.error(error);
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection");
    console.error(reason);
    process.exit(1);
});