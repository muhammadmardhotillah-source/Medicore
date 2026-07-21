/**
 * display-antrian.js
 * Queue Display — real data from Supabase + realtime
 */

// LOKET DEFINITIONS
const LOKETS = [
  { id: 1, prefix: 'A', name: 'Loket 1', type: 'Umum / Asuransi', htmlId: 'loket-1', numId: 'ln1' },
  { id: 2, prefix: 'B', name: 'Loket 2', type: 'BPJS', htmlId: 'loket-2', numId: 'ln2' },
  { id: 3, prefix: 'C', name: 'Loket 3', type: 'JKN Mobile', htmlId: 'loket-3', numId: 'ln3' },
  { id: 4, prefix: 'D', name: 'Loket 4', type: 'Mobile', htmlId: 'loket-4', numId: 'ln4' },
  { id: 5, prefix: 'F', name: 'Farmasi', type: 'Pengambilan Obat', htmlId: 'loket-5', numId: 'ln5' },
  { id: 6, prefix: 'K', name: 'Kasir', type: 'Pembayaran', htmlId: 'loket-6', numId: 'ln6' },
];

// POLI LIST (populated from Supabase)
let POLI_LIST = [];
let CURRENT_POLI_INDEX = 0;

// CLOCK
function tick() {
  const n = new Date();
  const t = n.toLocaleTimeString('id-ID');
  const d = n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  ['clk', 'pd-clk', 'aq-clk', 'ft-clk', 'aq-ft'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  });
  ['dt', 'pd-dt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = d;
  });
}
tick();
setInterval(tick, 1000);

// MODE SWITCH
function setMode(mode, event) {
  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.remove('active'); });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  var modeBar = document.querySelector('.mode-bar');
  if (modeBar) modeBar.classList.toggle('hidden', mode !== 'kunjungan');

  var modeKunjungan = document.getElementById('mode-kunjungan');
  var modePoli = document.getElementById('mode-poli');
  var modeSemua = document.getElementById('mode-semua');
  if (modeKunjungan) modeKunjungan.style.display = 'none';
  if (modePoli) modePoli.classList.remove('active');
  if (modeSemua) modeSemua.classList.remove('active');
  if (mode === 'kunjungan' && modeKunjungan) { modeKunjungan.style.display = 'flex'; }
  else if (mode === 'poli' && modePoli) { modePoli.classList.add('active'); }
  else if (mode === 'semua' && modeSemua) { modeSemua.classList.add('active'); }
}

// ─── SUPABASE HELPERS ───
function sb() { return window.__sb; }

let cachedRegs = [];
let cachedPatients = {};
let cachedPolis = {};
let cachedDoctors = {};

async function fetchQueues() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Fetch recent registrations (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: regs } = await sb()
      .from('registrations')
      .select('id, no_antrian, status, penjamin, patient_id, poli_id, loket_id, created_at')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: true });

    if (regs) cachedRegs = regs;

    // Fetch patients for names
    const pIds = [...new Set((regs || []).map(r => r.patient_id).filter(Boolean))];
    if (pIds.length > 0) {
      const { data: patients } = await sb()
        .from('patients')
        .select('id, no_rm, nama')
        .in('id', pIds);
      cachedPatients = {};
      (patients || []).forEach(p => cachedPatients[p.id] = p);
    }

    // Fetch poli
    const { data: polis } = await sb()
      .from('poli')
      .select('*');
    cachedPolis = {};
    (polis || []).forEach(p => cachedPolis[p.id] = p);

    // Fetch doctors
    const { data: doctors } = await sb()
      .from('doctors')
      .select('*, poli(nama_poli)');
    cachedDoctors = {};
    (doctors || []).forEach(d => {
      if (!cachedDoctors[d.poli_id]) cachedDoctors[d.poli_id] = [];
      cachedDoctors[d.poli_id].push(d);
    });

    // Render all modes
    renderKunjunganMode();
    renderPoliMode();
    renderSemuaMode();
    renderStats();
    // Start poli cycle after data loaded
    if (POLI_LIST.length > 0) startPoliCycle();
  } catch (err) {
    console.error('Display fetch error:', err);
  }
}

