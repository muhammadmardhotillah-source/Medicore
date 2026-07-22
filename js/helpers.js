/**
 * helpers.js — Shared utility functions for MediCore SIMRS
 * Load this BEFORE index.js in HTML
 */

// ─── AUDIT TRAIL ───
function logActivity(action, entityType, entityName, detail) {
  try {
    var user = window.medicoreUser;
    if (!window.__sb) return;
    window.__sb.from('audit_logs').insert({
      user_name: user ? user.nama || user.username : 'System',
      action: action,
      entity_type: entityType,
      entity_name: entityName || '',
      detail: detail || '',
      created_at: new Date().toISOString()
    });
  } catch(e) {}
}

// ─── TOAST ───
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  var container = document.getElementById('toast-container');
  if (!container) return;
  var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' + message;
  toast.onclick = function() { dismissToast(toast); };
  container.appendChild(toast);
  setTimeout(function() { dismissToast(toast); }, duration);
}
function dismissToast(toast) {
  if (toast.classList.contains('toast-exit')) return;
  toast.classList.add('toast-exit');
  setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
}

// ─── FORMAT RUPIAH ───
function formatRupiah(angka) {
  if (angka === null || angka === undefined) return 'Rp 0';
  if (typeof angka === 'string') angka = parseFloat(angka.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (isNaN(angka)) angka = 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
function formatCurrency(angka) { return formatRupiah(angka); }

// ─── EXPORT CSV ───
function exportTableToCSV(tableId, filename) {
  var table = document.getElementById(tableId);
  if (!table) { showToast('Tabel tidak ditemukan', 'error'); return; }
  filename = filename || 'data-' + new Date().toISOString().slice(0,10) + '.csv';
  var rows = [];
  var headerRow = [];
  table.querySelectorAll('thead th').forEach(function(th) {
    var text = th.textContent.replace(/[▴▾]/g, '').trim();
    if (text !== 'Aksi' && text !== '') headerRow.push('"' + text + '"');
  });
  if (headerRow.length) rows.push(headerRow.join(','));
  table.querySelectorAll('tbody tr').forEach(function(tr) {
    var dataRow = [];
    var cells = tr.querySelectorAll('td');
    if (cells.length <= 1 && tr.querySelector('[colspan]')) return;
    cells.forEach(function(td, i) {
      if (i === cells.length - 1) return;
      dataRow.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
    });
    if (dataRow.length) rows.push(dataRow.join(','));
  });
  if (rows.length <= 1) { showToast('Tidak ada data untuk di-export', 'warning'); return; }
  var csv = '﻿' + rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  showToast('✅ Data di-export: ' + filename, 'success');
}

// ─── DARK MODE ───
function toggleDarkMode() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'light';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('medicore-theme', next);
  var btn = document.getElementById('dark-mode-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}
function initDarkMode() {
  var saved = localStorage.getItem('medicore-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.textContent = '☀️';
  }
}

// ─── MODAL ───
function showM(id) { var el = document.getElementById(id); if (el) el.classList.add('show'); }
function hideM(id) { var el = document.getElementById(id); if (el) el.classList.remove('show'); }

// ─── SKELETON ───
function showSkeleton(containerId, type) {
  var el = document.getElementById(containerId);
  if (!el) return;
  type = type || 'table';
  var skeletons = {
    'table': function() { var r = ''; for (var i=0;i<5;i++) r += '<div class="skeleton skeleton-table-row"></div>'; return r; },
    'card': function() { return '<div class="skeleton skeleton-card"></div>'; },
    'stat': function() { return '<div class="skeleton skeleton-stat"></div>'; },
    'text': function() { return '<div class="skeleton skeleton-text" style="width:80%"></div><div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-text-sm"></div>'; },
    'table-row': function() { return '<div class="skeleton skeleton-table-row"></div>'; }
  };
  el.innerHTML = '<div class="loading-skeleton">' + (skeletons[type] ? skeletons[type]() : skeletons['table']()) + '</div>';
}
function hideSkeleton(containerId) {
  var el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

// ─── ANIMATED COUNTER ───
function renderMiniChart(containerId, data, color) {
  var container = document.getElementById(containerId);
  if (!container) return;
  color = color || 'var(--primary-500)';
  var max = Math.max.apply(null, data, 1);
  var html = '<div class="chart-wrap">';
  var days = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  for (var i = 0; i < data.length; i++) {
    var h = Math.max(4, (data[i] / max) * 100);
    var op = 0.3 + (data[i]/max)*0.7;
    html += '<div class="chart-bar"><div class="chart-bar-inner" style="height:'+h+'px;background:'+color+';opacity:'+op+'"></div><div class="chart-bar-label">'+(days[i]||'')+'</div></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function animateCounter(el, target, prefix, suffix) {
  if (!el) return;
  if (typeof target === 'string' && target.includes('Rp')) { el.textContent = target; return; }
  if (prefix === 'Rp' || (el.id && (el.id.includes('income') || el.id.includes('total') || el.id.includes('omzet')))) {
    el.textContent = formatRupiah(parseInt(target) || 0); return;
  }
  var numTarget = parseInt(target) || 0;
  var step = Math.max(1, Math.floor(numTarget / 30));
  var current = 0;
  el.textContent = prefix + current + suffix;
  var timer = setInterval(function() {
    current += step;
    if (current >= numTarget) { current = numTarget; clearInterval(timer); }
    el.textContent = prefix + current.toLocaleString() + suffix;
  }, 30);
}

// ─── FORM VALIDATION ───
function validateField(id, rules) {
  var el = document.getElementById(id);
  if (!el) return true; rules = rules || {};
  var value = el.value.trim(); var errorEl = el.parentNode.querySelector('.field-error');
  el.classList.remove('is-error','is-success'); if (errorEl) errorEl.classList.remove('show');
  if (rules.required && !value) { el.classList.add('is-error'); if(errorEl){errorEl.textContent=rules.message||'Wajib diisi';errorEl.classList.add('show');} return false; }
  if (rules.minLength && value.length < rules.minLength) { el.classList.add('is-error'); if(errorEl){errorEl.textContent='Minimal '+rules.minLength+' karakter';errorEl.classList.add('show');} return false; }
  if (rules.pattern && value && !rules.pattern.test(value)) { el.classList.add('is-error'); if(errorEl){errorEl.textContent=rules.message||'Format tidak valid';errorEl.classList.add('show');} return false; }
  if (rules.validate && !rules.validate(value)) { el.classList.add('is-error'); if(errorEl){errorEl.textContent=rules.message||'Tidak valid';errorEl.classList.add('show');} return false; }
  if (value && rules.showSuccess) el.classList.add('is-success');
  return true;
}
function validateForm(rules) { var v = true; for (var id in rules) { if (!validateField(id, rules[id])) v = false; } return v; }

// ─── SORT TABLE ───
window.__tableSort = window.__tableSort || {};
function sortTable(tableId, colIndex) {
  var table = document.getElementById(tableId); if (!table) return;
  var tbody = table.querySelector('tbody'); if (!tbody) return;
  var state = window.__tableSort[tableId] || {};
  var isAsc = state.col === colIndex ? !state.asc : true;
  window.__tableSort[tableId] = { col: colIndex, asc: isAsc };
  table.querySelectorAll('th').forEach(function(th, i) {
    var t = th.textContent.replace(/[▴▾]/g,'').trim();
    th.textContent = i === colIndex ? t + ' ' + (isAsc ? '▴' : '▾') : t;
    if (i === colIndex) th.setAttribute('data-sort', isAsc ? 'asc' : 'desc');
    else th.removeAttribute('data-sort');
  });
  var rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort(function(a,b) {
    var aV = a.cells[colIndex]?.textContent.trim()||'', bV = b.cells[colIndex]?.textContent.trim()||'';
    var aN = parseFloat(aV.replace(/[Rp. ,]/g,'')); var bN = parseFloat(bV.replace(/[Rp. ,]/g,''));
    if (!isNaN(aN) && !isNaN(bN)) return isAsc ? aN - bN : bN - aN;
    return isAsc ? aV.localeCompare(bV,'id') : bV.localeCompare(aV,'id');
  });
  rows.forEach(function(r) { tbody.appendChild(r); });
}

// ─── AUTOCOMPLETE ───
function createAutocomplete(inputEl, opts) {
  if (!inputEl) return null;
  opts = opts || {};
  var onSearch = opts.onSearch || function(t,cb){cb([]);};
  var onSelect = opts.onSelect || function(){};
  var renderItem = opts.renderItem || function(item) { return '<div class="sd-main"><div class="sd-title">'+(item.label||item)+'</div></div>'; };
  var minChars = opts.minChars || 2;
  var debounceMs = opts.debounceMs || 300;
  var dd = document.createElement('div'); dd.className = 'search-dropdown';
  inputEl.parentNode.style.position = 'relative'; inputEl.parentNode.appendChild(dd);
  var selectedIndex = -1, currentData = [], debounceTimer = null;
  function hide() { dd.classList.remove('show'); dd.innerHTML = ''; selectedIndex = -1; }
  function show(data) {
    currentData = data;
    if (!data||!data.length) { dd.innerHTML='<div class="search-dropdown-empty">Tidak ditemukan</div>'; dd.classList.add('show'); return; }
    dd.innerHTML = data.map(function(item,i) {
      return '<div class="search-dropdown-item" data-index="'+i+'"><span class="sd-icon">'+(item.icon||'🔍')+'</span>'+renderItem(item)+(item.sub?'<span class="sd-right">'+item.sub+'</span>':'')+'</div>';
    }).join('');
    selectedIndex = -1; dd.classList.add('show');
  }
  function search(term) {
    if (term.length < minChars) { hide(); return; }
    onSearch(term, function(r) { show(r); });
  }
  inputEl.addEventListener('input', function() {
    var v = inputEl.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { search(v); }, debounceMs);
  });
  inputEl.addEventListener('focus', function() {
    var v = inputEl.value.trim();
    if (v.length >= minChars) search(v);
  });
  inputEl.addEventListener('keydown', function(e) {
    var items = dd.querySelectorAll('.search-dropdown-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); items.forEach(function(el,i){el.classList.toggle('highlighted',i===selectedIndex);}); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); items.forEach(function(el,i){el.classList.toggle('highlighted',i===selectedIndex);}); }
    else if (e.key === 'Enter' && selectedIndex >= 0 && currentData[selectedIndex]) { e.preventDefault(); onSelect(currentData[selectedIndex]); hide(); }
    else if (e.key === 'Escape') { hide(); }
  });
  dd.addEventListener('click', function(e) {
    var itemEl = e.target.closest('.search-dropdown-item'); if (!itemEl) return;
    var idx = parseInt(itemEl.getAttribute('data-index')); if (currentData[idx]) { onSelect(currentData[idx]); hide(); }
  });
  document.addEventListener('click', function(e) { if (!inputEl.parentNode.contains(e.target)) hide(); });
  return { hide: hide };
}

// ─── TABLE SORT DELEGATED ───
document.addEventListener('click', function(e) {
  var th = e.target.closest('.t th:not([colspan])');
  if (!th) return;
  var table = th.closest('.t'); if (!table) return;
  var colIndex = Array.from(th.parentNode.children).indexOf(th);
  if (colIndex === table.querySelectorAll('th').length - 1) return;
  sortTable(table.id || 'table-' + Math.random(), colIndex);
});

// ─── AUTO-CLEAR ERROR ───
document.addEventListener('input', function(e) {
  var target = e.target;
  if (target.classList.contains('is-error')) {
    target.classList.remove('is-error');
    var err = target.parentNode.querySelector('.field-error');
    if (err) err.classList.remove('show');
  }
});

// ─── LAPORAN SIRS ───
async function exportSIRS() {
  var now = new Date();
  var bulan = now.getMonth() + 1;
  var tahun = now.getFullYear();
  var tglAwal = tahun + '-' + String(bulan).padStart(2,'0') + '-01';
  var tglAkhir = tahun + '-' + String(bulan).padStart(2,'0') + '-' + new Date(tahun, bulan, 0).getDate();
  showToast('Mengenerate laporan SIRS...', 'info');
  var { data: regs } = await window.__sb.from('registrations').select('*, patients(nama, jk, tgl_lahir)').gte('created_at', tglAwal).lte('created_at', tglAkhir + 'T23:59:59Z');
  var daftarReg = regs || [];
  var totalK = daftarReg.length;
  var rj = daftarReg.filter(function(r){return r.poli_id && r.status!=='Opname';}).length;
  var ri = daftarReg.filter(function(r){return r.status==='Opname';}).length;
  var ugd = daftarReg.filter(function(r){return !r.poli_id && r.status!=='Opname' && r.status!=='Selesai';}).length;
  var bpjs = daftarReg.filter(function(r){return r.penjamin==='BPJS';}).length;
  var umum = daftarReg.filter(function(r){return r.penjamin==='Umum';}).length;
  var laki = daftarReg.filter(function(r){return r.patients && r.patients.jk==='L';}).length;
  var perem = daftarReg.filter(function(r){return r.patients && r.patients.jk==='P';}).length;
  var csv = '﻿"LAPORAN SIRS BULANAN"\r\n"Rumah Sakit: Edoy Hospital Management"\r\n"Periode: ' + bulan + '/' + tahun + '"\r\n\r\n"A. DATA KUNJUNGAN"\r\n"Indikator","Jumlah"\r\n"Total Kunjungan",' + totalK + '\r\n"Rawat Jalan",' + rj + '\r\n"Rawat Inap",' + ri + '\r\n"UGD",' + ugd + '\r\n"BPJS",' + bpjs + '\r\n"Umum",' + umum + '\r\n"Laki-laki",' + laki + '\r\n"Perempuan",' + perem + '\r\n\r\n"C. INFO RS"\r\n"Nama RS","Edoy Hospital Management"\r\n"Kode RS BPJS","0401R001"\r\n"Periode Laporan","' + bulan + '/' + tahun + '"\r\n"Tanggal Generate","' + new Date().toLocaleDateString('id-ID') + '"';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'SIRS-' + tahun + '-' + String(bulan).padStart(2,'0') + '.csv';
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
  logActivity('Export SIRS','Laporan','SIRS-'+tahun+'-'+bulan,'Export laporan bulanan SIRS');
  showToast('✅ Laporan SIRS ' + bulan + '/' + tahun + ' di-export', 'success');
}

// ─── TRANSACTION HELPER ───
var __tx_pending = [];
function txBegin() { __tx_pending = []; return true; }
function txAdd(table, op, data, idField) {
  __tx_pending.push({ table: table, op: op, data: JSON.parse(JSON.stringify(data)), idField: idField || 'id', _rb: null });
}
async function txCommit() {
  var errors = [], executed = [];
  for (var i = 0; i < __tx_pending.length; i++) {
    var s = __tx_pending[i];
    try {
      if (s.op === 'insert') { var r = await window.__sb.from(s.table).insert(s.data); if (r.error) errors.push(s.table+': '+r.error.message); else executed.push(s); }
      else if (s.op === 'update') { var snap = await window.__sb.from(s.table).select('*').eq(s.idField, s.data[s.idField]).single(); s._rb = snap.data; var r2 = await window.__sb.from(s.table).update(s.data).eq(s.idField, s.data[s.idField]); if (r2.error) errors.push(s.table+': '+r2.error.message); else executed.push(s); }
    } catch(e) { errors.push(s.table+': '+e.message); }
  }
  if (errors.length > 0) {
    for (var j = executed.length-1; j >= 0; j--) { var rs = executed[j]; try { if (rs.op === 'insert') window.__sb.from(rs.table).delete().eq(rs.idField, rs.data[rs.idField]); else if (rs.op === 'update' && rs._rb) window.__sb.from(rs.table).update(rs._rb).eq(rs.idField, rs._rb[rs.idField]); } catch(e) {} }
    __tx_pending = []; return { success: false, errors: errors };
  }
  __tx_pending = []; return { success: true };
}
function txRollback() { __tx_pending = []; }

// ─── PAGINATION ───
function renderPagination(total, page, perPage, containerId, callback) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var tp = Math.ceil(total / perPage);
  if (tp <= 1) { el.innerHTML = ''; return; }
  var h = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;flex-wrap:wrap">';
  h += '<button class="btn btn-o btn-xs" onclick="'+callback+'('+(page-1)+')" '+(page<=1?'disabled':'')+'>Prev</button>';
  var s = Math.max(1,page-2), e = Math.min(tp,page+2);
  if (s>1) { h += '<button class="btn btn-o btn-xs" onclick="'+callback+'(1)">1</button>'; if (s>2) h += '<span style="color:var(--text-muted)">...</span>'; }
  for (var i=s; i<=e; i++) h += '<button class="btn '+(i===page?'btn-p':'btn-o')+' btn-xs" onclick="'+callback+'('+i+')">'+i+'</button>';
  if (e<tp) { if (e<tp-1) h += '<span style="color:var(--text-muted)">...</span>'; h += '<button class="btn btn-o btn-xs" onclick="'+callback+'('+tp+')">'+tp+'</button>'; }
  h += '<button class="btn btn-o btn-xs" onclick="'+callback+'('+(page+1)+')" '+(page>=tp?'disabled':'')+'>Next</button>';
  h += '<span style="font-size:11px;color:var(--text-muted);margin-left:8px">'+page+'/'+tp+'</span></div>';
  el.innerHTML = h;
}
