const express = require('express');
const db = require('../db');
const { lookupIsbn } = require('../isbn-lookup');

const router = express.Router();

// GET /api/books?query=&category=&status=
router.get('/', (req, res) => {
  const { query, category, status } = req.query;
  let sql = 'SELECT * FROM books WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    const like = `%${query}%`;
    params.push(like, like, like);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const books = db.prepare(sql).all(...params);
  res.json(books);
});

router.get('/categories', (_req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category")
    .all();
  res.json(rows.map((r) => r.category));
});

// ISBN 조회 (외부 API, DB에 저장하지 않고 정보만 반환)
router.get('/lookup/:isbn', async (req, res) => {
  try {
    const info = await lookupIsbn(req.params.isbn);
    if (!info) return res.status(404).json({ error: '도서 정보를 찾을 수 없습니다.' });
    res.json(info);
  } catch (err) {
    res.status(502).json({ error: '외부 도서 API 조회 실패', detail: err.message });
  }
});

router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'not found' });
  res.json(book);
});

router.post('/', (req, res) => {
  const { isbn, title, author, publisher, category, cover_url, memo } = req.body;
  if (!title) return res.status(400).json({ error: '제목은 필수입니다.' });

  const stmt = db.prepare(
    `INSERT INTO books (isbn, title, author, publisher, category, cover_url, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(isbn || null, title, author || null, publisher || null, category || null, cover_url || null, memo || null);
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(book);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { isbn, title, author, publisher, category, cover_url, memo } = req.body;
  db.prepare(
    `UPDATE books SET isbn = ?, title = ?, author = ?, publisher = ?, category = ?, cover_url = ?, memo = ?
     WHERE id = ?`
  ).run(
    isbn ?? existing.isbn,
    title ?? existing.title,
    author ?? existing.author,
    publisher ?? existing.publisher,
    category ?? existing.category,
    cover_url ?? existing.cover_url,
    memo ?? existing.memo,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const activeLoan = db
    .prepare("SELECT * FROM loans WHERE book_id = ? AND status = 'on_loan'")
    .get(req.params.id);
  if (activeLoan) return res.status(400).json({ error: '대출 중인 도서는 삭제할 수 없습니다.' });

  const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