// ─── KUNJUNGAN MODE ───
function renderKunjunganMode() {
  // Group registrations by prefix (first char of no_antrian)
  const groups = {};
  cachedRegs.forEach(r => {
    if (!r.no_antrian) return;
    const prefix = r.no_antrian.charAt(0).toUpperCase();
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(r);
  });

  // Update each loket
  let latestCall = null;
  let latestName = '';

  LOKETS.forEach(loket => {
    const items = groups[loket.prefix] || [];
    // Find the "calling" or "Proses" one; otherwise the most recent
    const active = items.find(r => r.status === 'Calling' || r.status === 'Proses') ||
      items[items.length - 1] || null;

    const numEl = document.getElementById(loket.numId);
    if (numEl) numEl.textContent = active ? active.no_antrian : `—`;

    const loketEl = document.getElementById(loket.htmlId);
    if (loketEl) {
      loketEl.classList.toggle('active', !!active);
    }

    // Track the most recent "Calling" for the big display
    if (active && (active.status === 'Calling' || active.status === 'Proses')) {
      if (!latestCall || new Date(active.created_at) > new Date(latestCall.created_at)) {
        latestCall = active;
        const pat = cachedPatients[active.patient_id];
        latestName = pat ? pat.nama : '';
      }
    }
  });

  // If no calling found, use the most recent non-Selesai registration
  if (!latestCall) {
    const nonSelesai = cachedRegs.filter(r => r.status !== 'Selesai');
    if (nonSelesai.length > 0) {
      latestCall = nonSelesai[nonSelesai.length - 1];
      const pat = cachedPatients[latestCall.patient_id];
      latestName = pat ? pat.nama : '';
    }
  }

  // Big display
  const callNumEl = document.getElementById('call-num');
  const callLoketEl = document.getElementById('call-loket-name');
  const callNameEl = document.getElementById('call-name');

  if (latestCall) {
    if (callNumEl) callNumEl.textContent = latestCall.no_antrian || '—';
    if (callLoketEl) {
      const prefix = latestCall.no_antrian ? latestCall.no_antrian.charAt(0).toUpperCase() : '';
      const loket = LOKETS.find(l => l.prefix === prefix);
      if (callLoketEl) callLoketEl.textContent = loket ? loket.name : 'Loket';
    }
    if (callNameEl) callNameEl.textContent = latestName || latestCall.penjamin || '—';
  } else {
    if (callNumEl) callNumEl.textContent = '—';
    if (callLoketEl) callLoketEl.textContent = 'Loket 1';
    if (callNameEl) callNameEl.textContent = 'Menunggu Antrian';
  }
}

// ─── POLI DISPLAY MODE ───
function renderPoliMode() {
  // Get list of poli
  const polis = Object.values(cachedPolis);
  if (polis.length === 0) {
    POLI_LIST = [];
    return;
  }
  POLI_LIST = polis;

  // Cycle through poli every 15 seconds
  if (POLI_LIST.length > 0) {
    const poli = POLI_LIST[CURRENT_POLI_INDEX % POLI_LIST.length];
    const doctors = cachedDoctors[poli.id] || [];

    const nameEl = document.getElementById('pd-poli-name');
    if (nameEl) nameEl.textContent = `POLI — ${poli.nama_poli}`;

    const dokterNameEl = document.querySelector('.pd-dokter-name');
    if (dokterNameEl) {
      if (doctors.length > 0) {
        dokterNameEl.textContent = doctors.map(d => d.nama_dokter).join(', ');
      } else {
        dokterNameEl.textContent = 'Dokter belum tersedia';
      }
    }

    const jadwalEl = document.querySelector('.pd-jadwal');
    if (jadwalEl) {
      if (doctors.length > 0 && doctors[0].jadwal_praktik) {
        jadwalEl.textContent = `⏰ ${doctors[0].jadwal_praktik}`;
      } else {
        jadwalEl.textContent = '⏰ —';
      }
    }

    // Count registrations for this poli
    const poliRegs = cachedRegs.filter(r => r.poli_id === poli.id);
    const calling = poliRegs.find(r => r.status === 'Calling' || r.status === 'Proses');
    const waiting = poliRegs.filter(r => r.status === 'Menunggu');

    const numEl = document.getElementById('pd-num');
    if (numEl) numEl.textContent = calling ? calling.no_antrian : (poliRegs.length > 0 ? poliRegs[poliRegs.length - 1].no_antrian : '—');

    const tungguEl = document.getElementById('pd-tunggu');
    if (tungguEl) tungguEl.textContent = waiting.length;

    const prosesEl = document.getElementById('pd-proses');
    if (prosesEl) prosesEl.textContent = calling ? 1 : 0;

    const statusEl = document.querySelector('.pd-status-val');
    if (statusEl) {
      if (calling) {
        statusEl.textContent = '● Sedang Melayani';
        statusEl.style.color = '#4ade80';
      } else if (waiting.length > 0) {
        statusEl.textContent = '● Menunggu Pasien';
        statusEl.style.color = '#fbbf24';
      } else {
        statusEl.textContent = '● Tidak Ada Antrian';
        statusEl.style.color = '#94a3b8';
      }
    }
  }
}

