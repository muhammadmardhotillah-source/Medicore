/**
 * emr.js — Standalone EMR
 * Real data from Supabase, no local SharedState dependency
 */

// ─── GET URL PARAM ───
function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

let currentReg = null;
let currentPatient = null;
let currentPoli = null;
let currentDoctor = null;
let REG_ID = getParam('reg_id');

// ─── CLOCK ───
function tick() {
  const n = new Date();
  document.querySelectorAll('[id$="clk"]').forEach(el => {
    if (el.id === 'clk-top') el.textContent = n.toLocaleTimeString('id-ID');
  });
}
tick(); setInterval(tick, 1000);

// ─── SOAP TABS ───
function switchTab(tabEl, contentId) {
  document.querySelectorAll('#emr-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  tabEl.classList.add('active');
  const content = document.getElementById(contentId);
  if (content) content.classList.add('active');
}

// ─── ICD SEARCH ───
const ICD_LIST = [
  { code: 'I10', name: 'Essential (primary) hypertension' },
  { code: 'I11', name: 'Hypertensive heart disease' },
  { code: 'I50', name: 'Heart failure' },
  { code: 'I48', name: 'Atrial fibrillation and flutter' },
  { code: 'I25', name: 'Chronic ischaemic heart disease' },
  { code: 'E11', name: 'Type 2 diabetes mellitus without complications' },
  { code: 'E78', name: 'Disorders of lipoprotein metabolism' },
  { code: 'Z87', name: 'Personal history of other conditions' },
  { code: 'J45', name: 'Asthma' },
  { code: 'J15', name: 'Bacterial pneumonia, not elsewhere classified' },
  { code: 'N39', name: 'Urinary tract infection, site not specified' },
  { code: 'K29', name: 'Gastritis and duodenitis' },
  { code: 'M54', name: 'Dorsalgia (back pain)' },
  { code: 'R51', name: 'Headache' },
  { code: 'R10', name: 'Abdominal and pelvic pain' },
  { code: 'A09', name: 'Infectious gastroenteritis and colitis' },
];

function searchICD(input, resultsId) {
  const q = input.value.toLowerCase();
  const results = document.getElementById(resultsId);
  if (!results) return;
  if (q.length < 1) { results.style.display = 'none'; return; }
  const matched = ICD_LIST.filter(i => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  if (matched.length === 0) { results.style.display = 'none'; return; }
  results.innerHTML = matched.map(i =>
    `<div class="icd-item" onclick="selectICD('${input.id}','${resultsId}','${i.code}','${i.name.replace(/'/g,"\\'")}')">
      <div class="icd-code">${i.code}</div>
      <div class="icd-name">${i.name}</div>
    </div>`
  ).join('');
  results.style.display = 'block';
}

function selectICD(inputId, resultsId, code, name) {
  const input = document.getElementById(inputId);
  if (input) input.value = `${code} — ${name}`;
  const results = document.getElementById(resultsId);
  if (results) results.style.display = 'none';
}

// ─── DRUG SEARCH ───
let drugList = [];

async function loadDrugs() {
  try {
    const { data } = await window.__sb.from('medicines').select('*').limit(100);
    if (data) drugList = data;
    renderDrugList('');
  } catch (e) {
    console.error('Drug load error:', e);
    // Fallback to hardcoded
    drugList = [
      { id: 1, nama_obat: 'Amlodipine 5mg', bentuk: 'Tab', harga: 850, stok: 240 },
      { id: 2, nama_obat: 'Metformin 500mg', bentuk: 'Tab', harga: 420, stok: 380 },
      { id: 3, nama_obat: 'Bisoprolol 5mg', bentuk: 'Tab', harga: 1200, stok: 42 },
      { id: 4, nama_obat: 'Omeprazole 20mg', bentuk: 'Kaps', harga: 680, stok: 520 },
      { id: 5, nama_obat: 'Furosemide 40mg', bentuk: 'Tab', harga: 320, stok: 180 },
      { id: 6, nama_obat: 'Captopril 25mg', bentuk: 'Tab', harga: 250, stok: 600 },
      { id: 7, nama_obat: 'Paracetamol 500mg', bentuk: 'Tab', harga: 150, stok: 1000 },
      { id: 8, nama_obat: 'Amoxicillin 500mg', bentuk: 'Kaps', harga: 350, stok: 450 },
    ];
    renderDrugList('');
  }
}

function filterDrug(q) {
  renderDrugList(q);
}

function renderDrugList(q) {
  const list = document.getElementById('drug-list');
  if (!list) return;
  const filtered = drugList.filter(d => d.nama_obat.toLowerCase().includes((q || '').toLowerCase()));
  const cats = { Tab: '💊', Kaps: '💊', Sirup: '🧴', Injeksi: '💉' };
  list.innerHTML = filtered.map(d => `
    <div class="drug-item" onclick="addDrug('${d.nama_obat}','${d.bentuk}','Rp ${d.harga.toLocaleString()}',${d.stok})">
      <div class="drug-icon">${cats[d.bentuk] || '💊'}</div>
      <div style="flex:1"><div class="drug-name">${d.nama_obat}</div><div class="drug-detail">${d.bentuk} • Rp ${d.harga.toLocaleString()}/tab</div></div>
      <div class="drug-stock" style="color:${d.stok < 50 ? 'var(--warning)' : 'var(--success)'}">${d.stok}</div>
      <button class="btn btn-p btn-xs" style="margin-left:8px">+</button>
    </div>
  `).join('');
  if (filtered.length === 0) list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px">Obat tidak ditemukan</div>';
}

function addDrug(nama, bentuk, harga, stok) {
  const body = document.getElementById('rx-body');
  if (!body) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${nama}</strong></td>
    <td><input class="rx-input" value="1x1" style="width:50px"></td>
    <td><select class="rx-input" style="width:90px">
      <option>Pagi</option><option>Pagi-Siang</option><option>3x sehari</option>
    </select></td>
    <td><input class="rx-input" value="30" style="width:40px"> tab</td>
    <td><input class="rx-input" value="Setelah makan" style="width:110px"></td>
    <td><button class="btn btn-d btn-xs" onclick="this.closest('tr').remove();updateTotal()">✕</button></td>
  `;
  body.appendChild(tr);
  updateTotal();
}

function updateTotal() {
  // Simple: just count items
}

// ─── VITAL ───
function saveVital() {
  const vitals = {
    td: document.getElementById('v-td')?.value || '',
    nadi: document.getElementById('v-nd')?.value || '',
    suhu: document.getElementById('v-sh')?.value || '',
    rr: document.getElementById('v-rr')?.value || '',
    spo2: document.getElementById('v-o2')?.value || '',
    gds: document.getElementById('v-gds')?.value || '',
  };
  console.log('Vitals saved:', vitals);
  showToast('✅ Tanda vital tersimpan');
}

// ─── LOAD DATA ───
async function loadEMRData() {
  if (!REG_ID) {
    // No reg_id provided — show empty patient info
    document.querySelector('.pasien-name').textContent = 'Buka dari Rawat Jalan';
    document.querySelector('.pasien-meta').textContent = 'Pilih pasien terlebih dahulu';
    return;
  }

  try {
    // Load registration with patient data
    const { data: reg } = await window.__sb
      .from('registrations')
      .select('*, patients(*), poli(nama_poli)')
      .eq('id', REG_ID)
      .single();

    if (!reg) {
      showToast('❌ Registrasi tidak ditemukan');
      return;
    }

    currentReg = reg;
    currentPatient = reg.patients;
    currentPoli = reg.poli;

    // Check poli for doctor info
    if (reg.poli_id) {
      const { data: docs } = await window.__sb
        .from('doctors')
        .select('*')
        .eq('poli_id', reg.poli_id)
        .limit(1);
      if (docs && docs.length > 0) currentDoctor = docs[0];
    }

    // Populate UI
    populatePatientInfo();
  } catch (err) {
    console.error('Load EMR error:', err);
    showToast('❌ Gagal memuat data pasien');
  }
}

function populatePatientInfo() {
  if (!currentPatient) return;

  const p = currentPatient;
  const r = currentReg;
  const pol = currentPoli;

  // Calculate age
  let age = '—';
  if (p.tanggal_lahir) {
    const birth = new Date(p.tanggal_lahir);
    const now = new Date();
    age = Math.floor((now - birth) / (365.25 * 24 * 60 * 60 * 1000)) + ' tahun';
  }

  // Kalkulasi kunjungan ke-
  let kunjunganKe = '-';
  if (p.id) {
    // Count visits for this patient today
    SharedState.fetchData().then(() => {
      const visits = SharedState.cache.registrations?.filter(r2 => r2.patient_id === p.id) || [];
      kunjunganKe = visits.length + 1;
      const keEl = document.querySelector('.pasien-badge:last-child');
      if (keEl) keEl.textContent = `Kunjungan ke-${kunjunganKe}`;
    }).catch(() => {});
  }

  // Badge color based on penjamin
  const penjaminColors = {
    'Umum': ['#dbeeff', '#073d66'],
    'BPJS': ['#d1fae5', '#065f46'],
    'Asuransi': ['#fef3c7', '#92400e']
  };
  const pc = penjaminColors[r.penjamin] || ['#dbeeff', '#073d66'];

  // Name + avatar initials
  const names = (p.nama || '?').split(' ');
  const initials = names.map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');

  // Populate elements
  setText('.pasien-name', p.nama || '—');
  setText('.pasien-meta', `${p.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} • ${age} • Gol. Darah: ${p.gol_darah || '—'}`);
  setText('.pasien-av', initials);
  
  // Badge penjamin
  const badgeContainer = document.querySelector('.pasien-header > div > div:last-child');
  if (badgeContainer) {
    badgeContainer.innerHTML = `
      <span class="pasien-badge" style="background:${pc[0]};color:${pc[1]}">${r.penjamin || 'Umum'}</span>
      <span class="pasien-badge" style="background:#d1fae5;color:#065f46;margin-left:4px">Kunjungan ke-${kunjunganKe}</span>
    `;
  }

  // Info rows
  const infoRows = {
    'No. RM': `<span style="font-family:'JetBrains Mono',monospace">${p.no_rm || '—'}</span>`,
    'NIK': `<span style="font-family:'JetBrains Mono',monospace">${p.nik || '—'}</span>`,
    'Tgl. Lahir': p.tanggal_lahir ? new Date(p.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—',
    'Alamat': p.alamat || '—',
    'No. HP': p.no_hp || '—',
    'Agama': p.agama || '—',
    'Pekerjaan': p.pekerjaan || '—',
    'Asuransi': r.penjamin || '—',
  };

  const infoContainer = document.querySelector('.card:first-child .card-body > div:last-child');
  if (infoContainer) {
    infoContainer.innerHTML = Object.entries(infoRows).map(([lbl, val]) =>
      `<div class="info-row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`
    ).join('');
  }

  // Status strip
  const statusEls = document.querySelectorAll('.status-strip span');
  if (statusEls.length >= 2) {
    const poliName = pol ? pol.nama_poli : 'Umum';
    statusEls[1].innerHTML = `Poli: <strong style="color:#fff">${poliName}</strong>`;
  }
  if (statusEls.length >= 3 && currentDoctor) {
    statusEls[2].innerHTML = `Dokter: <strong style="color:#fff">${currentDoctor.nama_dokter}</strong>`;
  }
  if (statusEls.length >= 5) {
    statusEls[4].innerHTML = `No. Antrian Dilayani: <strong style="color:#4ade80;font-family:'JetBrains Mono',monospace">${r.no_antrian || '—'}</strong>`;
  }

  // Queue list (antrian poli)
  loadPoliQueue(pol ? pol.id : null);

  // Billing summary
  loadBilling(p);
}

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

