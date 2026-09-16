const API = '/api';

// ---------- 유틸 ----------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function api(path, options = {}) {
  const resp = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!resp.ok) {
    let message = `요청 실패 (${resp.status})`;
    try {
      const data = await resp.json();
      if (data.error) message = data.error;
    } catch (_) {}
    throw new Error(message);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

function openModal(id) { $(`#${id}`).classList.add('open'); }
function closeModal(id) { $(`#${id}`).classList.remove('open'); }

$$('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
});

// ---------- 탭 전환 ----------
$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach((b) => b.classList.remove('active'));
    $$('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
    refreshTab(btn.dataset.tab);
  });
});

function refreshTab(tab) {
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'books') loadBooks();
  if (tab === 'loans') loadLoans();
  if (tab === 'members') loadMembers();
}

// ---------- 대시보드 ----------
async function loadDashboard() {
  try {
    const stats = await api('/dashboard/stats');
    $('#stat-grid').innerHTML = `
      <div class="stat-card"><div class="value">${stats.totalBooks}</div><div class="label">전체 도서</div></div>
      <div class="stat-card"><div class="value">${stats.available}</div><div class="label">대출 가능</div></div>
      <div class="stat-card"><div class="value">${stats.onLoan}</div><div class="label">대출 중</div></div>
      <div class="stat-card ${stats.overdue > 0 ? 'warn' : ''}"><div class="value">${stats.overdue}</div><div class="label">연체</div></div>
      <div class="stat-card"><div class="value">${stats.totalMembers}</div><div class="label">회원 수</div></div>
    `;
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------- 도서 ----------
async function loadCategories() {
  const categories = await api('/books/categories');
  const select = $('#book-category-filter');
  const current = select.value;
  select.innerHTML = '<option value="">전체 분류</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  select.value = current;
}

async function loadBooks() {
  const query = $('#book-search').value.trim();
  const category = $('#book-category-filter').value;
  const status = $('#book-status-filter').value;
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (category) params.set('category', category);
  if (status) params.set('status', status);

  try {
    const books = await api(`/books?${params.toString()}`);
    const tbody = $('#books-tbody');
    if (books.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">등록된 도서가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = books
      .map(
        (b) => `
      <tr>
        <td>${b.cover_url ? `<img class="cover-thumb" src="${b.cover_url}" alt="" />` : ''}</td>
        <td>${escapeHtml(b.title)}</td>
        <td>${escapeHtml(b.author || '')}</td>
        <td>${escapeHtml(b.publisher || '')}</td>
        <td>${escapeHtml(b.category || '')}</td>
        <td>${escapeHtml(b.isbn || '')}</td>
        <td><span class="badge ${b.status}">${b.status === 'available' ? '대출가능' : '대출중'}</span></td>
        <td>
          <button class="btn-link" data-edit-book="${b.id}">수정</button>
          <button class="btn-link danger" data-delete-book="${b.id}">삭제</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('#book-search').addEventListener('input', debounce(loadBooks, 300));
$('#book-category-filter').addEventListener('change', loadBooks);
$('#book-status-filter').addEventListener('change', loadBooks);

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

$('#open-add-book').addEventListener('click', () => {
  $('#book-modal-title').textContent = '도서 등록';
  $('#book-form').reset();
  $('#book-id').value = '';
  stopScanner();
  openModal('modal-book');
});

$('#books-tbody').addEventListener('click', async (e) => {
  const editId = e.target.dataset.editBook;
  const deleteId = e.target.dataset.deleteBook;
  if (editId) {
    const book = await api(`/books/${editId}`);
    $('#book-modal-title').textContent = '도서 수정';
    $('#book-id').value = book.id;
    $('#book-isbn').value = book.isbn || '';
    $('#book-title').value = book.title || '';
    $('#book-author').value = book.author || '';
    $('#book-publisher').value = book.publisher || '';
    $('#book-category').value = book.category || '';
    $('#book-cover').value = book.cover_url || '';
    $('#book-memo').value = book.memo || '';
    openModal('modal-book');
  }
  if (deleteId) {
    if (!confirm('이 도서를 삭제할까요?')) return;
    try {
      await api(`/books/${deleteId}`, { method: 'DELETE' });
      showToast('삭제되었습니다.');
      loadBooks();
      loadCategories();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

$('#book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#book-id').value;
  const payload = {
    isbn: $('#book-isbn').value.trim(),
    title: $('#book-title').value.trim(),
    author: $('#book-author').value.trim(),
    publisher: $('#book-publisher').value.trim(),
    category: $('#book-category').value.trim(),
    cover_url: $('#book-cover').value.trim(),
    memo: $('#book-memo').value.trim(),
  };
  try {
    if (id) {
      await api(`/books/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('수정되었습니다.');
    } else {
      await api('/books', { method: 'POST', body: JSON.stringify(payload) });
      showToast('등록되었습니다.');
    }
    closeModal('modal-book');
    stopScanner();
    loadBooks();
    loadCategories();
  } catch (err) {
    showToast(err.message, true);
  }
});

$('#btn-lookup-isbn').addEventListener('click', async () => {
  const isbn = $('#book-isbn').value.trim();
  if (!isbn) return showToast('ISBN을 입력해주세요.', true);
  try {
    const info = await api(`/books/lookup/${isbn}`);
    $('#book-title').value = info.title || '';
    $('#book-author').value = info.author || '';
    $('#book-publisher').value = info.publisher || '';
    $('#book-category').value = info.category || '';
    $('#book-cover').value = info.cover_url || '';
    showToast('도서 정보를 가져왔습니다.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- 바코드 스캔 ----------
let html5QrCode = null;

$('#btn-scan-barcode').addEventListener('click', async () => {
  $('#scanner-wrap').classList.remove('hidden');
  try {
    html5QrCode = new Html5Qrcode('scanner');
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 120 } },
      async (decodedText) => {
        $('#book-isbn').value = decodedText;
        await stopScanner();
        $('#btn-lookup-isbn').click();
      },
      () => {}
    );
  } catch (err) {
    showToast('카메라를 시작할 수 없습니다: ' + err.message, true);
  }
});

$('#btn-stop-scan').addEventListener('click', stopScanner);

async function stopScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (_) {}
    html5QrCode = null;
  }
  $('#scanner-wrap').classList.add('hidden');
}

// ---------- 회원 ----------
async function loadMembers() {
  const query = $('#member-search').value.trim();
  const params = new URLSearchParams();
  if (query) params.set('query', query);

  try {
    const members = await api(`/members?${params.toString()}`);
    const loans = await api('/loans?status=on_loan');
    const loanCountByMember = {};
    loans.forEach((l) => {
      loanCountByMember[l.member_id] = (loanCountByMember[l.member_id] || 0) + 1;
    });

    const tbody = $('#members-tbody');
    if (members.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">등록된 회원이 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = members
      .map(
        (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.phone || '')}</td>
        <td>${escapeHtml(m.memo || '')}</td>
        <td>${loanCountByMember[m.id] || 0}권</td>
        <td>
          <button class="btn-link" data-edit-member="${m.id}">수정</button>
          <button class="btn-link danger" data-delete-member="${m.id}">삭제</button>
        </td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

$('#member-search').addEventListener('input', debounce(loadMembers, 300));

$('#open-add-member').addEventListener('click', () => {
  $('#member-modal-title').textContent = '회원 등록';
  $('#member-form').reset();
  $('#member-id').value = '';
  openModal('modal-member');
});

$('#members-tbody').addEventListener('click', async (e) => {
  const editId = e.target.dataset.editMember;
  const deleteId = e.target.dataset.deleteMember;
  if (editId) {
    const member = await api(`/members/${editId}`);
    $('#member-modal-title').textContent = '회원 수정';
    $('#member-id').value = member.id;
    $('#member-name').value = member.name || '';
    $('#member-phone').value = member.phone || '';
    $('#member-memo').value = member.memo || '';
    openModal('modal-member');
  }
  if (deleteId) {
    if (!confirm('이 회원을 삭제할까요?')) return;
    try {
      await api(`/members/${deleteId}`, { method: 'DELETE' });
      showToast('삭제되었습니다.');
      loadMembers();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

$('#member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#member-id').value;
  const payload = {
    name: $('#member-name').value.trim(),
    phone: $('#member-phone').value.trim(),
    memo: $('#member-memo').value.trim(),
  };
  try {
    if (id) {
      await api(`/members/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('수정되었습니다.');
    } else {
      await api('/members', { method: 'POST', body: JSON.stringify(payload) });
      showToast('등록되었습니다.');
    }
    closeModal('modal-member');
    loadMembers();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- 대출/반납 ----------
async function loadLoans() {
  const status = $('#loan-status-filter').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  try {
    const loans = await api(`/loans?${params.toString()}`);
    const tbody = $('#loans-tbody');
    if (loans.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">대출 기록이 없습니다.</td></tr>';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    tbody.innerHTML = loans
      .map((l) => {
        const isOverdue = l.status === 'on_loan' && l.due_date < today;
        const badgeClass = l.status === 'returned' ? 'returned' : isOverdue ? 'overdue' : 'on_loan';
        const badgeText = l.status === 'returned' ? '반납완료' : isOverdue ? '연체' : '대출중';
        return `
      <tr>
        <td>${escapeHtml(l.book_title)}</td>
        <td>${escapeHtml(l.member_name)}</td>
        <td>${l.loan_date.slice(0, 10)}</td>
        <td>${l.due_date}</td>
        <td>${l.return_date ? l.return_date.slice(0, 10) : '-'}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>${l.status === 'on_loan' ? `<button class="btn-link" data-return="${l.id}">반납 처리</button>` : ''}</td>
      </tr>`;
      })
      .join('');
  } catch (err) {
    showToast(err.message, true);
  }
}

$('#loan-status-filter').addEventListener('change', loadLoans);

$('#loans-tbody').addEventListener('click', async (e) => {
  const returnId = e.target.dataset.return;
  if (!returnId) return;
  if (!confirm('반납 처리하시겠습니까?')) return;
  try {
    await api(`/loans/${returnId}/return`, { method: 'POST' });
    showToast('반납 처리되었습니다.');
    loadLoans();
  } catch (err) {
    showToast(err.message, true);
  }
});

$('#open-checkout').addEventListener('click', async () => {
  try {
    const [books, members] = await Promise.all([api('/books?status=available'), api('/members')]);
    $('#checkout-book').innerHTML = books.map((b) => `<option value="${b.id}">${escapeHtml(b.title)}${b.author ? ' - ' + escapeHtml(b.author) : ''}</option>`).join('');
    $('#checkout-member').innerHTML = members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
    if (books.length === 0) {
      showToast('대출 가능한 도서가 없습니다.', true);
      return;
    }
    if (members.length === 0) {
      showToast('등록된 회원이 없습니다. 먼저 회원을 등록해주세요.', true);
      return;
    }
    openModal('modal-checkout');
  } catch (err) {
    showToast(err.message, true);
  }
});

$('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    book_id: Number($('#checkout-book').value),
    member_id: Number($('#checkout-member').value),
    loan_days: Number($('#checkout-days').value) || 14,
  };
  try {
    await api('/loans', { method: 'POST', body: JSON.stringify(payload) });
    showToast('대출 처리되었습니다.');
    closeModal('modal-checkout');
    loadLoans();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ---------- 초기 로드 ----------
loadDashboard();
loadCategories();
