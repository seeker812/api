import pkg from "pg";
import dotenv from "dotenv";
const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed certs (for testing)
  },
});

async function saveToDatabase(results, timestamp) {
  const client = await pool.connect();
  try {
    const insertQuery = `
            INSERT INTO operations.interception_tracking_results (tracking_id, status, timestamp, error_message)
            VALUES ($1, $2, $3, $4)
        `;

    await client.query("BEGIN");

    for (const id of results.success) {
      await client.query(insertQuery, [id, "Success", timestamp, ""]);
    }

    for (const result of result.failed) {
      await client.query(insertQuery, [
        result.trackingId,
        "failed",
        timestamp,
        result.error,
      ]);
    }

    await client.query("COMMIT");
    console.log("Results saved to database successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving results to database:", error);
  } finally {
    client.release();
  }
}

async function fetchFromDatabase(email, timestamp) {
  const searchQuery = `
                  SELECT * 
                  FROM operations.interception_tracking_results
                  WHERE tracking_id = $1 
                  AND timestamp = $2;

            `;
  try {
    const result = await pool.query(searchQuery, [email, timestamp]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching results from database:", error);
    throw error;
  }
}
export { saveToDatabase, fetchFromDatabase };
