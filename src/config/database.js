const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
        process.env.DB_SSL === "true"
            ? {
                  rejectUnauthorized: false,
              }
            : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

const connectDB = async () => {
    try {
        const client = await pool.connect();

        await client.query("SELECT NOW()");

        console.log("✅ PostgreSQL connected successfully.");

        client.release();
    } catch (error) {
        console.error("❌ PostgreSQL connection failed.");
        console.error(error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
module.exports.pool = pool;