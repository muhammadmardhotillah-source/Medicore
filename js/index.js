/**
 * index.js
 * Main Dashboard Logic for MediCore SIMRS
 */

// ─── TRANSACTION HELPER (manual rollback) ───
var __tx_pending = [];

function txBegin() { __tx_pending = []; return true; }

function txAdd(table, op, data, idField) {
  __tx_pending.push({
    table: table, op: op,
    data: JSON.parse(JSON.stringify(data)),
    idField: idField || 'id',
    _rb: null
  });
}

async function txCommit() {
  var errors = [], executed = [];
  for (var i = 0; i < __tx_pending.length; i++) {
    var s = __tx_pending[i];
    try {
      if (s.op === 'insert') {
        var r = await window.__sb.from(s.table).insert(s.data);
        if (r.error) errors.push(s.table + ': ' + r.error.message); else executed.push(s);
      } else if (s.op === 'update') {
        var snap = await window.__sb.from(s.table).select('*').eq(s.idField, s.data[s.idField]).single();
        s._rb = snap.data;
        var r2 = await window.__sb.from(s.table).update(s.data).eq(s.idField, s.data[s.idField]);
        if (r2.error) errors.push(s.table + ': ' + r2.error.message); else executed.push(s);
      }
    } catch(e) { errors.push(s.table + ': ' + e.message); }
  }
  if (errors.length > 0) {
    for (var j = executed.length - 1; j >= 0; j--) {
      var rs = executed[j];
      try {
        if (rs.op === 'insert') window.__sb.from(rs.table).delete().eq(rs.idField, rs.data[rs.idField]);
        else if (rs.op === 'update' && rs._rb) window.__sb.from(rs.table).update(rs._rb).eq(rs.idField, rs._rb[rs.idField]);
      } catch(e) { console.error('Rollback fail', rs.table, e); }
    }
    __tx_pending = [];
    return { success: false, errors: errors };
  }
  __tx_pending = [];
  return { success: true };
}

function txRollback() { __tx_pending = []; }

// ─── GLOBAL TOAST SYSTEM ───
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' + message;
  toast.onclick = function() {
    dismissToast(toast);
  };
  container.appendChild(toast);

  setTimeout(function() {
    dismissToast(toast);
  }, duration);
}

function dismissToast(toast) {
  if (toast.classList.contains('toast-exit')) return;
  toast.classList.add('toast-exit');
  setTimeout(function() {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

// ─── REUSABLE AUTOCOMPLETE ───
// createAutocomplete(inputEl, options)
// options: { onSearch(term, cb), onSelect(item), renderItem(item), minChars(2), debounceMs(300) }
function createAutocomplete(inputEl, opts) {
  if (!inputEl) return null;
  opts = opts || {};
  var onSearch = opts.onSearch || function(t, cb) { cb([]); };
  var onSelect = opts.onSelect || function() {};
  var renderItem = opts.renderItem || function(item) {
    return '<div class="sd-main"><div class="sd-title">' + (item.label || item) + '</div></div>';
  };
  var minChars = opts.minChars || 2;
  var debounceMs = opts.debounceMs || 300;

  // Create dropdown
  var dd = document.createElement('div');
  dd.className = 'search-dropdown';
  inputEl.parentNode.style.position = 'relative';
  inputEl.parentNode.appendChild(dd);

  var selectedIndex = -1;
  var currentData = [];
  var debounceTimer = null;

  function hideDropdown() {
    dd.classList.remove('show');
    dd.innerHTML = '';
    selectedIndex = -1;
  }

  function showDropdown(data) {
    currentData = data;
    if (!data || data.length === 0) {
      dd.innerHTML = '<div class="search-dropdown-empty">Tidak ditemukan</div>';
      dd.classList.add('show');
      return;
    }
    dd.innerHTML = data.map(function(item, i) {
      return '<div class="search-dropdown-item" data-index="' + i + '">' +
        '<span class="sd-icon">' + (item.icon || '🔍') + '</span>' +
        renderItem(item) +
        (item.sub ? '<span class="sd-right">' + item.sub + '</span>' : '') +
        '</div>';
    }).join('');
    selectedIndex = -1;
    dd.classList.add('show');
  }

  function doSearch(term) {
    if (term.length < minChars) {
      hideDropdown();
      return;
    }
    onSearch(term, function(results) {
      showDropdown(results);
    });
  }

  // Input events
  inputEl.addEventListener('input', function() {
    var val = inputEl.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() { doSearch(val); }, debounceMs);
  });

  inputEl.addEventListener('focus', function() {
    var val = inputEl.value.trim();
    if (val.length >= minChars) doSearch(val);
  });

  inputEl.addEventListener('keydown', function(e) {
    var items = dd.querySelectorAll('.search-dropdown-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      items.forEach(function(el, i) { el.classList.toggle('highlighted', i === selectedIndex); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      items.forEach(function(el, i) { el.classList.toggle('highlighted', i === selectedIndex); });
    } else if (e.key === 'Enter' && selectedIndex >= 0 && currentData[selectedIndex]) {
      e.preventDefault();
      onSelect(currentData[selectedIndex]);
      hideDropdown();
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  // Click on dropdown items
  dd.addEventListener('click', function(e) {
    var itemEl = e.target.closest('.search-dropdown-item');
    if (!itemEl) return;
    var idx = parseInt(itemEl.getAttribute('data-index'));
    if (currentData[idx]) {
      onSelect(currentData[idx]);
      hideDropdown();
    }
  });

  // Click outside
  document.addEventListener('click', function(e) {
    if (!inputEl.parentNode.contains(e.target)) {
      hideDropdown();
    }
  });

  return { hide: hideDropdown, refresh: function() { doSearch(inputEl.value.trim()); } };
}

// ─── FORM VALIDATION HELPERS ───
function validateField(id, rules) {
  var el = document.getElementById(id);
  if (!el) return true;
  rules = rules || {};
  var value = el.value.trim();
  var errorEl = el.parentNode.querySelector('.field-error');

  // Remove existing error
  el.classList.remove('is-error', 'is-success');
  if (errorEl) errorEl.classList.remove('show');

  // Required
  if (rules.required && !value) {
    el.classList.add('is-error');
    if (errorEl) { errorEl.textContent = rules.message || 'Wajib diisi'; errorEl.classList.add('show'); }
    return false;
  }

  // Min length
  if (rules.minLength && value.length < rules.minLength) {
    el.classList.add('is-error');
    if (errorEl) { errorEl.textContent = 'Minimal ' + rules.minLength + ' karakter'; errorEl.classList.add('show'); }
    return false;
  }

  // Pattern
  if (rules.pattern && value && !rules.pattern.test(value)) {
    el.classList.add('is-error');
    if (errorEl) { errorEl.textContent = rules.message || 'Format tidak valid'; errorEl.classList.add('show'); }
    return false;
  }

  // Custom
  if (rules.validate && !rules.validate(value)) {
    el.classList.add('is-error');
    if (errorEl) { errorEl.textContent = rules.message || 'Tidak valid'; errorEl.classList.add('show'); }
    return false;
  }

  // Success state
  if (value && rules.showSuccess) el.classList.add('is-success');
  return true;
}

function validateForm(rules) {
  // rules = { fieldId: ruleObj, ... }
  var valid = true;
  for (var id in rules) {
    if (!validateField(id, rules[id])) valid = false;
  }
  return valid;
}

// Auto-clear error on input
document.addEventListener('input', function(e) {
  var target = e.target;
  if (target.classList.contains('is-error')) {
    target.classList.remove('is-error');
    var err = target.parentNode.querySelector('.field-error');
    if (err) err.classList.remove('show');
  }
});
function showSkeleton(containerId, type) {
  var el = document.getElementById(containerId);
  if (!el) return;
  type = type || 'table';
  var skeletons = {
    'table': function() {
      var rows = '';
      for (var i = 0; i < 5; i++) {
        rows += '<div class="skeleton skeleton-table-row"></div>';
      }
      return rows;
    },
    'card': function() {
      return '<div class="skeleton skeleton-card"></div>';
    },
    'stat': function() {
      return '<div class="skeleton skeleton-stat"></div>';
    },
    'text': function() {
      return '<div class="skeleton skeleton-text" style="width:80%"></div>' +
             '<div class="skeleton skeleton-text" style="width:60%"></div>' +
             '<div class="skeleton skeleton-text-sm"></div>';
    },
    'table-row': function() {
      return '<div class="skeleton skeleton-table-row"></div>';
    }
  };
  el.innerHTML = '<div class="loading-skeleton">' + (skeletons[type] ? skeletons[type]() : skeletons['table']()) + '</div>';
  el.style.display = '';
}

function hideSkeleton(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
}
// ─── UNIVERSAL TABLE SORT ───
window.__tableSort = window.__tableSort || {};
function sortTable(tableId, colIndex) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var tbody = table.querySelector('tbody');
  if (!tbody) return;

  var state = window.__tableSort[tableId] || {};
  var isAsc = state.col === colIndex ? !state.asc : true;
  window.__tableSort[tableId] = { col: colIndex, asc: isAsc };

  table.querySelectorAll('th').forEach(function(th, i) {
    var text = th.textContent.replace(/[▴▾]/g, '').trim();
    th.textContent = i === colIndex ? text + ' ' + (isAsc ? '▴' : '▾') : text;
    if (i === colIndex) th.setAttribute('data-sort', isAsc ? 'asc' : 'desc');
    else th.removeAttribute('data-sort');
  });

  var rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort(function(a, b) {
    var aV = (a.cells[colIndex] ? a.cells[colIndex].textContent.trim() : '');
    var bV = (b.cells[colIndex] ? b.cells[colIndex].textContent.trim() : '');
    var aN = parseFloat(aV.replace(/[Rp. ,]/g, ''));
    var bN = parseFloat(bV.replace(/[Rp. ,]/g, ''));
    if (!isNaN(aN) && !isNaN(bN)) return isAsc ? aN - bN : bN - aN;
    return isAsc ? aV.localeCompare(bV, 'id') : bV.localeCompare(aV, 'id');
  });
  rows.forEach(function(row) { tbody.appendChild(row); });
}

// Delegated sort: click any <th> in a .t table to sort
document.addEventListener('click', function(e) {
  var th = e.target.closest('.t th:not([colspan])');
  if (!th) return;
  var table = th.closest('.t');
  if (!table) return;
  var colIndex = Array.from(th.parentNode.children).indexOf(th);
  var lastCol = table.querySelectorAll('th').length - 1;
  if (colIndex === lastCol) return;
  sortTable(table.id || 'table-' + Math.random(), colIndex);
});

function initAutocompletes() {
  // Patient search (pendaftaran)
  var regInput = document.getElementById('reg-name');
  if (regInput) {
    createAutocomplete(regInput, {
      minChars: 2,
      onSearch: function(term, cb) {
        window.__sb.from('patients').select('id, no_rm, nama, no_hp').ilike('nama', '%' + term + '%').limit(8).then(function(res) {
          cb((res.data || []).map(function(p) {
            return { id: p.id, label: p.nama, sub: p.no_rm, icon: '👤', rm: p.no_rm };
          }));
          })['catch'](function() { cb([]); });
      },
      onSelect: function(item) {
        var resultDiv = document.getElementById('search-result');
        if (resultDiv) {
          resultDiv.style.display = 'block';
          document.getElementById('res-name').textContent = item.label;
          document.getElementById('res-rm').textContent = item.rm || item.sub;
        }
        window._regPatientId = item.id;
        window._regPatientRM = item.rm || item.sub;
      }
    });
  }

  // Drug search (stok / farmasi)
  var stokSearch = document.getElementById('stok-search');
  if (stokSearch) {
    // Already handled by filterStok(), just wrap the search-input-wrap
  }

  // Drug autocomplete for prescription (rx-search)
  var rxSearch = document.getElementById('rx-search');
  if (rxSearch) {
    createAutocomplete(rxSearch, {
      minChars: 2,
      onSearch: function(term, cb) {
        window.__sb.from('medicines').select('id, nama_obat, kode, stok, harga_satuan, satuan').ilike('nama_obat', '%' + term + '%').limit(8).then(function(res) {
          cb((res.data || []).map(function(m) {
            return {
              id: m.id,
              label: m.nama_obat,
              sub: 'Stok: ' + (m.stok || 0) + ' ' + (m.satuan || ''),
              icon: '💊',
              stok: m.stok || 0,
              harga: m.harga_satuan || 0
            };
          }));
        })['catch'](function() { cb([]); });
      },
      onSelect: function(item) {
        tambahObat(item.label);
        rxSearch.value = '';
        rxSearch.focus();
      }
    });
  }

  // Drug autocomplete for penerimaan stok
  var psSearch = document.getElementById('ps-search-input');
  if (psSearch) {
    createAutocomplete(psSearch, {
      minChars: 2,
      onSearch: function(term, cb) {
        window.__sb.from('medicines').select('id, nama_obat, kode, stok').ilike('nama_obat', '%' + term + '%').limit(8).then(function(res) {
          cb((res.data || []).map(function(m) {
            return { id: m.id, label: m.nama_obat, sub: m.kode, icon: '💊' };
          }));
        })['catch'](function() { cb([]); });
      },
      onSelect: function(item) {
        pilihObatPenerimaan(item);
      }
    });
  }

  // ICD-10 autocomplete for EMR
  var icdInputs = ['emr-dx1', 'emr-dx2'];
  icdInputs.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    createAutocomplete(el, {
      minChars: 1,
      onSearch: function(term, cb) {
        var q = term.toLowerCase();
        // Use hardcoded ICD list from emr.js + query supabase
        var icdList = [
          { code: 'I10', name: 'Essential hypertension' },
          { code: 'I11', name: 'Hypertensive heart disease' },
          { code: 'I50', name: 'Heart failure' },
          { code: 'I48', name: 'Atrial fibrillation and flutter' },
          { code: 'I25', name: 'Chronic ischaemic heart disease' },
          { code: 'E11', name: 'Type 2 diabetes mellitus' },
          { code: 'E78', name: 'Disorders of lipoprotein metabolism' },
          { code: 'J45', name: 'Asthma' },
          { code: 'J15', name: 'Bacterial pneumonia' },
          { code: 'N39', name: 'Urinary tract infection' },
          { code: 'K29', name: 'Gastritis and duodenitis' },
          { code: 'M54', name: 'Dorsalgia (back pain)' },
          { code: 'R51', name: 'Headache' },
          { code: 'R10', name: 'Abdominal and pelvic pain' },
          { code: 'A09', name: 'Infectious gastroenteritis' },
        ];
        var matched = icdList.filter(function(i) {
          return i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
        });
        cb(matched.map(function(i) {
          return { label: i.code + ' — ' + i.name, sub: i.code, icon: '📖' };
        }));
      },
      onSelect: function(item) {
        el.value = item.label;
      }
    });
  });
}

// ─── MOBILE MENU TOGGLE ───
function toggleMobileMenu() {
  var sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('show');
  }
}

// ─── USER CHIP CLICK (delegated, not inline) ───
document.addEventListener('click', function(e) {
  var chip = e.target.closest('#user-chip');
  if (chip) toggleUserMenu();
});
document.addEventListener('click', function(e) { if (e.target.closest('#mobile-menu-btn')) toggleMobileMenu(); });
document.addEventListener('submit', function(e) { if (e.target.id === 'login-form') { e.preventDefault(); doLogin(); } });
document.addEventListener('keydown', function(e) { if (e.key === 'Enter' && (document.activeElement === document.getElementById('login-user') || document.activeElement === document.getElementById('login-pass'))) doLogin(); });


// ─── KEYBOARD: Close modal on Escape + click outside ───
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close any open modal
    document.querySelectorAll('.ov.show').forEach(function(m) {
      m.classList.remove('show');
    });
    // Close sidebar on mobile
    var sidebar = document.querySelector('.sidebar.show');
    if (sidebar) sidebar.classList.remove('show');
    // Close user menu
    var userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.style.display = 'none';
  }
});

// Click outside modal to close
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('ov')) {
    e.target.classList.remove('show');
  }
});

const titles = {
    dashboard: 'Dashboard',
    booking: '📅 Booking Pasien',
    ambilantrian: '🎫 Ambil Antrian',
    antrian: 'Ambil Antrian',
    pendaftaran: '📋 Registrasi Pasien',
    rawatjalan: '🏃 Poli / Rawat Jalan',
    rawatinap: 'Rawat Inap',
    ugd: 'Unit Gawat Darurat',
    rekammedis: 'Rekam Medis',
    laboratorium: 'Laboratorium',
    radiologi: 'Radiologi',
    farmasi: '💊 Farmasi',
    operasi: 'Kamar Operasi',
    kasir: '💳 Kasir & Pembayaran',
    tagihan: 'Tagihan',
    laporan: 'Laporan Keuangan',
    sdm: 'SDM & Dokter',
    pengaturan: 'Pengaturan',
    masterdata: '📋 Master Data',
    stok: '📦 Stok & Inventory',
    pembelian: '📥 Pembelian',
    'kas-bank': '💰 Kas & Bank',
    'penggunaan-obat': '💊 Penggunaan Obat',
    'permintaan-medis': '📋 Permintaan Medis',
    'penjualan': '🧾 Penjualan',
    'logistik': '📦 Logistik',
    'akuntansi': '📒 Akuntansi',
    'security': '🔒 Security',
    'fixed-asset': '🏛️ Fixed Asset',
    'audit-trail': '📋 Audit Trail'
};

const ROLE_MENUS = {
  'Administrator': ['dashboard','booking','ambilantrian','pendaftaran','rawatjalan','rawatinap','ugd','rekammedis','laboratorium','radiologi','farmasi','operasi','kasir','tagihan','laporan','sdm','masterdata','pengaturan','stok','pembelian','kas-bank','penggunaan-obat','permintaan-medis','penjualan','logistik','akuntansi','security','fixed-asset','audit-trail'],
  'Kasir': ['dashboard','booking','ambilantrian','kasir','tagihan','laporan'],
  'Apoteker': ['dashboard','booking','ambilantrian','farmasi','stok','pembelian','penggunaan-obat'],
  'Petugas': ['dashboard','booking','ambilantrian','pendaftaran','rawatjalan','rawatinap','ugd','rekammedis'],
  'Dokter': ['dashboard','booking','ambilantrian','rekammedis','operasi','penggunaan-obat'],
};

function go(name, el) {
  // Role guard
  const user = window.medicoreUser;
  if (user) {
    const allowed = ROLE_MENUS[user.role] || [];
    if (!allowed.includes(name)) {
      showToast('Anda tidak memiliki akses ke menu ini', 'warning');
      return;
    }
  }
  // Redirect old 'antrian' to new 'ambilantrian'
  if (name === 'antrian') name = 'ambilantrian';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));

    const pg = document.getElementById('pg-' + name);
    if (pg) pg.classList.add('active');

    document.getElementById('pgt').textContent = titles[name] || name;

    // Sync bottom nav
    document.querySelectorAll('.bn-item').forEach(function(b) {
      if (b.getAttribute('data-page') === name) b.classList.add('active');
    });

    // Close sidebar on mobile after navigation
    var mobileSidebar = document.querySelector('.sidebar.show');
    if (mobileSidebar) mobileSidebar.classList.remove('show');

    // Load page-specific data
    if (name === 'booking') loadBooking();
    if (name === 'pendaftaran') loadPendaftaran();
    if (name === 'dashboard') renderDashboard();
    if (name === 'rawatjalan') loadRawatJalan();
    if (name === 'rawatinap') loadRawatInap();
    if (name === 'ugd') loadUGD();
    if (name === 'ambilantrian') loadAntrian();
    if (name === 'rekammedis') loadRM();
    if (name === 'sdm') loadSDM();
    if (name === 'laboratorium') loadLab();
    if (name === 'radiologi') loadRad();
    if (name === 'farmasi') loadFarmasi();
    if (name === 'operasi') loadOK();
    if (name === 'kasir') loadKasir();
    if (name === 'tagihan') loadTagihan();
    if (name === 'laporan') loadLaporan();
    if (name === 'pengaturan') { loadConfig(); loadUsers(); }
    if (name === 'masterdata') loadMasterData();
    if (name === 'stok') loadStok();
    if (name === 'pembelian') loadPembelian();
        if (name === 'kas-bank') loadKasBank();
        if (name === 'penggunaan-obat') loadPenggunaanObat();
        if (name === 'permintaan-medis') loadPermintaanMedis();
        if (name === 'penjualan') loadPenjualan();
        if (name === 'logistik') loadLogistik();
        if (name === 'akuntansi') loadJurnalUmum();
        if (name === 'security') loadSecurity();
        if (name === 'fixed-asset') loadFixedAssets();
        if (name === 'audit-trail') loadAuditLogs();
        if (el) {
        el.classList.add('active');
    } else {
        document.querySelectorAll('.ni').forEach(n => {
            if (n.getAttribute('onclick')?.includes(`'${name}'`)) n.classList.add('active');
        });
    }
}

/**
 * Filter sidebar menus based on user role
 */
function filterSidebar(role) {
  const allowed = ROLE_MENUS[role] || [];
  document.querySelectorAll('.sidebar .s-sec').forEach(sec => {
    const buttons = sec.querySelectorAll('.ni[data-page]');
    let visibleCount = 0;
    buttons.forEach(btn => {
      const page = btn.getAttribute('data-page');
      if (allowed.includes(page)) {
        btn.style.display = '';
        visibleCount++;
      } else {
        btn.style.display = 'none';
      }
    });
    // Hide section title + whole section if no buttons visible
    const title = sec.querySelector('.s-title');
    if (visibleCount === 0) {
      sec.style.display = 'none';
    } else {
      sec.style.display = '';
    }
  });
}

// MODAL UTILS
function showM(id) { document.getElementById(id)?.classList.add('show'); }
function hideM(id) { document.getElementById(id)?.classList.remove('show'); }

let selectedPenjamin = 'Umum';

function selectPenjamin(type, el) {
    document.querySelectorAll('.pj').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    selectedPenjamin = type;
}

// TAB SWITCHER
function swTab(el, tabId) {
    const parent = el.closest('.tg') || el.parentElement;
    parent.querySelectorAll('.tgb').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    // Hide all tab-like content within the same page
    const page = el.closest('.page');
    if (page) {
        const possibleTabs = ['rj-q','rj-emr','rj-rx','far-rx','far-stok','far-retur','emr-s','emr-o','emr-a','emr-p'];
        possibleTabs.forEach(id => {
            const d = document.getElementById(id);
            if (d && page.contains(d)) d.style.display = 'none';
        });
    }

    const target = document.getElementById(tabId);
    if (target) target.style.display = '';

    // Auto-load data for specific tabs
    if (tabId === 'far-stok') loadFarStok();
    if (tabId === 'far-rx') loadFarRx();
}

// ─── ANIMATED COUNTER ───
function animateCounter(el, target, prefix, suffix) {
  prefix = prefix || '';
  suffix = suffix || '';
  if (!el) return;
  // Currency format (Rp)
  if (typeof target === 'string' && target.includes('Rp')) {
    el.textContent = target;
    return;
  }
  if (prefix === 'Rp' || (el.id && (el.id.includes('income') || el.id.includes('total') || el.id.includes('omzet') || el.id.includes('biaya')))) {
    el.textContent = formatRupiah(parseInt(target) || 0);
    return;
  }
  const numTarget = parseInt(target) || 0;
  let current = 0;
  const step = Math.max(1, Math.floor(numTarget / 30));
  const interval = 30;
  el.textContent = prefix + current + suffix;
  const timer = setInterval(function() {
    current += step;
    if (current >= numTarget) {
      current = numTarget;
      clearInterval(timer);
    }
    el.textContent = prefix + current.toLocaleString() + suffix;
  }, interval);
}

// ─── RENDER CSS-ONLY CHART ───
function renderMiniChart(containerId, data, color) {
  const container = document.getElementById(containerId);
  if (!container) return;
  color = color || 'var(--primary-500)';
  const max = Math.max(...data, 1);
  container.innerHTML = '<div class="chart-wrap">' +
    data.map(function(v, i) {
      var h = Math.max(4, (v / max) * 100);
      var dayNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
      return '<div class="chart-bar"><div class="chart-bar-inner" style="height:' + h + 'px;background:' + color + ';opacity:' + (0.3 + (v/max)*0.7) + '"></div><div class="chart-bar-label">' + (dayNames[i] || '') + '</div></div>';
    }).join('') +
    '</div>';
}

// RENDER DASHBOARD DATA
async function renderDashboard() {
    await SharedState.waitReady();
    var dashboardData = await SharedState.getDashboardData();
    if (!dashboardData) { showToast('Data dashboard gagal dimuat','warning'); return; }
    var st = dashboardData.stats || {};
    var beds = dashboardData.beds || [];
    var patients = dashboardData.latestPatients || [];
    var queues = dashboardData.queues || {};

    // 1. Update Statistik — with animated counter
    animateCounter(document.getElementById('stat-rj'), dashboardData.stats.rawatJalan);
    animateCounter(document.getElementById('stat-ri'), dashboardData.stats.rawatInap);
    animateCounter(document.getElementById('stat-ugd'), dashboardData.stats.ugd);
    animateCounter(document.getElementById('stat-income'), 'Rp ' + (dashboardData.stats.income || 0).toLocaleString());

    // Update sidebar badges
    const totActive = dashboardData.stats.rawatJalan + dashboardData.stats.rawatInap + dashboardData.stats.ugd;
    const antrianNb = document.querySelector('.ni[data-page="ambilantrian"] .nb');
    if (antrianNb) antrianNb.textContent = totActive;
    const ugdNb = document.querySelector('.ni[data-page="ugd"] .nb');
    if (ugdNb) ugdNb.textContent = dashboardData.stats.ugd;

    // 2. Render Tempat Tidur — Enhanced with tooltip
    const bedContainer = document.getElementById('bed-container');
    if (bedContainer) {
        bedContainer.innerHTML = '';
        dashboardData.beds.forEach(function(bed) {
            var statusClass = bed.status === 'tersedia' ? 'bo' : (bed.status === 'terpakai' ? 'ba' : 'br');
            var statusText = bed.status === 'tersedia' ? 'Tersedia' : (bed.status === 'terpakai' ? 'Terisi' : 'Reservasi');
            bedContainer.innerHTML += '<div class="bi2 ' + statusClass + '">' +
                '<div class="icon">🛏</div>' +
                '<div class="num">' + bed.nomor + '</div>' +
                '<div class="cls">' + bed.kelas + '</div>' +
                '<div class="bed-info">' + statusText + '</div>' +
                '</div>';
        });

        if(document.getElementById('bed-tersedia')) document.getElementById('bed-tersedia').textContent = dashboardData.stats.beds.tersedia;
        if(document.getElementById('bed-terpakai')) document.getElementById('bed-terpakai').textContent = dashboardData.stats.beds.terpakai;
        if(document.getElementById('bed-reservasi')) document.getElementById('bed-reservasi').textContent = dashboardData.stats.beds.reservasi;
    }

    // 3. Render Tabel Kunjungan Terbaru
    const patientTable = document.getElementById('latest-patients-table')?.querySelector('tbody');
    if (patientTable) {
        patientTable.innerHTML = '';
        dashboardData.latestPatients.forEach(function(p) {
            patientTable.innerHTML += '<tr>' +
                '<td class="mono">' + p.no_rm + '</td>' +
                '<td>' + p.nama + '</td>' +
                '<td>' + p.poli + '</td>' +
                '<td>' + p.penjamin + '</td>' +
                '<td><span class="b ' + (p.status === 'Selesai' ? 'bs' : 'bw') + '">' + p.status + '</span></td>' +
                '</tr>';
        });
    }

    // 4. Render Antrian
    if (dashboardData.queues) {
        Object.keys(dashboardData.queues).forEach(function(id) {
            var el = document.getElementById('q-' + id);
            if (el) el.textContent = dashboardData.queues[id].current;
        });
    }

    // 5. CSS-only Revenue Chart (7 days mock)
    var mockIncome = [65, 72, 58, 84, 91, 78, 89];
    renderMiniChart('chart-w', mockIncome, 'var(--primary-500)');

    // 6. Chart legends
    var chartLegend = document.getElementById('chart-l');
    if (chartLegend) {
      chartLegend.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">7 hari terakhir • dalam juta rupiah</span>';
    }
}

// RENDER PENDAFTARAN
async function loadPendaftaran() {
    const { data: regs } = await window.__sb
        .from('registrations')
        .select('*, patients(no_rm, nama, tgl_lahir), poli(nama_poli)')
        .order('created_at', { ascending: false });

    if (!regs) return;

    const tbody = document.getElementById('pendaftaran-tbody');
    if (!tbody) return;

    // Hitung stat
    const total = regs.length;
    const menunggu = regs.filter(r => r.status === 'Menunggu').length;
    const proses = regs.filter(r => r.status === 'Proses').length;
    const selesai = regs.filter(r => r.status === 'Selesai').length;

    document.getElementById('stat-kunjungan-total').textContent = total;
    document.getElementById('stat-kunjungan-menunggu').textContent = menunggu;
    document.getElementById('stat-kunjungan-proses').textContent = proses;
    document.getElementById('stat-kunjungan-selesai').textContent = selesai;
    document.getElementById('stat-kunjungan-count').textContent = total + ' kunjungan';

    // Render tabel
    tbody.innerHTML = '';
    regs.forEach(r => {
        const usia = r.patients?.tgl_lahir 
            ? Math.floor((new Date() - new Date(r.patients.tgl_lahir)) / 31557600000) + 'th'
            : '—';
        const dokter = '—';
        const statusClass = r.status === 'Selesai' ? 'bs' 
            : r.status === 'Proses' ? 'bp'
            : r.status === 'URGENT' ? 'bd'
            : r.status === 'Opname' ? 'bi'
            : 'bw';
        const rowClass = r.status === 'URGENT' ? ' class="row-u"' : '';

        tbody.innerHTML += `<tr${rowClass}>
            <td class="mono">${String(r.id).slice(0,6).toUpperCase()}</td>
            <td class="mono">${r.patients?.no_rm || '—'}</td>
            <td><strong>${r.patients?.nama || 'Unknown'}</strong></td>
            <td>${usia}</td>
            <td>${r.poli?.nama_poli || 'UGD'}</td>
            <td>${dokter}</td>
            <td><span class="b ${r.penjamin === 'BPJS' ? 'bi' : r.penjamin === 'Asuransi' ? 'bw' : 'bp'}">${r.penjamin || 'Umum'}</span></td>
            <td><strong>${r.no_antrian || '—'}</strong></td>
            <td><span class="b ${statusClass}">${r.status}</span></td>
            <td><button class="btn btn-o btn-xs" onclick="showPendaftaranDetail('${r.id}')">Detail</button></td>
        </tr>`;
    });
}

// Detail kunjungan di Pendaftaran
async function showPendaftaranDetail(regId) {
    showDetail('⏳ Memuat detail...', '<div style="padding:30px;text-align:center;color:var(--text-muted)">Memuat data...</div>');
    showM('mdl-detail');
    
    const { data: r } = await window.__sb
        .from('registrations')
        .select('*, patients(no_rm, nama, nik, jk, tgl_lahir, alamat, no_hp), poli(nama_poli)')
        .eq('id', regId)
        .single();
    
    if (!r) return showDetail('❌ Error', '<div style="padding:30px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    
    const p = r.patients;
    const usia = p?.tgl_lahir 
        ? Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000) + ' tahun'
        : '—';
    const gender = p?.jk === 'L' ? 'Laki-laki' : p?.jk === 'P' ? 'Perempuan' : '—';
    const cr = r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '—';
    const statClass = r.status === 'Selesai' ? 'bs' 
        : r.status === 'Proses' ? 'bp'
        : r.status === 'calling' ? 'bi'
        : r.status === 'URGENT' ? 'bd'
        : r.status === 'Opname' ? 'bi'
        : 'bw';

    showDetail('📋 Detail Kunjungan — ' + (p?.nama || 'Unknown'), `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Antrian</span><div style="font-weight:700;font-family:monospace;font-size:16px">${r.no_antrian || '—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${statClass}">${r.status}</span></div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div style="grid-column:1/-1;font-weight:700;color:var(--text-muted);margin-bottom:2px">👤 DATA PASIEN</div>
            <div><span style="color:var(--text-muted)">Nama</span><div style="font-weight:700">${p?.nama || '—'}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700;font-family:monospace">${p?.no_rm || '—'}</div></div>
            <div><span style="color:var(--text-muted)">NIK</span><div>${p?.nik || '—'}</div></div>
            <div><span style="color:var(--text-muted)">JK / Usia</span><div>${gender} / ${usia}</div></div>
            <div><span style="color:var(--text-muted)">Tgl Lahir</span><div>${p?.tgl_lahir || '—'}</div></div>
            <div><span style="color:var(--text-muted)">No. HP</span><div>${p?.no_hp || '—'}</div></div>
            <div style="grid-column:1/-1"><span style="color:var(--text-muted)">Alamat</span><div>${p?.alamat || '—'}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px">
            <div style="grid-column:1/-1;font-weight:700;color:var(--text-muted);margin-bottom:2px">📋 DATA KUNJUNGAN</div>
            <div><span style="color:var(--text-muted)">Poli</span><div style="font-weight:700">${r.poli?.nama_poli || 'UGD'}</div></div>
            <div><span style="color:var(--text-muted)">Penjamin</span><div><span class="b ${r.penjamin === 'BPJS' ? 'bi' : r.penjamin === 'Asuransi' ? 'bw' : 'bp'}">${r.penjamin || 'Umum'}</span></div></div>
            <div style="grid-column:1/-1"><span style="color:var(--text-muted)">Didaftarkan</span><div>${cr}</div></div>
        </div>
    `);
}

// PENDAFTARAN — Dynamic dropdowns from Supabase
async function loadPoliOptions() {
    await SharedState.waitReady();
    const select = document.getElementById('reg-poli');
    if (!select) return;
    const polis = SharedState.getPoli();
    select.innerHTML = '<option value="">— Pilih Poli —</option>';
    polis.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nama_poli}</option>`;
    });
    // Trigger doctor load if poli selected
    if (select.value) loadDoctorOptions(select.value);
}

async function loadDoctorOptions(poliId) {
    const select = document.getElementById('reg-dokter');
    if (!select) return;
    const doctors = SharedState.getDoctorsByPoli(parseInt(poliId));
    select.innerHTML = '<option value="">— Pilih Dokter —</option>';
    doctors.forEach(d => {
        select.innerHTML += `<option value="${d.id}">${d.nama_dokter}</option>`;
    });
}

// Cari pasien via Supabase
async function searchPatient() {
    const nama = document.getElementById('reg-name').value.trim();
    if (!nama) return showToast('Masukkan nama pasien');
    const { data } = await window.__sb
        .from('patients')
        .select('id, no_rm, nama')
        .ilike('nama', `%${nama}%`)
        .limit(5);
    const resultDiv = document.getElementById('search-result');
    if (!data || data.length === 0) {
        resultDiv.style.display = 'none';
        return showToast('Pasien tidak ditemukan. Daftarkan pasien baru melalui halaman daftar-mandiri.');
    }
    // Show first result
    resultDiv.style.display = 'block';
    document.getElementById('res-name').textContent = data[0].nama;
    document.getElementById('res-rm').textContent = data[0].no_rm;
    window._regPatientId = data[0].id;
    window._regPatientRM = data[0].no_rm;
}

// Toggle tab Pendaftaran: baru vs cari
function swTabDaftar(mode) {
  document.getElementById('daftar-tab-baru').style.display = mode === 'baru' ? 'block' : 'none';
  document.getElementById('daftar-tab-cari').style.display = mode === 'cari' ? 'block' : 'none';
  document.getElementById('tg-daftar-baru').className = 'tgb' + (mode === 'baru' ? ' active' : '');
  document.getElementById('tg-daftar-cari').className = 'tgb' + (mode === 'cari' ? ' active' : '');
  window._regPatientId = null;
  window._regPatientRM = null;
}

// Submit registrasi ke Supabase
async function submitRegistration() {
    const penjamin = window.selectedPenjamin || 'Umum';
    const poliId = document.getElementById('reg-poli')?.value;
    const dokterId = document.getElementById('reg-dokter')?.value;
    const mode = document.getElementById('daftar-tab-baru')?.style.display !== 'none' ? 'baru' : 'cari';

    // Validate form
    if (mode === 'baru') {
      var valid = validateForm({
        'reg-nama': { required: true, message: '⚠️ Nama pasien wajib diisi' },
        'reg-poli': { required: true, message: '⚠️ Pilih poli tujuan' }
      });
      if (!valid) return;
    } else {
      if (!validateField('reg-name', { required: true, message: '⚠️ Cari pasien terlebih dahulu' })) return;
      if (!window._regPatientId) return showToast('Pilih pasien dari hasil pencarian', 'warning');
    }

    let patientId = window._regPatientId;

    // MODE BARU: create pasien baru
    if (mode === 'baru') {
        const nama = document.getElementById('reg-nama').value.trim();
        if (!nama) return showToast('Nama pasien wajib diisi!');

        const nik = document.getElementById('reg-nik').value.trim();
        const jk = document.getElementById('reg-jk').value;
        const tglLahir = document.getElementById('reg-tgl-lahir').value;
        const alamat = document.getElementById('reg-alamat').value.trim();
        const hp = document.getElementById('reg-hp').value.trim();

        // Validasi NIK 16 digit
        if (nik.length > 0 && nik.length !== 16) {
          showToast('NIK harus 16 digit angka', 'warning');
          return;
        }

        // Cek duplikasi: NIK
        var dup = null;
        if (nik) {
          var r = await window.__sb.from('patients').select('id,no_rm,nama').eq('nik', nik).limit(1);
          if (r.data && r.data.length > 0) dup = r.data[0];
        }
        // Fallback: nama + tgl lahir
        if (!dup && nama && tglLahir) {
          var r2 = await window.__sb.from('patients').select('id,no_rm,nama').eq('nama', nama).eq('tgl_lahir', tglLahir).limit(1);
          if (r2.data && r2.data.length > 0) dup = r2.data[0];
        }
        if (dup && !confirm('Data mirip ditemukan: ' + dup.nama + ' (' + dup.no_rm + ')\nTetap daftarkan baru?')) {
          return;
        }

        if (!patientId) {
            var { count } = await window.__sb.from('patients').select('id', { count: 'exact', head: true });
            var noRm = '009' + String((count || 0) + 1).padStart(6, '0');
            txBegin();
            var { data: np, error: pe } = await window.__sb.from('patients').insert({
                no_rm: noRm, nama: nama, nik: nik || null, jk: jk || null,
                tgl_lahir: tglLahir || null, alamat: alamat || null, no_hp: hp || null
            }).select().single();
            if (pe) { txRollback(); return showToast(' Gagal: ' + pe.message); }
            patientId = np.id;
            window._regPatientRM = np.no_rm;
        }
    } else {
        // MODE CARI: pastikan sudah cari pasien
        if (!patientId) return showToast('Cari pasien terlebih dahulu!');
    }

    // Generate nomor antrian
    var hariIni = new Date().toISOString().slice(0,10);
    var { count: regCount } = await window.__sb
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hariIni);

    var noUrut = (regCount || 0) + 1;
    const prefix = poliId === '8' ? 'T' : 'A';
    const noAntrian = `${prefix}-${String(noUrut).padStart(2, '0')}`;

    const { error } = await window.__sb
        .from('registrations')
        .insert({
            patient_id: patientId,
            poli_id: parseInt(poliId),
            penjamin: penjamin,
            status: 'Menunggu',
            no_antrian: noAntrian
        });

    if (error) return showToast(' Gagal: ' + error.message);

    // Create invoice automatically
    await window.__sb.from('invoices').insert({
        registration_id: null,
        patient_id: patientId,
        status: 'Belum Dibayar',
        total: 0
    });

    showToast(`✅ Berhasil! Pasien terdaftar. No. Antrian: ${noAntrian}`);
    hideM('mdl-daftar');
    loadPendaftaran();
}

// ===== RAWAT JALAN — Queue from Supabase =====
var _RJ = { regs: [], patients: {}, polis: {}, doctors: {} };

async function loadRawatJalan() {
    const container = document.getElementById('rj-queue-container');
    if (!container) return;
    container.innerHTML = '<div class="loader" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">⏳ Memuat data antrian...</div>';

    const poliMap = {};
    SharedState.getPoli().forEach(p => poliMap[p.id] = p.nama_poli);

    // Fetch registrations for poli (antrian T-* / status not Opname/calling/URGENT)
    const { data: regs } = await window.__sb
        .from('registrations')
        .select('id, patient_id, poli_id, doctor_id, no_antrian, status, penjamin, created_at')
        .not('status', 'in', '("Opname","calling","URGENT")')
        .order('created_at', { ascending: true });

    if (!regs || !regs.length) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:10px">🏥</div>Tidak ada antrian poli hari ini</div>';
        return;
    }

    // Fetch patients & doctors for display
    const patientIds = [...new Set(regs.map(r => r.patient_id))];
    const { data: patients } = await window.__sb
        .from('patients')
        .select('id, no_rm, nama, tgl_lahir, jk')
        .in('id', patientIds);

    const patientsMap = {};
    (patients || []).forEach(p => patientsMap[p.id] = p);

    // Group by poli
    const groups = {};
    regs.forEach(r => {
        if (!r.poli_id) return;
        if (!groups[r.poli_id]) groups[r.poli_id] = [];
        groups[r.poli_id].push(r);
    });

    // Render
    let html = '';
    for (const [poliId, poliRegs] of Object.entries(groups)) {
        const pid = parseInt(poliId);
        const poliName = poliMap[pid] || 'Poli #' + pid;
        const waiting = poliRegs.filter(r => r.status === 'Menunggu').length;
        const proses = poliRegs.filter(r => r.status === 'Proses');
        const regsHtml = poliRegs.map(r => {
            const pat = patientsMap[r.patient_id];
            const isProses = r.status === 'Proses';
            return `<tr class="${isProses ? 'row-n' : ''}"><td><strong>${r.no_antrian || '-'}</strong></td><td>${pat ? pat.nama : '—'}</td><td><span class="b ${isProses ? 'bp' : (r.status === 'Selesai' ? 'bs' : 'bw')}">${r.status}</span></td></tr>`;
        }).join('');

        const haveProses = proses.length > 0;
        const nextWaiting = poliRegs.find(r => r.status === 'Menunggu');
        const currentReg = haveProses ? proses[0] : nextWaiting;
        const patName = currentReg && patientsMap[currentReg.patient_id] ? patientsMap[currentReg.patient_id].nama : '';

        html += `<div class="card" style="margin-bottom:0"><div class="ch"><div class="ct">🫀 Poli ${poliName}</div><span class="b bw">${waiting} menunggu</span></div>
          <div style="padding:10px 13px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:7px">${SharedState.getDokterByPoli(pid) || 'Dokter tersedia'} — ${SharedState.getJadwalByPoli(pid) || 'Jam praktik'}</div>
          <table class="t"><thead><tr><th>Antrian</th><th>Nama</th><th>Status</th></tr></thead><tbody>${regsHtml}</tbody></table>
          <button class="btn btn-p btn-sm" style="margin-top:9px;width:100%" onclick="panggilPasien('${currentReg ? currentReg.id : ''}')">⏭️ ${haveProses ? 'Lanjutkan EMR' : (nextWaiting ? 'Panggil & Input EMR' : 'Tunggu Pasien')}</button></div>
        </div>`;
    }

    container.innerHTML = html;
    // Load medicines for resep tab
    loadMedicines();
}

// Panggil pasien — update status ke Proses + set active patient
async function panggilPasien(regId) {
    if (!regId) return showToast('Tidak ada pasien yang bisa dipanggil');

    // Update status to Proses
    const { error } = await window.__sb
        .from('registrations')
        .update({ status: 'Proses' })
        .eq('id', regId);

    if (error) return showToast(' Gagal: ' + error.message);

    // Switch to EMR tab
    document.querySelectorAll('.tgb').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tgb')[1].classList.add('active');
    document.getElementById('rj-q').style.display = 'none';
    document.getElementById('rj-emr').style.display = 'block';

    // Load patient data into EMR
    loadEMR(regId);
    loadRawatJalan();
}

// Load EMR data for a registration
async function loadEMR(regId) {
    const { data: reg } = await window.__sb
        .from('registrations')
        .select('*, patients!inner(id, no_rm, nama, tgl_lahir, jk), poli(nama_poli)')
        .eq('id', regId)
        .single();

    if (!reg) return;

    const p = reg.patients;
    const umur = p.tgl_lahir ? Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000) : '?';
    const inisial = p.nama ? p.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '--';

    document.getElementById('rj-emr-patient').innerHTML = `
        <div class="pc" style="margin-bottom:10px;cursor:default"><div class="p-av">${inisial}</div><div><div class="p-name">${p.nama}</div><div class="p-meta">No.RM: ${p.no_rm || '—'} • ${umur}th • ${p.jk || '—'}</div><div class="p-meta">${reg.penjamin || '—'} • Antrian ${reg.no_antrian}</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px">
            <div><span style="color:var(--text-muted)">Poli:</span> <strong>${reg.poli?.nama_poli || 'UGD'}</strong></div>
            <div><span style="color:var(--text-muted)">Dokter:</span> <strong>${SharedState.getDokterByPoli(reg.poli_id) || '—'}</strong></div>
        </div>`;

    const titleEl = document.getElementById('mdl-emr-title');
    if (titleEl) titleEl.textContent = `📝 Input EMR — ${p.nama} (${reg.no_antrian || '—'})`;

    document.getElementById('rx-pasien-nama').textContent = p.nama || '—';
    document.getElementById('rx-tbody').innerHTML = '';
    document.getElementById('rx-subtotal').textContent = 'Rp 0';
    document.getElementById('rx-total').textContent = 'Rp 5.000';
    window._activeRegId = regId;
    window._activePatient = p;
    window._rxItems = [];
}

// ─── TAB SWITCH EMR ───
function swSub(el, tabId) {
    document.querySelectorAll('#rj-emr .tabs .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('#rj-emr [id^="emr-"]').forEach(d => {
        if (['emr-s','emr-o','emr-a','emr-p'].includes(d.id)) d.style.display = 'none';
    });
    document.getElementById(tabId).style.display = 'block';
}

// ─── SIMPAN EMR ───
async function simpanEMR(mode) {
    const regId = window._activeRegId;
    if (!regId) return showToast(' Pilih pasien dulu dari antrian');

    const emrData = {
        s_keluhan: document.getElementById('emr-keluhan')?.value || '',
        s_rps: document.getElementById('emr-rps')?.value || '',
        s_rpd: document.getElementById('emr-rpd')?.value || '',
        s_alergi: document.getElementById('emr-alergi')?.value || '',
        o_fisik: document.getElementById('emr-fisik')?.value || '',
        o_khusus: document.getElementById('emr-khusus')?.value || '',
        a_dx1: document.getElementById('emr-dx1')?.value || '',
        a_dx2: document.getElementById('emr-dx2')?.value || '',
        a_asesmen: document.getElementById('emr-asesmen')?.value || '',
        p_plan: document.getElementById('emr-plan')?.value || '',
        p_kontrol: document.getElementById('emr-kontrol')?.value || '',
        p_tindakan: [
            document.getElementById('act-konsul')?.checked ? 'Konsul' : null,
            document.getElementById('act-ranap')?.checked ? 'Rawat Inap' : null,
            document.getElementById('act-resep')?.checked ? 'Resep Obat' : null,
            document.getElementById('act-rujuk')?.checked ? 'Rujukan' : null,
            document.getElementById('act-lab')?.checked ? 'Lab' : null,
        ].filter(Boolean)
    };

    const updateData = { notes: JSON.stringify(emrData), updated_at: new Date().toISOString() };
    if (mode === 'selesai') updateData.status = 'Selesai';

    const { error } = await window.__sb.from('registrations').update(updateData).eq('id', regId);
    if (error) return showToast(' Gagal: ' + error.message);

    if (mode === 'selesai') {
        showToast(' Rekam medis selesai & tersimpan!');
        // Reset form
        document.getElementById('rj-emr-patient').innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Pilih pasien dari antrian untuk memulai EMR</div>';
        document.querySelectorAll('#rj-emr input, #rj-emr textarea, #rj-emr select').forEach(el => el.value = '');
        document.querySelectorAll('#rj-emr input[type=checkbox]').forEach(el => el.checked = false);
        window._activeRegId = null;
        window._activePatient = null;
        swTab(document.querySelector('.tgb'), 'rj-q');
        loadRawatJalan();
    } else {
        showToast('Draft EMR tersimpan!');
    }
}

// ─── LANJUT KE RESEP ───
function lanjutResep() {
    if (!window._activeRegId) return showToast(' Pilih pasien dulu');
    swTab(document.querySelectorAll('.tgb')[2], 'rj-rx');
}

// ─── CETAK SURAT KONTROL ───
function printKontrol() {
    const pt = window._activePatient;
    if (!pt) return showToast(' Pilih pasien dulu');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Surat Kontrol</title><style>body{font-family:sans-serif;padding:40px}</style></head><body>
        <h2>Surat Kontrol</h2>
        <p>Nama: <strong>${pt.nama}</strong></p>
        <p>No. RM: ${pt.no_rm || '—'}</p>
        <p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
        <p>Kontrol kembali: ${document.getElementById('emr-kontrol')?.value || '—'}</p>
        <br><br><p>Dokter,</p><br><br><p>(__________________)</p>
        <script>window.print()</script></body></html>`);
    win.document.close();
}

// ─── RESEP ───
let _rxItems = [];

async function loadMedicines() {
    const { data } = await window.__sb.from('medicines').select('*').order('nama_obat');
    if (!data) return;
    const list = document.getElementById('rx-obat-list');
    if (!list) return;
    const searchInput = document.getElementById('rx-search');
    if (!searchInput) return;

    function render(filter = '') {
        const filtered = data.filter(m => m.nama_obat.toLowerCase().includes(filter.toLowerCase()));
        list.innerHTML = filtered.map(m => {
            const stokClass = m.stok <= m.stok_minimum ? 'var(--danger)' : m.stok <= m.stok_minimum * 3 ? 'var(--warning)' : 'var(--success)';
            return `<div class="di"><div class="d-icon">💊</div><div><div class="d-name">${m.nama_obat}</div><div class="d-det">${m.kategori||'Obat'} • Rp ${(m.harga_satuan||0).toLocaleString()}/${m.satuan||''}</div></div><div class="d-stock"><div class="d-qty" style="color:${stokClass}">${m.stok||0}</div><div class="d-unit">${m.satuan||''}</div></div><button class="btn btn-p btn-xs" onclick="tambahObat('${m.id}','${m.nama_obat.replace(/'/g,"\\'")}',${m.harga_satuan||0},'${m.satuan||''}')">+ Tambah</button></div>`;
        }).join('');
    }

    render('');
    searchInput.oninput = () => render(searchInput.value);
}

function tambahObat(id, nama, harga, satuan) {
    if (!window._activePatient) return showToast(' Pilih pasien dulu dari EMR');
    const tbody = document.getElementById('rx-tbody');
    const idx = window._rxItems ? window._rxItems.length : 0;
    if (!window._rxItems) window._rxItems = [];
    window._rxItems.push({ id, nama, harga, satuan, dosis: '', frek: '', jumlah: 1, ket: '' });
    
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${nama}</strong></td>
        <td><input class="fc" style="width:60px" value="" onchange="updateRx(${idx},'dosis',this.value)"></td>
        <td><input class="fc" style="width:60px" value="" onchange="updateRx(${idx},'frek',this.value)"></td>
        <td><input class="fc" style="width:50px" type="number" min="1" value="1" onchange="updateRx(${idx},'jumlah',parseInt(this.value)||1)"></td>
        <td><input class="fc" style="width:70px" value="" onchange="updateRx(${idx},'ket',this.value)"></td>
        <td><button class="btn btn-o btn-xs" onclick="hapusObat(${idx})">✕</button></td>`;
    tbody.appendChild(tr);
    hitungTotal();
}

function updateRx(idx, field, val) {
    if (!window._rxItems) window._rxItems = [];
    if (!window._rxItems[idx]) return;
    window._rxItems[idx][field] = val;
    hitungTotal();
}

function hapusObat(idx) {
    if (!window._rxItems) return;
    window._rxItems.splice(idx, 1);
    renderRxTable();
    hitungTotal();
}

function renderRxTable() {
    const tbody = document.getElementById('rx-tbody');
    tbody.innerHTML = '';
    (window._rxItems || []).forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${item.nama}</strong></td>
            <td><input class="fc" style="width:60px" value="${item.dosis||''}" onchange="updateRx(${i},'dosis',this.value)"></td>
            <td><input class="fc" style="width:60px" value="${item.frek||''}" onchange="updateRx(${i},'frek',this.value)"></td>
            <td><input class="fc" style="width:50px" type="number" min="1" value="${item.jumlah||1}" onchange="updateRx(${i},'jumlah',parseInt(this.value)||1)"></td>
            <td><input class="fc" style="width:70px" value="${item.ket||''}" onchange="updateRx(${i},'ket',this.value)"></td>
            <td><button class="btn btn-o btn-xs" onclick="hapusObat(${i})">✕</button></td>`;
        tbody.appendChild(tr);
    });
}

function hitungTotal() {
    const items = window._rxItems || [];
    const subtotal = items.reduce((sum, item) => sum + (item.harga || 0) * (item.jumlah || 1), 0);
    document.getElementById('rx-subtotal').textContent = formatRupiah(subtotal);
    document.getElementById('rx-total').textContent = 'Rp ' + (subtotal + 5000).toLocaleString();
}

async function kirimFarmasi() {
    const regId = window._activeRegId;
    const pt = window._activePatient;
    if (!regId || !pt) return showToast(' Pilih pasien dulu dari EMR');
    const items = window._rxItems || [];
    if (!items.length) return showToast(' Belum ada obat di resep');

    // Create prescription
    const noResep = 'RX-' + Date.now().toString(36).toUpperCase();
    const { data: presc, error: pe } = await window.__sb.from('prescriptions').insert({
        no_resep: noResep,
        patient_id: pt.id,
        registration_id: regId,
        unit: 'RJ',
        status: 'Menunggu Farmasi',
        created_at: new Date().toISOString()
    }).select().single();

    if (pe) return showToast(' Gagal buat resep: ' + pe.message);

    // Create prescription items
    const pItems = items.map(item => ({
        prescription_id: presc.id,
        medicine_id: item.id,
        jumlah: item.jumlah || 1,
        dosis: item.dosis || '',
        harga: item.harga || 0,
        subtotal: (item.harga || 0) * (item.jumlah || 1)
    }));

    const { error: ie } = await window.__sb.from('prescription_items').insert(pItems);
    if (ie) return showToast(' Gagal simpan item: ' + ie.message);

    // Kurangi stok otomatis
    for (var si = 0; si < items.length; si++) {
      var it = items[si];
      if (!it.id) continue;
      var { data: obat } = await window.__sb.from('medicines').select('stok, nama_obat').eq('id', it.id).single();
      if (!obat) continue;
      if ((obat.stok || 0) < (it.jumlah || 1)) {
        showToast('Stok ' + obat.nama_obat + ' tidak cukup (sisa: ' + obat.stok + ')', 'warning');
        continue;
      }
      await window.__sb.from('medicines').update({ stok: (obat.stok || 0) - (it.jumlah || 1) }).eq('id', it.id);
    }

    showToast(' Resep terkirim ke Farmasi! Stok dikurangi otomatis.', 'success');
    window._rxItems = [];
    document.getElementById('rx-tbody').innerHTML = '';
    hitungTotal();
}

function cetakResep() {
    const pt = window._activePatient;
    if (!pt) return showToast(' Pilih pasien dulu dari EMR');
    const items = window._rxItems || [];
    if (!items.length) return showToast(' Belum ada obat di resep');

    let rows = items.map((item, i) => `
        <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd">${i+1}.</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd"><strong>${item.nama}</strong></td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd">${item.dosis || '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd">${item.frek || '—'}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd">${item.jumlah || 1} ${item.satuan || ''}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #ddd">${item.ket || '—'}</td>
        </tr>`).join('');

    const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html><head><title>Resep - MEDICORE</title>
<style>
    @page { margin: 15mm 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #222; padding: 0; margin: 0; }
    .header { text-align: center; border-bottom: 2px solid #0A2540; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 18px; color: #0A2540; }
    .header p { margin: 3px 0 0; font-size: 11px; color: #555; }
    .info { margin-bottom: 14px; }
    .info table { width: 100%; border-collapse: collapse; }
    .info td { padding: 2px 0; font-size: 12px; }
    .info .lbl { color: #555; width: 80px; }
    table.obat { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    table.obat th { background: #0A2540; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
    table.obat td { font-size: 12px; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; }
    .footer .ttd { text-align: center; }
    .footer .ttd p { margin: 0 0 40px; font-size: 11px; color: #555; }
    .footer .ttd .line { width: 160px; border-top: 1px solid #222; padding-top: 4px; font-size: 11px; }
    .no-print { display: none; }
</style></head>
<body>
    <div class="header">
        <h1>RESEP OBAT</h1>
        <p>Edoy Hospital Management — Banten</p>
    </div>
    <div class="info">
        <table>
            <tr><td class="lbl">Nama</td><td>: <strong>${pt.nama}</strong></td><td style="text-align:right">Tanggal: ${tgl}</td></tr>
            <tr><td class="lbl">No. RM</td><td>: ${pt.no_rm || '—'}</td><td style="text-align:right">No. Resep: RX-${Date.now().toString(36).toUpperCase()}</td></tr>
            <tr><td class="lbl">Dokter</td><td>: ${window.medicoreUser?.nama || '—'}</td><td></td></tr>
        </table>
    </div>
    <table class="obat">
        <thead><tr><th style="width:30px">No</th><th>Nama Obat</th><th style="width:70px">Dosis</th><th style="width:70px">Frek.</th><th style="width:80px">Jumlah</th><th style="width:90px">Keterangan</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer">
        <div class="ttd">
            <p>Pasien / Keluarga,</p>
            <div class="line">(__________________)</div>
        </div>
        <div class="ttd">
            <p>Dokter,</p>
            <div class="line">(${window.medicoreUser?.nama || '__________________'})</div>
        </div>
    </div>
    <p style="text-align:center;font-size:10px;color:#999;margin-top:20px">— Dokumen ini sah tanpa tanda tangan basah —</p>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)};window.onafterprint=function(){window.close()};<\/script>
</body></html>`);
    win.document.close();
}

// ===== RAWAT INAP — from Supabase =====
async function loadRawatInap() {
    await SharedState.waitReady();

    // Stats: count opname & beds
    const { data: opnames } = await window.__sb
        .from('registrations')
        .select('id, status, no_antrian, patient_id, poli_id, created_at, bed_id, doctor_id, diagnosa_masuk')
        .eq('status', 'Opname');

    const { data: allBeds } = await window.__sb
        .from('beds')
        .select('*');

    const opnameCount = opnames?.length || 0;
    const beds = allBeds || [];
    const tersedia = beds.filter(b => b.status === 'Tersedia').length;
    const terpakai = beds.filter(b => b.status === 'Terpakai').length;
    const reservasi = beds.filter(b => b.status === 'Reservasi').length;

    document.getElementById('ri-stats').innerHTML = `
        <div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">${opnameCount}</div><div class="sl">Pasien Opname</div></div>
        <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success)">${tersedia}</div><div class="sl">TT Tersedia</div></div>
        <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning)">${reservasi}</div><div class="sl">Reservasi</div></div>
        <div class="sc"><div class="sb" style="background:var(--info)"></div><div class="sv" style="color:var(--info)">${terpakai}</div><div class="sl">TT Terpakai</div></div>`;

    // Bed map — group by kelas
    const kelasGroups = {};
    beds.forEach(b => {
        if (!kelasGroups[b.kelas]) kelasGroups[b.kelas] = [];
        kelasGroups[b.kelas].push(b);
    });

    const statusClass = { 'Tersedia': 'bo', 'Terpakai': 'ba', 'Reservasi': 'br' };
    let bedHtml = '';
    const kelasOrder = ['ICU', 'K-1', 'K-2', 'K-3'];
    for (const k of kelasOrder) {
        if (!kelasGroups[k] || !kelasGroups[k].length) continue;
        bedHtml += `<div style="padding:11px 11px 2px;font-size:11px;font-weight:700;color:var(--text-muted)">${k}</div>
        <div class="bg-g" style="padding:0 11px 11px">`;
        kelasGroups[k].forEach(b => {
            bedHtml += `<div class="bi2 ${statusClass[b.status] || 'bo'}"><div class="icon">🛏</div><div class="num">${b.nomor}</div><div class="cls">${b.status === 'Tersedia' ? 'Sedia' : b.status === 'Terpakai' ? 'Pakai' : 'Res'}</div></div>`;
        });
        bedHtml += `</div>`;
    }
    document.getElementById('ri-bedmap').innerHTML = bedHtml || '<div style="color:var(--text-muted)">Tidak ada data kamar</div>';

    // Opname table — join with beds & patients
    if (opnames && opnames.length) {
        const pIds = [...new Set(opnames.map(r => r.patient_id))];
        const bedIds = [...new Set(opnames.filter(r => r.bed_id).map(r => r.bed_id))];
        const { data: patients } = await window.__sb
            .from('patients')
            .select('id, nama, no_rm')
            .in('id', pIds);
        const pMap = {};
        (patients||[]).forEach(p => pMap[p.id] = p);

        let bMap = {};
        if (bedIds.length) {
            const { data: beds } = await window.__sb
                .from('beds')
                .select('id, nomor, kelas')
                .in('id', bedIds);
            (beds||[]).forEach(b => bMap[b.id] = b);
        }

        const rows = opnames.map((r, i) => {
            const pat = pMap[r.patient_id];
            const hari = r.created_at ? Math.floor((new Date() - new Date(r.created_at)) / 86400000) : 0;
            const bed = bMap[r.bed_id];
            const kamar = bed ? `${bed.nomor} (${bed.kelas})` : '—';
            const diagnosa = r.diagnosa_masuk || '—';
            const dpjp = r.doctor_id ? (SharedState.cache.doctors?.find(d => d.id === r.doctor_id)?.nama_dokter || '—') : '—';
            return `<tr>
                <td><strong>${kamar}</strong></td>
                <td>${pat?.nama || '—'}</td>
                <td style="font-size:12px;color:var(--text-muted)">${diagnosa}</td>
                <td>${dpjp}</td>
                <td>${hari}</td>
                <td>
                    <button class="btn btn-d btn-xs" onclick="openDischarge('${r.id}','${pat?.nama || ''}','${r.no_antrian || ''}','${r.bed_id || ''}')">🏥 Pulangkan</button>
                </td>
            </tr>`;
        }).join('');
        document.querySelector('#ri-opname-table tbody').innerHTML = rows;
    }
}

// ===== UGD — from Supabase =====
async function loadUGD() {
    await SharedState.waitReady();

    // Cari UGD: no_antrian starts with 'UGD' OR poli_id IS NULL (bukan calling/opname/selesai)
    try {
        const { data: ugdRegs } = await window.__sb
            .from('registrations')
            .select('id, no_antrian, status, patient_id')
            .or('no_antrian.ilike.UGD%,and(poli_id.is.null,status.neq.Selesai,status.neq.Opname,status.neq.calling)');
        
        if (!ugdRegs || ugdRegs.length === 0) {
            document.getElementById('ugd-stats').innerHTML = `
                <div class="sc"><div class="sb" style="background:var(--text-muted)"></div><div class="sv" style="color:var(--text-muted)">0</div><div class="sl">🆘 Pasien UGD</div></div>`;
            if (document.querySelector('#ugd-table tbody')) {
                document.querySelector('#ugd-table tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Tidak ada pasien UGD</td></tr>';
            }
            return;
        }

        const count = ugdRegs.length;
        document.getElementById('ugd-stats').innerHTML = `
            <div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">${count}</div><div class="sl">🆘 Pasien UGD</div></div>`;

        const pIds = [...new Set(ugdRegs.map(r => r.patient_id))];
        const { data: patients } = await window.__sb
            .from('patients')
            .select('id, nama, no_rm')
            .in('id', pIds);
        const pMap = {};
        (patients||[]).forEach(p => pMap[p.id] = p);

        const rows = ugdRegs.map((r, i) => {
            const pat = pMap[r.patient_id];
            const cls = r.status === 'URGENT' ? 'row-u' : '';
            return `<tr class="${cls}"><td>${i+1}</td><td><strong>${pat?.nama || '—'}</strong></td><td>${r.no_antrian || '—'}</td><td><span class="b ${r.status === 'URGENT' ? 'bd' : 'bw'}">${r.status}</span></td><td><button class="btn btn-p btn-xs" onclick="loadEMR('${r.id}');showM('mdl-emr')">EMR</button></td></tr>`;
        }).join('');
        const tbody = document.querySelector('#ugd-table tbody');
        if (tbody) tbody.innerHTML = rows;
    } catch (e) {
        console.error('loadUGD error:', e);
    }
}

// LOAD BOOKING
async function loadBooking() {
    const tbody = document.getElementById('booking-tbody');
    if (!tbody) return;
    try {
        const { data, error } = await supabase
            .from('registrations')
            .select('id, no_reg, patients!inner(name, no_rm), poli, dokter, penjamin, status, created_at')
            .gte('created_at', new Date().toISOString().split('T')[0])
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada booking hari ini</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td class="mono">${r.no_reg || '-'}</td>
                <td><strong>${r.patients?.name || '-'}</strong></td>
                <td>${r.poli || '-'}</td>
                <td>${r.dokter || '-'}</td>
                <td>${r.penjamin || '-'}</td>
                <td><span class="b ${r.status === 'menunggu' ? 'bw' : r.status === 'selesai' ? 'bs' : 'bo'}">${r.status || '-'}</span></td>
                <td><button class="btn btn-xs btn-p" onclick="go('pendaftaran')">Proses</button></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">❌ Gagal memuat data</td></tr>';
    }
}

// LOAD ANTRIAN
async function loadAntrian() {
    const container = document.getElementById('antrian-queue-container');
    if (!container) return;

    // Query registrasi hari ini — exclude Opname
    const today = new Date().toISOString().slice(0, 10);
    let regs = [];
    try {
        const { data, error } = await window.__sb
            .from('registrations')
            .select('no_antrian, status, patient_id, penjamin, created_at')
            .gte('created_at', today)
            .order('created_at', { ascending: true });
        if (error) console.error('loadAntrian error:', error);
        regs = data || [];
    } catch (e) {
        console.error('loadAntrian exception:', e);
    }

    if (regs.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">📭 Belum ada antrian hari ini.</div>';
        return;
    }

    // Definisikan prefix → loket mapping (+ T untuk poli)
    const lokets = [
        { prefix: 'A', title: '🏥 Loket 1 — Umum',   subtitle: 'Pasien Umum' },
        { prefix: 'B', title: '🏥 Loket 2 — BPJS',   subtitle: 'Pasien BPJS' },
        { prefix: 'C', title: '🏥 Loket 3 — JKN',    subtitle: 'Pasien Asuransi' },
        { prefix: 'T', title: '🩺 Poli Klinik',       subtitle: 'Kunjungan Poli' },
        { prefix: 'F', title: '💊 Farmasi',           subtitle: 'Farmasi' },
        { prefix: 'L', title: '🧪 Laboratorium',      subtitle: 'Lab' },
        { prefix: 'K', title: '💰 Kasir',             subtitle: 'Kasir & Pembayaran' },
    ];

    // Kelompokkan data per prefix (case-insensitive)
    const groups = {};
    regs.forEach(r => {
        // Skip registrasi tanpa no_antrian, Opname, URGENT, dan UGD (ditampilkan di halaman UGD)
        if (!r.no_antrian) return;
        if (['Opname','URGENT','calling'].includes(r.status)) return;
        // 'UGD' no_antrian -> skip here, shown in UGD page
        if (r.no_antrian.toUpperCase().startsWith('UGD')) return;
        const prefix = r.no_antrian.charAt(0).toUpperCase();
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(r);
    });

    // Render tiap loket
    container.innerHTML = '';
    lokets.forEach(loket => {
        const items = groups[loket.prefix] || [];
        const calling = items.find(r => r.status === 'Calling') || items.find(r => r.status === 'Proses') || null;
        const waiting = items.filter(r => r.status === 'Menunggu');
        const waitingCount = waiting.length;
        if (items.length === 0 && loket.prefix !== 'T') {
            // Hide empty non-T cards
            return;
        }
        const currentNum = calling ? calling.no_antrian : (items.length > 0 ? items[items.length - 1].no_antrian : '—');

        container.innerHTML += `
        <div class="card" style="margin-bottom:0">
            <div class="ch"><div class="ct">${loket.title}</div></div>
            <div class="qg">
                <div class="qb ${calling ? 'on' : ''}">
                    <div class="ql">${loket.subtitle}</div>
                    <div class="qn">${currentNum}</div>
                    <div class="qt">${calling ? 'Dilayani' : (items.length > 0 ? 'Terakhir' : '—')}</div>
                </div>
                <div class="qb">
                    <div class="ql">Menunggu</div>
                    <div class="qn" style="color:var(--warning)">${waitingCount}</div>
                    <div class="qt">antrian</div>
                </div>
            </div>
        </div>`;
    });
    
    // If no cards rendered at all
    if (container.innerHTML === '') {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">📭 Tidak ada antrian aktif hari ini.</div>';
    }
}

// ===== REKAM MEDIS — from Supabase =====
async function loadRM() {
    const resultsDiv = document.getElementById('rm-results');
    const detailDiv = document.getElementById('rm-detail');
    if (!resultsDiv) return;
    detailDiv.style.display = 'none';

    // Load all patients
    const { data: patients } = await window.__sb
        .from('patients')
        .select('id, no_rm, nama, nik, tgl_lahir, alamat, no_hp, agama, jk')
        .order('nama', { ascending: true });

    if (!patients || patients.length === 0) {
        resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:10px">📁</div>Tidak ada data pasien</div>';
        return;
    }

    resultsDiv.innerHTML = '';
    patients.forEach(p => {
        const umur = p.tgl_lahir ? Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000) : '?';
        const inisial = p.nama ? p.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '--';
        resultsDiv.innerHTML += `
            <div class="pc" onclick="viewRMPatient('${p.id}')" style="cursor:pointer">
                <div class="p-av">${inisial}</div>
                <div>
                    <div class="p-name">${p.nama}</div>
                    <div class="p-meta">No.RM: ${p.no_rm || '—'} • ${umur}th • ${p.jk || '—'}</div>
                    <div class="p-meta">NIK: ${p.nik || '—'}</div>
                </div>
                <div class="p-right">
                    <span class="b bs">Aktif</span>
                </div>
            </div>`;
    });
}

async function searchRM() {
    const keyword = document.getElementById('rm-search')?.value.trim();
    if (!keyword) {
        loadRM();
        return;
    }

    const resultsDiv = document.getElementById('rm-results');
    const detailDiv = document.getElementById('rm-detail');
    if (!resultsDiv) return;
    detailDiv.style.display = 'none';

    resultsDiv.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Mencari...</div>';

    // Search by no_rm, nama, or nik
    const { data: patients } = await window.__sb
        .from('patients')
        .select('id, no_rm, nama, nik, tgl_lahir, alamat, no_hp, agama, jk')
        .or(`no_rm.ilike.%${keyword}%, nama.ilike.%${keyword}%, nik.ilike.%${keyword}%`)
        .limit(20);

    if (!patients || patients.length === 0) {
        resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:10px">🔍</div>Pasien tidak ditemukan</div>';
        return;
    }

    resultsDiv.innerHTML = '';
    patients.forEach(p => {
        const umur = p.tgl_lahir ? Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000) : '?';
        const inisial = p.nama ? p.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '--';
        resultsDiv.innerHTML += `
            <div class="pc" onclick="viewRMPatient('${p.id}')" style="cursor:pointer">
                <div class="p-av">${inisial}</div>
                <div>
                    <div class="p-name">${p.nama}</div>
                    <div class="p-meta">No.RM: ${p.no_rm || '—'} • ${umur}th • ${p.jk || '—'}</div>
                    <div class="p-meta">NIK: ${p.nik || '—'}</div>
                </div>
                <div class="p-right">
                    <span class="b bs">Aktif</span>
                </div>
            </div>`;
    });
}

async function viewRMPatient(patientId) {
    const detailDiv = document.getElementById('rm-detail');
    const detailContent = document.getElementById('rm-detail-content');
    if (!detailContent) return;

    detailDiv.style.display = 'block';
    detailContent.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Memuat detail...</div>';

    // Get patient data
    const { data: patient } = await window.__sb
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (!patient) {
        detailContent.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">❌ Data pasien tidak ditemukan</div>';
        return;
    }

    // Get visit history
    const { data: regs } = await window.__sb
        .from('registrations')
        .select('*, poli(nama_poli)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

    const umur = patient.tgl_lahir ? Math.floor((new Date() - new Date(patient.tgl_lahir)) / 31557600000) : '?';
    const kunjunganCount = regs?.length || 0;

    // Build visit table rows
    let visitRows = '';
    if (regs && regs.length > 0) {
        regs.forEach(r => {
            const tgl = r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const statusClass = r.status === 'Selesai' ? 'bs' : r.status === 'Proses' ? 'bp' : r.status === 'Menunggu' ? 'bw' : 'bw';
            const biaya = r.biaya ? 'Rp ' + Number(r.biaya).toLocaleString() : '—';
            visitRows += `<tr>
                <td>${tgl}</td>
                <td>${r.poli?.nama_poli || 'UGD'}</td>
                <td>${r.penjamin || '—'}</td>
                <td><span class="b ${statusClass}">${r.status}</span></td>
                <td>${biaya}</td>
            </tr>`;
        });
    } else {
        visitRows = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Belum ada kunjungan</td></tr>';
    }

    detailContent.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:13px">
            <div><span style="color:var(--text-muted)">No.RM</span><div style="font-weight:700;font-family:monospace">${patient.no_rm || '—'}</div></div>
            <div><span style="color:var(--text-muted)">Nama</span><div style="font-weight:700">${patient.nama}</div></div>
            <div><span style="color:var(--text-muted)">Umur</span><div style="font-weight:600">${umur}th</div></div>
            <div><span style="color:var(--text-muted)">JK</span><div style="font-weight:600">${patient.jk === 'L' ? 'Laki-laki' : patient.jk === 'P' ? 'Perempuan' : '—'}</div></div>
            <div><span style="color:var(--text-muted)">Tgl Lahir</span><div style="font-weight:600">${patient.tgl_lahir ? new Date(patient.tgl_lahir).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div></div>
            <div><span style="color:var(--text-muted)">Agama</span><div style="font-weight:600">${patient.agama || '—'}</div></div>
            <div><span style="color:var(--text-muted)">Alamat</span><div style="font-weight:600">${patient.alamat || '—'}</div></div>
            <div><span style="color:var(--text-muted)">No. HP</span><div style="font-weight:600">${patient.no_hp || '—'}</div></div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:7px">📋 Riwayat Kunjungan — <strong>${kunjunganCount} kunjungan</strong></div>
        <table class="t"><thead><tr><th>Tanggal</th><th>Poli</th><th>Penjamin</th><th>Status</th><th>Biaya</th></tr></thead><tbody>${visitRows}</tbody></table>
    `;

    // Scroll detail into view
    detailDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function printRMDetail() {
    const content = document.getElementById('rm-detail-content');
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return showToast('Izinkan popup untuk mencetak');
    w.document.write(`<html><head><title>Rekam Medis</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
        h2 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 10px 0; }
        .info div { padding: 3px 0; }
        .label { color: #666; }
    </style></head><body>
    <h2>Rekam Medis</h2>
    ${content.innerHTML}
    <script>window.print();window.close();<\/script>
    </body></html>`);
    w.document.close();
}

// ===== SDM & DOKTER — from Supabase =====
async function loadSDM() {
    const container = document.getElementById('sdm-container');
    if (!container) return;

    container.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Memuat data SDM...</div>';

    await SharedState.waitReady();

    // Get doctors with poli info
    const { data: doctors } = await window.__sb
        .from('doctors')
        .select('*, poli(nama_poli)')
        .order('nama_dokter', { ascending: true });

    if (!doctors || doctors.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:10px">👥</div>Tidak ada data dokter</div>';
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin; // minutes since midnight

    function parseJadwal(jadwalStr) {
        if (!jadwalStr) return null;
        // Format: "13:00–15:00" or "08:00-12:00"
        const parts = jadwalStr.split(/[–\-]/);
        if (parts.length < 2) return null;
        const startParts = parts[0].trim().split(':');
        const endParts = parts[1].trim().split(':');
        if (startParts.length < 2 || endParts.length < 2) return null;
        const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        return { start: startMin, end: endMin, text: jadwalStr };
    }

    function getStatus(jadwal) {
        if (!jadwal) return { label: 'Tidak Ada Jadwal', cls: 'bg' };
        if (currentTime < jadwal.start) return { label: 'Akan Praktik', cls: 'bw' };
        if (currentTime >= jadwal.start && currentTime <= jadwal.end) return { label: 'Praktik', cls: 'bp' };
        return { label: 'Selesai', cls: 'bs' };
    }

    let rows = '';
    doctors.forEach(d => {
        const jadwal = parseJadwal(d.jadwal_praktik);
        const status = getStatus(jadwal);
        const poliName = d.poli?.nama_poli || '—';
        rows += `<tr>
            <td><strong>${d.nama_dokter}</strong></td>
            <td>${d.spesialis || '—'}</td>
            <td>${poliName}</td>
            <td>${jadwal ? jadwal.text : '—'}</td>
            <td><span class="b ${status.cls}">${status.label}</span></td>
        </tr>`;
    });

    container.innerHTML = `
        <div class="card" style="margin-bottom:0">
            <div class="ch"><div class="ct">👨‍⚕️ Jadwal Praktik Dokter Hari Ini</div>
            <span style="font-size:11px;color:var(--text-muted)">${doctors.length} dokter terdaftar</span></div>
            <div style="overflow-x:auto">
                <table class="t">
                    <thead><tr><th>Nama Dokter</th><th>Spesialisasi</th><th>Poli</th><th>Jam Praktik</th><th>Status</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// ===== DETAIL MODAL FUNCTIONS =====
function showDetail(title, html) {
    document.getElementById('dtl-title').textContent = title;
    document.getElementById('dtl-body').innerHTML = html;
    showM('mdl-detail');
}

async function showLabDetail(id) {
    showDetail('🔍 Detail Lab', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: r } = await window.__sb.from('lab_requests').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!r) return showDetail('🔍 Detail Lab', '<div style="padding:20px;text-align:center;color:var(--danger)\">Data tidak ditemukan</div>');
    const p = r.patients;
    const cls = r.status === 'Selesai' ? 'bs' : r.status === 'Diproses' ? 'bp' : r.status === 'Diterima' ? 'bi' : 'bw';
    
    const sudahDiambil = r.sampel_status === 'Diambil';
    const sudahSelesai = r.status === 'Selesai';

    let actionBtns = '';
    if (!sudahDiambil) {
        actionBtns += `<button class="btn btn-p" style="width:100%" onclick="labAmbilSampel('${id}')">🧪 Ambil Sampel</button>`;
    } else if (!sudahSelesai) {
        actionBtns += `<button class="btn btn-success" style="width:100%" onclick="labSelesai('${id}')">✅ Selesai — Input Hasil</button>`;
    }

    showDetail('🧪 Detail Lab — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Lab</span><div style="font-weight:700;font-family:monospace">${r.no_lab||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Asal</span><div style="font-weight:700">${r.asal||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Sampel</span><div style="font-weight:700">${r.sampel_status||'Belum'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${cls}">${r.status||'—'}</span></div></div>
        </div>
        <div><strong>Jenis Pemeriksaan:</strong> ${r.jenis_pemeriksaan||'—'}</div>
        ${r.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${r.catatan}</div>` : ''}
        ${r.hasil ? `<div style="margin-top:6px;background:var(--bg);padding:8px;border-radius:6px"><strong>Hasil:</strong> ${r.hasil}</div>` : ''}
        ${actionBtns ? `<div style="display:flex;flex-direction:column;gap:7px;margin-top:13px">${actionBtns}</div>` : ''}`);
}

async function labAmbilSampel(id) {
    const btn = document.querySelector('button[onclick*="labAmbilSampel"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }
    const { error } = await window.__sb.from('lab_requests').update({ sampel_status: 'Diambil', status: 'Diproses' }).eq('id', id);
    if (error) { showToast(' Gagal: ' + error.message); if(btn){btn.disabled=false;btn.textContent='🧪 Ambil Sampel';} return; }
    showToast(' Sampel berhasil diambil!');
    showLabDetail(id);
    loadLab();
}

async function labSelesai(id) {
    // Prompt hasil
    const hasil = prompt('📋 Input hasil pemeriksaan lab:');
    if (hasil === null) return; // batal
    const btn = document.querySelector('button[onclick*="labSelesai"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }
    const { error } = await window.__sb.from('lab_requests').update({ 
        status: 'Selesai', hasil: hasil.trim()
    }).eq('id', id);
    if (error) { showToast(' Gagal: ' + error.message); if(btn){btn.disabled=false;btn.textContent='✅ Selesai';} return; }
    showToast(' Hasil lab tersimpan!');
    showLabDetail(id);
    loadLab();
}

async function showRadDetail(id) {
    showDetail('🔍 Detail Radiologi', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: r } = await window.__sb.from('radiology_requests').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!r) return showDetail('🔍 Detail Radiologi', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = r.patients;
    const cls = r.status === 'Selesai' || r.status === 'Hasil Siap' ? 'bs' : r.status === 'Diproses' ? 'bp' : 'bw';
    const sudahSelesai = r.status === 'Selesai' || r.status === 'Hasil Siap';

    // Scan preview / upload
    let scanSection = '';
    if (r.scan_url) {
        scanSection = `
            <div style="margin-top:10px">
                <strong>📷 Scan Radiologi</strong>
                <div style="margin-top:4px;max-width:100%;border-radius:6px;overflow:hidden;border:1px solid var(--border)">
                    <img src="${r.scan_url}" style="width:100%;display:block" alt="Scan radiologi" />
                </div>
            </div>`;
    }
    if (!sudahSelesai) {
        scanSection += `
            <div style="margin-top:10px;padding:11px;background:var(--bg);border-radius:6px">
                <strong>📷 Upload Scan Radiologi</strong>
                <div style="margin-top:6px;display:flex;gap:6px">
                    <input type="file" accept="image/*" id="rad-scan-input" style="flex:1" onchange="radUploadScan(this, '${id}')" />
                </div>
                <div id="rad-scan-preview" style="margin-top:6px"></div>
            </div>`;
    }

    // Action buttons
    let actionBtns = '';
    if (!sudahSelesai) {
        actionBtns = `
            <div style="display:flex;flex-direction:column;gap:7px;margin-top:13px">
                <button class="btn btn-success" style="width:100%" onclick="radSelesai('${id}')">✅ Selesai — Input Hasil</button>
            </div>`;
    }

    showDetail('🔬 Detail Radiologi — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Rad</span><div style="font-weight:700;font-family:monospace">${r.no_rad||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Asal</span><div style="font-weight:700">${r.asal||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${cls}">${r.status||'—'}</span></div></div>
        </div>
        <div><strong>Jenis Pemeriksaan:</strong> ${r.jenis_pemeriksaan||'—'}</div>
        ${r.catatan_klinis ? `<div style="margin-top:6px"><strong>Catatan Klinis:</strong> ${r.catatan_klinis}</div>` : ''}
        ${r.hasil ? `<div style="margin-top:6px;background:var(--bg);padding:8px;border-radius:6px"><strong>Hasil:</strong> ${r.hasil}</div>` : ''}
        ${scanSection}
        ${actionBtns}`);
}

async function radUploadScan(input, id) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast(' Ukuran file maksimal 5MB');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
        const dataUrl = e.target.result;
        // Show preview
        document.getElementById('rad-scan-preview').innerHTML =
            `<img src="${dataUrl}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid var(--border)" />`;
        // Save to DB
        const btn = document.querySelector('button[onclick*="radSelesai"]');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan scan...'; }
        const { error } = await window.__sb.from('radiology_requests').update({ scan_url: dataUrl }).eq('id', id);
        if (error) { showToast(' Gagal upload scan: ' + error.message); }
        if (btn) { btn.disabled = false; btn.textContent = '✅ Selesai — Input Hasil'; }
    };
    reader.readAsDataURL(file);
}

async function radSelesai(id) {
    const hasil = prompt('📋 Input hasil / kesimpulan pemeriksaan radiologi:');
    if (hasil === null) return;
    const btn = document.querySelector('button[onclick*="radSelesai"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }
    const { error } = await window.__sb.from('radiology_requests').update({
        status: 'Selesai',
        hasil: hasil.trim()
    }).eq('id', id);
    if (error) { showToast(' Gagal: ' + error.message); if(btn){btn.disabled=false;btn.textContent='✅ Selesai — Input Hasil';} return; }
    showToast(' Hasil radiologi tersimpan!');
    showRadDetail(id);
    loadRad();
}

async function showFarmasiDetail(id) {
    showDetail('🔍 Detail Resep', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: r } = await window.__sb.from('prescriptions').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!r) return showDetail('🔍 Detail Resep', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = r.patients;
    const sCls = r.status === 'Siap Ambil' || r.status === 'Selesai' ? 'bs' : r.status === 'Diproses' ? 'bp' : 'bw';
    const sudahSelesai = r.status === 'Selesai';
    showDetail('💊 Detail Resep — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Resep</span><div style="font-weight:700;font-family:monospace">${r.no_resep||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${sCls}">${r.status||'—'}</span></div></div>
            <div><span style="color:var(--text-muted)">Total</span><div style="font-weight:700;color:var(--primary)">Rp ${(r.total||0).toLocaleString()}</div></div>
        </div>
        ${r.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${r.catatan}</div>` : ''}
        ${!sudahSelesai ? `<button class="btn btn-p" style="width:100%;margin-top:13px" onclick="farmasiSelesai('${id}')">✅ Selesai — Lanjut ke Kasir</button>` : ''}`);
}

async function farmasiSelesai(id) {
    const btn = document.querySelector('button[onclick*="farmasiSelesai"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

    try {
        // Fetch prescription with patient data + items
        const { data: r, error: fe } = await window.__sb
            .from('prescriptions')
            .select('*, patients!inner(id, no_rm, nama)')
            .eq('id', id)
            .single();
        if (fe || !r) throw new Error(fe?.message || 'Data tidak ditemukan');

        // Get prescription items to calculate real total
        const { data: items } = await window.__sb
            .from('prescription_items')
            .select('subtotal')
            .eq('prescription_id', id);
        const total = (items || []).reduce((sum, i) => sum + Number(i.subtotal || 0), 0) || 0;

        const p = r.patients;
        if (total <= 0) throw new Error('Tagihan Rp 0 — tidak ada item obat atau subtotal belum diisi');

        // 1. Update prescription status + total
        const { error: ue } = await window.__sb
            .from('prescriptions')
            .update({ status: 'Selesai', total, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (ue) throw new Error('Gagal update status: ' + ue.message);

        // 2. Create payment record for kasir
        const noReg = r.no_resep || 'RX-' + Date.now().toString(36).toUpperCase();
        const { error: pe } = await window.__sb.from('payments').insert({
            no_reg: noReg,
            patient_id: p.id,
            penjamin: 'Umum',
            total_tagihan: total,
            metode: 'Tunai',
            status: 'Belum Bayar',
            bayar: 0,
            kembalian: 0
        });
        if (pe) throw new Error('Gagal buat tagihan: ' + pe.message);

        // 3. Close detail modal, navigate to kasir, refresh
        hideM('mdl-detail');
        go('kasir');
        showToast(' Resep selesai — tagihan Rp ' + total.toLocaleString() + ' dikirim ke Kasir');
    } catch (e) {
        showToast(' ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '✅ Selesai — Lanjut ke Kasir'; }
    }
}

async function showOKDetail(id) {
    showDetail('🔍 Detail Operasi', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: s } = await window.__sb.from('surgery_schedule').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!s) return showDetail('🔍 Detail Operasi', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = s.patients;
    const sCls = s.status === 'Selesai' ? 'bs' : s.status === 'Berjalan' ? 'bp' : s.status === 'Dijadwalkan' ? 'bw' : 'bd';
    const canSelesai = s.status !== 'Selesai';

    let actions = '';
    if (canSelesai) {
        actions = `<div style="margin-top:14px;padding:11px;background:var(--card-bg);border-radius:8px;border:1px solid var(--border)">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">💰 Biaya Tindakan</label>
            <div style="display:flex;gap:8px">
                <input id="ok-biaya" type="number" min="0" step="1000" value="${s.biaya || 0}" placeholder="Rp" style="flex:1;padding:8px 11px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px">
                <button class="btn btn-s btn-sm" onclick="selesaiOperasi('${s.id}')">✅ Selesai & Kirim ke Kasir</button>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">⏺ Biaya akan langsung masuk ke antrian Kasir sebagai tagihan</div>
        </div>`;
    }

    showDetail('🩺 Detail Operasi — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. OK</span><div style="font-weight:700;font-family:monospace">${s.no_ok||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Tindakan</span><div style="font-weight:700">${s.tindakan||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Dokter Operator</span><div style="font-weight:700">${s.dokter_operator||s.dokter||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${sCls}">${s.status||'—'}</span></div></div>
        </div>
        ${s.diagnosa ? `<div style="margin-top:6px"><strong>Diagnosa:</strong> ${s.diagnosa}</div>` : ''}
        ${s.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${s.catatan}</div>` : ''}
        ${actions}`);
}

async function selesaiOperasi(id) {
    const biaya = parseInt(document.getElementById('ok-biaya')?.value) || 0;
    if (biaya <= 0) { showToast(' Isi dulu biaya tindakan!'); return; }
    if (!confirm('💰 Konfirmasi operasi selesai dengan biaya Rp ' + biaya.toLocaleString() + '?')) return;

    const btn = document.querySelector(`button[onclick*="selesaiOperasi('${id}'"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }

    // Ambil data pasien dulu
    const { data: s } = await window.__sb.from('surgery_schedule').select('*, patients!inner(id, no_rm, nama)').eq('id', id).single();
    if (!s) { showToast(' Data operasi tidak ditemukan'); return; }

    try {
        // 1. Update status operasi + biaya
        const { error: ue } = await window.__sb
            .from('surgery_schedule')
            .update({ status: 'Selesai', waktu_selesai: new Date().toISOString(), biaya })
            .eq('id', id);
        if (ue) throw new Error('Gagal update: ' + ue.message);

        // 2. Buat tagihan di kasir
        const p = s.patients;
        const noReg = s.no_operasi || 'OK-' + Date.now().toString(36).toUpperCase();
        const { error: pe } = await window.__sb.from('payments').insert({
            no_reg: noReg,
            patient_id: p.id,
            penjamin: 'Umum',
            total_tagihan: biaya,
            metode: 'Tunai',
            status: 'Belum Bayar',
            bayar: 0,
            kembalian: 0
        });
        if (pe) throw new Error('Gagal buat tagihan: ' + pe.message);

        showToast(' Operasi selesai — tagihan Rp ' + biaya.toLocaleString() + ' masuk ke Kasir');
        hideM('mdl-detail');
        loadOK();
    } catch (e) {
        showToast(' ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '✅ Selesai & Kirim ke Kasir'; }
    }
}

// ===== LABORATORIUM — from lab_requests table =====
async function loadLab() {
    const statsDiv = document.getElementById('lab-stats');
    const tableDiv = document.getElementById('lab-table');
    if (!tableDiv) return;

    // Query lab_requests + join patients
    const { data: labReqs } = await window.__sb
        .from('lab_requests')
        .select('*, patients!inner(no_rm, nama)')
        .order('created_at', { ascending: false });

    if (!labReqs) {
        if (statsDiv) statsDiv.innerHTML = '<div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">❌</div><div class="sl">Gagal memuat data</div></div>';
        return;
    }

    // Stats
    const total = labReqs.length;
    const menunggu = labReqs.filter(r => r.status === 'Menunggu').length;
    const diproses = labReqs.filter(r => r.status === 'Diproses').length;
    const selesai = labReqs.filter(r => r.status === 'Selesai').length;

    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="sc"><div class="sb" style="background:var(--primary)"></div><div class="sv" style="color:var(--primary)">${total}</div><div class="sl">Total Permintaan</div></div>
            <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning)">${menunggu}</div><div class="sl">Menunggu</div></div>
            <div class="sc"><div class="sb" style="background:var(--info)"></div><div class="sv" style="color:var(--info)">${diproses}</div><div class="sl">Diproses</div></div>
            <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success)">${selesai}</div><div class="sl">Selesai</div></div>`;
    }

    // Render table
    let rows = '';
    labReqs.forEach(r => {
        const p = r.patients;
        const nama = p ? p.nama : '—';
        const sampelCls = r.sampel_status === 'Diambil' ? 'bs' : 'bw';
        const statusCls = r.status === 'Selesai' ? 'bs'
            : r.status === 'Diproses' ? 'bp'
            : r.status === 'Diterima' ? 'bi'
            : 'bw';
        const sampelLabel = r.sampel_status || 'Belum';

        rows += `<tr>
            <td class="mono">${r.no_lab || '—'}</td>
            <td><strong>${nama}</strong></td>
            <td>${r.jenis_pemeriksaan || '—'}</td>
            <td>${r.asal || '—'}</td>
            <td><span class="b ${sampelCls}">${sampelLabel}</span></td>
            <td><span class="b ${statusCls}">${r.status || '—'}</span></td>
            <td><button class="btn btn-o btn-xs" onclick="showLabDetail('${r.id}')">Detail</button></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Tidak ada data laboratorium</td></tr>';
    }

    tableDiv.innerHTML = `<table class="t"><thead><tr><th>No.Lab</th><th>Nama Pasien</th><th>Jenis Pemeriksaan</th><th>Asal</th><th>Sampel</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== LAB REGISTRATION =====
let _labPatientId = null;

function searchLabPatient() {
    const q = document.getElementById('lab-search-input')?.value.trim();
        if (!q) return;
        SharedState.waitReady().then(() => {
            const ps = (SharedState.cache.patients||[]).filter(p => p.nama?.toLowerCase().includes(q.toLowerCase()) || p.no_rm?.includes(q) || p.nik?.includes(q));
            const r = document.getElementById('lab-search-results');
            if (!ps.length) { r.innerHTML = '<div style="padding:8px;color:var(--text-muted)">Pasien tidak ditemukan</div>'; return; }
            r.innerHTML = ps.slice(0,6).map(p => `<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between" onclick="selectLabPatient('${p.id}','${p.nama.replace(/'/g,"\\'")}')"><strong>${p.nama}</strong><span style="color:var(--text-muted)">${p.no_rm||'—'}</span></div>`).join('');
        });
    }

    function selectLabPatient(id, nama) {
        _labPatientId = id;
        document.getElementById('lab-selected-patient').innerHTML = `<strong>${nama}</strong>`;
        document.getElementById('lab-search-results').innerHTML = '';
        document.getElementById('lab-search-input').value = nama;
    }

    async function submitLabReg() {
        const btn = document.getElementById('btn-lab-submit');
        if (!_labPatientId) { showToast('Pilih pasien terlebih dahulu!'); return; }
        const asal = document.getElementById('lab-asal').value;
        const checked = [...document.querySelectorAll('#lab-checkbox-group input:checked')].map(c => c.value);
        if (!checked.length) { showToast('Pilih minimal satu jenis pemeriksaan!'); return; }
        const catatan = document.getElementById('lab-catatan').value.trim();
        btn.disabled = true; btn.textContent = '⏳ Mendaftarkan...';
        const noLab = 'LAB-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + String(Date.now() % 10000).padStart(4,'0');
        const { error } = await window.__sb.from('lab_requests').insert({
            no_lab: noLab, patient_id: _labPatientId, jenis_pemeriksaan: checked.join(', '),
            asal, catatan, status: 'Menunggu', sampel_status: 'Belum'
        });
        if (error) { showToast('' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pemeriksaan'; return; }
        showToast(' ' + noLab + ' — Registrasi berhasil!');
        hideM('mdl-lab-reg');
        _labPatientId = null;
        document.getElementById('lab-search-input').value = '';
        document.getElementById('lab-selected-patient').innerHTML = '—';
        loadLab();
    }

// ===== RADIOLOGI REGISTRATION =====
let _radPatientId = null;

function searchRadPatient() {
    const q = document.getElementById('rad-search-input')?.value.trim();
    if (!q) return;
    SharedState.waitReady().then(() => {
        const ps = (SharedState.cache.patients||[]).filter(p => p.nama?.toLowerCase().includes(q.toLowerCase()) || p.no_rm?.includes(q));
        const r = document.getElementById('rad-search-results');
        if (!ps.length) { r.innerHTML = '<div style="padding:8px;color:var(--text-muted)">Pasien tidak ditemukan</div>'; return; }
        r.innerHTML = ps.slice(0,6).map(p => `<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between" onclick="selectRadPatient('${p.id}','${p.nama}')"><strong>${p.nama}</strong><span style="color:var(--text-muted)">${p.no_rm||'—'}</span></div>`).join('');
    });
}

function selectRadPatient(id, nama) {
    _radPatientId = id;
    document.getElementById('rad-selected-patient').innerHTML = `<strong>${nama}</strong>`;
    document.getElementById('rad-search-results').innerHTML = '';
    document.getElementById('rad-search-input').value = nama;
}

async function submitRadReg() {
    const btn = document.getElementById('btn-rad-submit');
    if (!_radPatientId) { showToast('Pilih pasien terlebih dahulu!'); return; }
    const asal = document.getElementById('rad-asal').value;
    const jenis = document.getElementById('rad-jenis').value;
    const catatan = document.getElementById('rad-catatan').value.trim();
    btn.disabled = true; btn.textContent = '⏳ Mendaftarkan...';
    const noRad = 'RAD-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + String(Date.now() % 10000).padStart(4,'0');
    const { error } = await window.__sb.from('radiology_requests').insert({
        no_rad: noRad, patient_id: _radPatientId, jenis_pemeriksaan: jenis + (catatan ? ' — ' + catatan : ''),
        asal, catatan, status: 'Menunggu'
    });
    if (error) { showToast('' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pemeriksaan'; return; }
    showToast(' ' + noRad + ' — Registrasi berhasil!');
    hideM('mdl-rad-reg');
    _radPatientId = null;
    document.getElementById('rad-search-input').value = '';
    document.getElementById('rad-selected-patient').innerHTML = '—';
    loadRad();
}

async function loadRad() {
    const statsDiv = document.getElementById('rad-stats');
    const tableDiv = document.getElementById('rad-table');
    if (!tableDiv) return;

    // Query radiology_requests + join patients
    const { data: radReqs } = await window.__sb
        .from('radiology_requests')
        .select('*, patients!inner(no_rm, nama)')
        .order('created_at', { ascending: false });

    if (!radReqs) {
        if (statsDiv) statsDiv.innerHTML = '<div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">❌</div><div class="sl">Gagal memuat data</div></div>';
        return;
    }

    // Stats
    const total = radReqs.length;
    const menunggu = radReqs.filter(r => r.status === 'Menunggu').length;
    const diproses = radReqs.filter(r => r.status === 'Diproses').length;
    const hasilsiap = radReqs.filter(r => r.status === 'Selesai' || r.status === 'Hasil Siap').length;

    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="sc"><div class="sb" style="background:var(--primary)"></div><div class="sv" style="color:var(--primary)">${total}</div><div class="sl">Total Pemeriksaan</div></div>
            <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning)">${menunggu}</div><div class="sl">Menunggu</div></div>
            <div class="sc"><div class="sb" style="background:var(--info)"></div><div class="sv" style="color:var(--info)">${diproses}</div><div class="sl">Diproses</div></div>
            <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success)">${hasilsiap}</div><div class="sl">Hasil Siap</div></div>`;
    }

    // Render table
    let rows = '';
    radReqs.forEach(r => {
        const p = r.patients;
        const nama = p ? p.nama : '—';
        const statusCls = r.status === 'Selesai' || r.status === 'Hasil Siap' ? 'bs'
            : r.status === 'Diproses' ? 'bp'
            : 'bw';

        rows += `<tr>
            <td class="mono">${r.no_rad || '—'}</td>
            <td><strong>${nama}</strong></td>
            <td>${r.jenis_pemeriksaan || '—'}</td>
            <td>${r.dokter || '—'}</td>
            <td><span class="b ${statusCls}">${r.status || '—'}</span></td>
            <td><button class="btn btn-o btn-xs" onclick="showRadDetail('${r.id}')">Detail</button></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Tidak ada data radiologi</td></tr>';
    }

    tableDiv.innerHTML = `<table class="t"><thead><tr><th>No.Rad</th><th>Nama Pasien</th><th>Jenis Pemeriksaan</th><th>Dokter</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== FARMASI — from prescriptions & medicines tables =====
async function loadFarmasi() {
    const statsDiv = document.getElementById('far-stats');
    if (!statsDiv) return;

    const { count: rxCount } = await window.__sb
        .from('prescriptions')
        .select('id', { count: 'exact', head: true });

    const { count: medCount } = await window.__sb
        .from('medicines')
        .select('id', { count: 'exact', head: true });

    const { data: medicines } = await window.__sb
        .from('medicines')
        .select('stok, stok_minimum');

    const menipis = (medicines || []).filter(m => m.stok <= m.stok_minimum && m.stok > 0).length;
    const kritis = (medicines || []).filter(m => m.stok <= 0 || m.stok <= (m.stok_minimum * 0.5)).length;

    statsDiv.innerHTML = `
        <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success)">${rxCount || 0}</div><div class="sl">Resep Hari Ini</div></div>
        <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning)">${menipis}</div><div class="sl">Stok Menipis</div></div>
        <div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">${kritis}</div><div class="sl">Stok Kritis</div></div>
        <div class="sc"><div class="sb" style="background:var(--info)"></div><div class="sv" style="color:var(--info)">${medCount || 0}</div><div class="sl">Total Item Obat</div></div>`;

    // Load active tab
    const rxTab = document.getElementById('far-rx');
    if (rxTab && rxTab.style.display !== 'none') loadFarRx();
    const stokTab = document.getElementById('far-stok');
    if (stokTab && stokTab.style.display !== 'none') loadFarStok();
}

async function loadFarRx() {
    const tableDiv = document.getElementById('far-rx-table');
    if (!tableDiv) return;

    tableDiv.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Memuat data resep...</div>';

    const { data: rx } = await window.__sb
        .from('prescriptions')
        .select('*, patients!inner(no_rm, nama)')
        .order('created_at', { ascending: false });

    if (!rx) {
        tableDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">❌ Gagal memuat data resep</div>';
        return;
    }

    // Count items per prescription
    const rxIds = rx.map(r => r.id);
    let itemsMap = {};
    if (rxIds.length > 0) {
        const { data: items } = await window.__sb
            .from('prescription_items')
            .select('prescription_id, jumlah, subtotal')
            .in('prescription_id', rxIds);
        (items || []).forEach(item => {
            if (!itemsMap[item.prescription_id]) itemsMap[item.prescription_id] = { count: 0, total: 0 };
            itemsMap[item.prescription_id].count += item.jumlah || 0;
            itemsMap[item.prescription_id].total += item.subtotal || 0;
        });
    }

    let rows = '';
    rx.forEach(r => {
        const p = r.patients;
        const itemInfo = itemsMap[r.id] || { count: 0, total: 0 };
        const statusCls = r.status === 'Siap Ambil' ? 'bs'
            : r.status === 'Diracik' ? 'bp'
            : r.status === 'Menunggu' ? 'bw'
            : 'bg';
        const totalStr = itemInfo.total ? 'Rp ' + Number(itemInfo.total).toLocaleString() : '—';

        rows += `<tr>
            <td class="mono">${r.no_resep || '—'}</td>
            <td><strong>${p ? p.nama : '—'}</strong></td>
            <td>${r.doctor_id || '—'}</td>
            <td>${r.unit || '—'}</td>
            <td>${itemInfo.count}</td>
            <td>${totalStr}</td>
            <td><span class="b ${statusCls}">${r.status || '—'}</span></td>
            <td><button class="btn btn-o btn-xs" onclick="showFarmasiDetail('${r.id}')">Detail</button></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Tidak ada resep hari ini</td></tr>';
    }

    tableDiv.innerHTML = `
        <div class="card"><div class="ch"><div class="ct">📋 Resep Masuk</div></div>
        <table class="t"><thead><tr><th>No.Resep</th><th>Nama Pasien</th><th>Dokter</th><th>Unit</th><th>Jml Item</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
}

async function loadFarStok() {
    const tableDiv = document.getElementById('far-stok-table');
    if (!tableDiv) return;

    tableDiv.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Memuat data stok...</div>';

    const { data: medicines } = await window.__sb
        .from('medicines')
        .select('*')
        .order('nama_obat', { ascending: true });

    if (!medicines) {
        tableDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">❌ Gagal memuat data stok</div>';
        return;
    }

    let rows = '';
    medicines.forEach(m => {
        let statusLabel, statusCls, rowCls;
        if (m.stok <= 0 || m.stok <= (m.stok_minimum * 0.5)) {
            statusLabel = 'Kritis';
            statusCls = 'bd';
            rowCls = 'row-u';
        } else if (m.stok <= m.stok_minimum) {
            statusLabel = 'Menipis';
            statusCls = 'bw';
            rowCls = 'row-u';
        } else {
            statusLabel = 'Normal';
            statusCls = 'bs';
            rowCls = '';
        }

        const ed = m.expired_date ? new Date(m.expired_date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '—';
        const harga = m.harga_satuan ? 'Rp ' + Number(m.harga_satuan).toLocaleString() : '—';
        const kat = m.kategori ? m.kategori.slice(0,4) : '—';

        rows += `<tr class="${rowCls}">
            <td class="mono">${m.kode || '—'}</td>
            <td><strong>${m.nama_obat}</strong></td>
            <td>${kat}</td>
            <td>${m.stok}</td>
            <td>${m.stok_minimum}</td>
            <td>${harga}</td>
            <td style="font-size:11px">${ed}</td>
            <td><span class="b ${statusCls}">${statusLabel}</span></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Tidak ada data obat</td></tr>';
    }

    tableDiv.innerHTML = `
        <div class="srch"><input class="fc" style="max-width:260px" placeholder="🔍 Cari nama obat..."><select class="fc" style="max-width:140px"><option>Semua Kategori</option><option>Tablet</option><option>Kapsul</option><option>Injeksi</option><option>Infus</option></select><button class="btn btn-p btn-sm">Filter</button><button class="btn btn-o btn-sm" style="margin-left:auto" onclick="showMdlPenerimaanStok()">+ Penerimaan Stok</button></div>
        <div class="card"><div class="ch"><div class="ct">Daftar Stok Obat</div></div>
        <table class="t"><thead><tr><th>Kode</th><th>Nama Obat</th><th>Kat.</th><th>Stok</th><th>Min.Stok</th><th>Harga</th><th>ED</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
}

function showMdlPenerimaanStok() {
    // Reset form
    document.getElementById('ps-search-input').value = '';
    document.getElementById('ps-search-results').innerHTML = '';
    document.getElementById('ps-obat-terpilih').textContent = '—';
    document.getElementById('ps-obat-id').value = '';
    document.getElementById('ps-qty').value = '';
    document.getElementById('ps-harga').value = '';
    document.getElementById('ps-expired').value = '';
    document.getElementById('ps-keterangan').value = '';
    showM('mdl-penerimaan-stok');
}

async function searchObatPenerimaan() {
    const q = document.getElementById('ps-search-input').value.trim();
    const resultsDiv = document.getElementById('ps-search-results');
    if (!q) { resultsDiv.innerHTML = ''; return; }
    resultsDiv.innerHTML = '<div style="padding:6px;color:var(--text-muted)">⏳ Mencari...</div>';
    const { data: medicines } = await window.__sb
        .from('medicines')
        .select('id, kode, nama_obat, stok, satuan')
        .or(`nama_obat.ilike.%${q}%,kode.ilike.%${q}%`)
        .limit(10);
    if (!medicines || medicines.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:6px;color:var(--text-muted)">Tidak ditemukan</div>';
        return;
    }
    let html = '<div style="border:1px solid var(--border);border-radius:6px;max-height:200px;overflow-y:auto">';
    medicines.forEach(m => {
        html += `<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"
            onclick="pilihObatPenerimaan('${m.id}','${m.nama_obat.replace(/'/g, "\\'")}','${m.kode}','${m.stok}','${m.satuan}')"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
            <div><strong>${m.nama_obat}</strong><div style="font-size:11px;color:var(--text-muted)">${m.kode}</div></div>
            <div style="text-align:right;font-size:12px">Stok: ${m.stok} <span style="color:var(--text-muted)">${m.satuan||''}</span></div>
        </div>`;
    });
    html += '</div>';
    resultsDiv.innerHTML = html;
}

function pilihObatPenerimaan(id, nama, kode, stok, satuan) {
    document.getElementById('ps-obat-id').value = id;
    document.getElementById('ps-obat-terpilih').textContent = `${nama} (${kode}) — Stok saat ini: ${stok} ${satuan||''}`;
    document.getElementById('ps-search-results').innerHTML = '';
    document.getElementById('ps-search-input').value = nama;
    document.getElementById('ps-qty').focus();
}

async function submitPenerimaanStok() {
    const id = document.getElementById('ps-obat-id').value;
    const qty = parseInt(document.getElementById('ps-qty').value);
    if (!id || !qty || qty <= 0) {
        showToast(' Pilih obat dan masukkan jumlah yang valid');
        return;
    }
    const btn = document.querySelector('button[onclick*="submitPenerimaanStok"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan...'; }

    // Build update object
    const updateData = {};
    
    // Update stok: read current stok first, then add
    const { data: cur } = await window.__sb.from('medicines').select('stok, stok_minimum').eq('id', id).single();
    const stokBaru = (cur?.stok || 0) + qty;
    updateData.stok = stokBaru;

    // Update harga if provided
    const harga = document.getElementById('ps-harga').value.trim();
    if (harga) updateData.harga_satuan = parseInt(harga);

    // Update expired if provided
    const expired = document.getElementById('ps-expired').value;
    if (expired) updateData.expired_date = expired;

    const { error } = await window.__sb.from('medicines').update(updateData).eq('id', id);
    if (error) {
        showToast(' Gagal: ' + error.message);
        if (btn) { btn.disabled = false; btn.textContent = '📦 Simpan Penerimaan'; }
        return;
    }

    showToast(`✅ Penerimaan berhasil! Stok bertambah menjadi: ${stokBaru}`);
    hideM('mdl-penerimaan-stok');
    loadFarStok();
    loadFarmasi();
    if (btn) { btn.disabled = false; btn.textContent = '📦 Simpan Penerimaan'; }
}

// ===== KAMAR OPERASI — from surgery_schedule table =====
async function loadOK() {
    const statsDiv = document.getElementById('ok-stats');
    const tableDiv = document.getElementById('ok-table');
    if (!tableDiv) return;

    const { data: surgeries } = await window.__sb
        .from('surgery_schedule')
        .select('*, patients!inner(no_rm, nama)')
        .order('waktu_mulai', { ascending: true });

    if (!surgeries) {
        if (statsDiv) statsDiv.innerHTML = '<div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">❌</div><div class="sl">Gagal memuat data</div></div>';
        tableDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">❌ Gagal memuat jadwal operasi</div>';
        return;
    }

    // Stats
    const total = surgeries.length;
    const selesai = surgeries.filter(s => s.status === 'Selesai').length;
    const berjalan = surgeries.filter(s => s.status === 'Berjalan').length;
    const menunggu = surgeries.filter(s => s.status === 'Menunggu').length;

    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="sc"><div class="sb" style="background:var(--primary)"></div><div class="sv" style="color:var(--primary)">${total}</div><div class="sl">Operasi Hari Ini</div></div>
            <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success)">${selesai}</div><div class="sl">Selesai</div></div>
            <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning)">${berjalan}</div><div class="sl">Sedang Berjalan</div></div>
            <div class="sc"><div class="sb" style="background:var(--text-muted)"></div><div class="sv">${menunggu}</div><div class="sl">Menunggu</div></div>`;
    }

    // Render table
    let rows = '';
    surgeries.forEach(s => {
        const p = s.patients;
        const waktu = s.waktu_mulai ? new Date(s.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
        const statusCls = s.status === 'Selesai' ? 'bs'
            : s.status === 'Berjalan' ? 'bw'
            : 'bg';
        const rowCls = s.status === 'Berjalan' ? 'row-n' : '';
        const klasCls = s.klasifikasi === 'Cito Mayor' || s.klasifikasi === 'Cito Minor' ? 'bd'
            : s.klasifikasi === 'Elektif Mayor' ? 'bw'
            : 'bi';

        rows += `<tr class="${rowCls}">
            <td><strong>${waktu}</strong></td>
            <td>${s.kamar_ok || '—'}</td>
            <td>${p ? p.nama : '—'}</td>
            <td>${s.tindakan || '—'}</td>
            <td><span class="b ${klasCls}">${s.klasifikasi || '—'}</span></td>
            <td>${s.dokter_operator || '—'}</td>
            <td><span class="b ${statusCls}">${s.status || '—'}</span></td>
            <td><button class="btn btn-o btn-xs" onclick="showOKDetail('${s.id}')">Detail</button></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Tidak ada jadwal operasi hari ini</td></tr>';
    }

    tableDiv.innerHTML = `<table class="t"><thead><tr><th>Waktu</th><th>Kamar OK</th><th>Pasien</th><th>Tindakan</th><th>Klasifikasi</th><th>Dokter Operator</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== KASIR & PEMBAYARAN =====
async function loadKasir() {
    const sidebar = document.getElementById('kasir-sidebar');
    const tableDiv = document.getElementById('kasir-table');
    if (!sidebar && !tableDiv) return;

    // Query payments today with patient info
    const today = new Date().toISOString().slice(0, 10);
    const { data: payments } = await window.__sb
        .from('payments')
        .select('*, patients!inner(no_rm, nama)')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

    if (!payments) {
        if (sidebar) sidebar.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">❌ Gagal memuat data</div>';
        return;
    }

    // === Count & Group ===
    const totalTransaksi = payments.length;
    const tunai = payments.filter(p => p.metode === 'Tunai');
    const transfer = payments.filter(p => p.metode === 'Transfer' || p.metode === 'QRIS');
    const bpjs = payments.filter(p => p.metode === 'BPJS');
    const asuransi = payments.filter(p => p.metode === 'Asuransi');

    const sumTunai = tunai.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const sumTransfer = transfer.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const sumBpjs = bpjs.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const sumAsuransi = asuransi.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const grandTotal = payments.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);

    // Count by status
    const selesai = payments.filter(p => p.status === 'Lunas').length;
    const menunggu = payments.filter(p => p.status === 'Menunggu' || p.status === 'Belum Bayar').length;

    // === Render Sidebar ===
    if (sidebar) {
        sidebar.innerHTML = `<div style="display:flex;flex-direction:column;gap:13px">
            <div class="card" style="margin-bottom:0"><div class="ch"><div class="ct">🎫 Antrian Kasir</div></div>
            <div style="padding:11px">
                <div class="qb on" style="margin-bottom:8px;padding:13px"><div class="ql">Antrian Hari Ini</div><div class="qn" style="font-size:34px">${totalTransaksi}</div><div class="qt">Transaksi tercatat</div></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:8px">
                    <div class="qb"><div class="ql">Menunggu</div><div class="qn" style="font-size:22px;color:var(--warning)">${menunggu}</div></div>
                    <div class="qb"><div class="ql">Lunas</div><div class="qn" style="font-size:22px;color:var(--success)">${selesai}</div></div>
                </div>
            </div>
            </div>
            <div class="card" style="margin-bottom:0"><div class="ch"><div class="ct">📊 Rekap Kasir Hari Ini</div></div>
            <div style="padding:11px;font-size:13px">
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Total Transaksi</span><strong>${totalTransaksi}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Tunai</span><strong style="color:var(--success)">Rp ${sumTunai.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Transfer/QRIS</span><strong style="color:var(--info)">Rp ${sumTransfer.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>BPJS</span><strong style="color:var(--warning)">Rp ${sumBpjs.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span>Asuransi</span><strong style="color:var(--accent)">Rp ${sumAsuransi.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:14px"><span style="font-weight:700">Total</span><strong style="color:var(--primary)">Rp ${grandTotal.toLocaleString()}</strong></div>
            </div>
            </div>
        </div>`;
    }

    // === Render SEP & Nota from first valid payment ===
    const sepDiv = document.getElementById('kasir-sep');
    const notaDiv = document.getElementById('kasir-nota');
    const firstValid = payments.find(p => Number(p.total_tagihan || 0) > 0);
    if (firstValid) {
        const first = firstValid;
        const nama = first.patients?.nama || '—';
        const total = Number(first.total_tagihan || 0);
        const bayar = Number(first.bayar || 0);
        const kembalian = bayar > total ? bayar - total : 0;
        const sepNum = first.no_reg ? first.no_reg.replace(/[^0-9]/g,'').slice(0,20) : '0222R00060322V001210';
        if (sepDiv) {
            sepDiv.innerHTML = `<div class="sep-box">
                <div class="sep-tit">Surat Eligibilitas Peserta (SEP) — BPJS Kesehatan</div>
                <div class="sep-num">${sepNum}</div>
                <div class="sep-g">
                    <div class="sep-item"><div class="lbl">Nama Peserta</div><div class="val">${nama}</div></div>
                    <div class="sep-item"><div class="lbl">No. Kartu</div><div class="val">${first.patients?.no_rm || '00021635356338'}</div></div>
                    <div class="sep-item"><div class="lbl">Jenis Rawat</div><div class="val">Rawat Jalan</div></div>
                    <div class="sep-item"><div class="lbl">Poli</div><div class="val">Penyakit Dalam</div></div>
                    <div class="sep-item"><div class="lbl">Kelas Hak</div><div class="val">Kelas 3</div></div>
                    <div class="sep-item"><div class="lbl">Tgl SEP</div><div class="val">${new Date(first.created_at).toLocaleDateString('id-ID')}</div></div>
                </div>
                <div style="display:flex;gap:8px;margin-top:11px">
                    <button class="btn" style="flex:1;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:12px" onclick="printSEP()">🖨️ Print SEP</button>
                    <button class="btn" style="flex:1;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:12px" onclick="sepPDF()">📄 SEP PDF</button>
                </div>
            </div>`;
        }
        if (notaDiv) {
            notaDiv.innerHTML = `<div class="nota">
                <div class="nota-h"><div style="font-weight:700;font-size:13px">EDOY HOSPITAL MANAGEMENT</div><div style="font-size:11px;opacity:.8">Nota Pembayaran</div></div>
                <div class="nota-b">
                    <div class="rec">
                        <div class="rr"><span>No. Reg</span><span>${first.no_reg || '—'}</span></div>
                        <div class="rr"><span>Nama</span><span>${nama}</span></div>
                        <div class="rr"><span>Penjamin</span><span>${first.penjamin || 'Umum'}</span></div>
                        <hr class="rs">
                        <div class="rr"><span>Jasa Dokter</span><span>Rp ${Math.round(total * 0.43).toLocaleString()}</span></div>
                        <div class="rr"><span>Biaya Poli</span><span>Rp ${Math.round(total * 0.09).toLocaleString()}</span></div>
                        <div class="rr"><span>Obat</span><span>Rp ${Math.round(total * 0.45).toLocaleString()}</span></div>
                        <div class="rr"><span>Administrasi</span><span>Rp ${Math.round(total * 0.03).toLocaleString()}</span></div>
                        <hr class="rs">
                        <div class="rr" style="font-size:13px;font-weight:700"><span>TOTAL</span><span style="color:var(--primary)">Rp ${total.toLocaleString()}</span></div>
                        <hr class="rs">
                        ${first.status === 'Belum Bayar'
                            ? `<div class="rr"><span style="color:var(--warning);font-weight:700">Status</span><span style="color:var(--warning);font-weight:700">Belum Dibayar</span></div>`
                            : `<div class="rr"><span>Bayar (${first.metode || 'Tunai'})</span><span>Rp ${bayar.toLocaleString()}</span></div>
                               <div class="rr"><span style="color:var(--success);font-weight:700">Kembali</span><span style="color:var(--success);font-weight:700">Rp ${kembalian.toLocaleString()}</span></div>`}
                    </div>
                    <div style="display:flex;gap:8px;margin-top:11px">
                        <button class="btn btn-p" style="flex:1" onclick="prosesBayar()">✅ Proses Bayar</button>
                        <button class="btn btn-o btn-sm" onclick="cetakKwitansi('${(first.no_reg||'').replace(/'/g,"\\'")}','${nama.replace(/'/g,"\\'")}','${(first.penjamin||'Umum').replace(/'/g,"\\'")}',${total},${bayar},'${(first.metode||'Tunai').replace(/'/g,"\\'")}','${(first.status||'').replace(/'/g,"\\'")}','${new Date(first.created_at).toLocaleDateString('id-ID')}')">🖨️ Kwitansi</button>
                    </div>
                </div>
            </div>`;
        }
    } else {
        if (sepDiv) sepDiv.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">Belum ada transaksi hari ini</div>';
        if (notaDiv) notaDiv.innerHTML = '<div class="loader" style="text-align:center;padding:40px;color:var(--text-muted)">Belum ada transaksi hari ini</div>';
    }

    // === Render Table ===
    if (tableDiv) {
        let rows = '';
        payments.forEach(p => {
            const nama = p.patients?.nama || '—';
            const metodeCls = p.metode === 'Tunai' ? 'bp'
                : p.metode === 'Transfer' || p.metode === 'QRIS' ? 'bi'
                : p.metode === 'BPJS' ? 'bw'
                : 'bg';
            const statusCls = p.status === 'Lunas' ? 'bs'
                : p.status === 'Belum Bayar' || p.status === 'Menunggu' ? 'bw'
                : 'bg';
            rows += `<tr>
                <td class="mono">${p.no_reg || String(p.id).slice(0,6).toUpperCase()}</td>
                <td><strong>${nama}</strong></td>
                <td><span class="b ${p.penjamin === 'BPJS' ? 'bi' : p.penjamin === 'Asuransi' ? 'bw' : 'bp'}">${p.penjamin || 'Umum'}</span></td>
                <td>Rp ${Number(p.total_tagihan || 0).toLocaleString()}</td>
                <td><span class="b ${metodeCls}">${p.metode || '—'}</span></td>
                <td><span class="b ${statusCls}">${p.status || '—'}</span></td>
                <td><button class="btn btn-o btn-xs" onclick="showDetailKwitansi('${(p.no_reg||'').replace(/'/g,"\\'")}','${nama.replace(/'/g,"\\'")}','${(p.penjamin||'Umum').replace(/'/g,"\\'")}',${p.total_tagihan||0},'${(p.metode||'').replace(/'/g,"\\'")}','${(p.status||'').replace(/'/g,"\\'")}')">Kwitansi</button></td>
            </tr>`;
        });
        if (!rows) {
            rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Belum ada transaksi hari ini</td></tr>';
        }
        tableDiv.innerHTML = `<div class="card"><div class="ch"><div class="ct">Riwayat Transaksi Hari Ini</div></div>
            <table class="t"><thead><tr><th>No.Reg</th><th>Nama</th><th>Penjamin</th><th>Total Tagihan</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    }
}

// ===== TAGIHAN =====
async function loadTagihan() {
    const statsDiv = document.getElementById('tag-stats');
    const tableDiv = document.getElementById('tag-table');
    if (!statsDiv && !tableDiv) return;

    // Query invoices with patient info
    const { data: invoices } = await window.__sb
        .from('invoices')
        .select('*, patients!inner(no_rm, nama)')
        .order('created_at', { ascending: false });

    if (!invoices) {
        if (statsDiv) statsDiv.innerHTML = '<div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">❌</div><div class="sl">Gagal memuat data</div></div>';
        return;
    }

    // === Stats: Sum by penjamin ===
    const bpjsPiutang = invoices.filter(i => i.penjamin === 'BPJS' && i.status !== 'Lunas');
    const asuransiPiutang = invoices.filter(i => i.penjamin === 'Asuransi' && i.status !== 'Lunas');
    const lunas = invoices.filter(i => i.status === 'Lunas');
    const pending = invoices.filter(i => i.status === 'Klaim Pending' || i.status === 'Belum Bayar');

    const sumBpjsPiutang = bpjsPiutang.reduce((s, i) => s + Number(i.total || 0), 0);
    const sumAsuransiPiutang = asuransiPiutang.reduce((s, i) => s + Number(i.total || 0), 0);
    const sumLunas = lunas.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalPending = pending.length;

    const fmt = (v) => 'Rp ' + Number(v).toLocaleString();

    if (statsDiv) {
        statsDiv.innerHTML = `
            <div class="sc"><div class="sb" style="background:var(--primary)"></div><div class="sv" style="color:var(--primary);font-size:19px">${fmt(sumBpjsPiutang)}</div><div class="sl">Piutang BPJS</div></div>
            <div class="sc"><div class="sb" style="background:var(--warning)"></div><div class="sv" style="color:var(--warning);font-size:19px">${fmt(sumAsuransiPiutang)}</div><div class="sl">Piutang Asuransi</div></div>
            <div class="sc"><div class="sb" style="background:var(--success)"></div><div class="sv" style="color:var(--success);font-size:19px">${fmt(sumLunas)}</div><div class="sl">Lunas</div></div>
            <div class="sc"><div class="sb" style="background:var(--info)"></div><div class="sv" style="color:var(--info)">${totalPending}</div><div class="sl">Klaim Pending</div></div>`;
    }

    // === Render Table ===
    if (tableDiv) {
        let rows = '';
        invoices.forEach(i => {
            const nama = i.patients?.nama || '—';
            const tgl = i.created_at ? new Date(i.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const total = Number(i.total || 0);
            const terbayar = Number(i.terbayar || 0);
            const sisa = Number(i.sisa || 0);
            const statusCls = i.status === 'Lunas' ? 'bs'
                : i.status === 'Klaim Pending' ? 'bw'
                : i.status === 'Belum Bayar' ? 'bg'
                : 'bw';
            rows += `<tr>
                <td class="mono">${i.no_tagihan || '—'}</td>
                <td><strong>${nama}</strong></td>
                <td><span class="b ${i.penjamin === 'BPJS' ? 'bi' : i.penjamin === 'Asuransi' ? 'bw' : 'bp'}">${i.penjamin || 'Umum'}</span></td>
                <td>${tgl}</td>
                <td>${fmt(total)}</td>
                <td>${fmt(terbayar)}</td>
                <td style="color:${sisa > 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${fmt(sisa)}</td>
                <td><span class="b ${statusCls}">${i.status || '—'}</span></td>
            </tr>`;
        });
        if (!rows) {
            rows = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">Belum ada data tagihan</td></tr>';
        }
        tableDiv.innerHTML = `<div class="card"><div class="ch"><div class="ct">Daftar Tagihan</div></div>
            <table class="t"><thead><tr><th>No.Tagihan</th><th>Pasien</th><th>Penjamin</th><th>Tanggal</th><th>Total</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    }
}

// ===== LAPORAN KEUANGAN =====
async function loadLaporan() {
    // Query payments — hitung total pendapatan (Lunas)
    const { data: payments } = await window.__sb
        .from('payments')
        .select('total_tagihan,penjamin,created_at')
        .eq('status', 'Lunas');

    if (!payments) {
        const finM = document.getElementById('fin-m');
        if (finM) finM.textContent = '❌ Gagal memuat';
        return;
    }

    const fmt = (v) => 'Rp ' + Number(v).toLocaleString();

    // Total pendapatan
    const totalPendapatan = payments.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const finM = document.getElementById('fin-m');
    if (finM) finM.textContent = totalPendapatan > 0 ? fmt(totalPendapatan) : 'Rp 0';

    // fin-g: group by penjamin
    const byPenjamin = {};
    payments.forEach(p => {
        const pen = p.penjamin || 'Umum';
        byPenjamin[pen] = (byPenjamin[pen] || 0) + Number(p.total_tagihan || 0);
    });

    const finG = document.getElementById('fin-g');
    if (finG) {
        const labels = { 'Umum': 'Rawat Jalan', 'BPJS': 'Rawat Inap', 'Asuransi': 'Farmasi' };
        const icons = { 'Umum': '🏃', 'BPJS': '🛏️', 'Asuransi': '💊' };
        finG.innerHTML = Object.entries(labels).map(([pen, label]) => `
            <div class="fin-i"><div class="lbl">${icons[pen]||''} ${label}</div><div class="val">${fmt(byPenjamin[pen] || 0)}</div></div>
        `).join('');
    }

    // Tabel ringkasan layanan
    const tbody = document.getElementById('ringkasan-layanan');
    if (tbody) {
        // Query registrations untuk hitung kunjungan
        const { data: regs } = await window.__sb
            .from('registrations')
            .select('jenis_rawat,poli_id,status,penjamin');

        const regList = regs || [];

        const rows = [
            {
                layanan: 'Rawat Jalan',
                kunjungan: regList.filter(r => r.jenis_rawat === 'RJ' || (!r.jenis_rawat && r.poli_id)).length,
                total: byPenjamin['Umum'] || 0
            },
            {
                layanan: 'Rawat Inap',
                kunjungan: regList.filter(r => r.jenis_rawat === 'RI' || r.status === 'Opname').length,
                total: byPenjamin['BPJS'] || 0
            },
            {
                layanan: 'Farmasi',
                kunjungan: regList.filter(r => r.jenis_rawat === 'UGD' || (!r.jenis_rawat && !r.poli_id && r.status !== 'Opname')).length,
                total: byPenjamin['Asuransi'] || 0
            },
        ];
        const grandTotal = rows.reduce((s, r) => s + r.total, 0) || 1;
        tbody.innerHTML = rows.map(r => {
            const pct = Math.round((r.total / grandTotal) * 100);
            const hasData = r.total > 0 || r.kunjungan > 0;
            if (!hasData) {
                return `<tr><td>${r.layanan}</td><td>Belum ada data</td><td>${fmt(r.total)}</td><td><span class="b bw">0%</span></td></tr>`;
            }
            const cls = pct > 50 ? 'bp' : pct > 25 ? 'bi' : 'bw';
            return `<tr><td>${r.layanan}</td><td>${r.kunjungan.toLocaleString()}</td><td>${fmt(r.total)}</td><td><span class="b ${cls}">${pct}%</span></td></tr>`;
        }).join('');
    }

    // Per penjamin — untuk progress bars
    const bpjs = byPenjamin['BPJS'] || 0;
    const umum = byPenjamin['Umum'] || 0;
    const asuransi = byPenjamin['Asuransi'] || 0;

    const maxVal = Math.max(bpjs, umum, asuransi, 1);
    const bpjsPct = Math.round((bpjs / maxVal) * 100);
    const umumPct = Math.round((umum / maxVal) * 100);
    const asuransiPct = Math.round((asuransi / maxVal) * 100);

    // Find progress bar containers
    const pbItems = document.querySelectorAll('#pg-laporan .card .pb');
    if (pbItems && pbItems.length >= 3) {
        pbItems[0].previousElementSibling.innerHTML = `<span style="font-weight:600">BPJS Kesehatan</span><span style="color:var(--text-muted)">${fmt(bpjs)}</span>`;
        pbItems[0].querySelector('.pf').style.width = bpjsPct + '%';
        pbItems[1].previousElementSibling.innerHTML = `<span style="font-weight:600">Umum</span><span style="color:var(--text-muted)">${fmt(umum)}</span>`;
        pbItems[1].querySelector('.pf').style.width = umumPct + '%';
        pbItems[2].previousElementSibling.innerHTML = `<span style="font-weight:600">Asuransi Swasta</span><span style="color:var(--text-muted)">${fmt(asuransi)}</span>`;
        pbItems[2].querySelector('.pf').style.width = asuransiPct + '%';
    }

    // Chart pendapatan harian (7 hari terakhir)
    const chartW = document.getElementById('chart-w');
    if (chartW) {
        const days = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days[key] = 0;
        }
        payments.forEach(p => {
            if (p.created_at) {
                const key = String(p.created_at).slice(0, 10);
                if (days[key] !== undefined) days[key] += Number(p.total_tagihan || 0);
            }
        });
        const maxValChart = Math.max(...Object.values(days), 1);
        const labels_map = { '0': 'Min', '1': 'Sen', '2': 'Sel', '3': 'Rab', '4': 'Kam', '5': 'Jum', '6': 'Sab' };
        const bars = Object.entries(days).map(([date, val]) => {
            const pct = Math.round((val / maxValChart) * 100);
            const day = new Date(date).getDay();
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="font-size:10px;color:var(--text-muted)">${fmt(val)}</div>
                <div style="width:100%;max-width:36px;height:80px;background:var(--bg);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden">
                    <div style="width:100%;height:${pct}%;background:var(--primary);border-radius:6px 6px 0 0;transition:height 0.3s"></div>
                </div>
                <div style="font-size:10px;color:var(--text-muted)">${labels_map[day] || date.slice(5)}</div>
            </div>`;
        }).join('');
        chartW.innerHTML = `<div style="display:flex;gap:4px;align-items:flex-end;padding:8px 0;min-height:130px">${bars}</div>`;
    }
}

// ===== ADMIT PASIEN RAWAT INAP =====
let _admitPatientId = null;

function admitPasien() {
    _admitPatientId = null;
    document.getElementById('admit-search').value = '';
    document.getElementById('admit-search-result').style.display = 'none';
    document.getElementById('admit-search-result').innerHTML = '';
    document.getElementById('admit-diagnosa').value = '';
    document.getElementById('btn-admit-submit').disabled = true;
    
    // Load available beds
    const bedSelect = document.getElementById('admit-bed');
    bedSelect.innerHTML = '<option value="">⏳ Memuat bed...</option>';
    window.__sb.from('beds').select('id, nomor, kelas').eq('status', 'Tersedia').order('nomor').then(({ data, error }) => {
        if (error) { bedSelect.innerHTML = '<option value="">Gagal muat bed</option>'; return; }
        bedSelect.innerHTML = '<option value="">— Pilih Kamar / Bed —</option>';
        if (data.length === 0) {
            bedSelect.innerHTML += '<option value="" disabled>⚠️ Tidak ada bed tersedia</option>';
        }
        data.forEach(b => bedSelect.innerHTML += `<option value="${b.id}">${b.nomor} (${b.kelas})</option>`);
    });
    
    // Load doctors
    const dpjpSelect = document.getElementById('admit-dpjp');
    const doctors = SharedState.cache && SharedState.cache.doctors;
    dpjpSelect.innerHTML = '<option value="">— Pilih DPJP —</option>';
    (doctors || []).forEach(d => dpjpSelect.innerHTML += `<option value="${d.id}">${d.nama_dokter}</option>`);
    
    showM('mdl-admit');
}

async function searchAdmitPatient() {
    const q = document.getElementById('admit-search').value.trim();
    const res = document.getElementById('admit-search-result');
    if (!q) { res.style.display = 'none'; return; }
    res.style.display = 'block';
    res.innerHTML = '<div style="padding:8px;color:var(--text-muted)">🔍 Mencari...</div>';
    
    const { data, error } = await window.__sb.from('patients')
        .select('id, no_rm, nama, jk, tgl_lahir, nik')
        .or(`nama.ilike.%${q}%,no_rm.ilike.%${q}%,nik.ilike.%${q}%`)
        .limit(10);
    
    if (error || !data || data.length === 0) {
        res.innerHTML = '<div style="padding:8px;color:var(--text-muted)">❌ Pasien tidak ditemukan</div>';
        return;
    }
    
    let html = '<div style="display:grid;gap:5px">';
    data.forEach(p => {
        const umur = Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000);
        html += `<div class="rr" style="cursor:pointer;padding:8px;border-radius:6px;border:1px solid var(--border)" onclick="selectAdmitPatient('${p.id}','${p.nama}','${p.no_rm}')">
            <strong>${p.nama}</strong> <span style="color:var(--text-muted)">${p.no_rm}</span>
            <span style="float:right;color:var(--text-muted)">${umur} th · ${p.jk}</span>
        </div>`;
    });
    html += '</div>';
    res.innerHTML = html;
}

function selectAdmitPatient(id, nama, rm) {
    _admitPatientId = id;
    document.getElementById('admit-search-result').innerHTML = 
        `<div style="padding:8px;border-radius:6px;background:var(--success-bg, #d4edda);border:1px solid var(--success, #28a745)">
            ✅ ${nama} <span style="color:var(--text-muted)">${rm}</span>
        </div>`;
    document.getElementById('btn-admit-submit').disabled = !document.getElementById('admit-bed').value;
}

// Enable submit when bed selected too
document.addEventListener('change', function(e) {
    if (e.target.id === 'admit-bed') {
        document.getElementById('btn-admit-submit').disabled = !_admitPatientId || !e.target.value;
    }
});

async function submitAdmit() {
    const btn = document.getElementById('btn-admit-submit');
    const patientId = _admitPatientId;
    const bedId = document.getElementById('admit-bed').value;
    const dpjpId = document.getElementById('admit-dpjp').value;
    
    if (!patientId || !bedId) { showToast('Pilih pasien dan bed!'); return; }
    
    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';
    
    try {
        // Get patient name
        const { data: patient } = await window.__sb.from('patients').select('nama').eq('id', patientId).single();
        const patientName = patient?.nama || 'Pasien';
        
        // Generate RI number
        const { data: lastReg } = await window.__sb.from('registrations')
            .select('no_antrian').ilike('no_antrian', 'RI-%').order('created_at', { ascending: false }).limit(1);
        const lastNum = lastReg && lastReg.length > 0 ? parseInt(lastReg[0].no_antrian.replace('RI-', '')) : 0;
        const newNo = 'RI-' + String(lastNum + 1).padStart(3, '0');
        
        // Get diagnosa
        const diagnosa = document.getElementById('admit-diagnosa').value.trim();
        
        // Create registration with bed_id & tanggal_masuk
        const { error: regErr } = await window.__sb.from('registrations').insert({
            patient_id: patientId,
            status: 'Opname',
            no_antrian: newNo,
            penjamin: 'BPJS',
            doctor_id: dpjpId || null,
            bed_id: bedId,
            tanggal_masuk: new Date().toISOString(),
            diagnosa_masuk: diagnosa || null
        });
        
        if (regErr) { showToast('' + regErr.message); btn.disabled = false; btn.textContent = '✅ Konfirmasi Admit'; return; }
        
        // Update bed status
        await window.__sb.from('beds').update({ status: 'Terpakai' }).eq('id', bedId);
        
        hideM('mdl-admit');
        showToast(`✅ ${patientName} berhasil di-admit\nNo. Antrian: ${newNo}`);
        loadRawatInap();
    } catch (e) {
        showToast('' + e.message);
        btn.disabled = false;
        btn.textContent = '✅ Konfirmasi Admit';
    }
}

// ===== DISCHARGE PASIEN RAWAT INAP =====
let _dcRegId = null;
let _dcBedId = null;

function openDischarge(regId, namaPasien, noReg, bedId) {
    _dcRegId = regId;
    _dcBedId = bedId;
    // Set today's date
    document.getElementById('dc-tanggal').value = new Date().toISOString().slice(0, 10);
    document.getElementById('dc-nama').textContent = namaPasien || '—';
    document.getElementById('dc-no-reg').textContent = noReg || '—';
    document.getElementById('dc-kamar').textContent = 'Memuat...';
    document.getElementById('dc-diagnosa').value = '';
    document.getElementById('dc-status').value = 'Sembuh';
    document.getElementById('dc-catatan').value = '';
    document.getElementById('btn-dc-submit').disabled = false;
    document.getElementById('btn-dc-submit').textContent = '✅ Konfirmasi Pulang';

    // Load bed name
    if (bedId) {
        window.__sb.from('beds').select('nomor, kelas').eq('id', bedId).single().then(({ data }) => {
            if (data) document.getElementById('dc-kamar').textContent = `${data.nomor} (${data.kelas})`;
        });
    } else {
        document.getElementById('dc-kamar').textContent = '—';
    }

    showM('mdl-discharge');
}

async function submitDischarge() {
    const btn = document.getElementById('btn-dc-submit');
    const regId = _dcRegId;
    const bedId = _dcBedId;
    const tanggalPulang = document.getElementById('dc-tanggal').value;
    const diagnosaAkhir = document.getElementById('dc-diagnosa').value.trim();
    const statusPulang = document.getElementById('dc-status').value;
    const catatan = document.getElementById('dc-catatan').value.trim();

    if (!regId) { showToast('Data pasien tidak valid'); return; }
    if (!tanggalPulang) { showToast('Pilih tanggal pulang!'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Memproses...';

    try {
        // Update registration: status Selesai, tanggal_pulang, diagnosa_akhir
        const updateData = {
            status: 'Selesai',
            tanggal_pulang: new Date(tanggalPulang + 'T23:59:59' + new Date().toTimeString().slice(5, 11)).toISOString(),
            diagnosa_akhir: diagnosaAkhir || null
        };
        const { error: regErr } = await window.__sb.from('registrations').update(updateData).eq('id', regId);
        if (regErr) { showToast('update registrasi: ' + regErr.message); btn.disabled = false; btn.textContent = '✅ Konfirmasi Pulang'; return; }

        // Update bed status back to Tersedia
        if (bedId) {
            await window.__sb.from('beds').update({ status: 'Tersedia' }).eq('id', bedId);
        }

        hideM('mdl-discharge');
        showToast(`✅ Pasien berhasil dipulangkan\nStatus: ${statusPulang}`);
        loadRawatInap();
    } catch (e) {
        showToast('' + e.message);
        btn.disabled = false;
        btn.textContent = '✅ Konfirmasi Pulang';
    }
}

// ===== UGD INPUT =====
let _ugdPatientId = null;

function searchUGDPatient() {
    const q = document.getElementById('ugd-search').value.trim();
    const res = document.getElementById('ugd-search-result');
    if (!q) { res.style.display = 'none'; return; }
    res.style.display = 'block';
    res.innerHTML = '<div style="padding:8px;color:var(--text-muted)">🔍 Mencari...</div>';
    
    // Load doctors in the UGD modal
    const dSel = document.getElementById('ugd-dokter');
    if (dSel.options.length <= 1) {
        const docs = (SharedState.cache && SharedState.cache.doctors) || [];
        dSel.innerHTML = '<option value="">— Pilih Dokter —</option>';
        docs.forEach(d => dSel.innerHTML += `<option value="${d.id}">${d.nama_dokter}</option>`);
    }
    
    window.__sb.from('patients')
        .select('id, no_rm, nama, jk, tgl_lahir')
        .or(`nama.ilike.%${q}%,no_rm.ilike.%${q}%`)
        .limit(10).then(({ data, error }) => {
        if (error || !data || data.length === 0) {
            res.innerHTML = '<div style="padding:8px;color:var(--text-muted)">❌ Pasien tidak ditemukan</div>';
            return;
        }
        let html = '<div style="display:grid;gap:5px">';
        data.forEach(p => {
            const umur = Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000);
            html += `<div class="rr" style="cursor:pointer;padding:8px;border-radius:6px;border:1px solid var(--border)" onclick="selectUGDPatient('${p.id}','${p.nama}','${p.no_rm}')">
                <strong>${p.nama}</strong> <span style="color:var(--text-muted)">${p.no_rm}</span>
                <span style="float:right;color:var(--text-muted)">${umur} th · ${p.jk}</span>
            </div>`;
        });
        html += '</div>';
        res.innerHTML = html;
    });
}

function selectUGDPatient(id, nama, rm) {
    _ugdPatientId = id;
    document.getElementById('ugd-search-result').innerHTML = 
        `<div style="padding:8px;border-radius:6px;background:#d4edda;border:1px solid #28a745">
            ✅ ${nama} <span style="color:#666">${rm}</span>
        </div>`;
}

async function submitUGD() {
    const patientId = _ugdPatientId;
    if (!patientId) { showToast('Cari dan pilih pasien dulu!'); return; }
    
    const triase = document.getElementById('ugd-triase').value;
    const dokterId = document.getElementById('ugd-dokter').value;
    const gcs = document.getElementById('ugd-gcs').value.trim() || '-';
    const td = document.getElementById('ugd-td').value.trim() || '-';
    const nadi = document.getElementById('ugd-nadi').value.trim() || '-';
    const keluhan = document.getElementById('ugd-keluhan').value.trim();
    
    if (!keluhan) { showToast('Isi keluhan utama pasien!'); return; }
    
    const btn = document.querySelector('#mdl-ugd .btn-p');
    btn.disabled = true;
    btn.textContent = '⏳ Mendaftarkan...';
    
    try {
        // Generate UGD number
        const { data: last } = await window.__sb.from('registrations')
            .select('no_antrian').ilike('no_antrian', 'UGD-%').order('created_at', { ascending: false }).limit(1);
        const lastNum = last && last.length > 0 ? parseInt(last[0].no_antrian.replace('UGD-', '')) : 0;
        const newNo = 'UGD-' + String(lastNum + 1).padStart(3, '0');
        
        const { error } = await window.__sb.from('registrations').insert({
            patient_id: patientId,
            status: triase === 'Merah' ? 'Kritis' : triase === 'Kuning' ? 'Urgent' : 'Urgent',
            no_antrian: newNo,
            penjamin: 'Umum',
            doctor_id: dokterId || null
        });
        
        if (error) { showToast('' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pasien UGD'; return; }
        
        hideM('mdl-ugd');
        showToast(`✅ Pasien UGD terdaftar\nNo. Antrian: ${newNo}`);
        loadUGD();
    } catch (e) { showToast('' + e.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pasien UGD'; }
}

// ===== TRANSAKSI KASIR =====
function showMdlTransaksi() {
    SharedState.waitReady().then(() => {
        const sel = document.getElementById('trx-pasien');
        if (sel.options.length <= 1) {
            (SharedState.cache.patients || []).forEach(p => {
                sel.innerHTML += `<option value="${p.id}">${p.nama} (${p.no_rm || '—'})</option>`;
            });
        }
    });
    showM('mdl-transaksi');
}

function showMdlTagihan() {
    SharedState.waitReady().then(() => {
        const sel = document.getElementById('tag-pasien');
        if (sel.options.length <= 1) {
            (SharedState.cache.patients || []).forEach(p => {
                sel.innerHTML += `<option value="${p.id}">${p.nama} (${p.no_rm || '—'})</option>`;
            });
        }
    });
    showM('mdl-tagihan');
}

async function submitTransaksi() {
    const btn = document.querySelector('button[onclick*="submitTransaksi"]');
    const patId = document.getElementById('trx-pasien').value;
    const noReg = document.getElementById('trx-no-reg').value.trim();
    const penjamin = document.getElementById('trx-penjamin').value;
    const total = parseInt(document.getElementById('trx-total').value) || 0;
    const metode = document.getElementById('trx-metode').value;
    const bayar = parseInt(document.getElementById('trx-bayar').value) || 0;

    if (!patId || !noReg || total <= 0) { showToast('Isi pasien, No.Reg, dan Total Tagihan!'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    try {
        const { error } = await window.__sb.from('payments').insert({
            no_reg: noReg,
            patient_id: patId,
            penjamin,
            total_tagihan: total,
            metode,
            status: metode === 'Tunai' || metode === 'Transfer' || metode === 'QRIS' ? 'Lunas' : 'Belum Bayar',
            bayar,
            kembalian: bayar > total ? bayar - total : 0
        });
        if (error) throw error;
        showToast(' Transaksi berhasil!');
        hideM('mdl-transaksi');
        loadKasir();
        document.getElementById('trx-no-reg').value = '';
        document.getElementById('trx-total').value = '';
        document.getElementById('trx-bayar').value = '';
    } catch (e) { showToast(' ' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '✅ Proses Bayar'; }
}

// ===== JADWAL OPERASI =====
function showMdlOperasi() {
    SharedState.waitReady().then(() => {
        const sel = document.getElementById('ok-pasien');
        if (sel.options.length <= 1) {
            (SharedState.cache.patients || []).forEach(p => {
                sel.innerHTML += `<option value="${p.id}">${p.nama} (${p.no_rm || '—'})</option>`;
            });
        }
    });
    showM('mdl-operasi');
}

async function submitOperasi() {
    const btn = document.querySelector('[onclick="submitOperasi()"]');
    const patId = document.getElementById('ok-pasien').value;
    const noOp = document.getElementById('ok-no').value.trim();
    const kamar = document.getElementById('ok-kamar').value;
    const klasifikasi = document.getElementById('ok-klasifikasi').value;
    const tindakan = document.getElementById('ok-tindakan').value.trim();
    const diagnosa = document.getElementById('ok-diagnosa').value.trim();
    const operator = document.getElementById('ok-operator').value.trim();
    const anastesi = document.getElementById('ok-anastesi').value.trim();
    const mulai = document.getElementById('ok-mulai').value;

    if (!patId || !noOp || !tindakan) { showToast('Isi pasien, No.Operasi, dan Tindakan!'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    try {
        const { error } = await window.__sb.from('surgery_schedule').insert({
            no_operasi: noOp,
            patient_id: patId,
            kamar_ok: kamar,
            tindakan, klasifikasi, diagnosa,
            dokter_operator: operator,
            dokter_anastesi: anastesi,
            waktu_mulai: mulai || null,
            status: 'Menunggu'
        });
        if (error) throw error;
        showToast(' Jadwal operasi berhasil disimpan!');
        hideM('mdl-operasi');
        loadOK();
        document.getElementById('ok-no').value = '';
        document.getElementById('ok-tindakan').value = '';
        document.getElementById('ok-diagnosa').value = '';
        document.getElementById('ok-operator').value = '';
        document.getElementById('ok-anastesi').value = '';
        document.getElementById('ok-mulai').value = '';
    } catch (e) { showToast(' ' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '✅ Simpan Jadwal'; }
}

// ===== RETUR OBAT (client-side only) =====
function submitRetur() {
    const pasien = document.getElementById('retur-pasien').value;
    const obat = document.getElementById('retur-obat').value.trim();
    const jumlah = document.getElementById('retur-jumlah').value.trim();
    const kondisi = document.getElementById('retur-kondisi').value;
    const alasan = document.getElementById('retur-alasan').value.trim();
    if (!obat || !jumlah) { showToast('Isi nama obat dan jumlah!'); return; }
    showToast(' Retur diajukan: ' + obat + ' (' + jumlah + ') — ' + pasien + '\nAlasan: ' + (alasan || kondisi));
    hideM('mdl-retur');
    document.getElementById('retur-obat').value = '';
    document.getElementById('retur-jumlah').value = '';
    document.getElementById('retur-alasan').value = '';
}

function tick() {
    const n = new Date();
    document.getElementById('clk').textContent = n.toLocaleTimeString('id-ID');
    document.getElementById('pgd').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== KASIR HELPER FUNCTIONS =====
function printSEP() { window.print(); }
function sepPDF() { window.open(window.location.href, '_blank'); }

async function prosesBayar() {
    // Find the first unpaid payment with valid total
    const { data: payments } = await window.__sb
        .from('payments')
        .select('id, patient_id, total_tagihan, status, metode')
        .eq('status', 'Belum Bayar')
        .gt('total_tagihan', 0)
        .order('created_at', { ascending: true })
        .limit(1);
    if (!payments || !payments.length) return showToast(' Tidak ada tagihan yang perlu diproses');

    const p = payments[0];
    const total = Number(p.total_tagihan || 0);
    if (total <= 0) return showToast(' Total tagihan tidak valid');

    // Update payment to Lunas
    const { error } = await window.__sb
        .from('payments')
        .update({
            status: 'Lunas',
            metode: p.metode || 'Tunai',
            bayar: total,
            kembalian: 0
        })
        .eq('id', p.id);

    if (error) return showToast(' Gagal proses pembayaran: ' + error.message);
    showToast(' Pembayaran Rp ' + total.toLocaleString() + ' berhasil diproses!');
    loadKasir();
}
function cetakKwitansi(noReg, nama, penjamin, total, bayar, metode, status, tgl) {
    const totalNum = Number(total || 0);
    const bayarNum = Number(bayar || 0);
    const kembalian = bayarNum > totalNum ? bayarNum - totalNum : 0;
    const isLunas = status === 'Lunas';

    const w = window.open('', '_blank', 'width=380,height=600');
    w.document.write(`<!DOCTYPE html><html><head>
        <title>Kwitansi — ${nama}</title>
        <style>
            @page { margin: 0; size: auto; }
            body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; color: #000; }
            .kw { max-width: 320px; margin: 0 auto; }
            .kw-h { text-align: center; border-bottom: 2px double #000; padding-bottom: 10px; margin-bottom: 12px; }
            .kw-h h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
            .kw-h p { margin: 2px 0; font-size: 10px; }
            .kw-body { }
            .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #ccc; }
            .row-lbl { color: #555; }
            .row-val { font-weight: bold; }
            .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 6px 0; border-top: 2px solid #000; margin-top: 6px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px solid #ccc; padding-top: 10px; }
            .footer p { margin: 2px 0; }
            .status-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; font-size: 10px; margin-top: 4px; }
            @media print {
                body { padding: 10px; }
                .no-print { display: none; }
            }
        </style>
    </head><body>
        <div class="kw">
            <div class="kw-h">
                <h2>Edoy Hospital Management</h2>
                <p>Jl. Raya Cilegon KM 8, Serang, Banten</p>
                <p>Telp: 0254-226000</p>
                <hr class="sep">
                <p style="font-size:11px;font-weight:bold;letter-spacing:1px">K W I T A N S I</p>
            </div>
            <div class="kw-body">
                <div class="row"><span class="row-lbl">No. Reg</span><span class="row-val">${noReg || '—'}</span></div>
                <div class="row"><span class="row-lbl">Nama Pasien</span><span class="row-val">${nama}</span></div>
                <div class="row"><span class="row-lbl">Penjamin</span><span class="row-val">${penjamin}</span></div>
                <div class="row"><span class="row-lbl">Tanggal</span><span class="row-val">${tgl || new Date().toLocaleDateString('id-ID')}</span></div>
                <hr class="sep">
                <div class="row"><span class="row-lbl">Jasa Dokter</span><span>Rp ${Math.round(totalNum * 0.43).toLocaleString()}</span></div>
                <div class="row"><span class="row-lbl">Biaya Poli</span><span>Rp ${Math.round(totalNum * 0.09).toLocaleString()}</span></div>
                <div class="row"><span class="row-lbl">Obat</span><span>Rp ${Math.round(totalNum * 0.45).toLocaleString()}</span></div>
                <div class="row"><span class="row-lbl">Administrasi</span><span>Rp ${Math.round(totalNum * 0.03).toLocaleString()}</span></div>
                <div class="total-row"><span>TOTAL</span><span>Rp ${totalNum.toLocaleString()}</span></div>
                <hr class="sep">
                ${isLunas ? `
                <div class="row"><span class="row-lbl">Metode Bayar</span><span class="row-val">${metode || 'Tunai'}</span></div>
                <div class="row"><span class="row-lbl">Pembayaran</span><span>Rp ${bayarNum.toLocaleString()}</span></div>
                <div class="row"><span class="row-lbl">Kembalian</span><span>Rp ${kembalian.toLocaleString()}</span></div>
                ` : `<div style="text-align:center;padding:8px 0"><span class="status-badge">${status || 'BELUM DIBAYAR'}</span></div>`}
            </div>
            <div class="footer">
                <p>Terima Kasih — Semoga Lekas Sembuh</p>
                <p style="font-size:8px">Kwitansi ini adalah bukti pembayaran yang sah</p>
                <p class="no-print" style="margin-top:10px"><button onclick="window.print()" style="padding:6px 20px;font-family:inherit;cursor:pointer">🖨️ Cetak Kwitansi</button></p>
                <p class="no-print" style="margin-top:5px"><button onclick="window.close()" style="padding:4px 12px;font-family:inherit;cursor:pointer">✕ Tutup</button></p>
            </div>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)};<\/script>
    </body></html>`);
    w.document.close();
}

function showDetailKwitansi(noReg, nama, penjamin, total, metode, status) {
    const statusCls = status === 'Lunas' ? 'bs'
        : status === 'Belum Bayar' || status === 'Menunggu' ? 'bw'
        : 'bg';
    showDetail('🧾 Kwitansi — ' + nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--bg);padding:13px;border-radius:8px">
            <div><span style="color:var(--text-muted)">No. Reg</span><div style="font-weight:700">${noReg || '—'}</div></div>
            <div><span style="color:var(--text-muted)">Nama</span><div style="font-weight:700">${nama}</div></div>
            <div><span style="color:var(--text-muted)">Penjamin</span><div style="font-weight:700">${penjamin}</div></div>
            <div><span style="color:var(--text-muted)">Total Tagihan</span><div style="font-weight:700;color:var(--primary)">Rp ${Number(total || 0).toLocaleString()}</div></div>
            <div><span style="color:var(--text-muted)">Metode</span><div style="font-weight:700">${metode || '—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${statusCls}">${status || '—'}</span></div></div>
        </div>
    `);
}

async function submitTagihan() {
    const btn = document.querySelector('[onclick="submitTagihan()"]');
    const patId = document.getElementById('tag-pasien').value;
    const noTag = document.getElementById('tag-no').value.trim();
    const penjamin = document.getElementById('tag-penjamin').value;
    const total = parseInt(document.getElementById('tag-total').value) || 0;
    const jatuhTempo = document.getElementById('tag-jatuh-tempo').value;
    const keterangan = document.getElementById('tag-keterangan').value.trim();
    if (!patId || !noTag || total <= 0) { showToast('Isi pasien, No. Tagihan, dan Total Tagihan!'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
        const { error } = await window.__sb.from('invoices').insert({
            no_invoice: noTag,
            patient_id: patId,
            penjamin,
            total,
            jatuh_tempo: jatuhTempo || null,
            keterangan,
            status: 'Belum Bayar'
        });
        if (error) throw error;
        showToast(' Tagihan berhasil dibuat!');
        hideM('mdl-tagihan');
        loadTagihan();
        document.getElementById('tag-no').value = '';
        document.getElementById('tag-total').value = '';
        document.getElementById('tag-keterangan').value = '';
        document.getElementById('tag-jatuh-tempo').value = '';
    } catch (e) { showToast(' ' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '✅ Buat Tagihan'; }
}

// ===== TAMBAH DOKTER =====
function showMdlAddDokter() {
    ['dr-nama','dr-spesialis','dr-jadwal','dr-sip','dr-str','dr-telp'].forEach(id => document.getElementById(id).value = '');
    SharedState.waitReady().then(() => {
        const sel = document.getElementById('dr-poli');
        sel.innerHTML = '<option value="">— Pilih Poli —</option>';
        (SharedState.cache.poli||[]).forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.nama_poli}</option>`;
        });
    });
    showM('mdl-add-dokter');
}

async function submitAddDokter() {
    const nama = document.getElementById('dr-nama').value.trim();
    if (!nama) { showToast('Nama dokter wajib diisi!'); return; }
    const poliId = document.getElementById('dr-poli').value;
    if (!poliId) { showToast('Poli wajib dipilih!'); return; }
    
    const payload = {
        nama_dokter: nama,
        spesialis: document.getElementById('dr-spesialis').value.trim() || null,
        poli_id: poliId,
        jadwal_praktik: document.getElementById('dr-jadwal').value.trim() || null,
        no_sip: document.getElementById('dr-sip').value.trim() || null,
        no_str: document.getElementById('dr-str').value.trim() || null,
        telepon: document.getElementById('dr-telp').value.trim() || null,
    };
    
    const { data, error } = await window.__sb.from('doctors').insert(payload).select().single();
    if (error) { showToast(' Gagal menyimpan: ' + error.message); return; }
    
    SharedState.cache.doctors.push(data);
    hideM('mdl-add-dokter');
    loadSDM();
}

// ===== TAMBAH KARYAWAN =====
function showMdlAddKaryawan() {
    ['kar-username','kar-password','kar-nama'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('kar-role').value = '';
    document.getElementById('kar-unit').value = '';
    showM('mdl-add-karyawan');
}

async function submitAddKaryawan() {
    const username = document.getElementById('kar-username').value.trim();
    const password = document.getElementById('kar-password').value.trim();
    const nama = document.getElementById('kar-nama').value.trim();
    const role = document.getElementById('kar-role').value;
    const unit = document.getElementById('kar-unit').value;
    
    if (!username || !password || !nama || !role) { showToast('Username , password, nama, dan role wajib diisi!'); return; }
    
    // Try insert to Supabase users table
    const { data, error } = await window.__sb.from('users').insert({
        username, password, nama, role, unit: unit || 'Semua', status: 'Aktif'
    }).select().maybeSingle();
    
    if (error) {
        // Fallback: table doesn't exist yet — use array
        if (!window._appUsers) window._appUsers = [];
        if (window._appUsers.find(u => u.username === username)) {
            showToast(' Username sudah terdaftar!');
            return;
        }
        window._appUsers.push({ username, nama, role, unit: unit || 'Semua', status: 'Aktif' });
        renderUsersTable();
        hideM('mdl-add-karyawan');
        showToast(' Akun karyawan berhasil ditambahkan (local)');
    } else {
        // Success — reload users table from DB
        hideM('mdl-add-karyawan');
        loadUsers();
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#pg-pengaturan .t tbody');
    if (!tbody) return;
    
    const { data: users, error } = await window.__sb.from('users').select('*').order('username');
    if (error || !users || users.length === 0) {
        // Fallback to array
        if (!window._appUsers) window._appUsers = [
            { username: 'admin', nama: 'Admin RS', role: 'Administrator', unit: 'Semua', status: 'Aktif' },
            { username: 'kasir01', nama: 'Sari Dewi', role: 'Kasir', unit: 'Kasir', status: 'Aktif' },
            { username: 'farmasi01', nama: 'Budi Santoso', role: 'Apoteker', unit: 'Farmasi', status: 'Aktif' },
            { username: 'pendaftaran01', nama: 'Rini Yuliani', role: 'Petugas', unit: 'Pendaftaran', status: 'Aktif' },
        ];
        renderUsersTable();
        return;
    }
    window._appUsers = users;
    renderUsersTable();
}

function renderUsersTable() {
    const tbody = document.querySelector('#pg-pengaturan .t tbody');
    if (!tbody || !window._appUsers) return;
    tbody.innerHTML = window._appUsers.map(u => `
        <tr><td>${u.username}</td><td>${u.nama}</td><td><span class="b ${roleClass(u.role)}">${u.role}</span></td><td>${u.unit || 'Semua'}</td><td><span class="b bs">${u.status || 'Aktif'}</span></td></tr>
    `).join('');
}

function roleClass(role) {
    return role === 'Administrator' ? 'bd' : role === 'Kasir' ? 'bi' : role === 'Apoteker' ? 'bw' : 'bg';
}

// ===== KONFIGURASI RS =====

function simpanConfig() {
    const cfg = {
        nama: document.getElementById('cfg-nama').value,
        alamat: document.getElementById('cfg-alamat').value,
        telp: document.getElementById('cfg-telp').value,
        email: document.getElementById('cfg-email').value,
        kodeBpjs: document.getElementById('cfg-kode-bpjs').value,
    };
    localStorage.setItem('rs_config', JSON.stringify(cfg));
    showToast(' Konfigurasi berhasil disimpan!');
}

function loadConfig() {
    const saved = localStorage.getItem('rs_config');
    const cfg = saved ? JSON.parse(saved) : {
        nama: 'Edoy Hospital Management',
        alamat: 'Jl. Raya Cilegon KM 8, Serang, Banten',
        telp: '0254-226000',
        email: '',
        kodeBpjs: '0401R001',
    };
    document.getElementById('cfg-nama').value = cfg.nama;
    document.getElementById('cfg-alamat').value = cfg.alamat;
    document.getElementById('cfg-telp').value = cfg.telp;
    document.getElementById('cfg-email').value = cfg.email;
    document.getElementById('cfg-kode-bpjs').value = cfg.kodeBpjs;
}

// ===== AUTH =====
let medicoreUser = null;

function initAuth() {
  var saved = localStorage.getItem('medicore_user');
  if (saved) {
    try {
      var user = JSON.parse(saved);
      var now = Date.now();
      if (user._expiresAt && now > user._expiresAt) {
        localStorage.removeItem('medicore_user');
        showToast('Sesi berakhir. Silakan login ulang.', 'warning');
        document.getElementById('login-overlay').classList.add('active');
        document.getElementById('app-shell').classList.remove('active');
        return;
      }
      window.medicoreUser = user;
      updateUserChip();
      document.getElementById('login-overlay').classList.remove('active');
      document.getElementById('app-shell').classList.add('active');
    } catch(e) {
      localStorage.removeItem('medicore_user');
      document.getElementById('login-overlay').classList.add('active');
      document.getElementById('app-shell').classList.remove('active');
    }
  } else {
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('app-shell').classList.remove('active');
  }
}

async function doLogin() {
  var username = document.getElementById('login-user').value.trim();
  var password = document.getElementById('login-pass').value.trim();
  var btn = document.querySelector('.login-btn');
  var err = document.getElementById('login-error');

  err.classList.remove('show');

  if (!username || !password) {
    err.innerHTML = '<span>⚠️</span> Isi username dan password';
    err.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = ' Memproses...';

  var data, error;
  try {
    var result = await window.__sb.from('users')
      .select('username,nama,role,unit,status')
      .eq('username', username)
      .eq('password', password)
      .eq('status', 'Aktif')
      .single();
    data = result.data;
    error = result.error;
  } catch(e) {
    error = e;
  }

  btn.disabled = false;
  btn.classList.remove('loading');
  btn.innerHTML = '🔐 Masuk';

  if (error || !data) {
    err.innerHTML = '<span>❌</span> Username atau password salah';
    err.classList.add('show');
    var card = btn.closest('.login-card');
    if (card) {
      card.style.animation = 'shake 0.4s ease';
      setTimeout(function() { if (card) card.style.animation = ''; }, 500);
    }
    return;
  }

  // Login dengan timeout session
  var loginTime = Date.now();
  window.medicoreUser = data;
  window.medicoreUser._loginAt = loginTime;
  window.medicoreUser._expiresAt = loginTime + (8 * 60 * 60 * 1000); // 8 jam
  localStorage.setItem('medicore_user', JSON.stringify(window.medicoreUser));
  updateUserChip();
  document.getElementById('login-overlay').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');
  renderDashboard();
}

// ─── SEP BPJS ───
function showSEPModal(regId, patientData) {
  document.getElementById('sep-norm').value = patientData?.no_rm || '';
  if (regId) window._sepRegId = regId;
  showM('mdl-sep');
}
async function submitSEP() {
  var noBPJS = document.getElementById('sep-nobpjs').value.trim();
  var poli = document.getElementById('sep-poli').value;
  var diagnosis = document.getElementById('sep-diagnosis').value.trim();
  if (!noBPJS) return showToast('No. BPJS wajib diisi', 'warning');
  if (!poli) return showToast('Pilih poli', 'warning');
  var noSEP = 'SEP' + Date.now().toString(36).toUpperCase();
  var { error } = await window.__sb.from('sep_bpjs').insert({
    no_sep: noSEP,
    no_bpjs: noBPJS,
    no_rm: document.getElementById('sep-norm').value,
    poli: poli,
    jenis: document.getElementById('sep-jenis').value,
    diagnosis: diagnosis,
    dpjp: document.getElementById('sep-dpjp').value.trim(),
    catatan: document.getElementById('sep-catatan').value.trim(),
    registration_id: window._sepRegId || null,
    created_at: new Date().toISOString()
  }).single();
  if (error) return showToast('Gagal simpan SEP: ' + error.message, 'error');
  showToast('✅ SEP ' + noSEP + ' berhasil disimpan', 'success');
  hideM('mdl-sep');
}

// ─── FORMAT RUPIAH ───
function formatRupiah(angka) {
  if (angka === null || angka === undefined) return 'Rp 0';
  if (typeof angka === 'string') angka = parseFloat(angka.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (isNaN(angka)) angka = 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
function formatCurrency(angka) { return formatRupiah(angka); }

// ─── EXPORT TABLE TO CSV ───
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
      var text = td.textContent.trim().replace(/"/g, '""');
      dataRow.push('"' + text + '"');
    });
    if (dataRow.length) rows.push(dataRow.join(','));
  });

  if (rows.length <= 1) { showToast('Tidak ada data untuk di-export', 'warning'); return; }

  var bom = '﻿';
  var csv = bom + rows.join('\r\n');
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

// ─── DARK MODE TOGGLE ───
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

function doLogout() {
  localStorage.removeItem('medicore_user');
  window.medicoreUser = null;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('login-overlay').classList.add('active');
  document.getElementById('app-shell').classList.remove('active');
  // Reset all sidebar items to visible
  document.querySelectorAll('.sidebar .ni').forEach(btn => btn.style.display = '');
  document.querySelectorAll('.sidebar .s-sec').forEach(sec => sec.style.display = '');
}

function updateUserChip() {
  const u = window.medicoreUser;
  if (!u) return;
  const initials = u.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const av = document.querySelector('.u-av');
  const nm = document.querySelector('.u-nm');
  const rl = document.querySelector('.u-rl');
  if (av) av.textContent = initials || u.nama.slice(0, 2).toUpperCase();
  if (nm) nm.textContent = u.nama;
  if (rl) rl.textContent = u.role;
  filterSidebar(u.role);
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  const isVisible = menu.style.display !== 'none';
  // Hide all other dropdowns
  document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isVisible ? 'none' : 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.u-chip') && !e.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
  }
});

// ===== MASTER DATA =====

function swMdTab(btn, tabId) {
    document.querySelectorAll('#pg-masterdata .tg .tgb').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#pg-masterdata .page > div[id^="md-"]').forEach(d => d.style.display = 'none');
    if (btn) btn.classList.add('active');
    document.getElementById(tabId).style.display = '';
}

async function loadMasterData() {
    await SharedState.waitReady();
    loadPoliTable();
    loadTarifTable();
    loadIcdTable();
    loadKatObatTable();
}

// ===== POLI =====
async function loadPoliTable() {
    const tbody = document.getElementById('md-poli-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';
    const { data, error } = await window.__sb.from('poli').select('*').order('id');
    if (error) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--danger)">❌ ${error.message}</td></tr>`; return; }
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada data poli</td></tr>'; return; }
    tbody.innerHTML = data.map(p => `<tr>
        <td class="mono">${p.id}</td>
        <td>${p.nama_poli}</td>
        <td>${p.kode_poli || '—'}</td>
        <td><button class="btn btn-o btn-xs" onclick="editPoli(${p.id})">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusPoli(${p.id})">🗑️</button></td>
    </tr>`).join('');
}

async function showMdlPoli() {
    document.getElementById('mdl-poli-id').value = '';
    document.getElementById('mdl-poli-nama').value = '';
    document.getElementById('mdl-poli-kode').value = '';
    showM('mdl-poli');
}

async function editPoli(id) {
    const { data, error } = await window.__sb.from('poli').select('*').eq('id', id).single();
    if (error || !data) { showToast(' Data tidak ditemukan'); return; }
    document.getElementById('mdl-poli-id').value = data.id;
    document.getElementById('mdl-poli-nama').value = data.nama_poli;
    document.getElementById('mdl-poli-kode').value = data.kode_poli || '';
    showM('mdl-poli');
}

async function hapusPoli(id) {
    if (!confirm('Yakin hapus poli ini?')) return;
    const { error } = await window.__sb.from('poli').delete().eq('id', id);
    if (error) { showToast(' Gagal hapus: ' + error.message); return; }
    loadPoliTable();
}

async function submitPoli() {
    const id = document.getElementById('mdl-poli-id').value;
    const nama = document.getElementById('mdl-poli-nama').value.trim();
    const kode = document.getElementById('mdl-poli-kode').value.trim();
    if (!nama) { showToast('Nama poli wajib diisi!'); return; }
    const payload = { nama_poli: nama, kode_poli: kode || null };
    let error;
    if (id) {
        ({ error } = await window.__sb.from('poli').update(payload).eq('id', id));
    } else {
        ({ error } = await window.__sb.from('poli').insert(payload));
    }
    if (error) { showToast(' Gagal: ' + error.message); return; }
    hideM('mdl-poli');
    loadPoliTable();
}

// ===== TARIF =====
async function loadTarifTable() {
    const tbody = document.getElementById('md-tarif-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';
    const { data, error } = await window.__sb.from('master_tarif').select('*').order('kode_tarif');
    if (error) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--danger)">❌ ${error.message}</td></tr>`; return; }
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada data tarif</td></tr>'; return; }
    window._mdTarifData = data;
    tbody.innerHTML = data.map(t => `<tr>
        <td class="mono">${t.kode_tarif}</td>
        <td>${t.nama_tindakan}</td>
        <td><span class="b bg">${t.kategori}</span></td>
        <td style="font-weight:600;font-family:monospace">Rp ${(t.harga || 0).toLocaleString('id-ID')}</td>
        <td><button class="btn btn-o btn-xs" onclick="editTarif('${t.id}')">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusTarif('${t.id}')">🗑️</button></td>
    </tr>`).join('');
}

function filterTarif(q) {
    const tbody = document.getElementById('md-tarif-tbody');
    if (!tbody || !window._mdTarifData) return;
    if (!q) { loadTarifTable(); return; }
    const low = q.toLowerCase();
    const filtered = window._mdTarifData.filter(t => 
        t.kode_tarif.toLowerCase().includes(low) || 
        t.nama_tindakan.toLowerCase().includes(low) || 
        t.kategori.toLowerCase().includes(low)
    );
    tbody.innerHTML = filtered.map(t => `<tr>
        <td class="mono">${t.kode_tarif}</td>
        <td>${t.nama_tindakan}</td>
        <td><span class="b bg">${t.kategori}</span></td>
        <td style="font-weight:600;font-family:monospace">Rp ${(t.harga || 0).toLocaleString('id-ID')}</td>
        <td><button class="btn btn-o btn-xs" onclick="editTarif('${t.id}')">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusTarif('${t.id}')">🗑️</button></td>
    </tr>`).join('');
}

async function showMdlTarif() {
    document.getElementById('mdl-tarif-id').value = '';
    document.getElementById('mdl-tarif-kode').value = '';
    document.getElementById('mdl-tarif-nama').value = '';
    document.getElementById('mdl-tarif-harga').value = '';
    document.getElementById('mdl-tarif-kategori').value = 'Tindakan';
    const sel = document.getElementById('mdl-tarif-poli');
    sel.innerHTML = '<option value="">— Semua Poli —</option>';
    (SharedState.cache.poli||[]).forEach(p => {
        sel.innerHTML += `<option value="${p.id}">${p.nama_poli}</option>`;
    });
    showM('mdl-tarif');
}

async function editTarif(id) {
    const { data, error } = await window.__sb.from('master_tarif').select('*').eq('id', id).single();
    if (error || !data) { showToast(' Data tidak ditemukan'); return; }
    document.getElementById('mdl-tarif-id').value = data.id;
    document.getElementById('mdl-tarif-kode').value = data.kode_tarif;
    document.getElementById('mdl-tarif-nama').value = data.nama_tindakan;
    document.getElementById('mdl-tarif-harga').value = data.harga || 0;
    document.getElementById('mdl-tarif-kategori').value = data.kategori || 'Tindakan';
    const sel = document.getElementById('mdl-tarif-poli');
    sel.innerHTML = '<option value="">— Semua Poli —</option>';
    (SharedState.cache.poli||[]).forEach(p => {
        sel.innerHTML += `<option value="${p.id}"${p.id === data.poli_id ? ' selected' : ''}>${p.nama_poli}</option>`;
    });
    showM('mdl-tarif');
}

async function hapusTarif(id) {
    if (!confirm('Yakin hapus tarif ini?')) return;
    const { error } = await window.__sb.from('master_tarif').delete().eq('id', id);
    if (error) { showToast(' Gagal hapus: ' + error.message); return; }
    loadTarifTable();
}

async function submitTarif() {
    const id = document.getElementById('mdl-tarif-id').value;
    const kode = document.getElementById('mdl-tarif-kode').value.trim();
    const nama = document.getElementById('mdl-tarif-nama').value.trim();
    const harga = parseInt(document.getElementById('mdl-tarif-harga').value) || 0;
    const kategori = document.getElementById('mdl-tarif-kategori').value;
    const poliId = document.getElementById('mdl-tarif-poli').value || null;
    if (!kode || !nama) { showToast('Kode dan nama tindakan wajib diisi!'); return; }
    const payload = { kode_tarif: kode, nama_tindakan: nama, harga, kategori, poli_id: poliId };
    let error;
    if (id) {
        ({ error } = await window.__sb.from('master_tarif').update(payload).eq('id', id));
    } else {
        ({ error } = await window.__sb.from('master_tarif').insert(payload));
    }
    if (error) { showToast(' Gagal: ' + error.message); return; }
    hideM('mdl-tarif');
    loadTarifTable();
}

// ===== ICD-10 =====
async function loadIcdTable() {
    const tbody = document.getElementById('md-icd-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';
    const { data, error } = await window.__sb.from('icd10').select('*').order('kode_icd');
    if (error) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--danger)">❌ ${error.message}</td></tr>`; return; }
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada data ICD-10</td></tr>'; return; }
    window._mdIcdData = data;
    tbody.innerHTML = data.map(d => `<tr>
        <td class="mono"><strong>${d.kode_icd}</strong></td>
        <td>${d.nama_penyakit}</td>
        <td><span class="b bg">${d.kategori}</span></td>
        <td><button class="btn btn-o btn-xs" onclick="editIcd('${d.id}')">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusIcd('${d.id}')">🗑️</button></td>
    </tr>`).join('');
}

function filterIcd(q) {
    const tbody = document.getElementById('md-icd-tbody');
    if (!tbody || !window._mdIcdData) return;
    if (!q) { loadIcdTable(); return; }
    const low = q.toLowerCase();
    const filtered = window._mdIcdData.filter(d => 
        d.kode_icd.toLowerCase().includes(low) || 
        d.nama_penyakit.toLowerCase().includes(low) || 
        d.kategori.toLowerCase().includes(low)
    );
    tbody.innerHTML = filtered.map(d => `<tr>
        <td class="mono"><strong>${d.kode_icd}</strong></td>
        <td>${d.nama_penyakit}</td>
        <td><span class="b bg">${d.kategori}</span></td>
        <td><button class="btn btn-o btn-xs" onclick="editIcd('${d.id}')">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusIcd('${d.id}')">🗑️</button></td>
    </tr>`).join('');
}

async function showMdlIcd() {
    document.getElementById('mdl-icd-id').value = '';
    document.getElementById('mdl-icd-kode').value = '';
    document.getElementById('mdl-icd-nama').value = '';
    document.getElementById('mdl-icd-kategori').value = 'Umum';
    showM('mdl-icd');
}

async function editIcd(id) {
    const { data, error } = await window.__sb.from('icd10').select('*').eq('id', id).single();
    if (error || !data) { showToast(' Data tidak ditemukan'); return; }
    document.getElementById('mdl-icd-id').value = data.id;
    document.getElementById('mdl-icd-kode').value = data.kode_icd;
    document.getElementById('mdl-icd-nama').value = data.nama_penyakit;
    document.getElementById('mdl-icd-kategori').value = data.kategori;
    showM('mdl-icd');
}

async function hapusIcd(id) {
    if (!confirm('Yakin hapus ICD-10 ini?')) return;
    const { error } = await window.__sb.from('icd10').delete().eq('id', id);
    if (error) { showToast(' Gagal hapus: ' + error.message); return; }
    loadIcdTable();
}

async function submitIcd() {
    const id = document.getElementById('mdl-icd-id').value;
    const kode = document.getElementById('mdl-icd-kode').value.trim().toUpperCase();
    const nama = document.getElementById('mdl-icd-nama').value.trim();
    const kategori = document.getElementById('mdl-icd-kategori').value;
    if (!kode || !nama) { showToast('Kode dan nama penyakit wajib diisi!'); return; }
    const payload = { kode_icd: kode, nama_penyakit: nama, kategori };
    let error;
    if (id) {
        ({ error } = await window.__sb.from('icd10').update(payload).eq('id', id));
    } else {
        ({ error } = await window.__sb.from('icd10').insert(payload));
    }
    if (error) { showToast(' Gagal: ' + error.message); return; }
    hideM('mdl-icd');
    loadIcdTable();
}

// ===== KATEGORI OBAT =====
async function loadKatObatTable() {
    const tbody = document.getElementById('md-katobat-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';
    const { data, error } = await window.__sb.from('kategori_obat').select('*').order('nama_kategori');
    if (error) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--danger)">❌ ${error.message}</td></tr>`; return; }
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada data kategori</td></tr>'; return; }
    tbody.innerHTML = data.map(k => `<tr>
        <td><strong>${k.nama_kategori}</strong></td>
        <td>${k.deskripsi || '—'}</td>
        <td><button class="btn btn-o btn-xs" onclick="editKatObat('${k.id}')">✏️</button> <button class="btn btn-d btn-xs" onclick="hapusKatObat('${k.id}')">🗑️</button></td>
    </tr>`).join('');
}

async function showMdlKatObat() {
    document.getElementById('mdl-katobat-id').value = '';
    document.getElementById('mdl-katobat-nama').value = '';
    document.getElementById('mdl-katobat-desk').value = '';
    showM('mdl-katobat');
}

async function editKatObat(id) {
    const { data, error } = await window.__sb.from('kategori_obat').select('*').eq('id', id).single();
    if (error || !data) { showToast(' Data tidak ditemukan'); return; }
    document.getElementById('mdl-katobat-id').value = data.id;
    document.getElementById('mdl-katobat-nama').value = data.nama_kategori;
    document.getElementById('mdl-katobat-desk').value = data.deskripsi || '';
    showM('mdl-katobat');
}

async function hapusKatObat(id) {
    if (!confirm('Yakin hapus kategori ini?')) return;
    const { error } = await window.__sb.from('kategori_obat').delete().eq('id', id);
    if (error) { showToast(' Gagal hapus: ' + error.message); return; }
    loadKatObatTable();
}

async function submitKatObat() {
    const id = document.getElementById('mdl-katobat-id').value;
    const nama = document.getElementById('mdl-katobat-nama').value.trim();
    const desk = document.getElementById('mdl-katobat-desk').value.trim();
    if (!nama) { showToast('Nama kategori wajib diisi!'); return; }
    const payload = { nama_kategori: nama, deskripsi: desk || null };
    let error;
    if (id) {
        ({ error } = await window.__sb.from('kategori_obat').update(payload).eq('id', id));
    } else {
        ({ error } = await window.__sb.from('kategori_obat').insert(payload));
    }
    if (error) { showToast(' Gagal: ' + error.message); return; }
    hideM('mdl-katobat');
    loadKatObatTable();
}

// ===== STOK & INVENTORY =====

/**
 * Main Stok page loader
 */
async function loadStok() {
  await SharedState.waitReady();
  
  const { data: medicines, error } = await window.__sb.from('medicines').select('*');
  if (error) return console.error(error);
  
  // Render stat cards
  const totalItems = medicines.length;
  const totalQty = medicines.reduce((s, m) => s + (m.stok || 0), 0);
  const lowItems = medicines.filter(m => m.stok <= m.stok_minimum).length;
  const totalValue = medicines.reduce((s, m) => s + ((m.stok || 0) * (m.harga_satuan || 0)), 0);
  
  document.getElementById('stok-total-items').textContent = totalItems;
  document.getElementById('stok-total-qty').textContent = totalQty.toLocaleString();
  document.getElementById('stok-low-items').textContent = lowItems;
  document.getElementById('stok-total-value').textContent = formatRupiah(totalValue);
  
  // Populate kategori filter
  const kats = [...new Set(medicines.map(m => m.kategori).filter(Boolean))];
  const katSelect = document.getElementById('stok-filter-kat');
  katSelect.innerHTML = '<option value="">Semua Kategori</option>' + kats.map(k => `<option value="${k}">${k}</option>`).join('');
  
  // Store data for filtering
  window.__stokData = medicines;
  renderStokTable(medicines);
}

/**
 * Render the stok table
 */
function renderStokTable(data) {
  const tbody = document.getElementById('stok-tbody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada data obat</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(m => {
    const stok = m.stok || 0;
    const min = m.stok_minimum || 0;
    let status, statusClass;
    if (stok === 0) { status = 'Kosong'; statusClass = 'b bd'; }
    else if (stok <= min) { status = 'Warning'; statusClass = 'b bw'; }
    else { status = 'Aman'; statusClass = 'b bs'; }
    
    return `<tr>
      <td class="mono">${m.kode || '-'}</td>
      <td><strong>${m.nama_obat || '-'}</strong></td>
      <td><span class="b bg">${m.kategori || '-'}</span></td>
      <td style="font-weight:800;font-size:16px">${stok}</td>
      <td>${min}</td>
      <td><span class="${statusClass}">${status}</span></td>
      <td>${m.satuan || '-'}</td>
      <td>Rp ${(m.harga_satuan || 0).toLocaleString()}</td>
      <td>
        <button class="btn btn-xs btn-o" onclick="editObat('${m.id}')">✏️</button>
        <button class="btn btn-xs btn-d" onclick="deleteObat('${m.id}','${m.nama_obat.replace(/'/g, "\\'")}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

/**
 * Filter stok table by search, kategori, and low-stock checkbox
 */
function filterStok(searchVal) {
  const data = window.__stokData || [];
  const search = (searchVal || document.getElementById('stok-search').value || '').toLowerCase();
  const kat = document.getElementById('stok-filter-kat').value;
  const onlyLow = document.getElementById('stok-only-low').checked;
  
  let filtered = data.filter(m => {
    if (search && !m.nama_obat?.toLowerCase().includes(search) && !m.kode?.toLowerCase().includes(search)) return false;
    if (kat && m.kategori !== kat) return false;
    if (onlyLow && (m.stok || 0) > (m.stok_minimum || 0)) return false;
    return true;
  });
  renderStokTable(filtered);
}

/**
 * Show modal to add new medicine
 */
function showMdlTambahObat() {
  document.getElementById('mdl-obat-id').value = '';
  document.getElementById('mdl-obat-kode').value = '';
  document.getElementById('mdl-obat-kategori').value = 'Tablet';
  document.getElementById('mdl-obat-nama').value = '';
  document.getElementById('mdl-obat-stok').value = '0';
  document.getElementById('mdl-obat-min').value = '10';
  document.getElementById('mdl-obat-satuan').value = 'tablet';
  document.getElementById('mdl-obat-harga').value = '';
  document.getElementById('mdl-obat-exp').value = '';
  document.querySelector('#mdl-obat .mt').textContent = '💊 Tambah Obat';
  showM('mdl-obat');
}

/**
 * Edit existing medicine
 */
async function editObat(id) {
  await SharedState.waitReady();
  const { data, error } = await window.__sb.from('medicines').select('*').eq('id', id).single();
  if (error || !data) { showToast(' Data tidak ditemukan'); return; }
  
  document.getElementById('mdl-obat-id').value = data.id;
  document.getElementById('mdl-obat-kode').value = data.kode || '';
  document.getElementById('mdl-obat-kategori').value = data.kategori || 'Tablet';
  document.getElementById('mdl-obat-nama').value = data.nama_obat || '';
  document.getElementById('mdl-obat-stok').value = data.stok || 0;
  document.getElementById('mdl-obat-min').value = data.stok_minimum || 10;
  document.getElementById('mdl-obat-satuan').value = data.satuan || 'tablet';
  document.getElementById('mdl-obat-harga').value = data.harga_satuan || '';
  document.getElementById('mdl-obat-exp').value = data.expired_date ? data.expired_date.slice(0, 10) : '';
  document.querySelector('#mdl-obat .mt').textContent = '✏️ Edit Obat';
  showM('mdl-obat');
}

/**
 * Submit medicine (insert or update)
 */
async function submitObat() {
  const id = document.getElementById('mdl-obat-id').value;
  const kode = document.getElementById('mdl-obat-kode').value.trim();
  const kategori = document.getElementById('mdl-obat-kategori').value;
  const nama = document.getElementById('mdl-obat-nama').value.trim();
  const stok = parseInt(document.getElementById('mdl-obat-stok').value) || 0;
  const min = parseInt(document.getElementById('mdl-obat-min').value) || 10;
  const satuan = document.getElementById('mdl-obat-satuan').value;
  const harga = parseInt(document.getElementById('mdl-obat-harga').value) || 0;
  const exp = document.getElementById('mdl-obat-exp').value;
  
  if (!nama) { showToast('Nama obat wajib diisi!'); return; }
  if (!kode) { showToast('Kode obat wajib diisi!'); return; }
  
  const payload = {
    kode,
    kategori,
    nama_obat: nama,
    stok,
    stok_minimum: min,
    satuan,
    harga_satuan: harga || null,
    expired_date: exp || null
  };
  
  let error;
  if (id) {
    ({ error } = await window.__sb.from('medicines').update(payload).eq('id', id));
  } else {
    ({ error } = await window.__sb.from('medicines').insert(payload));
  }
  
  if (error) { showToast(' Gagal: ' + error.message); return; }
  hideM('mdl-obat');
  loadStok();
}

/**
 * Delete a medicine
 */
async function deleteObat(id, nama) {
  if (!confirm(`Yakin ingin menghapus "${nama}"?`)) return;
  const { error } = await window.__sb.from('medicines').delete().eq('id', id);
  if (error) { showToast(' Gagal hapus: ' + error.message); return; }
  loadStok();
}

/**
 * Show modal for stock receipt (penerimaan)
 */
async function showMdlStokMasuk() {
  await SharedState.waitReady();
  
  // Populate obat dropdown
  const { data: medicines } = await window.__sb.from('medicines').select('id, kode, nama_obat').order('nama_obat');
  const select = document.getElementById('mdl-sm-obat');
  select.innerHTML = '<option value="">— Pilih Obat —</option>';
  if (medicines) {
    select.innerHTML += medicines.map(m => 
      `<option value="${m.id}">${m.kode} — ${m.nama_obat}</option>`
    ).join('');
  }
  
  // Reset form
  document.getElementById('mdl-sm-qty').value = '';
  document.getElementById('mdl-sm-harga').value = '';
  document.getElementById('mdl-sm-ref').value = '';
  document.getElementById('mdl-sm-ket').value = '';
  
  showM('mdl-stok-masuk');
}

/**
 * Submit stock receipt — updates medicines.stok directly
 */
async function submitStokMasuk() {
  const obatId = document.getElementById('mdl-sm-obat').value;
  const qty = parseInt(document.getElementById('mdl-sm-qty').value);
  const harga = document.getElementById('mdl-sm-harga').value.trim();
  const ref = document.getElementById('mdl-sm-ref').value.trim();
  const ket = document.getElementById('mdl-sm-ket').value.trim();
  
  if (!obatId || !qty || qty <= 0) {
    showToast(' Pilih obat dan masukkan jumlah yang valid');
    return;
  }
  
  // Read current stok, then add
  const { data: cur } = await window.__sb.from('medicines').select('stok').eq('id', obatId).single();
  const newStok = (cur?.stok || 0) + qty;
  
  const updateData = { stok: newStok };
  if (harga) updateData.harga_satuan = parseInt(harga);
  
  const { error } = await window.__sb.from('medicines').update(updateData).eq('id', obatId);
  if (error) { showToast(' Gagal: ' + error.message); return; }
  
  console.log('📥 Stok Masuk:', { obatId, qty, ref, ket });
  showToast(`✅ Penerimaan berhasil! Stok baru: ${newStok}`);
  hideM('mdl-stok-masuk');
  loadStok();
}

/**
 * Show modal for stock opname
 */
async function showMdlStokOpname() {
  await SharedState.waitReady();
  
  // Populate obat dropdown
  const { data: medicines } = await window.__sb.from('medicines').select('id, kode, nama_obat').order('nama_obat');
  const select = document.getElementById('mdl-so-obat');
  select.innerHTML = '<option value="">— Pilih Obat —</option>';
  if (medicines) {
    select.innerHTML += medicines.map(m => 
      `<option value="${m.id}">${m.kode} — ${m.nama_obat}</option>`
    ).join('');
  }
  
  // Reset form
  document.getElementById('mdl-so-stok-sistem').value = '';
  document.getElementById('mdl-so-stok-fisik').value = '';
  document.getElementById('mdl-so-ket').value = '';
  
  // When obat changes, load current stok
  select.onchange = async function() {
    const id = this.value;
    if (!id) { document.getElementById('mdl-so-stok-sistem').value = ''; return; }
    const { data } = await window.__sb.from('medicines').select('stok').eq('id', id).single();
    document.getElementById('mdl-so-stok-sistem').value = data?.stok || 0;
  };
  
  showM('mdl-stok-opname');
}

/**
 * Submit stock opname — sets medicines.stok to physical count
 */
async function submitStokOpname() {
  const obatId = document.getElementById('mdl-so-obat').value;
  const stokFisik = parseInt(document.getElementById('mdl-so-stok-fisik').value);
  const ket = document.getElementById('mdl-so-ket').value.trim();
  
  if (!obatId || isNaN(stokFisik) || stokFisik < 0) {
    showToast(' Pilih obat dan masukkan stok fisik yang valid');
    return;
  }
  
  const { error } = await window.__sb.from('medicines').update({ stok: stokFisik }).eq('id', obatId);
  if (error) { showToast(' Gagal: ' + error.message); return; }
  
  console.log('📋 Stok Opname:', { obatId, stokFisik, ket });
  showToast(`✅ Opname berhasil! Stok diatur ke: ${stokFisik}`);
  hideM('mdl-stok-opname');
  loadStok();
}

// ===== PEMBELIAN (PURCHASE ORDERS) =====

/**
 * Check if error is a table-not-found error
 */
function isTableNotFound(err) {
  return err && (err.message || '').toLowerCase().includes('could not find the table');
}

/**
 * Main Pembelian page loader
 */
async function loadPembelian() {
  await SharedState.waitReady();

  const tbody = document.getElementById('beli-tbody');
  if (!tbody) return;

  // Fetch suppliers
  let suppliers = [];
  let poErr = null;
  try {
    const { data: sData, error: sErr } = await window.__sb.from('suppliers').select('*');
    if (sErr) throw sErr;
    suppliers = sData || [];
    window.__beliSuppliers = suppliers;
  } catch (e) {
    if (isTableNotFound(e)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px"><div style="color:#dc2626;font-weight:700;margin-bottom:8px">⚠️ Database table belum dibuat</div><div style="color:var(--text-muted);font-size:13px">Jalankan file <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sql/03-pembelian.sql</code> di Supabase SQL Editor terlebih dahulu.</div></td></tr>';
      // Also show banner
      const stats = document.getElementById('beli-stats');
      if (stats && !document.getElementById('beli-db-banner')) {
        const banner = document.createElement('div');
        banner.id = 'beli-db-banner';
        banner.style.cssText = 'background:#fee2e2;color:#dc2626;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-weight:600';
        banner.textContent = '⚠️ Database table belum dibuat — jalankan sql/03-pembelian.sql di Supabase SQL Editor';
        stats.parentNode.insertBefore(banner, stats);
      }
      return;
    }
    console.error('loadPembelian error:', e);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">❌ Gagal memuat data</td></tr>';
    return;
  }

  // Remove banner if it exists
  const banner = document.getElementById('beli-db-banner');
  if (banner) banner.remove();

  // Fetch purchase orders and suppliers separately
  const { data: orders, error: oErr } = await window.__sb.from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (oErr) {
    if (isTableNotFound(oErr)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px"><div style="color:#dc2626;font-weight:700;margin-bottom:8px">⚠️ Database table belum dibuat</div><div style="color:var(--text-muted);font-size:13px">Jalankan file <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sql/03-pembelian.sql</code> di Supabase SQL Editor terlebih dahulu.</div></td></tr>';
      return;
    }
    console.error('loadPembelian orders error:', oErr);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">❌ Gagal memuat data PO</td></tr>';
    return;
  }

  // Update stat cards
  const totalPO = orders ? orders.length : 0;
  const pending = orders ? orders.filter(o => o.status === 'draft' || o.status === 'dipesan').length : 0;
  const selesai = orders ? orders.filter(o => o.status === 'selesai').length : 0;
  const diproses = orders ? orders.filter(o => o.status === 'diterima_sebagian').length : 0;

  document.getElementById('beli-total-po').textContent = totalPO;
  document.getElementById('beli-po-pending').textContent = pending;
  document.getElementById('beli-po-selesai').textContent = selesai;
  document.getElementById('beli-po-diproses').textContent = diproses;

  // Store data for filtering
  window.__beliOrders = orders || [];
  window.__beliSuppliers = suppliers;

  renderBeliTable(window.__beliOrders);
}

/**
 * Render the purchase order table
 */
function renderBeliTable(data) {
  const tbody = document.getElementById('beli-tbody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada Purchase Order. Klik "+ Buat PO" untuk membuat PO baru.</td></tr>';
    return;
  }

  const statusMap = {
    draft: { label: 'Draft', cls: 'b bd' },
    dipesan: { label: 'Dipesan', cls: 'b bi' },
    diterima_sebagian: { label: 'Diterima Sebagian', cls: 'b bw' },
    selesai: { label: 'Selesai', cls: 'b bs' },
    dibatalkan: { label: 'Dibatalkan', cls: 'b ba' }
  };

  tbody.innerHTML = data.map(po => {
    const st = statusMap[po.status] || { label: po.status || 'Unknown', cls: 'b bd' };
    const supplierName = po.suppliers?.nama_supplier || (window.__beliSuppliers || []).find(s => s.id === po.supplier_id)?.nama_supplier || '-';
    const total = po.total || 0;
    const canDelete = po.status === 'draft';

    return `<tr>
      <td class="mono" style="font-weight:600">${po.no_po || '-'}</td>
      <td>${supplierName}</td>
      <td>${po.tgl_po || '-'}</td>
      <td>${po.tgl_jatuh_tempo || '-'}</td>
      <td style="font-weight:600">Rp ${total.toLocaleString()}</td>
      <td><span class="${st.cls}">${st.label}</span></td>
      <td>
        <button class="btn btn-xs btn-p" onclick="seePO('${po.id}')">📋 Detail</button>
        ${canDelete ? `<button class="btn btn-xs btn-d" onclick="hapusPO('${po.id}')">🗑️ Hapus</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

/**
 * Filter purchase orders by search text and status
 */
function filterPembelian(searchVal) {
  const data = window.__beliOrders || [];
  const search = (searchVal || document.getElementById('beli-search')?.value || '').toLowerCase();
  const status = document.getElementById('pembelian-filter-status')?.value || '';

  const filtered = data.filter(po => {
    // Search filter
    if (search) {
      const poNo = (po.no_po || '').toLowerCase();
      const supplier = (window.__beliSuppliers || []).find(s => s.id === po.supplier_id);
      const supplierName = (supplier?.nama_supplier || '').toLowerCase();
      if (!poNo.includes(search) && !supplierName.includes(search)) return false;
    }
    // Status filter
    if (status && po.status !== status) return false;
    return true;
  });

  renderBeliTable(filtered);
}

/**
 * Show modal to create new PO
 */
function showMdlPOTambah() {
  // Generate PO number: PO-YYYYMMDD-001
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Auto-increment: find existing PO numbers from today
  const existingPOs = (window.__beliOrders || []).filter(po => (po.no_po || '').startsWith('PO-' + dateStr));
  let nextNum = 1;
  if (existingPOs.length > 0) {
    const nums = existingPOs.map(po => {
      const parts = po.no_po.split('-');
      return parseInt(parts[parts.length - 1]) || 0;
    });
    nextNum = Math.max(...nums) + 1;
  }
  const noPO = 'PO-' + dateStr + '-' + String(nextNum).padStart(3, '0');

  document.getElementById('mdl-po-id').value = '';
  document.getElementById('mdl-po-no').value = noPO;
  document.getElementById('mdl-po-tgl').value = today.toISOString().slice(0, 10);
  document.getElementById('mdl-po-jt').value = '';
  document.getElementById('mdl-po-ket').value = '';

  // Populate supplier dropdown
  const selSupplier = document.getElementById('mdl-po-supplier');
  const suppliers = window.__beliSuppliers || [];
  selSupplier.innerHTML = '<option value="">— Pilih Supplier —</option>' +
    suppliers.map(s => `<option value="${s.id}">${s.kode || ''} — ${s.nama_supplier}</option>`).join('');

  // Clear items container and add one empty row
  document.getElementById('po-items-container').innerHTML = '';
  addPoItemRow();
  document.getElementById('po-total-display').textContent = 'Rp 0';

  // Show the modal title
  document.querySelector('#mdl-po .mt').textContent = '📥 Buat Purchase Order';
  showM('mdl-po');
}

/**
 * Add a row for PO item (obat selector + qty + harga)
 */
function addPoItemRow(obatId, qty, harga) {
  const container = document.getElementById('po-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
  row.className = 'po-item-row';

  // Select for medicine
  const select = document.createElement('select');
  select.className = 'fc';
  select.style.cssText = 'flex:3';
  select.onchange = poItemChange;

  // Populate with medicines — use window.__stokData if available, else try direct query
  const medicines = window.__stokData || [];
  if (medicines.length > 0) {
    select.innerHTML = '<option value="">— Pilih Obat —</option>' +
      medicines.map(m => `<option value="${m.id}">${m.kode || ''} — ${m.nama_obat || ''}</option>`).join('');
  } else {
    select.innerHTML = '<option value="">— Pilih Obat —</option>';
    // Try to load medicines directly
    window.__sb.from('medicines').select('id,kode,nama_obat').then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        window.__stokData = data;
        select.innerHTML = '<option value="">— Pilih Obat —</option>' +
          data.map(m => `<option value="${m.id}">${m.kode || ''} — ${m.nama_obat || ''}</option>`).join('');
      }
    });
  }

  if (obatId) select.value = obatId;

  // Qty input
  const qtyInput = document.createElement('input');
  qtyInput.className = 'fc po-item-qty';
  qtyInput.type = 'number';
  qtyInput.min = '1';
  qtyInput.placeholder = 'Qty';
  qtyInput.style.cssText = 'flex:1;width:70px';
  qtyInput.value = qty || '';
  qtyInput.oninput = poItemChange;

  // Harga input
  const hargaInput = document.createElement('input');
  hargaInput.className = 'fc po-item-harga';
  hargaInput.type = 'number';
  hargaInput.min = '0';
  hargaInput.placeholder = 'Harga';
  hargaInput.style.cssText = 'flex:1;width:100px';
  hargaInput.value = harga || '';
  hargaInput.oninput = poItemChange;

  // Subtotal display
  const subtotal = document.createElement('span');
  subtotal.className = 'po-item-subtotal';
  subtotal.style.cssText = 'font-weight:600;min-width:80px;text-align:right';
  subtotal.textContent = 'Rp 0';

  // Remove button
  const rmBtn = document.createElement('button');
  rmBtn.className = 'btn btn-xs btn-d';
  rmBtn.textContent = '✕';
  rmBtn.onclick = function() {
    row.remove();
    poItemChange();
  };

  row.appendChild(select);
  row.appendChild(qtyInput);
  row.appendChild(hargaInput);
  row.appendChild(subtotal);
  row.appendChild(rmBtn);
  container.appendChild(row);

  if (obatId && qty && harga) {
    poItemChange();
  }
}

/**
 * Recalculate all item subtotals and update total display
 */
function poItemChange() {
  const rows = document.querySelectorAll('#po-items-container .po-item-row');
  let total = 0;

  rows.forEach(row => {
    const qty = parseInt(row.querySelector('.po-item-qty')?.value) || 0;
    const harga = parseInt(row.querySelector('.po-item-harga')?.value) || 0;
    const sub = qty * harga;
    const subSpan = row.querySelector('.po-item-subtotal');
    if (subSpan) subSpan.textContent = formatRupiah(sub);
    total += sub;
  });

  document.getElementById('po-total-display').textContent = formatRupiah(total);
}

/**
 * Submit a new Purchase Order
 */
async function submitPO() {
  const noPO = document.getElementById('mdl-po-no').value.trim();
  const supplierId = document.getElementById('mdl-po-supplier').value;
  const tglPO = document.getElementById('mdl-po-tgl').value;
  const tglJT = document.getElementById('mdl-po-jt').value;
  const ket = document.getElementById('mdl-po-ket').value.trim();
  const poId = document.getElementById('mdl-po-id').value;

  // Validation
  if (!noPO) { showToast(' No. PO harus diisi'); return; }
  if (!supplierId) { showToast(' Supplier harus dipilih'); return; }

  // Get items
  const rows = document.querySelectorAll('#po-items-container .po-item-row');
  const items = [];
  rows.forEach(row => {
    const obatId = row.querySelector('select')?.value;
    const qty = parseInt(row.querySelector('.po-item-qty')?.value);
    const harga = parseInt(row.querySelector('.po-item-harga')?.value);
    if (obatId && qty > 0) {
      items.push({ medicine_id: obatId, qty, harga_satuan: harga || 0, subtotal: qty * (harga || 0) });
    }
  });

  if (items.length === 0) { showToast(' Minimal 1 item obat harus ditambahkan'); return; }

  await SharedState.waitReady();

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  try {
    if (poId) {
      // Update existing PO (not fully implemented for edit, but handle gracefully)
      const { error: upErr } = await window.__sb.from('purchase_orders')
        .update({ no_po: noPO, supplier_id: supplierId, tgl_po: tglPO, tgl_jatuh_tempo: tglJT, keterangan: ket, total, subtotal: total })
        .eq('id', poId);
      if (upErr) throw upErr;
    } else {
      // Insert PO
      const { data: poData, error: poErr } = await window.__sb.from('purchase_orders')
        .insert({ no_po: noPO, supplier_id: supplierId, tgl_po: tglPO, tgl_jatuh_tempo: tglJT, keterangan: ket, total, subtotal: total })
        .select('id')
        .single();
      if (poErr) throw poErr;

      // Insert items
      const poItems = items.map(i => ({ ...i, po_id: poData.id }));
      const { error: itemsErr } = await window.__sb.from('purchase_order_items').insert(poItems);
      if (itemsErr) throw itemsErr;
    }

    hideM('mdl-po');
    showToast(' PO berhasil disimpan!');
    loadPembelian();
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/03-pembelian.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal menyimpan PO: ' + e.message);
    }
    console.error('submitPO error:', e);
  }
}

/**
 * Show PO detail modal
 */
async function seePO(id) {
  await SharedState.waitReady();

  try {
    const { data: po, error: poErr } = await window.__sb.from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();
    if (poErr) throw poErr;
    if (!po) { showToast(' PO tidak ditemukan'); return; }

    const { data: items, error: itemsErr } = await window.__sb.from('purchase_order_items')
      .select('*, medicines!purchase_order_items_medicine_id_fkey(nama_obat, kode, satuan)')
      .eq('po_id', id);
    if (itemsErr) throw itemsErr;

    // Store current PO data for terimaPO
    window.__currentPO = { po, items };

    // Render info
    const supplierName = (window.__beliSuppliers || []).find(s => s.id === po.supplier_id)?.nama_supplier || '-';
    const infoDiv = document.getElementById('po-detail-info');
    infoDiv.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;background:#f8fafc;padding:12px;border-radius:8px">
        <div><strong>No. PO:</strong> ${po.no_po || '-'}</div>
        <div><strong>Status:</strong> <span class="${getStatusBadgeClass(po.status)}">${getStatusLabel(po.status)}</span></div>
        <div><strong>Supplier:</strong> ${supplierName}</div>
        <div><strong>Tgl. PO:</strong> ${po.tgl_po || '-'}</div>
        <div><strong>Jatuh Tempo:</strong> ${po.tgl_jatuh_tempo || '-'}</div>
        <div><strong>Total:</strong> Rp ${(po.total || 0).toLocaleString()}</div>
      </div>
      ${po.keterangan ? `<div style="margin-top:8px;padding:8px 12px;background:#fef9c3;border-radius:6px;font-size:13px"><strong>Catatan:</strong> ${po.keterangan}</div>` : ''}
    `;

    // Render items table
    const itemsDiv = document.getElementById('po-detail-items');
    if (!items || items.length === 0) {
      itemsDiv.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)">Tidak ada item</div>';
    } else {
      itemsDiv.innerHTML = `
        <table class="t"><thead><tr><th>Obat</th><th>Qty</th><th>Harga Satuan</th><th>Subtotal</th><th>Diterima</th></tr></thead>
        <tbody>${items.map(i => `
          <tr>
            <td>${i.medicines?.nama_obat || '-'} <span class="mono" style="color:var(--text-muted)">${i.medicines?.kode || ''}</span></td>
            <td>${i.qty}</td>
            <td>Rp ${(i.harga_satuan || 0).toLocaleString()}</td>
            <td>Rp ${(i.subtotal || 0).toLocaleString()}</td>
            <td>${i.qty_diterima || 0}</td>
          </tr>`).join('')}</tbody>
      </table>`;
    }

    // Show/hide terima button
    const btnTerima = document.getElementById('btn-terima-po');
    if (po.status === 'dipesan' || po.status === 'diterima_sebagian') {
      btnTerima.style.display = 'inline-flex';
    } else {
      btnTerima.style.display = 'none';
    }

    document.querySelector('#mdl-po-detail .mt').textContent = '📋 Detail PO — ' + (po.no_po || '');
    showM('mdl-po-detail');
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/03-pembelian.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal memuat detail PO: ' + e.message);
    }
    console.error('seePO error:', e);
  }
}

/**
 * Helper: get status badge class
 */
function getStatusBadgeClass(status) {
  const map = {
    draft: 'b bd',
    dipesan: 'b bi',
    diterima_sebagian: 'b bw',
    selesai: 'b bs',
    dibatalkan: 'b ba'
  };
  return map[status] || 'b bd';
}

/**
 * Helper: get status label
 */
function getStatusLabel(status) {
  const map = {
    draft: 'Draft',
    dipesan: 'Dipesan',
    diterima_sebagian: 'Diterima Sebagian',
    selesai: 'Selesai',
    dibatalkan: 'Dibatalkan'
  };
  return map[status] || status || 'Unknown';
}

/**
 * Terima barang (receive items) for a PO
 */
async function terimaPO() {
  const poData = window.__currentPO;
  if (!poData || !poData.po || !poData.items) {
    showToast(' Data PO tidak tersedia. Silakan buka detail PO lagi.');
    return;
  }

  const { po, items } = poData;

  // Confirm
  const remainingItems = items.filter(i => (i.qty || 0) > (i.qty_diterima || 0));
  if (remainingItems.length === 0) {
    showToast(' Semua item sudah diterima seluruhnya.');
    return;
  }

  if (!confirm('📥 Terima barang untuk PO ' + po.no_po + '? Item yang akan diterima: ' + remainingItems.length)) return;

  await SharedState.waitReady();

  try {
    // For each item, update qty_diterima to qty (receive all remaining)
    for (const item of items) {
      const qtyRemaining = (item.qty || 0) - (item.qty_diterima || 0);
      if (qtyRemaining <= 0) continue;

      // Update qty_diterima on purchase_order_items
      const { error: upItemErr } = await window.__sb.from('purchase_order_items')
        .update({ qty_diterima: item.qty })
        .eq('id', item.id);
      if (upItemErr) throw upItemErr;

      // Add to medicines.stok
      if (item.medicine_id) {
        const { data: med, error: medErr } = await window.__sb.from('medicines')
          .select('stok')
          .eq('id', item.medicine_id)
          .single();
        if (medErr) throw medErr;

        const newStok = (med?.stok || 0) + qtyRemaining;
        const { error: updateStokErr } = await window.__sb.from('medicines')
          .update({ stok: newStok })
          .eq('id', item.medicine_id);
        if (updateStokErr) throw updateStokErr;
      }
    }

    // After the loop, all items have qty_diterima = qty, so status is always 'selesai'
    const newStatus = 'selesai';

    // Update PO status
    const { error: poUpdateErr } = await window.__sb.from('purchase_orders')
      .update({ status: newStatus })
      .eq('id', po.id);
    if (poUpdateErr) throw poUpdateErr;

    hideM('mdl-po-detail');
    showToast(' Barang berhasil diterima! Stok telah ditambahkan.');
    loadPembelian();
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/03-pembelian.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal menerima barang: ' + e.message);
    }
    console.error('terimaPO error:', e);
  }
}

/**
 * Hapus PO (only for draft status)
 */
async function hapusPO(id) {
  if (!confirm('🗑️ Hapus PO ini?')) return;

  await SharedState.waitReady();

  try {
    const { error } = await window.__sb.from('purchase_orders').delete().eq('id', id);
    if (error) throw error;
    showToast(' PO berhasil dihapus');
    loadPembelian();
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/03-pembelian.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal menghapus PO: ' + e.message);
    }
  }
}

// ===== KAS & BANK (CASH & BANK MODULE) =====

/**
 * Format a number as Indonesian Rupiah
 */
function formatCurrency(n) {
  if (n === null || n === undefined) return 'Rp 0';
  const num = parseFloat(n);
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Get today's date as YYYY-MM-DD
 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Helper: get akun name by ID from cached data
 */
function getAkunName(akunId) {
  if (!window.__kasData || !window.__kasData.akun) return akunId;
  const a = window.__kasData.akun.find(x => x.id === akunId);
  return a ? a.nama_akun : akunId;
}

/**
 * Helper: get kategori name by ID from cached data
 */
function getKategoriName(katId) {
  if (!window.__kasData || !window.__kasData.kategori) return katId;
  const k = window.__kasData.kategori.find(x => x.id === katId);
  return k ? k.nama_kategori : katId;
}

/**
 * Calculate running saldo for a specific akun based on all transactions
 */
function calculateSaldo(akunId, akunList, transaksiList) {
  const akun = akunList.find(a => a.id === akunId);
  let saldo = akun ? parseFloat(akun.saldo_awal) || 0 : 0;
  const trx = transaksiList.filter(t => t.akun_id === akunId)
    .sort((a, b) => new Date(a.tanggal + 'T' + a.created_at) - new Date(b.tanggal + 'T' + b.created_at));
  for (const t of trx) {
    if (t.tipe === 'pemasukan') saldo += parseFloat(t.jumlah);
    else if (t.tipe === 'pengeluaran' || t.tipe === 'transfer') saldo -= parseFloat(t.jumlah);
  }
  return saldo;
}

/**
 * Main page loader for Kas & Bank
 */
async function loadKasBank() {
  await SharedState.waitReady();

  const tbody = document.getElementById('kas-tbody');
  if (!tbody) return;

  // Show loading
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat data...</td></tr>';

  try {
    // Fetch akun kas (active only)
    const { data: akunData, error: akunErr } = await window.__sb.from('akun_kas').select('*').eq('aktif', true);
    if (akunErr) throw akunErr;

    // Fetch kategori kas (active only)
    const { data: kategoriData, error: katErr } = await window.__sb.from('kategori_kas').select('*').eq('aktif', true);
    if (katErr) throw katErr;

    // Fetch transaksi kas ordered by tanggal DESC, created_at DESC
    const { data: trxData, error: trxErr } = await window.__sb.from('transaksi_kas')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });
    if (trxErr) throw trxErr;

    const transaksi = trxData || [];
    const akun = akunData || [];
    const kategori = kategoriData || [];

    // Store for filtering
    window.__kasData = { transaksi, akun, kategori };

    // === Calculate stat cards ===

    // Saldo total: sum of all akun balances
    let totalSaldo = 0;
    for (const a of akun) {
      totalSaldo += calculateSaldo(a.id, akun, transaksi);
    }
    document.getElementById('kas-saldo-total').textContent = formatCurrency(totalSaldo);

    // Pemasukan hari ini
    const today = todayStr();
    let pemasukanHariIni = 0;
    for (const t of transaksi) {
      if (t.tanggal === today && t.tipe === 'pemasukan') {
        pemasukanHariIni += parseFloat(t.jumlah);
      }
    }
    document.getElementById('kas-pemasukan-hariini').textContent = formatCurrency(pemasukanHariIni);

    // Pengeluaran hari ini
    let pengeluaranHariIni = 0;
    for (const t of transaksi) {
      if (t.tanggal === today && (t.tipe === 'pengeluaran' || t.tipe === 'transfer')) {
        pengeluaranHariIni += parseFloat(t.jumlah);
      }
    }
    document.getElementById('kas-pengeluaran-hariini').textContent = formatCurrency(pengeluaranHariIni);

    // Jumlah akun aktif
    document.getElementById('kas-jml-akun').textContent = akun.length;

    // === Populate filter dropdowns ===

    // Akun filter
    const filterAkun = document.getElementById('kas-filter-akun');
    if (filterAkun) {
      const currentVal = filterAkun.value;
      filterAkun.innerHTML = '<option value="">Semua Akun</option>';
      for (const a of akun) {
        filterAkun.innerHTML += `<option value="${a.id}">${a.nama_akun}</option>`;
      }
      filterAkun.value = currentVal;
    }

    // Kategori filter
    const filterKategori = document.getElementById('kas-filter-kategori');
    if (filterKategori) {
      filterKategori.innerHTML = '<option value="">Semua Kategori</option>';
      for (const k of kategori) {
        filterKategori.innerHTML += `<option value="${k.id}">${k.nama_kategori}</option>`;
      }
    }

    renderKasTable(transaksi);
  } catch (e) {
    if (isTableNotFound(e)) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px"><div style="color:#dc2626;font-weight:700;margin-bottom:8px">⚠️ Database table belum dibuat</div><div style="color:var(--text-muted);font-size:13px">Jalankan file <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sql/04-kas-bank.sql</code> di Supabase SQL Editor terlebih dahulu.</div></td></tr>';
      document.getElementById('kas-saldo-total').textContent = '⚠️';
      document.getElementById('kas-pemasukan-hariini').textContent = '⚠️';
      document.getElementById('kas-pengeluaran-hariini').textContent = '⚠️';
      document.getElementById('kas-jml-akun').textContent = '⚠️';
    } else {
      console.error('loadKasBank error:', e);
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:#dc2626">❌ Gagal memuat data: ' + e.message + '</td></tr>';
    }
  }
}

/**
 * Render the kas transactions table
 */
function renderKasTable(transaksi) {
  const tbody = document.getElementById('kas-tbody');
  if (!tbody) return;

  const akun = window.__kasData?.akun || [];
  const kategori = window.__kasData?.kategori || [];

  if (!transaksi || transaksi.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">📭 Belum ada transaksi</td></tr>';
    return;
  }

  // Build a map of running balances per akun
  // We need to process transactions in chronological order to get the running balance at each row
  // Since the data is sorted DESC, we process from end to start
  const runningBalances = {};
  for (const a of akun) {
    runningBalances[a.id] = parseFloat(a.saldo_awal) || 0;
  }
  // First pass: calculate cumulative saldo for each akun from all transactions in chronological order
  const sortedAll = [...transaksi].sort((a, b) => {
    const da = a.tanggal + 'T' + (a.created_at || '');
    const db = b.tanggal + 'T' + (b.created_at || '');
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
  for (const t of sortedAll) {
    if (t.tipe === 'pemasukan') runningBalances[t.akun_id] = (runningBalances[t.akun_id] || 0) + parseFloat(t.jumlah);
    else if (t.tipe === 'pengeluaran' || t.tipe === 'transfer') runningBalances[t.akun_id] = (runningBalances[t.akun_id] || 0) - parseFloat(t.jumlah);
  }

  let html = '';
  for (const t of transaksi) {
    const tanggal = t.tanggal || '—';
    const akunName = t.akun_kas?.nama_akun || getAkunName(t.akun_id);
    const kategoriName = t.kategori_kas?.nama_kategori || getKategoriName(t.kategori_id) || '—';
    const ket = t.keterangan || '—';
    const ref = t.referensi || '—';

    // For transfer, show "Dari: X → Ke: Y" in keterangan
    let displayKet = ket;
    if (t.tipe === 'transfer') {
      const tujuanNama = t.akun_tujuan_kas?.nama_akun || getAkunName(t.akun_tujuan_id) || '?';
      displayKet = `Dari: ${akunName} → ${tujuanNama}`;
      if (ket !== '—' && ket) displayKet = `${ket} (${displayKet})`;
    }

    // Tipe badge
    let tipeBadge = '';
    if (t.tipe === 'pemasukan') tipeBadge = '<span class="st-b st-s" style="background:#dcfce7;color:#166534">Pemasukan</span>';
    else if (t.tipe === 'pengeluaran') tipeBadge = '<span class="st-b st-d" style="background:#fee2e2;color:#991b1b">Pengeluaran</span>';
    else if (t.tipe === 'transfer') tipeBadge = '<span class="st-b st-i" style="background:#e0f2fe;color:#075985">Transfer</span>';

    // Pemasukan column
    const pemasukanCol = t.tipe === 'pemasukan' ? formatCurrency(t.jumlah) : '';
    // Pengeluaran column
    const pengeluaranCol = t.tipe === 'pengeluaran' ? formatCurrency(t.jumlah) : '';
    // For transfer: show amount in pengeluaran column for source view
    const transferCol = t.tipe === 'transfer' ? formatCurrency(t.jumlah) : '';

    // Display saldo: current running balance after this transaction
    // Since we sorted by DESC, we need to subtract the current transaction from running to get before, then show after
    // Actually, we already have saldo_sesudah from DB if set, else we calculate
    let saldoDisplay = '—';
    if (t.saldo_sesudah !== null && t.saldo_sesudah !== undefined) {
      saldoDisplay = formatCurrency(t.saldo_sesudah);
    } else {
      // Estimate from runningBalances (reverse order)
      saldoDisplay = formatCurrency(runningBalances[t.akun_id] || 0);
    }

    const displayPemasukan = t.tipe === 'pemasukan' ? formatCurrency(t.jumlah) : '';
    const displayPengeluaran = (t.tipe === 'pengeluaran' || t.tipe === 'transfer') ? formatCurrency(t.jumlah) : '';

    html += `<tr>
      <td>${tanggal}</td>
      <td>${akunName}</td>
      <td>${tipeBadge}</td>
      <td>${kategoriName}</td>
      <td>${displayKet}</td>
      <td>${ref}</td>
      <td style="color:#16a34a;font-weight:600">${displayPemasukan}</td>
      <td style="color:#dc2626;font-weight:600">${displayPengeluaran}</td>
      <td style="font-weight:600">${saldoDisplay}</td>
      <td><button class="btn btn-o btn-xs" onclick="seeKasDetail('${t.id}')">Detail</button></td>
    </tr>`;
  }

  tbody.innerHTML = html;
}

/**
 * Filter the kas transactions based on search/filter criteria
 */
function filterKas() {
  if (!window.__kasData || !window.__kasData.transaksi) return;

  const search = (document.getElementById('kas-search')?.value || '').toLowerCase().trim();
  const filterAkun = document.getElementById('kas-filter-akun')?.value || '';
  const filterTipe = document.getElementById('kas-filter-tipe')?.value || '';
  const filterKategori = document.getElementById('kas-filter-kategori')?.value || '';
  const tglDari = document.getElementById('kas-tgl-dari')?.value || '';
  const tglSampai = document.getElementById('kas-tgl-sampai')?.value || '';

  let filtered = [...window.__kasData.transaksi];

  if (search) {
    filtered = filtered.filter(t =>
      (t.keterangan || '').toLowerCase().includes(search) ||
      (t.referensi || '').toLowerCase().includes(search)
    );
  }

  if (filterAkun) {
    filtered = filtered.filter(t => t.akun_id === filterAkun || t.akun_tujuan_id === filterAkun);
  }

  if (filterTipe) {
    filtered = filtered.filter(t => t.tipe === filterTipe);
  }

  if (filterKategori) {
    filtered = filtered.filter(t => t.kategori_id === filterKategori);
  }

  if (tglDari) {
    filtered = filtered.filter(t => t.tanggal >= tglDari);
  }

  if (tglSampai) {
    filtered = filtered.filter(t => t.tanggal <= tglSampai);
  }

  renderKasTable(filtered);
}

/**
 * Show modal for adding pemasukan
 */
function showKasPemasukan() {
  document.getElementById('mdl-kas-trx-tipe').value = 'pemasukan';
  document.getElementById('mdl-kas-trx-title').textContent = '💰 Pemasukan Baru';
  document.getElementById('mdl-kas-trx-btn').textContent = '✅ Simpan Pemasukan';

  // Reset form
  document.getElementById('mdl-kas-trx-id').value = '';
  document.getElementById('mdl-kas-jumlah').value = '';
  document.getElementById('mdl-kas-ket').value = '';
  document.getElementById('mdl-kas-ref').value = '';
  document.getElementById('mdl-kas-tgl').value = todayStr();

  // Populate akun dropdown
  const akunSelect = document.getElementById('mdl-kas-akun');
  if (akunSelect && window.__kasData?.akun) {
    akunSelect.innerHTML = '<option value="">Pilih akun...</option>';
    for (const a of window.__kasData.akun) {
      akunSelect.innerHTML += `<option value="${a.id}">${a.nama_akun}</option>`;
    }
  }

  // Populate kategori (only pemasukan types)
  const katSelect = document.getElementById('mdl-kas-kategori');
  if (katSelect && window.__kasData?.kategori) {
    katSelect.innerHTML = '<option value="">Pilih kategori...</option>';
    for (const k of window.__kasData.kategori) {
      if (k.tipe === 'pemasukan') {
        katSelect.innerHTML += `<option value="${k.id}">${k.nama_kategori}</option>`;
      }
    }
  }

  showM('mdl-kas-transaksi');
}

/**
 * Show modal for adding pengeluaran
 */
function showKasPengeluaran() {
  document.getElementById('mdl-kas-trx-tipe').value = 'pengeluaran';
  document.getElementById('mdl-kas-trx-title').textContent = '💸 Pengeluaran Baru';
  document.getElementById('mdl-kas-trx-btn').textContent = '✅ Simpan Pengeluaran';

  // Reset form
  document.getElementById('mdl-kas-trx-id').value = '';
  document.getElementById('mdl-kas-jumlah').value = '';
  document.getElementById('mdl-kas-ket').value = '';
  document.getElementById('mdl-kas-ref').value = '';
  document.getElementById('mdl-kas-tgl').value = todayStr();

  // Populate akun dropdown
  const akunSelect = document.getElementById('mdl-kas-akun');
  if (akunSelect && window.__kasData?.akun) {
    akunSelect.innerHTML = '<option value="">Pilih akun...</option>';
    for (const a of window.__kasData.akun) {
      akunSelect.innerHTML += `<option value="${a.id}">${a.nama_akun}</option>`;
    }
  }

  // Populate kategori (only pengeluaran types)
  const katSelect = document.getElementById('mdl-kas-kategori');
  if (katSelect && window.__kasData?.kategori) {
    katSelect.innerHTML = '<option value="">Pilih kategori...</option>';
    for (const k of window.__kasData.kategori) {
      if (k.tipe === 'pengeluaran') {
        katSelect.innerHTML += `<option value="${k.id}">${k.nama_kategori}</option>`;
      }
    }
  }

  showM('mdl-kas-transaksi');
}

/**
 * Submit a pemasukan/pengeluaran transaction
 */
async function submitKasTransaksi() {
  const tipe = document.getElementById('mdl-kas-trx-tipe').value;
  const akunId = document.getElementById('mdl-kas-akun').value;
  const jumlah = parseFloat(document.getElementById('mdl-kas-jumlah').value);
  const tgl = document.getElementById('mdl-kas-tgl').value || todayStr();
  const kategoriId = document.getElementById('mdl-kas-kategori').value || null;
  const keterangan = document.getElementById('mdl-kas-ket').value || '';
  const referensi = document.getElementById('mdl-kas-ref').value || '';
  const trxId = document.getElementById('mdl-kas-trx-id').value;

  // Validation
  if (!akunId) { showToast(' Pilih akun terlebih dahulu'); return; }
  if (!jumlah || jumlah <= 0) { showToast(' Jumlah harus lebih dari 0'); return; }

  await SharedState.waitReady();

  try {
    // Get current saldo for this akun
    let currentSaldo = 0;
    const { data: akunData } = await window.__sb.from('akun_kas').select('saldo_awal').eq('id', akunId).single();
    if (akunData) {
      currentSaldo = parseFloat(akunData.saldo_awal) || 0;
      // Add up all existing transactions for this akun
      const { data: allTrx } = await window.__sb.from('transaksi_kas').select('*').eq('akun_id', akunId);
      if (allTrx) {
        for (const t of allTrx) {
          if (t.tipe === 'pemasukan') currentSaldo += parseFloat(t.jumlah);
          else if (t.tipe === 'pengeluaran' || t.tipe === 'transfer') currentSaldo -= parseFloat(t.jumlah);
        }
      }
    }

    let saldoSebelum = currentSaldo;
    let saldoSesudah;

    if (tipe === 'pemasukan') {
      saldoSesudah = saldoSebelum + jumlah;
    } else if (tipe === 'pengeluaran') {
      if (saldoSebelum < jumlah) {
        showToast(' Saldo tidak mencukupi! Saldo saat ini: ' + formatCurrency(saldoSebelum));
        return;
      }
      saldoSesudah = saldoSebelum - jumlah;
    } else {
      showToast(' Tipe transaksi tidak valid');
      return;
    }

    if (trxId) {
      // Edit existing transaction (update)
      const { error } = await window.__sb.from('transaksi_kas')
        .update({
          akun_id: akunId,
          kategori_id: kategoriId,
          tipe: tipe,
          jumlah: jumlah,
          saldo_sebelum: saldoSebelum,
          saldo_sesudah: saldoSesudah,
          tanggal: tgl,
          keterangan: keterangan,
          referensi: referensi
        })
        .eq('id', trxId);
      if (error) throw error;
      showToast(' Transaksi berhasil diperbarui');
    } else {
      // Insert new transaction
      const { error } = await window.__sb.from('transaksi_kas').insert({
        akun_id: akunId,
        kategori_id: kategoriId,
        tipe: tipe,
        jumlah: jumlah,
        saldo_sebelum: saldoSebelum,
        saldo_sesudah: saldoSesudah,
        tanggal: tgl,
        keterangan: keterangan,
        referensi: referensi,
        dibuat_oleh: window.medicoreUser?.id || null
      });
      if (error) throw error;
      showToast(' Transaksi berhasil disimpan');
    }

    hideM('mdl-kas-transaksi');
    loadKasBank();
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/04-kas-bank.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal menyimpan transaksi: ' + e.message);
    }
    console.error('submitKasTransaksi error:', e);
  }
}

/**
 * Show modal for transfer
 */
function showKasTransfer() {
  // Reset form
  document.getElementById('mdl-kas-transfer-jumlah').value = '';
  document.getElementById('mdl-kas-transfer-ket').value = '';
  document.getElementById('mdl-kas-transfer-tgl').value = todayStr();

  // Populate dari dropdown
  const dariSelect = document.getElementById('mdl-kas-transfer-dari');
  const keSelect = document.getElementById('mdl-kas-transfer-ke');
  if (dariSelect && window.__kasData?.akun) {
    dariSelect.innerHTML = '<option value="">Pilih...</option>';
    for (const a of window.__kasData.akun) {
      dariSelect.innerHTML += `<option value="${a.id}">${a.nama_akun}</option>`;
    }
  }
  if (keSelect && window.__kasData?.akun) {
    keSelect.innerHTML = '<option value="">Pilih...</option>';
    for (const a of window.__kasData.akun) {
      keSelect.innerHTML += `<option value="${a.id}">${a.nama_akun}</option>`;
    }
  }

  showM('mdl-kas-transfer');
}

/**
 * Submit a transfer transaction (creates 2 records: pengeluaran + pemasukan)
 */
async function submitKasTransfer() {
  const dariId = document.getElementById('mdl-kas-transfer-dari').value;
  const keId = document.getElementById('mdl-kas-transfer-ke').value;
  const jumlah = parseFloat(document.getElementById('mdl-kas-transfer-jumlah').value);
  const tgl = document.getElementById('mdl-kas-transfer-tgl').value || todayStr();
  const keterangan = document.getElementById('mdl-kas-transfer-ket').value || '';

  // Validation
  if (!dariId) { showToast(' Pilih akun asal'); return; }
  if (!keId) { showToast(' Pilih akun tujuan'); return; }
  if (dariId === keId) { showToast(' Akun asal dan tujuan harus berbeda'); return; }
  if (!jumlah || jumlah <= 0) { showToast(' Jumlah harus lebih dari 0'); return; }

  await SharedState.waitReady();

  try {
    // Get current saldo for source akun
    let sourceSaldo = 0;
    const { data: srcAkun } = await window.__sb.from('akun_kas').select('saldo_awal').eq('id', dariId).single();
    if (srcAkun) {
      sourceSaldo = parseFloat(srcAkun.saldo_awal) || 0;
      const { data: srcTrx } = await window.__sb.from('transaksi_kas').select('*').eq('akun_id', dariId);
      if (srcTrx) {
        for (const t of srcTrx) {
          if (t.tipe === 'pemasukan') sourceSaldo += parseFloat(t.jumlah);
          else if (t.tipe === 'pengeluaran' || t.tipe === 'transfer') sourceSaldo -= parseFloat(t.jumlah);
        }
      }
    }

    if (sourceSaldo < jumlah) {
      showToast(' Saldo tidak mencukupi! Saldo sumber: ' + formatCurrency(sourceSaldo));
      return;
    }

    // Get current saldo for destination akun
    let destSaldo = 0;
    const { data: dstAkun } = await window.__sb.from('akun_kas').select('saldo_awal').eq('id', keId).single();
    if (dstAkun) {
      destSaldo = parseFloat(dstAkun.saldo_awal) || 0;
      const { data: dstTrx } = await window.__sb.from('transaksi_kas').select('*').eq('akun_id', keId);
      if (dstTrx) {
        for (const t of dstTrx) {
          if (t.tipe === 'pemasukan') destSaldo += parseFloat(t.jumlah);
          else if (t.tipe === 'pengeluaran' || t.tipe === 'transfer') destSaldo -= parseFloat(t.jumlah);
        }
      }
    }

    // Create pengeluaran record for source
    const { error: err1 } = await window.__sb.from('transaksi_kas').insert({
      akun_id: dariId,
      kategori_id: null,
      tipe: 'transfer',
      jumlah: jumlah,
      saldo_sebelum: sourceSaldo,
      saldo_sesudah: sourceSaldo - jumlah,
      akun_tujuan_id: keId,
      tanggal: tgl,
      keterangan: keterangan || 'Transfer antar akun',
      referensi: '',
      dibuat_oleh: window.medicoreUser?.id || null
    });
    if (err1) throw err1;

    // Create pemasukan record for destination
    const { error: err2 } = await window.__sb.from('transaksi_kas').insert({
      akun_id: keId,
      kategori_id: null,
      tipe: 'transfer',
      jumlah: jumlah,
      saldo_sebelum: destSaldo,
      saldo_sesudah: destSaldo + jumlah,
      akun_tujuan_id: dariId,
      tanggal: tgl,
      keterangan: keterangan || 'Transfer antar akun',
      referensi: '',
      dibuat_oleh: window.medicoreUser?.id || null
    });
    if (err2) throw err2;

    showToast(' Transfer berhasil: ' + formatCurrency(jumlah));
    hideM('mdl-kas-transfer');
    loadKasBank();
  } catch (e) {
    if (isTableNotFound(e)) {
      showToast(' Database table belum dibuat. Jalankan sql/04-kas-bank.sql di Supabase SQL Editor.');
    } else {
      showToast(' Gagal melakukan transfer: ' + e.message);
    }
    console.error('submitKasTransfer error:', e);
  }
}

/**
 * Show transaction detail modal
 */
async function seeKasDetail(id) {
  await SharedState.waitReady();

  const detailBody = document.getElementById('mdl-kas-detail-body');
  const hapusBtn = document.getElementById('mdl-kas-detail-hapus');
  if (!detailBody) return;

  detailBody.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ Memuat detail...</div>';
  if (hapusBtn) hapusBtn.style.display = 'none';

  try {
    const { data, error } = await window.__sb.from('transaksi_kas')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) {
      detailBody.innerHTML = '<div style="color:#dc2626">❌ Data tidak ditemukan</div>';
      return;
    }

    const akunName = data.akun_kas?.nama_akun || getAkunName(data.akun_id) || '—';
    const katName = data.kategori_kas?.nama_kategori || getKategoriName(data.kategori_id) || '—';
    const tujuanNama = data.akun_tujuan_kas?.nama_akun || (data.akun_tujuan_id ? getAkunName(data.akun_tujuan_id) : null);

    let tipeLabel = data.tipe;
    if (data.tipe === 'pemasukan') tipeLabel = '💰 Pemasukan';
    else if (data.tipe === 'pengeluaran') tipeLabel = '💸 Pengeluaran';
    else if (data.tipe === 'transfer') tipeLabel = '🔄 Transfer';

    let rows = `
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Tanggal</span><span style="font-weight:600">${data.tanggal || '—'}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Tipe</span><span style="font-weight:600">${tipeLabel}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Akun</span><span style="font-weight:600">${akunName}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Kategori</span><span style="font-weight:600">${katName}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Jumlah</span><span style="font-weight:700;font-size:18px">${formatCurrency(data.jumlah)}</span></div></div>`;

    if (data.tipe === 'transfer' && tujuanNama) {
      const asalNama = data.akun_tujuan_id ? (data.akun_tujuan_kas?.nama_akun || getAkunName(data.akun_tujuan_id)) : '';
      rows += `
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Dari Akun</span><span style="font-weight:600">${data.akun_kas?.nama_akun || getAkunName(data.akun_id)}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Ke Akun</span><span style="font-weight:600">${tujuanNama}</span></div></div>`;
    }

    rows += `
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Saldo Sebelum</span><span style="font-weight:600">${formatCurrency(data.saldo_sebelum)}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Saldo Sesudah</span><span style="font-weight:600">${formatCurrency(data.saldo_sesudah)}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Keterangan</span><span style="font-weight:600;text-align:right;max-width:250px">${data.keterangan || '—'}</span></div></div>
      <div class="fg"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:var(--text-muted)">Referensi</span><span style="font-weight:600">${data.referensi || '—'}</span></div></div>`;

    detailBody.innerHTML = rows;

    // Show "Hapus" button only if created today
    if (hapusBtn) {
      const createdDate = data.created_at ? data.created_at.substring(0, 10) : '';
      if (createdDate === todayStr()) {
        hapusBtn.style.display = '';
        hapusBtn.dataset.id = data.id;
        hapusBtn.dataset.tipe = data.tipe;
        hapusBtn.dataset.jumlah = data.jumlah;
        hapusBtn.dataset.akunId = data.akun_id;
        hapusBtn.dataset.akunTujuanId = data.akun_tujuan_id || '';
      } else {
        hapusBtn.style.display = 'none';
      }
    }

    showM('mdl-kas-detail');
  } catch (e) {
    if (isTableNotFound(e)) {
      detailBody.innerHTML = '<div style="color:#dc2626">⚠️ Database table belum dibuat. Jalankan sql/04-kas-bank.sql</div>';
    } else {
      detailBody.innerHTML = '<div style="color:#dc2626">❌ Gagal memuat detail: ' + e.message + '</div>';
    }
    console.error('seeKasDetail error:', e);
  }
}

/**
 * Hapus (reverse) a transaction
 */
async function hapusKasTransaksi() {
  const btn = document.getElementById('mdl-kas-detail-hapus');
  if (!btn) return;
  const id = btn.dataset.id;
  const tipe = btn.dataset.tipe;
  const jumlah = parseFloat(btn.dataset.jumlah);
  const akunId = btn.dataset.akunId;
  const akunTujuanId = btn.dataset.akunTujuanId;

  if (!id) return;
  if (!confirm('🗑️ Yakin ingin menghapus transaksi ini? Saldo akan dikembalikan ke posisi sebelum transaksi.')) return;

  await SharedState.waitReady();

  try {
    // For transfer, we need to handle both records
    if (tipe === 'transfer' && akunTujuanId) {
      // Find the paired transfer record
      const { data: paired } = await window.__sb.from('transaksi_kas')
        .select('id')
        .eq('akun_tujuan_id', akunId)
        .eq('akun_id', akunTujuanId)
        .eq('tipe', 'transfer')
        .eq('jumlah', jumlah);
      // Delete both records
      if (paired && paired.length > 0) {
        for (const p of paired) {
          await window.__sb.from('transaksi_kas').delete().eq('id', p.id);
        }
      }
    }

    // Delete the primary record
    const { error } = await window.__sb.from('transaksi_kas').delete().eq('id', id);
    if (error) throw error;

    showToast(' Transaksi berhasil dihapus');
    hideM('mdl-kas-detail');
    loadKasBank();
  } catch (e) {
      if (isTableNotFound(e)) {
        showToast(' Database table belum dibuat. Jalankan sql/04-kas-bank.sql di Supabase SQL Editor.');
      } else {
        showToast(' Gagal menghapus transaksi: ' + e.message);
      }
      console.error('hapusKasTransaksi error:', e);
    }
  }

  // ===== PENGGUNAAN OBAT =====
  function getPatientName(patientId) {
    return (window.__patientData || []).find(p => p.id === patientId)?.nama || '—';
  }
  function getDoctorName(doctorId) {
    return (window.__dokterData || []).find(d => d.id === doctorId)?.nama || '—';
  }
  function getPoliName(poliId) {
    return (window.__poliData || []).find(p => p.id === poliId)?.nama_poli || '—';
  }
  function getMedicineName(medicineId) {
    return (window.__stokData || []).find(m => m.id === medicineId)?.nama_obat || (window.__stokData || []).find(m => m.id === medicineId)?.nama || '—';
  }
  function getMedicineHarga(medicineId) {
    const m = (window.__stokData || []).find(m => m.id === medicineId);
    return m?.harga_satuan || m?.harga || 0;
  }
  function formatCurrency(n) {
    if (n === null || n === undefined) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }
  function getObatStatusClass(status) {
    return { pending: 'b bw', disiapkan: 'b bi', selesai: 'b bs' }[status] || 'b bd';
  }
  function getObatStatusLabel(status) {
    return { pending: '⏳ Pending', disiapkan: '📦 Disiapkan', selesai: '✅ Selesai' }[status] || status;
  }
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  async function loadPenggunaanObat() {
    await SharedState.waitReady();
    const tbody = document.getElementById('obat-tbody');
    if (!tbody) return;

    try {
      const [{ data: penggunaan, error: pErr }, { data: patients }, { data: medicines }, { data: poli }, { data: dokter }] = await Promise.all([
        window.__sb.from('penggunaan_obat').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }),
        window.__sb.from('patients').select('id, no_rm, nama'),
        window.__sb.from('medicines').select('id, kode, nama_obat, harga_satuan, satuan'),
        window.__sb.from('poli').select('id, nama_poli'),
        window.__sb.from('users').select('id, nama').eq('role', 'dokter')
      ]);

      if (pErr) {
        if (isTableNotFound(pErr)) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px"><div style="color:#dc2626;font-weight:700;margin-bottom:8px">⚠️ Database table belum dibuat</div><div style="color:var(--text-muted);font-size:13px">Jalankan file <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sql/05-penggunaan-obat.sql</code> di Supabase SQL Editor terlebih dahulu.</div></td></tr>';
          return;
        }
        throw pErr;
      }

      window.__patientData = patients || [];
      window.__stokData = medicines || [];
      window.__poliData = poli || [];
      window.__dokterData = dokter || [];
      window.__penggunaanData = penggunaan || [];

      const poliSelect = document.getElementById('obat-filter-poli');
      if (poliSelect && (poli || []).length > 0) {
        poliSelect.innerHTML = '<option value="">Semua Poli</option>' + (poli || []).map(p => `<option value="${p.id}">${p.nama_poli}</option>`).join('');
      }

      const data = penggunaan || [];
      const noReseps = new Set(data.map(d => d.no_resep).filter(Boolean));
      const totalResep = noReseps.size;
      const selesai = data.filter(d => d.status === 'selesai').length;
      const pending = data.filter(d => d.status === 'pending').length;
      const totalItem = data.length;

      document.getElementById('obat-total-resep').textContent = totalResep || 0;
      document.getElementById('obat-selesai').textContent = selesai || 0;
      document.getElementById('obat-pending').textContent = pending || 0;
      document.getElementById('obat-total-item').textContent = totalItem || 0;

      renderPenggunaanTable(data);
    } catch (e) {
      if (isTableNotFound(e)) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px"><div style="color:#dc2626;font-weight:700;margin-bottom:8px">⚠️ Database table belum dibuat</div><div style="color:var(--text-muted);font-size:13px">Jalankan file <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">sql/05-penggunaan-obat.sql</code> di Supabase SQL Editor terlebih dahulu.</div></td></tr>';
        return;
      }
      console.error('loadPenggunaanObat error:', e);
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">❌ Gagal memuat data</td></tr>';
    }
  }

  function renderPenggunaanTable(data) {
    const tbody = document.getElementById('obat-tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">📭 Belum ada data resep</td></tr>';
      return;
    }

    // Group by no_resep for summary view
    const groups = {};
    data.forEach(item => {
      const key = item.no_resep || item.keterangan || item.id.substring(0,8);
      if (!groups[key]) groups[key] = { no_resep: key, items: [], patient_id: item.patient_id, tanggal: item.tanggal, dokter_id: item.dibuat_oleh, poli_id: item.poli_id, status: item.status };
      groups[key].items.push(item);
    });

    tbody.innerHTML = Object.values(groups).map(g => {
      const patientName = getPatientName(g.patient_id);
      const dokterName = getDoctorName(g.dokter_id);
      const poliName = g.poli_id ? getPoliName(g.poli_id) : '—';
      const totalItem = g.items.length;
      const totalHarga = g.items.reduce((sum, i) => sum + (getMedicineHarga(i.medicine_id) * (i.jumlah || 1)), 0);
      const status = g.items.find(i => i.status)?.status || 'pending';
      const st = getObatStatusClass(status);

      return `<tr>
        <td><strong>${g.no_resep}</strong></td>
        <td>${g.tanggal ? new Date(g.tanggal).toLocaleDateString('id-ID') : '-'}</td>
        <td>${patientName}</td>
        <td>${dokterName}</td>
        <td>${poliName}</td>
        <td><span class="b ${st}">${getObatStatusLabel(status)}</span></td>
        <td>${totalItem} item</td>
        <td>${formatCurrency(totalHarga)}</td>
        <td>
          <button class="btn btn-xs btn-o" onclick="seePenggunaanObat('${g.items[0].id}')">Detail</button>
          ${status === 'pending' ? `<button class="btn btn-xs btn-danger" onclick="hapusPenggunaanObat('${g.no_resep}')">🗑️</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  function filterPenggunaanObat() {
    const search = (document.getElementById('obat-search').value || '').toLowerCase();
    const status = document.getElementById('obat-filter-status').value;
    const poli = document.getElementById('obat-filter-poli').value;
    const tglDari = document.getElementById('obat-tgl-dari').value;
    const tglSampai = document.getElementById('obat-tgl-sampai').value;

    const data = window.__penggunaanData || [];
    const filtered = data.filter(item => {
      const patientName = getPatientName(item.patient_id).toLowerCase();
      const dokterName = getDoctorName(item.dibuat_oleh).toLowerCase();
      const noResep = (item.no_resep || item.keterangan || '').toLowerCase();
      if (search && !patientName.includes(search) && !dokterName.includes(search) && !noResep.includes(search)) return false;
      if (status && item.status !== status) return false;
      if (poli && item.poli_id !== poli) return false;
      if (tglDari && item.tanggal < tglDari) return false;
      if (tglSampai && item.tanggal > tglSampai) return false;
      return true;
    });
    renderPenggunaanTable(filtered);
  }

  function showPenggunaanObatForm() {
    const modal = document.getElementById('mdl-penggunaan-obat');
    if (!modal) return;

    const today = todayStr();
    const dateStr = today.replace(/-/g, '');
    const existingCount = (window.__penggunaanData || []).filter(d => d.keterangan?.startsWith(`RSP-${dateStr}`)).length;
    const seq = String(existingCount + 1).padStart(3, '0');
    const noResep = `RSP-${dateStr}-${seq}`;

    document.getElementById('mdl-obat-title').textContent = '💊 Tambah Resep';
    document.getElementById('mdl-obat-id').value = '';
    document.getElementById('mdl-obat-noresep').value = noResep;
    document.getElementById('mdl-obat-tgl').value = today;

    const pasienSel = document.getElementById('mdl-obat-pasien');
    pasienSel.innerHTML = '<option value="">Pilih pasien...</option>' + (window.__patientData || []).map(p => `<option value="${p.id}">${p.no_rm} - ${p.nama}</option>`).join('');

    const dokterSel = document.getElementById('mdl-obat-dokter');
    dokterSel.innerHTML = '<option value="">Pilih dokter...</option>' + (window.__dokterData || []).map(d => `<option value="${d.id}">${d.nama}</option>`).join('');

    const poliSel = document.getElementById('mdl-obat-poli');
    poliSel.innerHTML = '<option value="">Pilih poli...</option>' + (window.__poliData || []).map(p => `<option value="${p.id}">${p.nama_poli}</option>`).join('');

    document.getElementById('mdl-obat-status').value = 'pending';

    document.getElementById('obat-items-container').innerHTML = '';
    addObatItemRow();

    showM('mdl-penggunaan-obat');
  }

  function addObatItemRow(medicineId, jumlah, dosis, aturan) {
    const container = document.getElementById('obat-items-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'fr';
    row.style.marginBottom = '8px';
    row.style.gap = '8px';

    const medicines = window.__stokData || [];
    const options = medicines.map(m => `<option value="${m.id}" ${medicineId === m.id ? 'selected' : ''}>${m.kode} - ${m.nama} (${m.satuan || 'tablet'})</option>`).join('');

    row.innerHTML = `
      <div class="fg" style="flex:3"><select class="fc obat-item-medicine" onchange="recalculateObatTotal()">${options}</select></div>
      <div class="fg" style="flex:1"><input class="fc obat-item-qty" type="number" min="1" value="${jumlah || 1}" onchange="recalculateObatTotal()"></div>
      <div class="fg" style="flex:2"><input class="fc obat-item-dosis" value="${dosis || ''}" placeholder="Dosis (5mg)"></div>
      <div class="fg" style="flex:2"><input class="fc obat-item-aturan" value="${aturan || ''}" placeholder="Aturan (1x1)"></div>
      <div class="fg" style="flex:1"><span class="fc obat-item-subtotal" style="display:block;padding:8px;background:#f8fafc;border-radius:4px;text-align:right">Rp 0</span></div>
      <button class="btn btn-xs btn-danger" onclick="this.closest('.fr').remove(); recalculateObatTotal()">✕</button>
    `;
    container.appendChild(row);
    recalculateObatTotal();
  }

  function recalculateObatTotal() {
    const container = document.getElementById('obat-items-container');
    if (!container) return;

    let total = 0;
    container.querySelectorAll('.fr').forEach(row => {
      const medId = row.querySelector('.obat-item-medicine')?.value;
      const qty = parseInt(row.querySelector('.obat-item-qty')?.value) || 0;
      const harga = medId ? getMedicineHarga(medId) : 0;
      const subtotal = harga * qty;
      total += subtotal;
      const subEl = row.querySelector('.obat-item-subtotal');
      if (subEl) subEl.textContent = formatCurrency(subtotal);
    });
    document.getElementById('obat-total-display').textContent = formatCurrency(total);
  }

  async function submitPenggunaanObat() {
    const noResep = document.getElementById('mdl-obat-noresep').value;
    const patientId = document.getElementById('mdl-obat-pasien').value;
    const dokterId = document.getElementById('mdl-obat-dokter').value;
    const poliId = document.getElementById('mdl-obat-poli').value;
    const status = document.getElementById('mdl-obat-status').value;
    const tgl = document.getElementById('mdl-obat-tgl').value;

    if (!noResep || !patientId) {
      return showToast('No. Resep dan Pasien wajib diisi!');
    }

    const container = document.getElementById('obat-items-container');
    const rows = container?.querySelectorAll('.fr') || [];
    if (rows.length === 0) {
      return showToast('Minimal 1 item obat!');
    }

    const items = [];
    rows.forEach(row => {
          const medId = row.querySelector('.obat-item-medicine')?.value;
          const qty = parseInt(row.querySelector('.obat-item-qty')?.value) || 0;
          const dosis = row.querySelector('.obat-item-dosis')?.value || '';
          const aturan = row.querySelector('.obat-item-aturan')?.value || '';
          if (!medId || qty <= 0) return;
          items.push({
            patient_id: patientId,
            medicine_id: medId,
            no_resep: noResep,
            jumlah: qty,
            dosis,
            aturan_pakai: aturan,
            tanggal: tgl,
            keterangan: noResep,
            dibuat_oleh: dokterId || null,
            poli_id: poliId || null
          });
        });

    if (items.length === 0) return showToast('Item obat tidak valid!');

    try {
      const { error } = await window.__sb.from('penggunaan_obat').insert(items);
      if (error) {
        if (isTableNotFound(error)) {
          return showToast(' Tabel penggunaan_obat belum dibuat. Jalankan sql/05-penggunaan-obat.sql di Supabase SQL Editor.');
        }
        throw error;
      }
      hideM('mdl-penggunaan-obat');
      loadPenggunaanObat();
    } catch (e) {
      console.error('submitPenggunaanObat error:', e);
      showToast('menyimpan: ' + e.message);
    }
  }

  async function seePenggunaanObat(id) {
    const data = window.__penggunaanData || [];
    const item = data.find(d => d.id === id);
    if (!item) return;

    const noResep = item.no_resep || item.keterangan || item.id.substring(0,8);
    const groupItems = data.filter(d => d.no_resep === noResep || d.keterangan === noResep);
    const patientName = getPatientName(item.patient_id);
    const dokterName = getDoctorName(item.dibuat_oleh);
    const poliName = item.poli_id ? getPoliName(item.poli_id) : '—';

    const body = document.getElementById('mdl-obat-detail-body');
    let html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px">
        <div><strong>No. Resep:</strong> ${noResep}</div>
        <div><strong>Tanggal:</strong> ${item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'}</div>
        <div><strong>Pasien:</strong> ${patientName}</div>
        <div><strong>Dokter:</strong> ${dokterName}</div>
        <div><strong>Poli:</strong> ${poliName}</div>
        <div><strong>Status:</strong> <span class="b ${getObatStatusClass(item.status)}">${getObatStatusLabel(item.status)}</span></div>
      </div>
      <div style="margin-bottom:12px;font-weight:700">Item Obat (${groupItems.length}):</div>
      <table class="t"><thead><tr><th>OBAT</th><th>JUMLAH</th><th>DOSIS</th><th>ATURAN</th><th>HARGA</th><th>SUBTOTAL</th></tr></thead><tbody>
    `;

    let total = 0;
    groupItems.forEach(i => {
      const medName = getMedicineName(i.medicine_id);
      const harga = getMedicineHarga(i.medicine_id);
      const subtotal = harga * (i.jumlah || 1);
      total += subtotal;
      html += `<tr>
        <td>${medName}</td>
        <td>${i.jumlah} ${i.satuan || 'tablet'}</td>
        <td>${i.dosis || '-'}</td>
        <td>${i.aturan_pakai || '-'}</td>
        <td>${formatCurrency(harga)}</td>
        <td>${formatCurrency(subtotal)}</td>
      </tr>`;
    });

    html += `</tbody></table>
      <div style="text-align:right;margin-top:12px;font-size:16px;font-weight:700">Total: ${formatCurrency(total)}</div>
    `;
    body.innerHTML = html;

    const hapusBtn = document.getElementById('mdl-obat-detail-hapus');
    hapusBtn.dataset.noresep = noResep;
    hapusBtn.style.display = (item.status === 'pending') ? 'inline-block' : 'none';

    showM('mdl-penggunaan-obat-detail');
  }

  async function hapusPenggunaanObat(noResep) {
    if (!confirm('Hapus resep ' + noResep + ' dan semua itemnya?')) return;

    try {
      const { error } = await window.__sb.from('penggunaan_obat').delete().eq('no_resep', noResep);
      if (error) {
        if (isTableNotFound(error)) {
          return showToast(' Tabel penggunaan_obat belum dibuat.');
        }
        throw error;
      }
      hideM('mdl-penggunaan-obat-detail');
      loadPenggunaanObat();
    } catch (e) {
      console.error('hapusPenggunaanObat error:', e);
      showToast('hapus: ' + e.message);
    }
  }

// ===== PERMINTAAN MEDIS =====
let __pmData = [];
let __pmItems = [];

async function loadPermintaanMedis() {
  await SharedState.waitReady();
  const tbody = document.getElementById('pm-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';
  
  const { data: pm, error } = await window.__sb
    .from('permintaan_medis')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    if (isTableNotFound(error)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--warning)">⚠️ Tabel belum dibuat — jalankan sql/06-permintaan-medis.sql di Supabase SQL Editor</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">❌ ' + error.message + '</td></tr>';
    return;
  }
  
  __pmData = pm || [];
  
  // Count items per permutation
  const pmIds = __pmData.map(p => p.id);
  let itemCounts = {};
  if (pmIds.length) {
    const { data: items } = await window.__sb
      .from('permintaan_medis_items')
      .select('permintaan_id, jumlah_diminta')
      .in('permintaan_id', pmIds);
    (items || []).forEach(it => {
      itemCounts[it.permintaan_id] = (itemCounts[it.permintaan_id] || 0) + it.jumlah_diminta;
    });
  }
  
  // Stats
  const total = __pmData.length;
  const menunggu = __pmData.filter(p => p.status === 'Menunggu').length;
  const diproses = __pmData.filter(p => p.status === 'Diproses').length;
  const selesai = __pmData.filter(p => p.status === 'Selesai').length;
  
  document.getElementById('pm-total').textContent = total;
  document.getElementById('pm-menunggu').textContent = menunggu;
  document.getElementById('pm-diproses').textContent = diproses;
  document.getElementById('pm-selesai').textContent = selesai;
  
  if (!__pmData.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada permintaan medis</td></tr>';
    return;
  }
  
  const statusBadge = { 'Menunggu': 'b bg-warning', 'Diproses': 'b bg-info', 'Selesai': 'b bg-success', 'Ditolak': 'b bg-danger' };
  
  tbody.innerHTML = __pmData.map(p => {
    const itemQty = itemCounts[p.id] || 0;
    const date = p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '—';
    return '<tr>' +
      '<td class="mono">' + p.no_permintaan + '</td>' +
      '<td>' + p.unit_peminta + '</td>' +
      '<td>' + (p.keterangan ? p.keterangan.substring(0, 40) + (p.keterangan.length > 40 ? '...' : '') : '—') + '</td>' +
      '<td>' + itemQty + '</td>' +
      '<td><span class="' + (statusBadge[p.status] || 'b') + '">' + p.status + '</span></td>' +
      '<td style="font-size:12px">' + date + '</td>' +
      '<td>' +
        (p.status === 'Menunggu' ? '<button class="btn btn-p btn-xs" onclick="prosesPermintaanMedis(\'' + p.id + '\')">🔄 Proses</button> ' : '') +
        '<button class="btn btn-o btn-xs" onclick="detailPermintaanMedis(\'' + p.id + '\')">📋 Detail</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function filterPermintaanMedis() {
  const q = (document.getElementById('pm-search')?.value || '').toLowerCase();
  const status = document.getElementById('pm-filter-status')?.value || '';
  const tglDari = document.getElementById('pm-tgl-dari')?.value || '';
  const tglSampai = document.getElementById('pm-tgl-sampai')?.value || '';
  
  const filtered = __pmData.filter(p => {
    if (q && !p.no_permintaan?.toLowerCase().includes(q) && !p.unit_peminta?.toLowerCase().includes(q)) return false;
    if (status && p.status !== status) return false;
    if (tglDari && p.created_at && p.created_at < tglDari) return false;
    if (tglSampai && p.created_at && p.created_at > tglSampai + 'T23:59:59') return false;
    return true;
  });
  
  // Re-render table with filtered data
  const tbody = document.getElementById('pm-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada data sesuai filter</td></tr>';
    return;
  }
  
  const statusBadge = { 'Menunggu': 'b bg-warning', 'Diproses': 'b bg-info', 'Selesai': 'b bg-success', 'Ditolak': 'b bg-danger' };
  tbody.innerHTML = filtered.map(p => {
    const date = p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '—';
    return '<tr>' +
      '<td class="mono">' + p.no_permintaan + '</td>' +
      '<td>' + p.unit_peminta + '</td>' +
      '<td>' + (p.keterangan ? p.keterangan.substring(0, 40) + (p.keterangan.length > 40 ? '...' : '') : '—') + '</td>' +
      '<td>—</td>' +
      '<td><span class="' + (statusBadge[p.status] || 'b') + '">' + p.status + '</span></td>' +
      '<td style="font-size:12px">' + date + '</td>' +
      '<td>' +
        (p.status === 'Menunggu' ? '<button class="btn btn-p btn-xs" onclick="prosesPermintaanMedis(\'' + p.id + '\')">🔄 Proses</button> ' : '') +
        '<button class="btn btn-o btn-xs" onclick="detailPermintaanMedis(\'' + p.id + '\')">📋 Detail</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ===== CREATE =====
async function showBuatPermintaan() {
  __pmItems = [];
  document.getElementById('mdl-pm-id').value = '';
  document.getElementById('mdl-pm-unit').value = 'Apotek';
  document.getElementById('mdl-pm-tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('mdl-pm-ket').value = '';
  document.getElementById('pm-items-container').innerHTML = '';
  addPMItemRow();
  showM('mdl-pm-buat');
}

function addPMItemRow(obatId, qty) {
  const c = document.getElementById('pm-items-container');
  const meds = (window.__stokData || []);
  const idx = c.children.length;
  const div = document.createElement('div');
  div.className = 'pm-item-row';
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:end';
  div.innerHTML = '<div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Obat</label>' +
    '<select class="fc" onchange="pmItemChange()" style="padding:6px 8px;font-size:13px">' +
    '<option value="">Pilih obat...</option>' +
    meds.map(m => '<option value="' + m.id + '"' + (m.id === obatId ? ' selected' : '') + '>' + (m.nama_obat || m.nama) + '</option>').join('') +
    '</select></div>' +
    '<div style="flex:0 0 100px"><label style="font-size:11px;color:var(--text-muted)">Jumlah</label>' +
    '<input class="fc" type="number" min="1" value="' + (qty || 1) + '" onchange="pmItemChange()" style="padding:6px 8px;font-size:13px"></div>' +
    '<button class="btn btn-d btn-xs" onclick="this.parentElement.remove();pmItemChange()" style="margin-bottom:0">✕</button>';
  c.appendChild(div);
}

function pmItemChange() {
  // No totals needed for this module
}

async function submitPermintaanMedis() {
  const unit = document.getElementById('mdl-pm-unit').value;
  if (!unit) { showToast('Pilih unit peminta!'); return; }
  
  // Collect items from DOM
  const rows = document.querySelectorAll('#pm-items-container .pm-item-row');
  const items = [];
  rows.forEach(row => {
    const sel = row.querySelector('select');
    const inp = row.querySelector('input[type=number]');
    if (sel && inp && sel.value && parseInt(inp.value) > 0) {
      items.push({ medicine_id: sel.value, jumlah_diminta: parseInt(inp.value) });
    }
  });
  if (!items.length) { showToast('Tambah minimal 1 item obat!'); return; }
  
  const noPM = 'PM-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now() % 10000).padStart(4,'0');
  const ket = document.getElementById('mdl-pm-ket').value.trim();
  
  const { data: header, error: hErr } = await window.__sb.from('permintaan_medis')
    .insert({ no_permintaan: noPM, unit_peminta: unit, keterangan: ket, status: 'Menunggu' })
    .select().single();
  
  if (hErr) { showToast(' Gagal: ' + hErr.message); return; }
  
  const pmItems = items.map(it => ({ permintaan_id: header.id, medicine_id: it.medicine_id, jumlah_diminta: it.jumlah_diminta }));
  const { error: iErr } = await window.__sb.from('permintaan_medis_items').insert(pmItems);
  
  if (iErr) {
    // Rollback header
    await window.__sb.from('permintaan_medis').delete().eq('id', header.id);
    showToast(' Gagal simpan item: ' + iErr.message);
    return;
  }
  
  showToast(' ' + noPM + ' — Permintaan berhasil dibuat!');
  hideM('mdl-pm-buat');
  loadPermintaanMedis();
}

// ===== DETAIL =====
async function detailPermintaanMedis(id) {
  await SharedState.waitReady();
  const { data: pm } = await window.__sb.from('permintaan_medis').select('*').eq('id', id).single();
  if (!pm) { showToast('Data tidak ditemukan'); return; }
  
  const { data: items } = await window.__sb.from('permintaan_medis_items').select('*').eq('permintaan_id', id);
  
  const meds = window.__stokData || [];
  const getMedName = (mid) => (meds.find(m => m.id === mid)?.nama_obat || meds.find(m => m.id === mid)?.nama || '—');
  
  let itemHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left">Obat</th><th style="padding:8px;text-align:center">Diminta</th><th style="padding:8px;text-align:center">Diberikan</th></tr></thead><tbody>';
  
  (items || []).forEach(it => {
    itemHtml += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--border)">' + getMedName(it.medicine_id) + '</td>' +
      '<td style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border)">' + it.jumlah_diminta + '</td>' +
      '<td style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border)">' + (it.jumlah_diberikan || 0) + '</td></tr>';
  });
  itemHtml += '</tbody></table>';
  
  const statusBadge = { 'Menunggu': 'b bg-warning', 'Diproses': 'b bg-info', 'Selesai': 'b bg-success', 'Ditolak': 'b bg-danger' };
  const html = '<div style="margin-bottom:16px">' +
    '<div class="fr"><div><strong>No. Permintaan:</strong> ' + pm.no_permintaan + '</div><div><span class="' + (statusBadge[pm.status] || 'b') + '">' + pm.status + '</span></div></div>' +
    '<div><strong>Unit:</strong> ' + pm.unit_peminta + '</div>' +
    '<div><strong>Tanggal:</strong> ' + (pm.created_at ? new Date(pm.created_at).toLocaleDateString('id-ID') : '—') + '</div>' +
    (pm.keterangan ? '<div style="margin-top:8px"><strong>Keterangan:</strong> ' + pm.keterangan + '</div>' : '') +
    '</div>' +
    itemHtml;
  
  document.getElementById('mdl-pm-proses-body').innerHTML = html;
  document.getElementById('mdl-pm-proses-body').dataset.pmId = id;
  document.getElementById('mdl-pm-proses-body').dataset.pmStatus = pm.status;
  
  // Show reject button only for Menunggu/Diproses
  document.getElementById('btn-pm-tolak').style.display = (pm.status === 'Menunggu' || pm.status === 'Diproses') ? '' : 'none';
  document.getElementById('btn-pm-selesai').style.display = (pm.status === 'Menunggu' || pm.status === 'Diproses') ? '' : 'none';
  
  showM('mdl-pm-proses');
}

// ===== PROCESS =====
async function prosesPermintaanMedis(id) {
  await detailPermintaanMedis(id);
}

async function selesaiPermintaanMedis() {
  const body = document.getElementById('mdl-pm-proses-body');
  const id = body.dataset.pmId;
  if (!id || !confirm('Selesaikan permintaan ini? Stok obat akan dikurangi sesuai jumlah yang diminta.')) return;
  
  const { data: items } = await window.__sb.from('permintaan_medis_items').select('*').eq('permintaan_id', id);
  
  if (items && items.length) {
    for (const it of items) {
      // Update qty_diberikan = qty_diminta
      await window.__sb.from('permintaan_medis_items')
        .update({ jumlah_diberikan: it.jumlah_diminta })
        .eq('id', it.id);
      
      // Reduce stock
      const { data: med } = await window.__sb.from('medicines').select('stok').eq('id', it.medicine_id).single();
      if (med) {
        const newStok = Math.max(0, (med.stok || 0) - it.jumlah_diminta);
        await window.__sb.from('medicines').update({ stok: newStok }).eq('id', it.medicine_id);
      }
    }
  }
  
  await window.__sb.from('permintaan_medis').update({ status: 'Selesai' }).eq('id', id);
  showToast(' Permintaan selesai diproses. Stok sudah dikurangi.');
  hideM('mdl-pm-proses');
  loadPermintaanMedis();
}

async function tolakPermintaanMedis() {
  const id = document.getElementById('mdl-pm-proses-body').dataset.pmId;
  if (!id || !confirm('Tolak permintaan ini?')) return;
  await window.__sb.from('permintaan_medis').update({ status: 'Ditolak' }).eq('id', id);
  showToast('Permintaan ditolak.', 'warning');
  hideM('mdl-pm-proses');
  loadPermintaanMedis();
}

// ===== PENJUALAN (Apotek/Retail) =====
let __penjData = [];
let __penjItems = [];

async function loadPenjualan() {
  await SharedState.waitReady();
  const tbody = document.getElementById('penj-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';

  const { data: penj, error } = await window.__sb
    .from('penjualan')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (error?.message?.includes('Could not find the table') || error?.code === '42P01') {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--warning)">⚠️ Tabel penjualan belum dibuat — jalankan sql/07-penjualan.sql</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">❌ ' + error.message + '</td></tr>';
    return;
  }

  __penjData = penj || [];

  // Stats
  const today = new Date().toISOString().slice(0,10);
  const todayPenj = __penjData.filter(p => (p.tanggal || '').slice(0,10) === today || p.created_at?.slice(0,10) === today);
  const omzet = todayPenj.reduce((s, p) => s + Number(p.total || 0), 0);
  const customers = new Set(todayPenj.map(p => p.customer || 'Umum'));
  const itemsSold = todayPenj.length; // proxy

  document.getElementById('penj-total').textContent = __penjData.length;
  document.getElementById('penj-omzet').textContent = formatRupiah(omzet);
  document.getElementById('penj-item').textContent = itemsSold;
  document.getElementById('penj-customer').textContent = customers.size;

  if (!__penjData.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada transaksi penjualan</td></tr>';
    return;
  }

  const statusBadge = { 'Lunas': 'b bg-success', 'Batal': 'b bg-danger' };

  tbody.innerHTML = __penjData.map(p => {
    const date = p.tanggal || (p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '—');
    return '<tr>' +
      '<td class="mono">' + p.no_penjualan + '</td>' +
      '<td style="font-size:12px">' + date + '</td>' +
      '<td>' + (p.customer || 'Umum') + '</td>' +
      '<td style="font-weight:600;font-family:monospace">Rp ' + (Number(p.total)||0).toLocaleString('id-ID') + '</td>' +
      '<td>' + p.metode_bayar + '</td>' +
      '<td><span class="' + (statusBadge[p.status] || 'b') + '">' + p.status + '</span></td>' +
      '<td>' +
        '<button class="btn btn-o btn-xs" onclick="detailPenjualan(\'' + p.id + '\')">📋 Detail</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function filterPenjualan() {
  const q = (document.getElementById('penj-search')?.value || '').toLowerCase();
  const metode = document.getElementById('penj-metode')?.value || '';
  const tglDari = document.getElementById('penj-tgl-dari')?.value || '';
  const tglSampai = document.getElementById('penj-tgl-sampai')?.value || '';

  const filtered = __penjData.filter(p => {
    if (q && !p.no_penjualan?.toLowerCase().includes(q) && !(p.customer || '').toLowerCase().includes(q)) return false;
    if (metode && p.metode_bayar !== metode) return false;
    if (tglDari && p.created_at && p.created_at < tglDari) return false;
    if (tglSampai && p.created_at && p.created_at > tglSampai + 'T23:59:59') return false;
    return true;
  });

  const tbody = document.getElementById('penj-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada data sesuai filter</td></tr>';
    return;
  }

  const statusBadge = { 'Lunas': 'b bg-success', 'Batal': 'b bg-danger' };
  tbody.innerHTML = filtered.map(p => {
    const date = p.tanggal || (p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '—');
    return '<tr>' +
      '<td class="mono">' + p.no_penjualan + '</td>' +
      '<td style="font-size:12px">' + date + '</td>' +
      '<td>' + (p.customer || 'Umum') + '</td>' +
      '<td style="font-weight:600;font-family:monospace">Rp ' + (Number(p.total)||0).toLocaleString('id-ID') + '</td>' +
      '<td>' + p.metode_bayar + '</td>' +
      '<td><span class="' + (statusBadge[p.status] || 'b') + '">' + p.status + '</span></td>' +
      '<td><button class="btn btn-o btn-xs" onclick="detailPenjualan(\'' + p.id + '\')">📋 Detail</button></td>' +
      '</tr>';
  }).join('');
}

// ===== CREATE =====
function showPenjualanBaru() {
  __penjItems = [];
  document.getElementById('mdl-penj-id').value = '';
  document.getElementById('mdl-penj-customer').value = 'Umum';
  document.getElementById('mdl-penj-tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('mdl-penj-metode').value = 'Tunai';
  document.getElementById('mdl-penj-diskon').value = '0';
  document.getElementById('mdl-penj-ket').value = '';
  document.getElementById('penj-items-container').innerHTML = '';
  document.getElementById('penj-total-display').textContent = 'Rp 0';
  addPenjItemRow();
  showM('mdl-penjualan');
}

function addPenjItemRow(obatId, qty, harga) {
  const c = document.getElementById('penj-items-container');
  const meds = window.__stokData || [];
  const idx = c.children.length;
  const div = document.createElement('div');
  div.className = 'penj-item-row';
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:end';
  div.innerHTML = '<div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Obat</label>' +
    '<select class="fc" onchange="penjItemChange()" style="padding:6px 8px;font-size:13px">' +
    '<option value="">Pilih obat...</option>' +
    meds.map(m => '<option value="' + m.id + '"' + (m.id === obatId ? ' selected' : '') + '>' + (m.nama_obat || m.nama) + ' (stok: ' + (m.stok||0) + ')</option>').join('') +
    '</select></div>' +
    '<div style="flex:0 0 80px"><label style="font-size:11px;color:var(--text-muted)">Qty</label>' +
    '<input class="fc" type="number" min="1" value="' + (qty || 1) + '" onchange="penjItemChange()" style="padding:6px 8px;font-size:13px"></div>' +
    '<div style="flex:0 0 100px"><label style="font-size:11px;color:var(--text-muted)">Harga</label>' +
    '<input class="fc" type="number" min="0" value="' + (harga || 0) + '" onchange="penjItemChange()" style="padding:6px 8px;font-size:13px"></div>' +
    '<div style="flex:0 0 90px;padding-top:16px;font-weight:600;font-family:monospace;font-size:13px" class="penj-subtotal">Rp 0</div>' +
    '<button class="btn btn-d btn-xs" onclick="this.parentElement.remove();penjItemChange()" style="margin-bottom:0">✕</button>';
  c.appendChild(div);
  penjItemChange();
}

function penjItemChange() {
  let total = 0;
  document.querySelectorAll('#penj-items-container .penj-item-row').forEach(row => {
    const sel = row.querySelector('select');
    const qty = parseInt(row.querySelector('input[type="number"]')?.value) || 0;
    const harga = parseInt(row.querySelectorAll('input[type="number"]')[1]?.value) || 0;
    const sub = qty * harga;
    const subEl = row.querySelector('.penj-subtotal');
    if (subEl) subEl.textContent = formatRupiah(sub);
    total += sub;
  });
  const diskon = parseInt(document.getElementById('mdl-penj-diskon')?.value) || 0;
  const afterDiskon = Math.max(0, total - diskon);
  document.getElementById('penj-total-display').textContent = formatRupiah(afterDiskon);
}

async function submitPenjualan() {
  const customer = document.getElementById('mdl-penj-customer').value.trim() || 'Umum';
  const metode = document.getElementById('mdl-penj-metode').value;
  const diskon = parseInt(document.getElementById('mdl-penj-diskon').value) || 0;

  // Collect items
  const rows = document.querySelectorAll('#penj-items-container .penj-item-row');
  const items = [];
  let subtotal = 0;
  rows.forEach(row => {
    const sel = row.querySelector('select');
    const qty = parseInt(row.querySelector('input[type="number"]')?.value) || 0;
    const harga = parseInt(row.querySelectorAll('input[type="number"]')[1]?.value) || 0;
    if (sel && sel.value && qty > 0 && harga > 0) {
      const sub = qty * harga;
      items.push({ medicine_id: sel.value, qty, harga_satuan: harga, subtotal: sub });
      subtotal += sub;
    }
  });
  if (!items.length) { showToast('Tambah minimal 1 item!'); return; }

  const total = Math.max(0, subtotal - diskon);
  const noTrx = 'TRX-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now() % 1000).padStart(3,'0');
  const ket = document.getElementById('mdl-penj-ket').value.trim();

  // Save header
  const { data: header, error: hErr } = await window.__sb.from('penjualan')
    .insert({
      no_penjualan: noTrx, customer, subtotal, diskon, total, metode_bayar: metode,
      status: 'Lunas', keterangan: ket, tanggal: new Date().toISOString().slice(0,10)
    })
    .select().single();

  if (hErr) { showToast(' Gagal: ' + hErr.message); return; }

  // Save items
  const penjItems = items.map(it => ({ ...it, penjualan_id: header.id }));
  const { error: iErr } = await window.__sb.from('penjualan_items').insert(penjItems);

  if (iErr) {
    await window.__sb.from('penjualan').delete().eq('id', header.id);
    showToast(' Gagal simpan item: ' + iErr.message);
    return;
  }

  // Reduce stock
  for (const it of items) {
    const { data: med } = await window.__sb.from('medicines').select('stok').eq('id', it.medicine_id).single();
    if (med) {
      await window.__sb.from('medicines').update({ stok: Math.max(0, (med.stok || 0) - it.qty) }).eq('id', it.medicine_id);
    }
  }

  showToast(' ' + noTrx + ' — Transaksi berhasil!');
  hideM('mdl-penjualan');
  loadPenjualan();
}

// ===== DETAIL =====
async function detailPenjualan(id) {
  await SharedState.waitReady();
  const { data: penj } = await window.__sb.from('penjualan').select('*').eq('id', id).single();
  if (!penj) { showToast('Data tidak ditemukan'); return; }

  const { data: items } = await window.__sb.from('penjualan_items').select('*').eq('penjualan_id', id);

  const meds = window.__stokData || [];
  const getMedName = (mid) => (meds.find(m => m.id === mid)?.nama_obat || meds.find(m => m.id === mid)?.nama || '—');

  let itemHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left">Obat</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Harga</th><th style="padding:8px;text-align:right">Subtotal</th></tr></thead><tbody>';

  (items || []).forEach(it => {
    itemHtml += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--border)">' + getMedName(it.medicine_id) + '</td>' +
      '<td style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border)">' + it.qty + '</td>' +
      '<td style="padding:6px 8px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace">Rp ' + (it.harga_satuan || 0).toLocaleString('id-ID') + '</td>' +
      '<td style="padding:6px 8px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace;font-weight:600">Rp ' + (it.subtotal || 0).toLocaleString('id-ID') + '</td></tr>';
  });
  itemHtml += '</tbody>';
  itemHtml += '<tfoot><tr><td colspan="3" style="padding:8px;text-align:right">Subtotal</td><td style="padding:8px;text-align:right;font-weight:600;font-family:monospace">Rp ' + (penj.subtotal||0).toLocaleString('id-ID') + '</td></tr>';
  if (penj.diskon) itemHtml += '<tr><td colspan="3" style="padding:8px;text-align:right">Diskon</td><td style="padding:8px;text-align:right;font-weight:600;font-family:monospace;color:var(--danger)">-Rp ' + (penj.diskon||0).toLocaleString('id-ID') + '</td></tr>';
  itemHtml += '<tr><td colspan="3" style="padding:8px;text-align:right;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700;font-family:monospace;color:var(--success)">Rp ' + (penj.total||0).toLocaleString('id-ID') + '</td></tr>';
  itemHtml += '</tfoot></table>';

  const html = '<div style="margin-bottom:16px">' +
    '<div class="fr"><div><strong>No. Transaksi:</strong> ' + penj.no_penjualan + '</div><div><span class="b bg-success">' + penj.status + '</span></div></div>' +
    '<div><strong>Customer:</strong> ' + (penj.customer || 'Umum') + '</div>' +
    '<div><strong>Tanggal:</strong> ' + (penj.tanggal || (penj.created_at ? new Date(penj.created_at).toLocaleDateString('id-ID') : '—')) + '</div>' +
    '<div><strong>Metode Bayar:</strong> ' + penj.metode_bayar + '</div>' +
    (penj.keterangan ? '<div style="margin-top:8px"><strong>Keterangan:</strong> ' + penj.keterangan + '</div>' : '') +
    '</div>' + itemHtml;

  document.getElementById('mdl-penj-detail-body').innerHTML = html;
  showM('mdl-penjualan-detail');
}

// ===== LOGISTIK =====
let __logData = [];

async function loadLogistik() {
  await SharedState.waitReady();
  const tbody = document.getElementById('log-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';

  const { data: log, error } = await window.__sb
    .from('logistik')
    .select('*')
    .order('kode', { ascending: true });

  if (error) {
    const msg = error?.message || '';
    if (msg.includes('Could not find the table') || error?.code === '42P01') {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--warning)">⚠️ Tabel logistik belum dibuat — jalankan sql/08-logistik.sql</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger)">❌ ' + msg + '</td></tr>';
    return;
  }

  __logData = log || [];

  const total = __logData.length;
  const kosong = __logData.filter(i => (i.stok || 0) <= 0).length;
  const minim = __logData.filter(i => (i.stok || 0) > 0 && (i.stok || 0) <= (i.stok_minimum || 5)).length;
  const ok = total - kosong - minim;

  document.getElementById('log-total').textContent = total;
  document.getElementById('log-ok').textContent = ok;
  document.getElementById('log-min').textContent = minim;
  document.getElementById('log-kosong').textContent = kosong;

  if (!__logData.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada barang logistik</td></tr>';
    return;
  }

  tbody.innerHTML = __logData.map(i => {
    const stok = i.stok || 0;
    const min = i.stok_minimum || 5;
    let badge, bar;
    if (stok <= 0) { badge = 'b bg-danger'; bar = '<div style="height:6px;background:#fee2e2;border-radius:3px;width:60px;margin-top:2px"><div style="height:100%;width:0%;background:var(--danger);border-radius:3px"></div></div>'; }
    else if (stok <= min) { badge = 'b bg-warning'; const pct = Math.round(stok/min*100); bar = '<div style="height:6px;background:#fef3c7;border-radius:3px;width:60px;margin-top:2px"><div style="height:100%;width:'+pct+'%;background:#f59e0b;border-radius:3px"></div></div>'; }
    else { badge = 'b bg-success'; bar = '<div style="height:6px;background:#dcfce7;border-radius:3px;width:60px;margin-top:2px"><div style="height:100%;width:100%;background:#22c55e;border-radius:3px"></div></div>'; }

    return '<tr>' +
      '<td class="mono">' + i.kode + '</td>' +
      '<td>' + i.nama + '</td>' +
      '<td>' + (i.kategori || 'Umum') + '</td>' +
      '<td>' + (i.satuan || 'pcs') + '</td>' +
      '<td style="font-weight:600">' + stok + bar + '</td>' +
      '<td>' + min + '</td>' +
      '<td><span class="' + badge + '">' + (stok <= 0 ? 'Habis' : stok <= min ? 'Minimal' : 'Cukup') + '</span></td>' +
      '<td><button class="btn btn-o btn-xs" onclick="detailLogistik(\'' + i.id + '\')">📋 Detail</button></td>' +
      '</tr>';
  }).join('');
}

function filterLogistik() {
  const q = (document.getElementById('log-search')?.value || '').toLowerCase();
  const kat = document.getElementById('log-kategori')?.value || '';

  const filtered = __logData.filter(i => {
    if (q && !i.nama?.toLowerCase().includes(q) && !i.kode?.toLowerCase().includes(q)) return false;
    if (kat && i.kategori !== kat) return false;
    return true;
  });

  const tbody = document.getElementById('log-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(i => {
    const stok = i.stok || 0;
    const min = i.stok_minimum || 5;
    let badge;
    if (stok <= 0) badge = 'b bg-danger';
    else if (stok <= min) badge = 'b bg-warning';
    else badge = 'b bg-success';

    return '<tr>' +
      '<td class="mono">' + i.kode + '</td>' +
      '<td>' + i.nama + '</td>' +
      '<td>' + (i.kategori || 'Umum') + '</td>' +
      '<td>' + (i.satuan || 'pcs') + '</td>' +
      '<td style="font-weight:600">' + stok + '</td>' +
      '<td>' + min + '</td>' +
      '<td><span class="' + badge + '">' + (stok <= 0 ? 'Habis' : stok <= min ? 'Minimal' : 'Cukup') + '</span></td>' +
      '<td><button class="btn btn-o btn-xs" onclick="detailLogistik(\'' + i.id + '\')">📋 Detail</button></td>' +
      '</tr>';
  }).join('');
}

// ===== BARANG CRUD =====
function showLogistikBarang() {
  document.getElementById('mdl-log-id').value = '';
  document.getElementById('mdl-log-nama').value = '';
  document.getElementById('mdl-log-kode').value = '';
  document.getElementById('mdl-log-kategori').value = 'ATK';
  document.getElementById('mdl-log-satuan').value = 'pcs';
  document.getElementById('mdl-log-stok').value = '0';
  document.getElementById('mdl-log-min').value = '5';
  document.getElementById('mdl-log-ket').value = '';
  document.querySelector('#mdl-logistik-barang .mt').textContent = '📦 Tambah Barang Logistik';
  showM('mdl-logistik-barang');
}

async function submitLogistikBarang() {
  const nama = document.getElementById('mdl-log-nama').value.trim();
  if (!nama) { showToast('Nama barang wajib diisi!'); return; }

  const editId = document.getElementById('mdl-log-id').value;
  const kode = document.getElementById('mdl-log-kode').value.trim() || 'LG-' + String(Date.now() % 10000).padStart(4,'0');
  const kategori = document.getElementById('mdl-log-kategori').value;
  const satuan = document.getElementById('mdl-log-satuan').value.trim() || 'pcs';
  const stok = parseInt(document.getElementById('mdl-log-stok').value) || 0;
  const min = parseInt(document.getElementById('mdl-log-min').value) || 5;
  const ket = document.getElementById('mdl-log-ket').value.trim();

  if (editId) {
    // Update
    const { error } = await window.__sb.from('logistik')
      .update({ nama, kode, kategori, satuan, stok_minimum: min, keterangan: ket })
      .eq('id', editId);
    if (error) { showToast(' ' + error.message); return; }
    showToast(' Barang updated!');
  } else {
    // Insert
    const { data: baru, error } = await window.__sb.from('logistik')
      .insert({ nama, kode, kategori, satuan, stok, stok_minimum: min, keterangan: ket })
      .select().single();
    if (error) { showToast(' ' + error.message); return; }
    // Auto-create mutasi for initial stock
    if (stok > 0) {
      await window.__sb.from('logistik_mutasi')
        .insert({ logistik_id: baru.id, tipe: 'masuk', qty: stok, keterangan: 'Stok awal', dibuat_oleh: 'Admin' });
    }
    showToast(' Barang ' + nama + ' ditambahkan!');
  }

  hideM('mdl-logistik-barang');
  loadLogistik();
}

// ===== DETAIL + MUTASI =====
async function detailLogistik(id) {
  await SharedState.waitReady();
  const { data: item } = await window.__sb.from('logistik').select('*').eq('id', id).single();
  if (!item) { showToast('Data tidak ditemukan'); return; }

  const { data: mutasi } = await window.__sb.from('logistik_mutasi')
    .select('*').eq('logistik_id', id).order('created_at', { ascending: false }).limit(20);

  const stok = item.stok || 0;
  const min = item.stok_minimum || 5;
  let statusText, statusColor;
  if (stok <= 0) { statusText = '🚨 Habis'; statusColor = 'var(--danger)'; }
  else if (stok <= min) { statusText = '⚠️ Stok Minimal'; statusColor = '#f59e0b'; }
  else { statusText = '✅ Stok Cukup'; statusColor = '#22c55e'; }

  document.getElementById('mdl-log-detail-info').innerHTML =
    '<div class="fr"><div><strong>' + item.nama + '</strong></div><div style="color:' + statusColor + '">' + statusText + '</div></div>' +
    '<div class="fr" style="margin-top:6px">' +
    '<div>Kode: ' + item.kode + '</div>' +
    '<div>Kategori: ' + (item.kategori || 'Umum') + '</div>' +
    '<div>Satuan: ' + (item.satuan || 'pcs') + '</div>' +
    '</div>' +
    '<div class="fr" style="margin-top:4px">' +
    '<div>Stok: <strong>' + stok + '</strong></div>' +
    '<div>Min: ' + min + '</div>' +
    '</div>' +
    (item.keterangan ? '<div style="margin-top:6px;font-size:13px;color:var(--text-muted)">' + item.keterangan + '</div>' : '');

  document.getElementById('mdl-log-mutasi-id').value = id;

  // Render mutations
  const mList = document.getElementById('mdl-log-mutasi-list');
  if (!mutasi || !mutasi.length) {
    mList.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px">Belum ada mutasi</div>';
  } else {
    mList.innerHTML = mutasi.map(m => {
      const icon = m.tipe === 'masuk' ? '📥' : '📤';
      const color = m.tipe === 'masuk' ? '#22c55e' : 'var(--danger)';
      return '<div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid var(--border);font-size:13px">' +
        '<span>' + icon + ' ' + (m.tipe === 'masuk' ? 'Masuk' : 'Keluar') + ' <strong style="color:' + color + '">' + m.qty + '</strong> ' + (item.satuan || 'pcs') + '</span>' +
        '<span style="color:var(--text-muted)">' + (m.keterangan || '') + ' — ' + (m.tanggal ? new Date(m.tanggal).toLocaleDateString('id-ID') : '') + '</span>' +
        '</div>';
    }).join('');
  }

  showM('mdl-logistik-detail');
}

function showLogMutasi(tipe) {
  document.getElementById('mdl-log-mutasi-tipe').value = tipe;
  const title = tipe === 'masuk' ? '📥 Stok Masuk' : '📤 Stok Keluar';
  document.getElementById('mdl-log-mutasi-title').textContent = title;
  document.getElementById('mdl-log-mutasi-qty').value = '1';
  document.getElementById('mdl-log-mutasi-ket').value = '';
  showM('mdl-log-mutasi');
}

async function submitLogMutasi() {
  const id = document.getElementById('mdl-log-mutasi-id').value;
  const tipe = document.getElementById('mdl-log-mutasi-tipe').value;
  const qty = parseInt(document.getElementById('mdl-log-mutasi-qty').value) || 0;
  if (qty <= 0) { showToast('Jumlah harus > 0!'); return; }
  const ket = document.getElementById('mdl-log-mutasi-ket').value.trim() || (tipe === 'masuk' ? 'Stok masuk' : 'Stok keluar');

  const { error } = await window.__sb.from('logistik_mutasi')
    .insert({ logistik_id: id, tipe, qty, keterangan: ket, dibuat_oleh: 'Admin' });
  if (error) { showToast(' ' + error.message); return; }

  // Update stok
  const { data: item } = await window.__sb.from('logistik').select('stok').eq('id', id).single();
  if (item) {
    const newStok = tipe === 'masuk' ? (item.stok || 0) + qty : Math.max(0, (item.stok || 0) - qty);
    await window.__sb.from('logistik').update({ stok: newStok }).eq('id', id);
  }

  showToast(' Stok ' + (tipe === 'masuk' ? 'masuk' : 'keluar') + ' ' + qty);
  hideM('mdl-log-mutasi');
  detailLogistik(id); // refresh detail
  loadLogistik(); // refresh table
}


// ===== AKUNTANSI =====
let __akunData = [];
let __jurnalData = [];

// ===== TAB SWITCHING =====
function switchAkunTab(tab) {
  document.querySelectorAll('.akun-tab').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = '';
  document.querySelectorAll('#pg-akuntansi .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#pg-akuntansi .tab-btn[data-tab="' + tab + '"]')?.classList.add('active');
  
  if (tab === 'jurnal') loadJurnalUmum();
  else if (tab === 'neracasaldo') loadNeracaSaldo();
  else if (tab === 'laba rugi') loadLabaRugi();
  else if (tab === 'neraca') loadNeraca();
  else if (tab === 'bukubesar') { loadAkunDropdown(); loadBukuBesar(); }
}

function activeAkunTab() {
  const active = document.querySelector('#pg-akuntansi .tab-btn.active');
  if (active) switchAkunTab(active.dataset.tab);
  else switchAkunTab('jurnal');
}

async function loadAkun() {
  await SharedState.waitReady();
  const { data: akun } = await window.__sb.from('akun').select('*').eq('aktif', true).order('kode');
  __akunData = akun || [];
  return __akunData;
}

function getAkun(id) { return __akunData.find(a => a.id === id); }

// ===== JURNAL UMUM =====
async function loadJurnalUmum() {
  await SharedState.waitReady();
  await loadAkun();
  const tbody = document.getElementById('jurnal-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';

  const { data: jurnal, error } = await window.__sb
    .from('jurnal')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const msg = error?.message || '';
    if (msg.includes('Could not find the table') || error?.code === '42P01') {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--warning)">⚠️ Tabel akuntansi belum dibuat — jalankan sql/09-akuntansi.sql</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">❌ ' + msg + '</td></tr>';
    return;
  }

  __jurnalData = jurnal || [];

  // Get totals for each journal
  const ids = __jurnalData.map(j => j.id);
  const { data: items } = ids.length ? await window.__sb.from('jurnal_item').select('jurnal_id, debit, kredit').in('jurnal_id', ids) : { data: [] };
  const totals = {};
  (items || []).forEach(it => {
    if (!totals[it.jurnal_id]) totals[it.jurnal_id] = { debit: 0, kredit: 0 };
    totals[it.jurnal_id].debit += Number(it.debit || 0);
    totals[it.jurnal_id].kredit += Number(it.kredit || 0);
  });

  if (!__jurnalData.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada jurnal</td></tr>';
    return;
  }

  tbody.innerHTML = __jurnalData.map(j => {
    const t = totals[j.id] || { debit: 0, kredit: 0 };
    return '<tr>' +
      '<td class="mono">' + j.no_jurnal + '</td>' +
      '<td style="font-size:12px">' + (j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID') : '—') + '</td>' +
      '<td>' + (j.keterangan || '') + '</td>' +
      '<td style="font-family:monospace;text-align:right">' + (t.debit ? formatRupiah(t.debit) : '—') + '</td>' +
      '<td style="font-family:monospace;text-align:right">' + (t.kredit ? formatRupiah(t.kredit) : '—') + '</td>' +
      '<td><button class="btn btn-o btn-xs" onclick="detailJurnal(\'' + j.id + '\')">📋</button></td>' +
      '</tr>';
  }).join('');
}

function filterJurnal() {
  const q = (document.getElementById('jurnal-search')?.value || '').toLowerCase();
  const tglDari = document.getElementById('jurnal-tgl-dari')?.value || '';
  const tglSampai = document.getElementById('jurnal-tgl-sampai')?.value || '';
  const filtered = __jurnalData.filter(j => {
    if (q && !j.no_jurnal?.toLowerCase().includes(q) && !(j.keterangan || '').toLowerCase().includes(q)) return false;
    if (tglDari && j.tanggal && j.tanggal < tglDari) return false;
    if (tglSampai && j.tanggal && j.tanggal > tglSampai) return false;
    return true;
  });
  const tbody = document.getElementById('jurnal-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Tidak ada data</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(j => {
    const t = { debit: 0, kredit: 0 };
    return '<tr>' +
      '<td class="mono">' + j.no_jurnal + '</td>' +
      '<td style="font-size:12px">' + (j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID') : '—') + '</td>' +
      '<td>' + (j.keterangan || '') + '</td>' +
      '<td style="font-family:monospace;text-align:right">—</td>' +
      '<td style="font-family:monospace;text-align:right">—</td>' +
      '<td><button class="btn btn-o btn-xs" onclick="detailJurnal(\'' + j.id + '\')">📋</button></td>' +
      '</tr>';
  }).join('');
}

// ===== CREATE JURNAL =====
function showJurnalBaru() {
  document.getElementById('mdl-jurnal-id').value = '';
  document.getElementById('mdl-jurnal-tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('mdl-jurnal-no').value = '';
  document.getElementById('mdl-jurnal-ket').value = '';
  document.getElementById('jurnal-items-container').innerHTML = '';
  document.getElementById('jurnal-total-debit').textContent = 'Rp 0';
  document.getElementById('jurnal-total-kredit').textContent = 'Rp 0';
  document.getElementById('jurnal-balance-msg').textContent = '';
  addJurnalItemRow();
  addJurnalItemRow();
  showM('mdl-jurnal');
}

function addJurnalItemRow(akunId, debit, kredit) {
  const c = document.getElementById('jurnal-items-container');
  const idx = c.children.length;
  const div = document.createElement('div');
  div.className = 'jurnal-item-row';
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:end';
  div.innerHTML = '<div style="flex:1"><label style="font-size:11px;color:var(--text-muted)">Akun</label>' +
    '<select class="fc" onchange="jurnalItemCalc()" style="padding:6px 8px;font-size:13px">' +
    '<option value="">Pilih akun...</option>' +
    __akunData.map(a => '<option value="' + a.id + '"' + (a.id === akunId ? ' selected' : '') + '>[' + a.kode + '] ' + a.nama + '</option>').join('') +
    '</select></div>' +
    '<div style="flex:0 0 120px"><label style="font-size:11px;color:var(--text-muted)">Debit</label>' +
    '<input class="fc" type="number" min="0" value="' + (debit || 0) + '" onchange="jurnalItemCalc()" style="padding:6px 8px;font-size:13px"></div>' +
    '<div style="flex:0 0 120px"><label style="font-size:11px;color:var(--text-muted)">Kredit</label>' +
    '<input class="fc" type="number" min="0" value="' + (kredit || 0) + '" onchange="jurnalItemCalc()" style="padding:6px 8px;font-size:13px"></div>' +
    '<button class="btn btn-d btn-xs" onclick="this.parentElement.remove();jurnalItemCalc()" style="margin-bottom:0">✕</button>';
  c.appendChild(div);
  jurnalItemCalc();
}

function jurnalItemCalc() {
  let totalDebit = 0, totalKredit = 0;
  document.querySelectorAll('#jurnal-items-container .jurnal-item-row').forEach(row => {
    const d = parseInt(row.querySelectorAll('input[type="number"]')[0]?.value) || 0;
    const k = parseInt(row.querySelectorAll('input[type="number"]')[1]?.value) || 0;
    totalDebit += d;
    totalKredit += k;
  });
  document.getElementById('jurnal-total-debit').textContent = formatRupiah(totalDebit);
  document.getElementById('jurnal-total-kredit').textContent = formatRupiah(totalKredit);
  const msg = document.getElementById('jurnal-balance-msg');
  if (totalDebit === 0 && totalKredit === 0) msg.textContent = '';
  else if (totalDebit === totalKredit) msg.innerHTML = '<span style="color:#22c55e">✅ Balance (Debit = Kredit)</span>';
  else msg.innerHTML = '<span style="color:var(--danger)">⚠️ Tidak balance! Selisih: Rp ' + Math.abs(totalDebit - totalKredit).toLocaleString('id-ID') + '</span>';
}

async function submitJurnal() {
  const ket = document.getElementById('mdl-jurnal-ket').value.trim();
  if (!ket) { showToast('Keterangan jurnal wajib diisi!'); return; }
  const tgl = document.getElementById('mdl-jurnal-tgl').value || new Date().toISOString().slice(0,10);

  const rows = document.querySelectorAll('#jurnal-items-container .jurnal-item-row');
  const items = [];
  let totalDebit = 0, totalKredit = 0;
  rows.forEach(row => {
    const sel = row.querySelector('select');
    const d = parseInt(row.querySelectorAll('input[type="number"]')[0]?.value) || 0;
    const k = parseInt(row.querySelectorAll('input[type="number"]')[1]?.value) || 0;
    if (sel && sel.value && (d > 0 || k > 0)) {
      items.push({ akun_id: sel.value, debit: d, kredit: k });
      totalDebit += d;
      totalKredit += k;
    }
  });
  if (items.length < 2) { showToast('Minimal 2 baris entri (debit & kredit)!'); return; }
  if (totalDebit !== totalKredit) { showToast('Total Debit harus sama dengan Total Kredit!'); return; }

  const noJurnal = document.getElementById('mdl-jurnal-no').value.trim() ||
    'JRN-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now() % 1000).padStart(3,'0');

  const { data: header, error: hErr } = await window.__sb.from('jurnal')
    .insert({ no_jurnal: noJurnal, tanggal: tgl, keterangan: ket }).select().single();
  if (hErr) { showToast(' ' + hErr.message); return; }

  const jItems = items.map(it => ({ ...it, jurnal_id: header.id }));
  const { error: iErr } = await window.__sb.from('jurnal_item').insert(jItems);
  if (iErr) {
    await window.__sb.from('jurnal').delete().eq('id', header.id);
    showToast(' ' + iErr.message);
    return;
  }

  showToast(' Jurnal ' + noJurnal + ' tersimpan!');
  hideM('mdl-jurnal');
  loadJurnalUmum();
}

// ===== DETAIL JURNAL =====
async function detailJurnal(id) {
  await SharedState.waitReady();
  const { data: j } = await window.__sb.from('jurnal').select('*').eq('id', id).single();
  if (!j) { showToast('Data tidak ditemukan'); return; }
  const { data: items } = await window.__sb.from('jurnal_item').select('*').eq('jurnal_id', id);

  let html = '<div style="margin-bottom:12px"><strong>' + j.no_jurnal + '</strong> — ' + (j.keterangan || '') + '<br><span style="color:var(--text-muted);font-size:13px">' + (j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID') : '') + '</span></div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left">Akun</th><th style="padding:8px;text-align:right">Debit</th><th style="padding:8px;text-align:right">Kredit</th></tr></thead><tbody>';

  let tDebit = 0, tKredit = 0;
  (items || []).forEach(it => {
    const a = getAkun(it.akun_id);
    html += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--border)">[' + (a?.kode || '?') + '] ' + (a?.nama || '—') + '</td>' +
      '<td style="padding:6px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">' + (it.debit ? formatRupiah(it.debit) : '—') + '</td>' +
      '<td style="padding:6px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">' + (it.kredit ? formatRupiah(it.kredit) : '—') + '</td></tr>';
    tDebit += Number(it.debit || 0);
    tKredit += Number(it.kredit || 0);
  });

  html += '</tbody><tfoot><tr style="font-weight:700"><td style="padding:8px;text-align:right">Total</td>' +
    '<td style="padding:8px;text-align:right;font-family:monospace">Rp ' + tDebit.toLocaleString('id-ID') + '</td>' +
    '<td style="padding:8px;text-align:right;font-family:monospace">Rp ' + tKredit.toLocaleString('id-ID') + '</td></tr></tfoot></table>';

  document.getElementById('mdl-jurnal-detail-body').innerHTML = html;
  showM('mdl-jurnal-detail');
}

// ===== BUKU BESAR =====
async function loadAkunDropdown() {
  const sel = document.getElementById('bb-akun');
  if (!sel) return;
  const cur = sel.value;
  await loadAkun();
  sel.innerHTML = '<option value="">— Pilih Akun —</option>' +
    __akunData.map(a => '<option value="' + a.id + '">' + a.kode + ' — ' + a.nama + '</option>').join('');
  if (cur) sel.value = cur;
}

async function loadBukuBesar() {
  const id = document.getElementById('bb-akun')?.value;
  const c = document.getElementById('bb-content');
  if (!id || !c) { c.innerHTML = 'Pilih akun untuk melihat Buku Besar'; return; }

  const a = getAkun(id);
  if (!a) { c.innerHTML = 'Akun tidak ditemukan'; return; }

  const { data: items } = await window.__sb.from('jurnal_item')
    .select('*, jurnal!inner(no_jurnal, tanggal, keterangan)')
    .eq('akun_id', id)
    .order('created_at', { ascending: true });

  let html = '<div style="margin-bottom:12px;font-size:15px;font-weight:700">Buku Besar — [' + a.kode + '] ' + a.nama + ' <span style="color:var(--text-muted);font-size:13px">(' + a.tipe + ' — Saldo ' + a.saldo_normal + ')</span></div>';

  let saldo = 0;
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:var(--bg)"><th style="padding:6px 8px;text-align:left">Tanggal</th><th style="padding:6px 8px;text-align:left">No. Jurnal</th><th style="padding:6px 8px;text-align:left">Keterangan</th><th style="padding:6px 8px;text-align:right">Debit</th><th style="padding:6px 8px;text-align:right">Kredit</th><th style="padding:6px 8px;text-align:right">Saldo</th></tr></thead><tbody>';

  (items || []).forEach(it => {
    const j = it.jurnal;
    const d = Number(it.debit || 0);
    const k = Number(it.kredit || 0);
    saldo = saldo + (a.saldo_normal === 'Debit' ? d - k : k - d);
    const tgl = j?.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID') : '—';
    html += '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);font-size:12px">' + tgl + '</td>' +
      '<td style="padding:4px 8px;border-bottom:1px solid var(--border);font-size:12px" class="mono">' + (j?.no_jurnal || '—') + '</td>' +
      '<td style="padding:4px 8px;border-bottom:1px solid var(--border)">' + (j?.keterangan || '') + '</td>' +
      '<td style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace">' + (d ? formatRupiah(d) : '') + '</td>' +
      '<td style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace">' + (k ? formatRupiah(k) : '') + '</td>' +
      '<td style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace;font-weight:600">Rp ' + saldo.toLocaleString('id-ID') + '</td></tr>';
  });

  html += '</tbody><tfoot><tr style="font-weight:700"><td colspan="5" style="padding:8px;text-align:right">Saldo Akhir</td>' +
    '<td style="padding:8px;text-align:right;font-family:monospace">Rp ' + saldo.toLocaleString('id-ID') + '</td></tr></tfoot></table>';

  c.innerHTML = html;
}

// ===== NERACA SALDO =====
async function loadNeracaSaldo() {
  await SharedState.waitReady();
  await loadAkun();
  const tbody = document.getElementById('ns-tbody');
  if (!tbody) return;

  let { data: items } = await window.__sb.from('jurnal_item').select('akun_id, debit, kredit');
  items = items || [];

  const summary = {};
  items.forEach(it => {
    const aid = it.akun_id;
    if (!summary[aid]) summary[aid] = { debit: 0, kredit: 0 };
    summary[aid].debit += Number(it.debit || 0);
    summary[aid].kredit += Number(it.kredit || 0);
  });

  let html = '';
  let totalDebit = 0, totalKredit = 0;
  __akunData.filter(a => a.aktif !== false).forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldoDebit = a.saldo_normal === 'Debit' ? Math.abs(s.debit - s.kredit) : 0;
    const saldoKredit = a.saldo_normal === 'Kredit' ? Math.abs(s.debit - s.kredit) : 0;
    totalDebit += saldoDebit;
    totalKredit += saldoKredit;
    if (saldoDebit || saldoKredit || a.induk_id === null) {
      html += '<tr><td class="mono">' + a.kode + '</td><td>' + a.nama + '</td><td>' + a.tipe +
        '</td><td style="text-align:right;font-family:monospace">' + (saldoDebit ? formatRupiah(saldoDebit) : '') +
        '</td><td style="text-align:right;font-family:monospace">' + (saldoKredit ? formatRupiah(saldoKredit) : '') + '</td></tr>';
    }
  });

  html += '<tr style="font-weight:700;border-top:2px solid var(--primary)"><td colspan="3" style="padding:10px;text-align:right">TOTAL</td>' +
    '<td style="padding:10px;text-align:right;font-family:monospace">Rp ' + totalDebit.toLocaleString('id-ID') + '</td>' +
    '<td style="padding:10px;text-align:right;font-family:monospace">Rp ' + totalKredit.toLocaleString('id-ID') + '</td></tr>';

  tbody.innerHTML = html;
}

// ===== LABA RUGI =====
async function loadLabaRugi() {
  await SharedState.waitReady();
  await loadAkun();
  const c = document.getElementById('laba-rugi-content');
  if (!c) return;

  const { data: items } = await window.__sb.from('jurnal_item').select('akun_id, debit, kredit');

  const summary = {};
  (items || []).forEach(it => {
    const aid = it.akun_id;
    if (!summary[aid]) summary[aid] = { debit: 0, kredit: 0 };
    summary[aid].debit += Number(it.debit || 0);
    summary[aid].kredit += Number(it.kredit || 0);
  });

  const akunLR = __akunData.filter(a => a.tipe === 'Pendapatan' || a.tipe === 'Beban');

  let html = '<div class="fr"><div style="flex:1"><h3 style="margin:0">📈 Laporan Laba Rugi</h3></div><div style="font-size:13px;color:var(--text-muted)">Periode: Semua data</div></div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px"><thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left">Akun</th><th style="padding:8px;text-align:right">Jumlah</th></tr></thead><tbody>';

  let totalPendapatan = 0, totalBeban = 0;

  // Pendapatan
  html += '<tr style="background:#f0fdf4"><td colspan="2" style="padding:8px;font-weight:700;color:#22c55e">PENDAPATAN</td></tr>';
  akunLR.filter(a => a.tipe === 'Pendapatan').forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldo = (s.kredit - s.debit);
    totalPendapatan += Math.max(0, saldo);
    if (saldo) html += '<tr><td style="padding:4px 8px;padding-left:24px;border-bottom:1px solid var(--border)">' + a.nama + '</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, saldo).toLocaleString('id-ID') + '</td></tr>';
  });
  html += '<tr style="font-weight:700"><td style="padding:8px;padding-left:24px">Total Pendapatan</td><td style="padding:8px;text-align:right;font-family:monospace;color:#22c55e">Rp ' + totalPendapatan.toLocaleString('id-ID') + '</td></tr>';

  // Beban
  html += '<tr style="background:#fef2f2"><td colspan="2" style="padding:8px;font-weight:700;color:var(--danger)">BEBAN</td></tr>';
  akunLR.filter(a => a.tipe === 'Beban').forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldo = (s.debit - s.kredit);
    totalBeban += Math.max(0, saldo);
    if (saldo) html += '<tr><td style="padding:4px 8px;padding-left:24px;border-bottom:1px solid var(--border)">' + a.nama + '</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, saldo).toLocaleString('id-ID') + '</td></tr>';
  });
  html += '<tr style="font-weight:700"><td style="padding:8px;padding-left:24px">Total Beban</td><td style="padding:8px;text-align:right;font-family:monospace;color:var(--danger)">Rp ' + totalBeban.toLocaleString('id-ID') + '</td></tr>';

  // Laba / Rugi
  const labaBersih = totalPendapatan - totalBeban;
  html += '<tr style="border-top:2px solid var(--primary)"><td style="padding:10px;font-weight:700;font-size:15px">' + (labaBersih >= 0 ? '✅ LABA BERSIH' : '❌ RUGI BERSIH') + '</td>' +
    '<td style="padding:10px;text-align:right;font-weight:700;font-size:15px;font-family:monospace">Rp ' + Math.abs(labaBersih).toLocaleString('id-ID') + '</td></tr>';

  html += '</tbody></table>';
  c.innerHTML = html;
}

// ===== NERACA =====
async function loadNeraca() {
  await SharedState.waitReady();
  await loadAkun();
  const c = document.getElementById('neraca-content');
  if (!c) return;

  const { data: items } = await window.__sb.from('jurnal_item').select('akun_id, debit, kredit');

  const summary = {};
  (items || []).forEach(it => {
    const aid = it.akun_id;
    if (!summary[aid]) summary[aid] = { debit: 0, kredit: 0 };
    summary[aid].debit += Number(it.debit || 0);
    summary[aid].kredit += Number(it.kredit || 0);
  });

  // Also get laba-rugi for this period
  const pendapatan = __akunData.filter(a => a.tipe === 'Pendapatan')
    .reduce((sum, a) => sum + Math.max(0, ((summary[a.id]?.kredit || 0) - (summary[a.id]?.debit || 0))), 0);
  const beban = __akunData.filter(a => a.tipe === 'Beban')
    .reduce((sum, a) => sum + Math.max(0, ((summary[a.id]?.debit || 0) - (summary[a.id]?.kredit || 0))), 0);
  const labaBersih = pendapatan - beban;

  let html = '<div style="margin-bottom:12px"><h3 style="margin:0">🏛️ Neraca</h3><span style="font-size:13px;color:var(--text-muted)">Periode: Semua data</span></div>';

  // AKTIVA
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px"><thead><tr style="background:#f0fdf4"><th style="padding:8px;text-align:left;color:#22c55e">AKTIVA</th><th style="padding:8px;text-align:right;color:#22c55e">Jumlah</th></tr></thead><tbody>';
  let totalAktiva = 0;
  __akunData.filter(a => a.tipe === 'Aktiva').forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldo = (s.debit - s.kredit);
    totalAktiva += Math.max(0, saldo);
    html += '<tr><td style="padding:4px 8px;padding-left:16px;border-bottom:1px solid var(--border)">' + a.nama + '</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, saldo).toLocaleString('id-ID') + '</td></tr>';
  });
  html += '<tr style="font-weight:700"><td style="padding:8px;padding-left:16px">Total Aktiva</td><td style="padding:8px;text-align:right;font-family:monospace">Rp ' + totalAktiva.toLocaleString('id-ID') + '</td></tr></tbody></table>';

  // PASIVA + MODAL
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px"><thead><tr style="background:#fef3c7"><th style="padding:8px;text-align:left;color:#f59e0b">PASIVA</th><th style="padding:8px;text-align:right;color:#f59e0b">Jumlah</th></tr></thead><tbody>';
  let totalPasiva = 0;
  __akunData.filter(a => a.tipe === 'Pasiva').forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldo = (s.kredit - s.debit);
    totalPasiva += Math.max(0, saldo);
    html += '<tr><td style="padding:4px 8px;padding-left:16px;border-bottom:1px solid var(--border)">' + a.nama + '</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, saldo).toLocaleString('id-ID') + '</td></tr>';
  });
  html += '<tr style="font-weight:700"><td style="padding:8px;padding-left:16px">Total Pasiva</td><td style="padding:8px;text-align:right;font-family:monospace">Rp ' + totalPasiva.toLocaleString('id-ID') + '</td></tr></tbody></table>';

  // MODAL
  let totalModal = 0;
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#e0f2fe"><th style="padding:8px;text-align:left;color:#2563eb">EKUITAS (MODAL)</th><th style="padding:8px;text-align:right;color:#2563eb">Jumlah</th></tr></thead><tbody>';
  __akunData.filter(a => a.tipe === 'Modal').forEach(a => {
    const s = summary[a.id] || { debit: 0, kredit: 0 };
    const saldo = (s.kredit - s.debit);
    totalModal += Math.max(0, saldo);
    html += '<tr><td style="padding:4px 8px;padding-left:16px;border-bottom:1px solid var(--border)">' + a.nama + '</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, saldo).toLocaleString('id-ID') + '</td></tr>';
  });
  const totalEkuitas = totalModal + Math.max(0, labaBersih);
  html += '<tr><td style="padding:4px 8px;padding-left:16px;border-bottom:1px solid var(--border)">Laba Bersih</td><td style="padding:4px 8px;text-align:right;font-family:monospace;border-bottom:1px solid var(--border)">Rp ' + Math.max(0, labaBersih).toLocaleString('id-ID') + '</td></tr>';
  html += '<tr style="font-weight:700"><td style="padding:8px;padding-left:16px">Total Ekuitas</td><td style="padding:8px;text-align:right;font-family:monospace">Rp ' + totalEkuitas.toLocaleString('id-ID') + '</td></tr></tbody></table>';

  // Check balance: Aktiva = Pasiva + Modal
  const totalKewajiban = totalPasiva + totalEkuitas;
  const balanced = totalAktiva === totalKewajiban;
  html += '<div style="margin-top:16px;padding:12px;border-radius:8px;text-align:center;font-weight:700;font-size:15px;' +
    (balanced ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:var(--danger)') + '">' +
    (balanced ? '✅ Balance: Aktiva = Pasiva + Ekuitas (Rp ' + totalAktiva.toLocaleString('id-ID') + ')' : '❌ Tidak balance! Aktiva Rp ' + totalAktiva.toLocaleString('id-ID') + ' ≠ Kewajiban Rp ' + totalKewajiban.toLocaleString('id-ID') ) +
    '</div>';

  c.innerHTML = html;
}

// ===== SECURITY (Role Matrix) =====
let __roles = [];
let __permissions = [];
let __rolePerms = {};

async function loadSecurity() {
  await SharedState.waitReady();
  const c = document.getElementById('security-matrix');
  if (!c) return;
  c.innerHTML = '⏳ Memuat matrix permission...';

  await loadRolesAndPerms();

  if (!__roles.length) {
    c.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Tidak ada data role. Buat role terlebih dahulu.</div>';
    return;
  }

  // Group permissions by module
  const modules = {};
  __permissions.forEach(p => {
    if (!modules[p.module]) modules[p.module] = [];
    modules[p.module].push(p);
  });

  let html = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  // Header row
  html += '<thead><tr style="background:var(--bg)"><th style="padding:8px;text-align:left;min-width:140px;position:sticky;left:0;background:var(--bg);z-index:2">Permission / Role</th>';
  __roles.forEach(r => {
    html += '<th style="padding:8px;text-align:center;min-width:100px;writing-mode:vertical-lr;transform:rotate(180deg);font-size:11px">' + r.name + '</th>';
  });
  html += '</tr></thead><tbody>';

  // Rows by module
  Object.keys(modules).sort().forEach(mod => {
    html += '<tr style="background:var(--primary-light);font-weight:700"><td style="padding:6px 8px;position:sticky;left:0;background:var(--primary-light);z-index:1" colspan="' + (__roles.length + 1) + '">' + mod + '</td></tr>';
    modules[mod].forEach(p => {
      html += '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);position:sticky;left:0;background:var(--bg);z-index:1"><span style="font-size:11px;color:var(--text-muted)">' + p.action + '</span> ' + p.description + '</td>';
      __roles.forEach(r => {
        const key = r.id + '|' + p.id;
        const allowed = __rolePerms[key];
        const val = allowed ? '✅' : '—';
        const bg = allowed ? '#dcfce7' : 'transparent';
        html += '<td style="padding:4px;text-align:center;border-bottom:1px solid var(--border);cursor:pointer;background:' + bg + '" onclick="togglePermission(\'' + r.id + '\',\'' + p.id + '\',this)" title="Klik untuk toggle">' + val + '</td>';
      });
      html += '</tr>';
    });
  });

  html += '</tbody></table>';
  c.innerHTML = html;
}

async function loadRolesAndPerms() {
  await SharedState.waitReady();

  const [rRes, pRes, rpRes] = await Promise.all([
    window.__sb.from('roles').select('*').order('name'),
    window.__sb.from('permissions').select('*').order('module, action'),
    window.__sb.from('role_permissions').select('*')
  ]);

  __roles = rRes.data || [];
  __permissions = pRes.data || [];
  const rp = rpRes.data || [];
  
  __rolePerms = {};
  rp.forEach(item => {
    __rolePerms[item.role_id + '|' + item.permission_id] = item.allowed;
  });
}

async function togglePermission(roleId, permId, el) {
  const key = roleId + '|' + permId;
  const current = __rolePerms[key];
  const newVal = !current;

  const { error } = await window.__sb.from('role_permissions')
    .upsert({ role_id: roleId, permission_id: permId, allowed: newVal }, { onConflict: 'role_id,permission_id' });

  if (error) { showToast(' ' + error.message); return; }

  __rolePerms[key] = newVal;
  el.innerHTML = newVal ? '✅' : '—';
  el.style.background = newVal ? '#dcfce7' : 'transparent';
}

function showRoleBaru() {
  document.getElementById('mdl-role-id').value = '';
  document.getElementById('mdl-role-name').value = '';
  document.getElementById('mdl-role-desc').value = '';
  document.querySelector('#mdl-role .mt').textContent = '➕ Role Baru';
  showM('mdl-role');
}

async function submitRole() {
  const name = document.getElementById('mdl-role-name').value.trim();
  if (!name) { showToast('Nama role wajib diisi!'); return; }
  const desc = document.getElementById('mdl-role-desc').value.trim();
  const editId = document.getElementById('mdl-role-id').value;

  if (editId) {
    const { error } = await window.__sb.from('roles').update({ name, description: desc }).eq('id', editId);
    if (error) { showToast(' ' + error.message); return; }
    showToast(' Role updated!');
  } else {
    const { error } = await window.__sb.from('roles').insert({ name, description: desc });
    if (error) { showToast(' ' + error.message); return; }
    showToast(' Role ' + name + ' ditambahkan!');
  }

  hideM('mdl-role');
  loadSecurity();
}

// ===== FIXED ASSET =====
let __faData = [];

async function loadFixedAssets() {
  await SharedState.waitReady();
  const tbody = document.getElementById('fa-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';

  const { data, error } = await window.__sb.from('fixed_assets').select('*').order('kode_aset');
  if (error || !data) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">' + (error?.message || 'Gagal memuat') + '</td></tr>'; return; }

  __faData = data;
  renderFixedAssets(data);
}

function renderFixedAssets(data) {
  const tbody = document.getElementById('fa-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada data aset tetap</td></tr>'; return; }
  tbody.innerHTML = data.map(a => {
    const depr = Math.max(0, (Number(a.harga_perolehan) - Number(a.nilai_residu)) / Math.max(1, a.umur_manfaat));
    const kondisiClass = a.kondisi === 'Baik' ? 'bs' : a.kondisi === 'Rusak Ringan' ? 'bw' : 'bd';
    return '<tr><td class="mono">' + a.kode_aset + '</td><td><strong>' + a.nama + '</strong></td><td>' + a.kategori + '</td><td style="font-family:monospace;text-align:right">Rp ' + Number(a.harga_perolehan).toLocaleString('id-ID') + '</td><td>' + (a.lokasi || '—') + '</td><td><span class="b ' + kondisiClass + '">' + a.kondisi + '</span></td><td><button class="btn btn-o btn-xs" onclick="detailFixedAsset(\'' + a.id + '\')">📋</button></td></tr>';
  }).join('');
}

function filterFixedAssets() {
  const q = (document.getElementById('fa-search')?.value || '').toLowerCase();
  const kat = document.getElementById('fa-kategori')?.value || '';
  const filtered = __faData.filter(a => {
    if (q && !a.nama.toLowerCase().includes(q) && !a.kode_aset.toLowerCase().includes(q)) return false;
    if (kat && a.kategori !== kat) return false;
    return true;
  });
  renderFixedAssets(filtered);
}

function showAssetBaru() {
  document.getElementById('mdl-fa-id').value = '';
  document.getElementById('mdl-fa-kode').value = 'ASET-' + String(__faData.length + 1).padStart(3, '0');
  document.getElementById('mdl-fa-nama').value = '';
  document.getElementById('mdl-fa-tgl').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mdl-fa-kat').value = 'Peralatan Medis';
  document.getElementById('mdl-fa-kondisi').value = 'Baik';
  document.getElementById('mdl-fa-harga').value = '';
  document.getElementById('mdl-fa-residu').value = '';
  document.getElementById('mdl-fa-umur').value = '5';
  document.getElementById('mdl-fa-lokasi').value = '';
  document.getElementById('mdl-fa-ket').value = '';
  document.querySelector('#mdl-fa .mt').textContent = '➕ Aset Baru';
  showM('mdl-fa');
}

async function detailFixedAsset(id) {
  const a = __faData.find(x => x.id === id);
  if (!a) { showToast('Data tidak ditemukan'); return; }
  document.getElementById('mdl-fa-id').value = a.id;
  document.getElementById('mdl-fa-kode').value = a.kode_aset;
  document.getElementById('mdl-fa-nama').value = a.nama;
  document.getElementById('mdl-fa-tgl').value = a.tanggal_perolehan?.slice(0, 10) || '';
  document.getElementById('mdl-fa-kat').value = a.kategori;
  document.getElementById('mdl-fa-kondisi').value = a.kondisi;
  document.getElementById('mdl-fa-harga').value = a.harga_perolehan;
  document.getElementById('mdl-fa-residu').value = a.nilai_residu;
  document.getElementById('mdl-fa-umur').value = a.umur_manfaat;
  document.getElementById('mdl-fa-lokasi').value = a.lokasi || '';
  document.getElementById('mdl-fa-ket').value = a.keterangan || '';
  document.querySelector('#mdl-fa .mt').textContent = '📋 Edit Aset';
  showM('mdl-fa');
}

async function submitFixedAsset() {
  const kode = document.getElementById('mdl-fa-kode').value.trim();
  const nama = document.getElementById('mdl-fa-nama').value.trim();
  if (!kode || !nama) { showToast('Kode & Nama aset wajib diisi!'); return; }
  const editId = document.getElementById('mdl-fa-id').value;

  const payload = {
    kode_aset: kode, nama, kategori: document.getElementById('mdl-fa-kat').value,
    tanggal_perolehan: document.getElementById('mdl-fa-tgl').value,
    harga_perolehan: Number(document.getElementById('mdl-fa-harga').value) || 0,
    nilai_residu: Number(document.getElementById('mdl-fa-residu').value) || 0,
    umur_manfaat: Number(document.getElementById('mdl-fa-umur').value) || 5,
    lokasi: document.getElementById('mdl-fa-lokasi').value.trim(),
    kondisi: document.getElementById('mdl-fa-kondisi').value,
    keterangan: document.getElementById('mdl-fa-ket').value.trim()
  };

  let error;
  if (editId) {
    ({ error } = await window.__sb.from('fixed_assets').update(payload).eq('id', editId));
  } else {
    ({ error } = await window.__sb.from('fixed_assets').insert(payload));
  }
  if (error) { showToast(' ' + error.message); return; }
  showToast(' Aset ' + (editId ? 'diupdate!' : 'ditambahkan!'));
  hideM('mdl-fa');
  loadFixedAssets();
}

// ===== AUDIT TRAIL =====
let __auditData = [];

async function loadAuditLogs() {
  await SharedState.waitReady();
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">⏳ Memuat...</td></tr>';

  const { data, error } = await window.__sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error || !data) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--danger)">' + (error?.message || 'Gagal memuat') + '</td></tr>'; return; }

  __auditData = data;
  renderAuditLogs(data);
}

function renderAuditLogs(data) {
  const tbody = document.getElementById('audit-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Belum ada log aktivitas</td></tr>'; return; }
  tbody.innerHTML = data.map(l => {
    const waktu = l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '—';
    const aksiClass = l.action === 'Login' ? '' : '';
    return '<tr><td style="font-size:12px;color:var(--text-muted)">' + waktu + '</td><td><strong>' + (l.user_name || '—') + '</strong></td><td>' + l.action + '</td><td><span style="font-size:13px">' + (l.entity_name || l.entity_type || '—') + '</span></td><td style="font-size:13px;color:var(--text-muted)">' + (l.detail || '') + '</td></tr>';
  }).join('');
}

function filterAudit() {
  const q = (document.getElementById('audit-search')?.value || '').toLowerCase();
  const tgl = document.getElementById('audit-tgl')?.value || '';
  const filtered = __auditData.filter(l => {
    if (q && !l.user_name?.toLowerCase().includes(q) && !l.action?.toLowerCase().includes(q) && !l.entity_name?.toLowerCase().includes(q)) return false;
    if (tgl && l.created_at && l.created_at.slice(0, 10) !== tgl) return false;
    return true;
  });
  renderAuditLogs(filtered);
}

  // ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();
    initAuth();
    tick();
    setInterval(tick, 1000);

    // Session expiry check every 30 seconds
    setInterval(function() {
      var u = window.medicoreUser;
      if (u && u._expiresAt && Date.now() > u._expiresAt) {
        doLogout();
        showToast('Sesi berakhir. Silakan login ulang.', 'warning');
      }
    }, 30000);

    renderDashboard();

    // Init users from DB (fallback to array)
    loadUsers();

    // Init autocomplete components
    setTimeout(initAutocompletes, 500);

    // Listen for real-time updates
    SharedState.onUpdate((key) => {
        renderDashboard();
    });
});
