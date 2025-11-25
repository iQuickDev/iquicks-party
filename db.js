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

      // Responses table
      db.run(`
        CREATE TABLE IF NOT EXISTS responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invite_id INTEGER NOT NULL,
          participating INTEGER NOT NULL,
          rosmarino INTEGER,
          eating INTEGER,
          alcohol INTEGER,
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
