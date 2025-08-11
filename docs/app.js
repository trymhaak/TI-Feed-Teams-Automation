const list = document.getElementById('list');
const q = document.getElementById('q');
const severitySel = document.getElementById('severity');
const sourceSel = document.getElementById('source');
const newOnly = document.getElementById('newOnly');
const lastUpdated = document.getElementById('lastUpdated');
const themeToggle = document.getElementById('themeToggle');
const counter = document.getElementById('counter');
const sortSel = document.getElementById('sort');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sourcesContainer = document.getElementById('sources');
const sevFilters = document.getElementById('sevFilters');
const dateWindowSel = document.getElementById('dateWindow');
const pager = document.getElementById('pager');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const backToTopBtn = document.getElementById('backToTop');
const refreshBtn = document.getElementById('refreshBtn');

const PAGE_SIZE = 30;
let data = [];
let filtered = [];
let page = 0;
let lastVisit = Number(localStorage.getItem('ti_last_visit')||0);

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
    const sev = (e.severity || 'INFO').toUpperCase();
    card.className = `card`;
    card.innerHTML = `
      <h3 class="title" title="${e.title}"><a href="${e.link}" target="_blank" rel="noopener">${e.title}</a></h3>
      <div class="meta">
        <span class="source">${e.source||''}</span>
        <span class="time" title="${e.published}">${rel(e.published)}</span>
        <span class="cat">${e.category||e.threatType||''}</span>
        <span class="chip-sev sev-${sev}">${sev}</span>
        ${isNew(e.published) ? '<span class="chip-sev" style="background:rgba(79,70,229,.15);color:#818cf8">NEW</span>' : ''}
      </div>
      <p class="summary" data-full="${escapeHtml(e.summary||'')}">${e.summary||''}</p>
      <div class="actions">
        <a class="btn" href="${e.link}" target="_blank" rel="noopener">Read Advisory →</a>
        <button class="btn-link" data-link="${e.link}">Copy link</button>
        <button class="btn-link" data-expand>Show more</button>
      </div>`;
    list.appendChild(card);
  }
  page++;
}

function applyFilters() {
  const text = (q.value||'').toLowerCase();
  const sevSet = new Set(Array.from(sevFilters.querySelectorAll('input:checked')).map(i=>i.value));
  const srcs = Array.from(sourcesContainer.querySelectorAll('input:checked')).map(i=>i.value);
  filtered = data.filter(e => {
    if (sevSet.size && !sevSet.has((e.severity||'').toUpperCase())) return false;
    if (srcs.length && !srcs.includes(e.source)) return false;
    if (text) {
      const hay = `${e.title} ${e.summary}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    if (newOnly.checked && lastVisit) {
      const ts = Date.parse(e.published||'');
      if (isFinite(ts) && ts <= lastVisit) return false;
    }
    return true;
  });
  // Sort
  if (sortSel.value === 'old') filtered.sort((a,b)=>new Date(a.published)-new Date(b.published));
  else if (sortSel.value === 'sev') filtered.sort((a,b)=>sevRank(b.severity)-sevRank(a.severity));
  else filtered.sort((a,b)=>new Date(b.published)-new Date(a.published));

  list.innerHTML = '';
  page = 0;
  renderBatch();
  counter.textContent = filtered.length ? `${filtered.length} item${filtered.length!==1?'s':''}` : '';
  updatePager();
}

function populateSources() {
  const set = new Set(data.map(e=>e.source).filter(Boolean));
  sourcesContainer.innerHTML = '';
  [...set].sort().forEach(s => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${s}"> ${s}`;
    sourcesContainer.appendChild(label);
  });
}

function initObserver() {
  const sentinel = document.getElementById('sentinel');
  if (!sentinel) return; // guard if sentinel is missing
  try {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e=>e.isIntersecting)) {
        renderBatch();
      }
    });
    io.observe(sentinel);
  } catch {}
}

async function boot() {
  lastUpdated.textContent = new Date().toISOString();
  try {
    const res = await fetch('./feed.json', { cache: 'no-store' });
    data = await res.json();
  } catch {
    data = [];
  }
  if (!data.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = 'No items available yet. The site updates automatically after the next run.';
    list.appendChild(empty);
  } else {
    populateSources();
    applyFilters();
  }
  initObserver();
}

q.addEventListener('input', applyFilters);
if (severitySel) severitySel.addEventListener('change', applyFilters);
if (sourceSel) sourceSel.addEventListener('change', applyFilters);
sevFilters.addEventListener('change', applyFilters);
sourcesContainer.addEventListener('change', applyFilters);
newOnly.addEventListener('change', applyFilters);
sortSel.addEventListener('change', applyFilters);
dateWindowSel.addEventListener('change', applyFilters);

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

document.addEventListener('click', (e) => {
  const exp = e.target.closest('[data-expand]');
  if (!exp) return;
  const card = exp.closest('.card');
  const p = card.querySelector('.summary');
  if (p.dataset.expanded === '1') { p.dataset.expanded = '0'; p.textContent = p.dataset.full.slice(0, 300); exp.textContent = 'Show more'; }
  else { p.dataset.expanded = '1'; p.textContent = p.dataset.full; exp.textContent = 'Show less'; }
});

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('ti_theme');
  if (savedTheme) document.body.dataset.theme = savedTheme;
  boot();
});

// Helpers
function sevRank(sev){
  const order = { CRITICAL:3, HIGH:2, MEDIUM:1, INFO:0 };
  return order[(sev||'').toUpperCase()] ?? -1;
}
function isNew(published){
  const ts = Date.parse(published||'');
  return lastVisit && isFinite(ts) && ts>lastVisit;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"]+/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

function updatePager(){
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(totalPages, page);
  prevPageBtn.disabled = curPage <= 1;
  nextPageBtn.disabled = page * PAGE_SIZE >= filtered.length;
  pageInfo.textContent = `${Math.min(curPage,totalPages)} / ${totalPages}`;
}

prevPageBtn.addEventListener('click', () => {
  if (page <= 1) return;
  page -= 2; // step back one page because renderBatch() increments
  list.innerHTML = '';
  renderBatch();
  updatePager();
  window.scrollTo({top:0,behavior:'smooth'});
});
nextPageBtn.addEventListener('click', () => {
  renderBatch();
  updatePager();
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});
backToTopBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
refreshBtn.addEventListener('click',()=>window.location.reload());


