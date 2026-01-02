import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'party.db');

const db = new sqlite3.Database(dbPath);

// Initialize database tables
export const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Invites table
      db.run(`
        CREATE TABLE IF NOT EXISTS invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending'
        )
      `);

      // Configuration table
      db.run(`
        CREATE TABLE IF NOT EXISTS config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventName TEXT,
          eventTime TEXT,
          eventLocation TEXT,
          serviceFood INTEGER DEFAULT 1,
          serviceSleep INTEGER DEFAULT 1,
          serviceRosmarino INTEGER DEFAULT 1,
          serviceAlcohol INTEGER DEFAULT 1,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add service columns if they don't exist
      db.run(`ALTER TABLE config ADD COLUMN serviceFood INTEGER DEFAULT 1`, () => {});
      db.run(`ALTER TABLE config ADD COLUMN serviceSleep INTEGER DEFAULT 1`, () => {});
      db.run(`ALTER TABLE config ADD COLUMN serviceRosmarino INTEGER DEFAULT 1`, () => {});
      db.run(`ALTER TABLE config ADD COLUMN serviceAlcohol INTEGER DEFAULT 1`, () => {});

      // Add sleep column if it doesn't exist
      db.run(`ALTER TABLE responses ADD COLUMN sleep INTEGER DEFAULT 0`, (err) => {
        // Ignore error if column already exists
      });

      // Responses table
      db.run(`
        CREATE TABLE IF NOT EXISTS responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invite_id INTEGER NOT NULL,
          participating INTEGER NOT NULL,
          rosmarino INTEGER,
          eating INTEGER,
          alcohol INTEGER,
          sleep INTEGER,
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invite_id) REFERENCES invites(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export default db;