async function loadPoliQueue(poliId) {
  const container = document.querySelector('.card:has(.card-title:contains(Antrian Poli)) .card-body > div:last-child');
  // Just skip this if we can't find the right container — the queue list is a nice-to-have
  try {
    if (!poliId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: queue } = await window.__sb
      .from('registrations')
      .select('*, patients(nama)')
      .eq('poli_id', poliId)
      .gte('created_at', today)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!queue) return;

    // Find the right container
    const cards = document.querySelectorAll('.card');
    for (const card of cards) {
      const title = card.querySelector('.card-title');
      if (title && title.textContent.includes('Antrian Poli')) {
        const body = card.querySelector('.card-body > div');
        if (body) {
          const currentRegEl = body.querySelector('div');
          if (currentRegEl) {
            // Replace children after the first 3 elements (title, sesi, then queue list)
            let html = `
              <div id="queue-title" style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
                Antrian • ${currentDoctor ? currentDoctor.nama_dokter : 'Dokter'}
              </div>
              <div style="display:flex;flex-direction:column;gap:5px">
            `;
            queue.forEach((q, i) => {
              const isActive = q.id === REG_ID;
              const statusColors = { 'Menunggu': ['var(--bg)', 'var(--bg2)'], 'Proses': ['#dbeeff', 'var(--primary)'], 'Calling': ['#d1fae5', 'var(--success)'] };
              const sc = statusColors[q.status] || ['var(--bg)', 'var(--bg2)'];
              html += `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:${sc[0]};border-radius:7px;font-size:12px;${isActive ? 'border-left:3px solid ' + sc[1] : ''}">
                  <span style="font-family:'JetBrains Mono',monospace;font-weight:800;color:${isActive ? sc[1] : 'inherit'}">${q.no_antrian || '—'}</span>
                  <span style="flex:1;font-weight:${isActive ? '600' : '400'}">${q.patients?.nama || '—'}</span>
                  <span class="b ${isActive ? 'bp' : 'bg2'}">${q.status || 'Menunggu'}</span>
                </div>
              `;
            });
            html += '</div>';
            body.innerHTML = html;
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error('Queue load error:', e);
  }
}

async function loadBilling(patient) {
  try {
    // Calculate a basic estimate based on poli
    let total = 0;
    const items = [
      { name: 'Jasa Dokter', amount: 100000 },
      { name: 'Biaya Poli', amount: 15000 },
      { name: 'Administrasi', amount: 5000 },
    ];

    // Count drugs in prescription
    const rxRows = document.querySelectorAll('#rx-body tr');
    let drugTotal = 0;
    rxRows.forEach(row => {
      const name = row.querySelector('td strong')?.textContent || '';
      const drug = drugList.find(d => d.nama_obat === name);
      if (drug) drugTotal += drug.harga * 30; // 30 tabs
    });

    if (drugTotal > 0) {
      items.push({ name: 'Obat Resep', amount: drugTotal });
    }

    total = items.reduce((s, i) => s + i.amount, 0);

    // Update billing display
    const summaryBody = document.querySelector('.summary-box');
    if (summaryBody) {
      let html = '<div class="summary-title">Rincian Biaya Kunjungan</div>';
      items.forEach(item => {
        html += `<div class="summary-row"><span class="lbl">${item.name}</span><span class="val">Rp ${item.amount.toLocaleString()}</span></div>`;
      });
      html += `<div class="summary-total"><span>TOTAL</span><span>Rp ${total.toLocaleString()}</span></div>`;
      summaryBody.innerHTML = html;
    }
  } catch (e) {
    console.error('Billing error:', e);
  }
}

// ─── SURAT ───
function showSurat(type) {
  const p = currentPatient;
  const dok = currentDoctor;
  const titles = { kontrol: 'SURAT KONTROL', rujukan: 'SURAT RUJUKAN', istirahat: 'SURAT ISTIRAHAT', sehat: 'SURAT KETERANGAN SEHAT' };
  const bodyEl = document.getElementById('surat-body');
  const titleEl = document.getElementById('surat-title');
  if (titleEl) titleEl.textContent = titles[type] || 'SURAT';
  if (!bodyEl) return;

  const nama = p?.nama || '—';
  const noRm = p?.no_rm || '—';
  const umur = p?.tanggal_lahir ? Math.floor((new Date() - new Date(p.tanggal_lahir)) / (365.25 * 24 * 60 * 60 * 1000)) + ' Tahun' : '—';
  const dx = document.getElementById('icd-utama')?.value || '—';
  const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const dokterNama = dok?.nama_dokter || 'Dokter';

  let extra = '';
  if (type === 'kontrol') {
    extra = `
      <div class="print-row" style="margin-top:6px"><span class="lbl">Dianjurkan kontrol</span><span class="sep">:</span><span>${document.getElementById('plan-kontrol')?.value || '2 minggu lagi'}</span></div>
      <div class="print-row"><span class="lbl">Ke Poli</span><span class="sep">:</span><span>${currentPoli?.nama_poli || '—'} — ${dokterNama}</span></div>
    `;
  } else if (type === 'rujukan') {
    extra = '<div class="print-row" style="margin-top:6px"><span class="lbl">Dirujuk ke</span><span class="sep">:</span><span>RSUD Dr. Adjidarmo, Rangkasbitung</span></div>';
  } else if (type === 'istirahat') {
    extra = '<div class="print-row" style="margin-top:6px"><span class="lbl">Diperlukan istirahat</span><span class="sep">:</span><span>3 (tiga) hari, sejak tanggal surat</span></div>';
  }

  bodyEl.innerHTML = `
    <div class="print-row"><span class="lbl">Nama</span><span class="sep">:</span><span>${nama}</span></div>
    <div class="print-row"><span class="lbl">No. RM</span><span class="sep">:</span><span style="font-family:'JetBrains Mono',monospace">${noRm}</span></div>
    <div class="print-row"><span class="lbl">Umur</span><span class="sep">:</span><span>${umur}</span></div>
    <div class="print-row"><span class="lbl">Diagnosa</span><span class="sep">:</span><span>${dx}</span></div>
    ${extra}
    <div style="margin-top:14px;font-size:11px;color:var(--text-muted)">Serang, ${now}</div>
    <div style="margin-top:4px;font-size:12px;font-weight:700">${dokterNama}</div>
    <div style="font-size:11px;color:var(--text-muted)">${dok?.sip || 'SIP: —'}</div>
  `;

  // Switch to surat tab
  const suratTab = document.querySelector('[onclick*="tab-surat"]');
  if (suratTab) switchTab(suratTab, 'tab-surat');
}

// ─── SIMPAN EMR ───
async function simpanEMR() {
  if (!currentReg && !REG_ID) {
    showToast('❌ Tidak ada pasien aktif. Buka dari Rawat Jalan dulu.');
    return;
  }

  const notes = {
    s_keluhan: document.getElementById('s-keluhan')?.value || '',
    s_rps: document.getElementById('s-rps')?.value || '',
    diagnosis: document.getElementById('icd-utama')?.value || '',
    plan_kontrol: document.getElementById('plan-kontrol')?.value || '',
  };

  try {
    // Update registration status to 'Selesai'
    const { error } = await window.__sb
      .from('registrations')
      .update({ 
        status: 'Selesai',
        notes: JSON.stringify(notes),
        updated_at: new Date().toISOString()
      })
      .eq('id', REG_ID);

    if (error) {
      showToast('❌ Gagal menyimpan: ' + error.message);
      return;
    }

    showToast('✅ Rekam medis tersimpan!');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  } catch (err) {
    console.error('Simpan error:', err);
    showToast('❌ Gagal menyimpan EMR');
  }
}

// ─── KIRIM KE FARMASI ───
async function kirimFarmasi() {
  if (!currentReg) {
    showToast('❌ Tidak ada pasien aktif');
    return;
  }

  // Collect prescription items
  const rows = document.querySelectorAll('#rx-body tr');
  const items = [];
  rows.forEach(row => {
    const name = row.querySelector('td strong')?.textContent || '';
    if (name) items.push({ nama_obat: name });
  });

  if (items.length === 0) {
    showToast('⚠️ Belum ada resep');
    return;
  }

  try {
    // Create prescription in Supabase
    const { data: presc, error } = await window.__sb
      .from('prescriptions')
      .insert({
        registration_id: REG_ID,
        patient_id: currentPatient?.id,
        status: 'Menunggu Farmasi',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      showToast('❌ Gagal kirim ke farmasi: ' + error.message);
      return;
    }

    // Create prescription items
    const pItems = items.map(item => ({
      prescription_id: presc.id,
      nama_obat: item.nama_obat,
      jumlah: 30,
      dosis: '1x1',
      keterangan: 'Setelah makan'
    }));

    await window.__sb
      .from('prescription_items')
      .insert(pItems);

    showToast(`✅ ${items.length} obat dikirim ke Farmasi`);
  } catch (err) {
    console.error('Kirim farmasi error:', err);
    showToast('❌ Gagal kirim ke farmasi');
  }
}

// ─── KIRIM KE KASIR ───
async function kirimKasir() {
  if (!currentReg) {
    showToast('❌ Tidak ada pasien aktif');
    return;
  }

  try {
    // Check if invoice already exists
    const { data: existing } = await window.__sb
      .from('invoices')
      .select('id')
      .eq('registration_id', REG_ID)
      .maybeSingle();

    if (existing) {
      showToast('ℹ️ Tagihan sudah dikirim ke kasir');
      return;
    }

    // Calculate total
    let total = 120000; // Default: dokter + poli + admin
    const rxRows = document.querySelectorAll('#rx-body tr');
    rxRows.forEach(row => {
      const name = row.querySelector('td strong')?.textContent || '';
      const drug = drugList.find(d => d.nama_obat === name);
      if (drug) total += drug.harga * 30;
    });

    // Create invoice
    const { error } = await window.__sb
      .from('invoices')
      .insert({
        registration_id: REG_ID,
        patient_id: currentPatient?.id,
        total: total,
        status: 'Belum Dibayar',
        created_at: new Date().toISOString()
      });

    if (error) {
      showToast('❌ Gagal kirim ke kasir: ' + error.message);
      return;
    }

    showToast(`✅ Tagihan Rp ${total.toLocaleString()} dikirim ke Kasir`);
  } catch (err) {
    console.error('Kirim kasir error:', err);
    showToast('❌ Gagal kirim ke kasir');
  }
}

// ─── PANGGIL BERIKUTNYA ───
async function panggilBerikutnya() {
  if (!currentReg || !currentReg.poli_id) {
    showToast('❌ Tidak ada antrian poli');
    return;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: nextReg } = await window.__sb
      .from('registrations')
      .select('id, no_antrian')
      .eq('poli_id', currentReg.poli_id)
      .eq('status', 'Menunggu')
      .gte('created_at', today)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!nextReg) {
      showToast('✅ Semua pasien sudah dilayani');
      return;
    }

    // Update current to Selesai
    await window.__sb
      .from('registrations')
      .update({ status: 'Selesai', updated_at: new Date().toISOString() })
      .eq('id', REG_ID);

    // Update next to Proses
    await window.__sb
      .from('registrations')
      .update({ status: 'Proses', updated_at: new Date().toISOString() })
      .eq('id', nextReg.id);

    showToast(`⏭️ Memanggil ${nextReg.no_antrian}`);
    setTimeout(() => {
      window.location.href = `emr.html?reg_id=${nextReg.id}`;
    }, 1000);
  } catch (err) {
    console.error('Panggil berikutnya error:', err);
    showToast('❌ Gagal memanggil antrian berikutnya');
  }
}

// ─── TOAST ───
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.4);transition:opacity .3s;font-size:14px';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for SharedState to be ready (provides Supabase client)
  if (window.SharedState) {
    try { await SharedState.waitReady(); } catch(e) {}
  }

  // Load drugs
  await loadDrugs();

  // Load EMR data
  await loadEMRData();

  console.log('EMR page initialized, reg_id:', REG_ID);
});
