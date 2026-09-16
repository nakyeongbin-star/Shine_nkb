const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'library.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn TEXT,
    title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    category TEXT,
    cover_url TEXT,
    memo TEXT,
    status TEXT NOT NULL DEFAULT 'available', -- available | on_loan
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    loan_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    due_date TEXT NOT NULL,
    return_date TEXT,
    status TEXT NOT NULL DEFAULT 'on_loan' -- on_loan | returned
  );

  CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
  CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
  CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
`);

module.exports = db;
