require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const booksRouter = require('./routes/books');
const membersRouter = require('./routes/members');
const loansRouter = require('./routes/loans');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/books', booksRouter);
app.use('/api/members', membersRouter);
app.use('/api/loans', loansRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`도서관리시스템이 http://localhost:${PORT} 에서 실행 중입니다.`);
});
