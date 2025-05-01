import * as schema from '../shared/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Drizzle ORM
const db = drizzle(pool);

// Migrate the database
console.log('Starting database migration...');

async function main() {
  try {
    // Create all tables manually using SQL
    console.log('Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 0,
        verified BOOLEAN DEFAULT FALSE,
        verification_code TEXT,
        avatar TEXT,
        community_id INTEGER,
        state TEXT,
        city TEXT,
        location_verified BOOLEAN DEFAULT FALSE,
        preferences JSONB
      )
    `);

    console.log('Creating books table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        description TEXT,
        google_books_id TEXT,
        owner_id INTEGER NOT NULL,
        community_id INTEGER NOT NULL,
        borrowed BOOLEAN DEFAULT FALSE,
        borrower_id INTEGER,
        borrow_deadline TIMESTAMP,
        returned BOOLEAN DEFAULT FALSE,
        condition TEXT,
        genre TEXT NOT NULL,
        image_url TEXT,
        donated BOOLEAN DEFAULT FALSE,
        unlisted BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('Creating borrow_requests table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "borrowRequests" (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL,
        requester_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        requested_return_date TIMESTAMP
      )
    `);

    console.log('Creating chats table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        book_id INTEGER
      )
    `);

    console.log('Creating communities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        location TEXT NOT NULL,
        state TEXT,
        city TEXT,
        image_url TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL
      )
    `);

    console.log('Creating community_join_requests table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_join_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        community_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Creating community_chats table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_chats (
        id SERIAL PRIMARY KEY,
        community_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('Creating user_reports table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER NOT NULL,
        report_type TEXT NOT NULL,
        description TEXT NOT NULL,
        book_id INTEGER,
        chat_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);
    
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();