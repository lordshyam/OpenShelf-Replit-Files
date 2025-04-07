import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Create a connection pool with improved settings
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Disable SSL for local development
  max: 10, // Reduced maximum number of clients in the pool
  idleTimeoutMillis: 60000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // Increased timeout
  query_timeout: 10000 // 10 seconds max query time
});

// Add event listeners for connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash the server on connection errors, just log them
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Test the connection with retry logic
async function testDatabaseConnection() {
  let client;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      client = await pool.connect();
      const res = await client.query('SELECT NOW()');
      console.log('Database connected successfully at:', res.rows[0].now);
      
      // Do a simple write test to ensure full database functionality
      await client.query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW())');
      await client.query('INSERT INTO connection_test (created_at) VALUES (NOW())');
      console.log('Database write test successful');
      
      return true;
    } catch (err) {
      attempts++;
      console.error(`Database connection error (attempt ${attempts}/${maxAttempts}):`, err);
      
      if (attempts < maxAttempts) {
        // Wait with exponential backoff before retrying
        const waitTime = Math.pow(2, attempts) * 1000;
        console.log(`Retrying database connection in ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('Maximum database connection attempts reached. Please check database configuration.');
        return false;
      }
    } finally {
      if (client) {
        try {
          client.release();
        } catch (e) {
          console.error('Error releasing client:', e);
        }
      }
    }
  }
  
  return false;
}

// Export async connection check function
export const checkDbConnection = testDatabaseConnection;

// Initial connection test
testDatabaseConnection();

// Utility function to safely execute database operations with retry logic
export async function executeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Database operation failed",
  maxRetries: number = 3
): Promise<T> {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Log the error with the attempt number
      console.error(`${errorMessage} (attempt ${attempt}/${maxRetries}):`, error);
      
      // If this is a connection-related error and not the last attempt, wait before retrying
      if (attempt < maxRetries && 
         (error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT' || 
          error.code === '57P01' ||  // admin_shutdown
          error.code === '57P02' ||  // crash_shutdown
          error.code === '57P03')) { // cannot_connect_now
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
      
      throw error;
    }
  }
  
  // This line should never be reached due to the throw in the catch block
  // but TypeScript needs it for type safety
  throw lastError;
}

// Export pool and db for use elsewhere
export default { pool, db, executeDbOperation };