// ─── SEMUA ANTRIAN MODE ───
function renderSemuaMode() {
  // Pendaftaran / Loket group: prefixes A, B, C, D
  const loketPrefixes = ['A', 'B', 'C', 'D'];
  const farmasiPrefixes = ['F'];
  const kasirPrefixes = ['K'];
  const labPrefixes = ['L'];

  const groups = {};
  cachedRegs.forEach(r => {
    if (!r.no_antrian) return;
    const prefix = r.no_antrian.charAt(0).toUpperCase();
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(r);
  });

  function buildItems(prefixes) {
    let items = [];
    prefixes.forEach(p => {
      const regs = groups[p] || [];
      regs.forEach(r => {
        const pat = cachedPatients[r.patient_id];
        items.push({
          no_antrian: r.no_antrian,
          status: r.status,
          name: pat ? pat.nama : r.penjamin || '—',
          unit: r.penjamin || '—'
        });
      });
    });
    // Sort: Calling first, then Proses, then Menunggu
    items.sort((a, b) => {
      const order = { 'Calling': 0, 'Proses': 1, 'Menunggu': 2, 'Selesai': 3 };
      return (order[a.status] || 99) - (order[b.status] || 99);
    });
    return items;
  }

  // Render the all-queue columns
  const colPendaftaran = document.querySelector('.all-q .aq-body .aq-col:nth-child(1)');
  const colFarmasiKasir = document.querySelector('.all-q .aq-body .aq-col:nth-child(2)');
  const colLabRad = document.querySelector('.all-q .aq-body .aq-col:nth-child(3)');

  if (colPendaftaran) {
    const head = colPendaftaran.querySelector('.aq-col-head');
    let html = head ? head.outerHTML : '<div class="aq-col-head">🏥 Pendaftaran / Loket</div>';
    const items = buildItems(loketPrefixes);
    items.slice(0, 8).forEach(item => {
      const isCalling = item.status === 'Calling' || item.status === 'Proses';
      html += `<div class="aq-item${isCalling ? ' calling' : ''}">
        <div class="aq-q">${item.no_antrian}</div>
        <div class="aq-info"><div class="aq-name">${item.name}</div><div class="aq-unit">${item.unit}</div></div>
      </div>`;
    });
    if (items.length === 0) {
      html += '<div style="padding:12px;font-size:12px;opacity:.5;text-align:center">Belum ada antrian</div>';
    }
    colPendaftaran.innerHTML = html;
  }

  if (colFarmasiKasir) {
    const head = colFarmasiKasir.querySelector('.aq-col-head');
    let html = head ? head.outerHTML : '<div class="aq-col-head">💊 Farmasi &amp; 💳 Kasir</div>';
    const items = buildItems([...farmasiPrefixes, ...kasirPrefixes]);
    items.slice(0, 8).forEach(item => {
      const isCalling = item.status === 'Calling' || item.status === 'Proses';
      html += `<div class="aq-item${isCalling ? ' calling' : ''}">
        <div class="aq-q">${item.no_antrian}</div>
        <div class="aq-info"><div class="aq-name">${item.name}</div><div class="aq-unit">${item.unit}</div></div>
      </div>`;
    });
    if (items.length === 0) {
      html += '<div style="padding:12px;font-size:12px;opacity:.5;text-align:center">Belum ada antrian</div>';
    }
    colFarmasiKasir.innerHTML = html;
  }

  if (colLabRad) {
    const head = colLabRad.querySelector('.aq-col-head');
    let html = head ? head.outerHTML : '<div class="aq-col-head">🧪 Lab &amp; 🔬 Radiologi</div>';
    const items = buildItems(labPrefixes);
    items.slice(0, 8).forEach(item => {
      const isCalling = item.status === 'Calling' || item.status === 'Proses';
      html += `<div class="aq-item${isCalling ? ' calling' : ''}">
        <div class="aq-q">${item.no_antrian}</div>
        <div class="aq-info"><div class="aq-name">${item.name}</div><div class="aq-unit">${item.unit}</div></div>
      </div>`;
    });
    if (items.length === 0) {
      html += '<div style="padding:12px;font-size:12px;opacity:.5;text-align:center">Belum ada antrian</div>';
    }
    colLabRad.innerHTML = html;
  }

  // Latest queue number in title
  const aqNum = document.getElementById('aq-num');
  if (aqNum) {
    const nonSelesai = cachedRegs.filter(r => r.status !== 'Selesai');
    const last = nonSelesai.length > 0 ? nonSelesai[nonSelesai.length - 1] : null;
    aqNum.textContent = last ? last.no_antrian || '0000' : '0000';
  }
}

