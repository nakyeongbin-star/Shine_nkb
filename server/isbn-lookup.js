const ALADIN_TTB_KEY = process.env.ALADIN_TTB_KEY;

function normalizeIsbn(isbn) {
  return String(isbn).replace(/[^0-9Xx]/g, '');
}

async function lookupViaAladin(isbn) {
  const url = new URL('http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx');
  url.searchParams.set('ttbkey', ALADIN_TTB_KEY);
  url.searchParams.set('itemIdType', 'ISBN13');
  url.searchParams.set('ItemId', isbn);
  url.searchParams.set('output', 'js');
  url.searchParams.set('Version', '20131101');
  url.searchParams.set('Cover', 'Big');

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Aladin API error: ${resp.status}`);
  const data = await resp.json();
  const item = data.item && data.item[0];
  if (!item) return null;

  return {
    isbn,
    title: item.title,
    author: item.author,
    publisher: item.publisher,
    category: item.categoryName ? item.categoryName.split('>').pop().trim() : null,
    cover_url: item.cover,
  };
}

async function lookupViaOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open Library API error: ${resp.status}`);
  const data = await resp.json();
  const item = data[`ISBN:${isbn}`];
  if (!item) return null;

  return {
    isbn,
    title: item.title,
    author: (item.authors || []).map((a) => a.name).join(', ') || null,
    publisher: (item.publishers || []).map((p) => p.name).join(', ') || null,
    category: (item.subjects || [])[0]?.name || null,
    cover_url: item.cover ? item.cover.medium || item.cover.large : null,
  };
}

async function lookupIsbn(rawIsbn) {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  if (ALADIN_TTB_KEY) {
    const result = await lookupViaAladin(isbn);
    if (result) return result;
  }
  return lookupViaOpenLibrary(isbn);
}

module.exports = { lookupIsbn };
