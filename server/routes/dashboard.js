const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/stats', (_req, res) => {
  const totalBooks = db.prepare('SELECT COUNT(*) AS c FROM books').get().c;
  const onLoan = db.prepare("SELECT COUNT(*) AS c FROM books WHERE status = 'on_loan'").get().c;
  const totalMembers = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  const overdue = db
    .prepare("SELECT COUNT(*) AS c FROM loans WHERE status = 'on_loan' AND date(due_date) < date('now', 'localtime')")
    .get().c;

  res.json({
    totalBooks,
    available: totalBooks - onLoan,
    onLoan,
    totalMembers,
    overdue,
  });
});

module.exports = router;
