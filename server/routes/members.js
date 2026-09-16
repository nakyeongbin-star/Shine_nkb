const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { query } = req.query;
  let sql = 'SELECT * FROM members WHERE 1=1';
  const params = [];
  if (query) {
    sql += ' AND (name LIKE ? OR phone LIKE ?)';
    const like = `%${query}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'not found' });

  const loans = db
    .prepare(
      `SELECT loans.*, books.title, books.author
       FROM loans JOIN books ON books.id = loans.book_id
       WHERE loans.member_id = ? ORDER BY loans.loan_date DESC`
    )
    .all(req.params.id);

  res.json({ ...member, loans });
});

router.post('/', (req, res) => {
  const { name, phone, memo } = req.body;
  if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });

  const result = db
    .prepare('INSERT INTO members (name, phone, memo) VALUES (?, ?, ?)')
    .run(name, phone || null, memo || null);
  res.status(201).json(db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const { name, phone, memo } = req.body;
  db.prepare('UPDATE members SET name = ?, phone = ?, memo = ? WHERE id = ?').run(
    name ?? existing.name,
    phone ?? existing.phone,
    memo ?? existing.memo,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const activeLoan = db
    .prepare("SELECT * FROM loans WHERE member_id = ? AND status = 'on_loan'")
    .get(req.params.id);
  if (activeLoan) return res.status(400).json({ error: '대출 중인 도서가 있는 회원은 삭제할 수 없습니다.' });

  const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

module.exports = router;