// ─── STATS ───
async function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  const todayRegs = cachedRegs.filter(r => r.created_at && r.created_at.slice(0, 10) === today);

  const rj = todayRegs.filter(r => r.poli_id && r.status !== 'Opname').length;
  const ri = todayRegs.filter(r => r.status === 'Opname').length;
  const waiting = todayRegs.filter(r => r.status === 'Menunggu').length;

  // Fetch bed stats from Supabase
  let bedsTersedia = '—';
  try {
    const { data: beds } = await sb()
      .from('beds')
      .select('status');
    if (beds) bedsTersedia = beds.filter(b => b.status === 'Tersedia').length;
  } catch (e) {}

  const statEls = {
    'stat-rj': rj,
    'stat-ri': ri,
    'stat-tt': bedsTersedia,
    'stat-q': waiting
  };

  Object.entries(statEls).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

// ─── POLI CYCLE ───
let _poliCycleInterval = null;
let _manualPoliId = null;  // null = auto-cycle

function showPoliSelector() {
  const body = document.getElementById('ps-body');
  if (!body) return;
  const polis = Object.values(cachedPolis);
  if (polis.length === 0) {
    body.innerHTML = '<div class="ps-empty">Belum ada data poli</div>';
  } else {
    body.innerHTML = polis.map(p => {
      const isActive = _manualPoliId 
        ? String(_manualPoliId) === String(p.id)
        : String(POLI_LIST[CURRENT_POLI_INDEX % POLI_LIST.length]?.id) === String(p.id);
      const icons = ['🏥','🩺','🦷','👁️','👂','❤️','🫁','🧠','🦴','🤰','🧬','🩸','⚕️'];
      const icon = icons[polis.indexOf(p) % icons.length];
      return `<div class="ps-item${isActive ? ' active' : ''}" onclick="selectPoli('${p.id}')">
        <div class="ps-item-icon">${icon}</div>
        <div class="ps-item-info">
          <div class="ps-item-name">${p.nama_poli || 'Poli'}</div>
          <div class="ps-item-desc">${p.lokasi || ''} ${p.kode_poli ? '• '+p.kode_poli : ''}</div>
        </div>
        <div class="ps-item-check">✓</div>
      </div>`;
    }).join('');
  }
  document.getElementById('poli-selector')?.classList.add('active');
}

function hidePoliSelector() {
  document.getElementById('poli-selector')?.classList.remove('active');
}

function selectPoli(poliId) {
  hidePoliSelector();
  _manualPoliId = poliId;
  // Find index in POLI_LIST (id could be int from DB, poliId from attr is string)
  const idx = POLI_LIST.findIndex(p => String(p.id) === String(poliId));
  if (idx >= 0) {
    CURRENT_POLI_INDEX = idx;
    // Stop auto-cycle
    if (_poliCycleInterval) {
      clearInterval(_poliCycleInterval);
      _poliCycleInterval = null;
    }
    document.getElementById('btn-pd-cycle').style.display = '';
    renderPoliMode();
  } else {
    console.warn('Poli not found:', poliId, POLI_LIST.map(p => p.id));
  }
}

function togglePoliCycle() {
  if (_poliCycleInterval) {
    // Stop cycle
    clearInterval(_poliCycleInterval);
    _poliCycleInterval = null;
    document.getElementById('btn-pd-cycle').textContent = '▶ Auto';
    return;
  }
  // Resume cycle
  _manualPoliId = null;
  document.getElementById('btn-pd-cycle').textContent = '🔄 Auto';
  document.getElementById('btn-pd-cycle').style.display = 'none';
  _poliCycleInterval = setInterval(() => {
    if (POLI_LIST.length > 0) {
      CURRENT_POLI_INDEX = (CURRENT_POLI_INDEX + 1) % POLI_LIST.length;
      renderPoliMode();
    }
  }, 15000);
}

// Start auto-cycle on init (called after poli data loaded)
function startPoliCycle() {
  if (_poliCycleInterval) clearInterval(_poliCycleInterval);
  _poliCycleInterval = setInterval(() => {
    if (!_manualPoliId && POLI_LIST.length > 0) {
      CURRENT_POLI_INDEX = (CURRENT_POLI_INDEX + 1) % POLI_LIST.length;
      renderPoliMode();
    }
  }, 15000);
}

// ─── REALTIME SUBSCRIPTION ───
function subscribeRealtime() {
  try {
    sb()
      .channel('display-antrian-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        () => { fetchQueues(); })
      .subscribe();
  } catch (err) {
    console.error('Realtime subscription error:', err);
  }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for SharedState to init first
  if (window.SharedState) {
    await SharedState.waitReady().catch(() => {});
  }

  // Initial fetch
  await fetchQueues();

  // Subscribe to realtime
  subscribeRealtime();
});
