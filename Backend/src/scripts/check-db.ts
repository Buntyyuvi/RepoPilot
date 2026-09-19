import { checkDatabaseConnection, closeDatabase } from "../config/database";

async function main(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log("PostgreSQL connection is healthy.");
  } catch (error) {
    console.error("PostgreSQL connection failed", error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main();
