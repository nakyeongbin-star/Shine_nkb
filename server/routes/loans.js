const express = require('express');
const db = require('../db');

const router = express.Router();
const DEFAULT_LOAN_DAYS = 14;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

// GET /api/loans?status=on_loan|returned|overdue
router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT loans.*, books.title AS book_title, books.author AS book_author, members.name AS member_name
    FROM loans
    JOIN books ON books.id = loans.book_id
    JOIN members ON members.id = loans.member_id
    WHERE 1=1
  `;
  const params = [];

  if (status === 'overdue') {
    sql += " AND loans.status = 'on_loan' AND date(loans.due_date) < date('now', 'localtime')";
  } else if (status) {
    sql += ' AND loans.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY loans.loan_date DESC';

  res.json(db.prepare(sql).all(...params));
});

// 대출 처리
router.post('/', (req, res) => {
  const { book_id, member_id, loan_days } = req.body;
  if (!book_id || !member_id) {
    return res.status(400).json({ error: 'book_id, member_id는 필수입니다.' });
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: '도서를 찾을 수 없습니다.' });
  if (book.status === 'on_loan') return res.status(400).json({ error: '이미 대출 중인 도서입니다.' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
  if (!member) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });

  const dueDate = formatDate(addDays(new Date(), loan_days || DEFAULT_LOAN_DAYS));

  const txn = db.transaction(() => {
    const result = db
      .prepare('INSERT INTO loans (book_id, member_id, due_date) VALUES (?, ?, ?)')
      .run(book_id, member_id, dueDate);
    db.prepare("UPDATE books SET status = 'on_loan' WHERE id = ?").run(book_id);
    return result.lastInsertRowid;
  });

  const loanId = txn();
  res.status(201).json(db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId));
});

// 반납 처리
router.post('/:id/return', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: '대출 기록을 찾을 수 없습니다.' });
  if (loan.status === 'returned') return res.status(400).json({ error: '이미 반납된 도서입니다.' });

  const txn = db.transaction(() => {
    db.prepare("UPDATE loans SET status = 'returned', return_date = datetime('now', 'localtime') WHERE id = ?").run(
      req.params.id
    );
    db.prepare("UPDATE books SET status = 'available' WHERE id = ?").run(loan.book_id);
  });
  txn();

  res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id));
});

module.exports = router;
