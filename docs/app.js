const list = document.getElementById('list');
const q = document.getElementById('q');
const severitySel = document.getElementById('severity');
const sourceSel = document.getElementById('source');
const newOnly = document.getElementById('newOnly');
const lastUpdated = document.getElementById('lastUpdated');
const themeToggle = document.getElementById('themeToggle');

const PAGE_SIZE = 30;
let data = [];
let filtered = [];
let page = 0;

function rel(dateStr) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderBatch() {
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  for (let i = start; i < end; i++) {
    const e = filtered[i];
    const card = document.createElement('article');
    card.className = `card sev-${(e.severity||'INFO').toLowerCase()}`;
    card.innerHTML = `
      <h3 class="title" title="${e.title}">${e.title}</h3>
      <div class="meta">
        <span class="source">${e.source||''}</span>
        <span class="time" title="${e.published}">${rel(e.published)}</span>
        <span class="cat">${e.category||e.threatType||''}</span>
        <span class="chip">${e.severity||'INFO'}</span>
      </div>
      <p class="summary">${e.summary||''}</p>
      <div class="actions">
        <a class="btn" href="${e.link}" target="_blank" rel="noopener">Read Advisory →</a>
        <button class="btn-link" data-link="${e.link}">Copy link</button>
      </div>`;
    list.appendChild(card);
  }
  page++;
}

function applyFilters() {
  const text = (q.value||'').toLowerCase();
  const sev = severitySel.value;
  const srcs = Array.from(sourceSel.selectedOptions).map(o=>o.value);
  const last = Number(localStorage.getItem('ti_last_visit')||0);
  filtered = data.filter(e => {
    if (sev && e.severity !== sev) return false;
    if (srcs.length && !srcs.includes(e.source)) return false;
    if (text) {
      const hay = `${e.title} ${e.summary}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    if (newOnly.checked && last) {
      const ts = Date.parse(e.published||'');
      if (isFinite(ts) && ts <= last) return false;
    }
    return true;
  });
  list.innerHTML = '';
  page = 0;
  renderBatch();
}

function populateSources() {
  const set = new Set(data.map(e=>e.source).filter(Boolean));
  [...set].sort().forEach(s => {
    const opt = document.createElement('option');
    opt.textContent = s;
    opt.value = s;
    sourceSel.appendChild(opt);
  });
}

function initObserver() {
  const sentinel = document.getElementById('sentinel');
  const io = new IntersectionObserver(entries => {
    if (entries.some(e=>e.isIntersecting)) {
      renderBatch();
    }
  });
  io.observe(sentinel);
}

async function boot() {
  lastUpdated.textContent = new Date().toISOString();
  try {
    const res = await fetch('./feed.json', { cache: 'no-store' });
    data = await res.json();
  } catch {
    data = [];
  }
  populateSources();
  applyFilters();
  initObserver();
}

q.addEventListener('input', applyFilters);
severitySel.addEventListener('change', applyFilters);
sourceSel.addEventListener('change', applyFilters);
newOnly.addEventListener('change', applyFilters);

themeToggle.addEventListener('click', () => {
  const cur = document.body.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  localStorage.setItem('ti_theme', next);
});

window.addEventListener('beforeunload', () => {
  localStorage.setItem('ti_last_visit', Date.now().toString());
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-link]');
  if (!btn) return;
  navigator.clipboard.writeText(btn.dataset.link).catch(()=>{});
});

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('ti_theme');
  if (savedTheme) document.body.dataset.theme = savedTheme;
  boot();
});


