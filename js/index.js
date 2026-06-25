/**
 * index.js
 * Main Dashboard Logic for MediCore SIMRS
 */

const titles = {
    dashboard: 'Dashboard',
    antrian: 'Antrian & Display',
    pendaftaran: 'Pendaftaran Pasien',
    rawatjalan: 'Rawat Jalan',
    rawatinap: 'Rawat Inap',
    ugd: 'Unit Gawat Darurat',
    rekammedis: 'Rekam Medis',
    laboratorium: 'Laboratorium',
    radiologi: 'Radiologi',
    farmasi: 'Farmasi',
    operasi: 'Kamar Operasi',
    kasir: 'Kasir & Pembayaran',
    tagihan: 'Tagihan',
    laporan: 'Laporan Keuangan',
    sdm: 'SDM & Dokter',
    pengaturan: 'Pengaturan'
};

const ROLE_MENUS = {
  'Administrator': ['dashboard','antrian','pendaftaran','rawatjalan','rawatinap','ugd','rekammedis','laboratorium','radiologi','farmasi','operasi','kasir','tagihan','laporan','sdm','pengaturan'],
  'Kasir': ['dashboard','kasir','tagihan','laporan'],
  'Apoteker': ['dashboard','farmasi'],
  'Petugas': ['dashboard','antrian','pendaftaran','rawatjalan','rawatinap','ugd','rekammedis'],
  'Dokter': ['dashboard','rekammedis','operasi'],
};

function go(name, el) {
  // Role guard
  const user = window.medicoreUser;
  if (user) {
    const allowed = ROLE_MENUS[user.role] || [];
    if (!allowed.includes(name)) {
      alert('⛔ Anda tidak memiliki akses ke menu ini');
      return;
    }
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    
    const pg = document.getElementById('pg-' + name);
    if (pg) pg.classList.add('active');
    
    document.getElementById('pgt').textContent = titles[name] || name;
    
    // Load page-specific data
    if (name === 'pendaftaran') loadPendaftaran();
    if (name === 'dashboard') renderDashboard();
    if (name === 'rawatjalan') loadRawatJalan();
    if (name === 'rawatinap') loadRawatInap();
    if (name === 'ugd') loadUGD();
    if (name === 'antrian') loadAntrian();
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

// RENDER DASHBOARD DATA
async function renderDashboard() {
    const dashboardData = await SharedState.getDashboardData();
    if (!dashboardData) return;

    // 1. Update Statistik
    if(document.getElementById('stat-rj')) document.getElementById('stat-rj').textContent = dashboardData.stats.rawatJalan;
    if(document.getElementById('stat-ri')) document.getElementById('stat-ri').textContent = dashboardData.stats.rawatInap;
    if(document.getElementById('stat-ugd')) document.getElementById('stat-ugd').textContent = dashboardData.stats.ugd;
    if(document.getElementById('stat-income')) document.getElementById('stat-income').textContent = 'Rp ' + dashboardData.stats.income.toLocaleString();

    // 2. Render Tempat Tidur
    const bedContainer = document.getElementById('bed-container');
    if (bedContainer) {
        bedContainer.innerHTML = '';
        dashboardData.beds.forEach(bed => {
            const statusClass = bed.status === 'tersedia' ? 'bo' : (bed.status === 'terpakai' ? 'ba' : 'br');
            bedContainer.innerHTML += `
                <div class="bi2 ${statusClass}">
                    <div class="icon">🛏</div>
                    <div class="num">${bed.nomor}</div>
                    <div class="cls">${bed.kelas}</div>
                </div>`;
        });
        
        // Update Ringkasan Bed
        if(document.getElementById('bed-tersedia')) document.getElementById('bed-tersedia').textContent = dashboardData.stats.beds.tersedia;
        if(document.getElementById('bed-terpakai')) document.getElementById('bed-terpakai').textContent = dashboardData.stats.beds.terpakai;
        if(document.getElementById('bed-reservasi')) document.getElementById('bed-reservasi').textContent = dashboardData.stats.beds.reservasi;
    }

    // 3. Render Tabel Kunjungan Terbaru
    const patientTable = document.getElementById('latest-patients-table')?.querySelector('tbody');
    if (patientTable) {
        patientTable.innerHTML = '';
        dashboardData.latestPatients.forEach(p => {
            patientTable.innerHTML += `
                <tr>
                    <td class="mono">${p.no_rm}</td>
                    <td>${p.nama}</td>
                    <td>${p.poli}</td>
                    <td>${p.penjamin}</td>
                    <td><span class="b ${p.status === 'Selesai' ? 'bs' : 'bw'}">${p.status}</span></td>
                </tr>`;
        });
    }

    // 4. Render Antrian
    if (dashboardData.queues) {
        Object.keys(dashboardData.queues).forEach(id => {
            const el = document.getElementById('q-' + id);
            if (el) el.textContent = dashboardData.queues[id].current;
        });
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
            <td><button class="btn btn-o btn-xs">Detail</button></td>
        </tr>`;
    });
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
    if (!nama) return alert('Masukkan nama pasien');
    const { data } = await window.__sb
        .from('patients')
        .select('id, no_rm, nama')
        .ilike('nama', `%${nama}%`)
        .limit(5);
    const resultDiv = document.getElementById('search-result');
    if (!data || data.length === 0) {
        resultDiv.style.display = 'none';
        return alert('Pasien tidak ditemukan. Daftarkan pasien baru melalui halaman daftar-mandiri.');
    }
    // Show first result
    resultDiv.style.display = 'block';
    document.getElementById('res-name').textContent = data[0].nama;
    document.getElementById('res-rm').textContent = data[0].no_rm;
    window._regPatientId = data[0].id;
    window._regPatientRM = data[0].no_rm;
}

// Submit registrasi ke Supabase
async function submitRegistration() {
    const patientId = window._regPatientId;
    const poliId = document.getElementById('reg-poli')?.value;
    const dokterId = document.getElementById('reg-dokter')?.value;
    const penjamin = window.selectedPenjamin || 'Umum';
    
    if (!patientId) return alert('Cari pasien terlebih dahulu!');
    if (!poliId) return alert('Pilih poli tujuan!');
    
    // Generate nomor antrian
    const hariIni = new Date().toISOString().slice(0,10);
    const { count } = await window.__sb
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hariIni);
    
    const noUrut = (count || 0) + 1;
    const prefix = poliId === '8' ? 'T' : 'A'; // T-xxx for poli, A-xxx for umum
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
    
    if (error) return alert('❌ Gagal: ' + error.message);
    
    alert(`✅ Berhasil! No. Antrian: ${noAntrian}`);
    hideM('mdl-daftar');
    loadPendaftaran();
}

// ===== RAWAT JALAN — Queue from Supabase =====
const _RJ = { regs: [], patients: {}, polis: {}, doctors: {} };

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
}

// Panggil pasien — update status ke Proses + set active patient
async function panggilPasien(regId) {
    if (!regId) return alert('Tidak ada pasien yang bisa dipanggil');

    // Update status to Proses
    const { error } = await window.__sb
        .from('registrations')
        .update({ status: 'Proses' })
        .eq('id', regId);

    if (error) return alert('❌ Gagal: ' + error.message);

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
        .select('*, patients!inner(no_rm, nama, tgl_lahir, jk), poli(nama_poli)')
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
    window._activeRegId = regId;
    window._activePatient = p;
}

// ===== RAWAT INAP — from Supabase =====
async function loadRawatInap() {
    await SharedState.waitReady();

    // Stats: count opname & beds
    const { data: opnames } = await window.__sb
        .from('registrations')
        .select('id, status, no_antrian, patient_id, poli_id, created_at')
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
            bedHtml += `<div class="bi2 ${statusClass[b.status] || 'bo'}"><div class="icon">🛏</div><div class="num">${b.nomor}</div><div class="cls">${b.status.slice(0,3)}</div></div>`;
        });
        bedHtml += `</div>`;
    }
    document.getElementById('ri-bedmap').innerHTML = bedHtml || '<div style="color:var(--text-muted)">Tidak ada data kamar</div>';

    // Opname table — fetch patient names
    if (opnames && opnames.length) {
        const pIds = [...new Set(opnames.map(r => r.patient_id))];
        const { data: patients } = await window.__sb
            .from('patients')
            .select('id, nama, no_rm')
            .in('id', pIds);
        const pMap = {};
        (patients||[]).forEach(p => pMap[p.id] = p);

        const rows = opnames.map((r, i) => {
            const pat = pMap[r.patient_id];
            const hari = r.created_at ? Math.floor((new Date() - new Date(r.created_at)) / 86400000) : 0;
            return `<tr><td><strong>${r.no_antrian || '—'}</strong></td><td>${pat?.nama || '—'}</td><td>—</td><td>${SharedState.getDokterByPoli(r.poli_id) || '—'}</td><td>${hari}</td></tr>`;
        }).join('');
        document.querySelector('#ri-opname-table tbody').innerHTML = rows;
    }
}

// ===== UGD — from Supabase =====
async function loadUGD() {
    await SharedState.waitReady();

    const { data: ugdRegs } = await window.__sb
        .from('registrations')
        .select('id, no_antrian, status, patient_id')
        .filter('no_antrian', 'ilike', 'UGD%');

    const count = ugdRegs?.length || 0;

    document.getElementById('ugd-stats').innerHTML = `
        <div class="sc"><div class="sb" style="background:var(--danger)"></div><div class="sv" style="color:var(--danger)">${count}</div><div class="sl">🆘 Pasien UGD</div></div>`;

    if (ugdRegs && ugdRegs.length) {
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
        document.querySelector('#ugd-table tbody').innerHTML = rows;
    }
}

// LOAD ANTRIAN
async function loadAntrian() {
    const container = document.getElementById('antrian-queue-container');
    if (!container) return;

    // Query registrations — exclude Opname & URGENT
    const { data: regs } = await window.__sb
        .from('registrations')
        .select('no_antrian, status, patient_id, penjamin')
        .not('status', 'in', '("Opname","URGENT")')
        .order('created_at', { ascending: true });

    if (!regs) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">❌ Gagal memuat data antrian.</div>';
        return;
    }

    // Definisikan prefix → loket mapping
    const lokets = [
        { prefix: 'A', title: '🏥 Loket 1 — Umum',   subtitle: 'Pasien Umum' },
        { prefix: 'B', title: '🏥 Loket 2 — BPJS',   subtitle: 'Pasien BPJS' },
        { prefix: 'C', title: '🏥 Loket 3 — JKN',    subtitle: 'Pasien Asuransi' },
        { prefix: 'F', title: '💊 Farmasi',           subtitle: 'Farmasi' },
        { prefix: 'L', title: '🧪 Laboratorium',      subtitle: 'Lab' },
        { prefix: 'K', title: '💰 Kasir',             subtitle: 'Kasir & Pembayaran' },
    ];

    // Kelompokkan data per prefix
    const groups = {};
    regs.forEach(r => {
        const prefix = r.no_antrian ? r.no_antrian.charAt(0).toUpperCase() : '';
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

        // Nomor yang sedang dilayani
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
    if (!w) return alert('Izinkan popup untuk mencetak');
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
    if (!r) return showDetail('🔍 Detail Lab', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = r.patients;
    const cls = r.status === 'Selesai' ? 'bs' : r.status === 'Diproses' ? 'bp' : r.status === 'Diterima' ? 'bi' : 'bw';
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
        ${r.hasil ? `<div style="margin-top:6px;background:var(--bg);padding:8px;border-radius:6px"><strong>Hasil:</strong> ${r.hasil}</div>` : ''}`);
}

async function showRadDetail(id) {
    showDetail('🔍 Detail Radiologi', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: r } = await window.__sb.from('radiology_requests').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!r) return showDetail('🔍 Detail Radiologi', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = r.patients;
    const cls = r.status === 'Selesai' || r.status === 'Hasil Siap' ? 'bs' : r.status === 'Diproses' ? 'bp' : 'bw';
    showDetail('🔬 Detail Radiologi — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Rad</span><div style="font-weight:700;font-family:monospace">${r.no_rad||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Asal</span><div style="font-weight:700">${r.asal||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${cls}">${r.status||'—'}</span></div></div>
        </div>
        <div><strong>Jenis Pemeriksaan:</strong> ${r.jenis_pemeriksaan||'—'}</div>
        ${r.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${r.catatan}</div>` : ''}
        ${r.hasil ? `<div style="margin-top:6px;background:var(--bg);padding:8px;border-radius:6px"><strong>Hasil:</strong> ${r.hasil}</div>` : ''}`);
}

async function showFarmasiDetail(id) {
    showDetail('🔍 Detail Resep', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: r } = await window.__sb.from('prescriptions').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!r) return showDetail('🔍 Detail Resep', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = r.patients;
    const sCls = r.status === 'Siap Ambil' || r.status === 'Selesai' ? 'bs' : r.status === 'Diproses' ? 'bp' : 'bw';
    showDetail('💊 Detail Resep — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. Resep</span><div style="font-weight:700;font-family:monospace">${r.no_resep||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${sCls}">${r.status||'—'}</span></div></div>
            <div><span style="color:var(--text-muted)">Total</span><div style="font-weight:700;color:var(--primary)">Rp ${(r.total||0).toLocaleString()}</div></div>
        </div>
        ${r.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${r.catatan}</div>` : ''}`);
}

async function showOKDetail(id) {
    showDetail('🔍 Detail Operasi', '<div style="padding:20px;text-align:center">⏳ Memuat...</div>');
    const { data: s } = await window.__sb.from('surgery_schedule').select('*, patients!inner(no_rm, nama)').eq('id', id).single();
    if (!s) return showDetail('🔍 Detail Operasi', '<div style="padding:20px;text-align:center;color:var(--danger)">Data tidak ditemukan</div>');
    const p = s.patients;
    const sCls = s.status === 'Selesai' ? 'bs' : s.status === 'Berjalan' ? 'bp' : s.status === 'Dijadwalkan' ? 'bw' : 'bd';
    showDetail('🩺 Detail Operasi — ' + p.nama, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;background:var(--bg);padding:11px;border-radius:8px;margin-bottom:11px">
            <div><span style="color:var(--text-muted)">No. OK</span><div style="font-weight:700;font-family:monospace">${s.no_ok||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Pasien</span><div style="font-weight:700">${p.nama}</div></div>
            <div><span style="color:var(--text-muted)">No. RM</span><div style="font-weight:700">${p.no_rm||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Tindakan</span><div style="font-weight:700">${s.tindakan||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Dokter</span><div style="font-weight:700">${s.dokter||'—'}</div></div>
            <div><span style="color:var(--text-muted)">Status</span><div><span class="b ${sCls}">${s.status||'—'}</span></div></div>
        </div>
        ${s.catatan ? `<div style="margin-top:6px"><strong>Catatan:</strong> ${s.catatan}</div>` : ''}`);
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
        if (!_labPatientId) { alert('Pilih pasien terlebih dahulu!'); return; }
        const asal = document.getElementById('lab-asal').value;
        const checked = [...document.querySelectorAll('#lab-checkbox-group input:checked')].map(c => c.value);
        if (!checked.length) { alert('Pilih minimal satu jenis pemeriksaan!'); return; }
        const catatan = document.getElementById('lab-catatan').value.trim();
        btn.disabled = true; btn.textContent = '⏳ Mendaftarkan...';
        const noLab = 'LAB-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + String(Date.now() % 10000).padStart(4,'0');
        const { error } = await window.__sb.from('lab_requests').insert({
            no_lab: noLab, patient_id: _labPatientId, jenis_pemeriksaan: checked.join(', '),
            asal, catatan, status: 'Menunggu', sampel_status: 'Belum'
        });
        if (error) { alert('Gagal: ' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pemeriksaan'; return; }
        alert('✅ ' + noLab + ' — Registrasi berhasil!');
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
    if (!_radPatientId) { alert('Pilih pasien terlebih dahulu!'); return; }
    const asal = document.getElementById('rad-asal').value;
    const jenis = document.getElementById('rad-jenis').value;
    const catatan = document.getElementById('rad-catatan').value.trim();
    btn.disabled = true; btn.textContent = '⏳ Mendaftarkan...';
    const noRad = 'RAD-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + String(Date.now() % 10000).padStart(4,'0');
    const { error } = await window.__sb.from('radiology_requests').insert({
        no_rad: noRad, patient_id: _radPatientId, jenis_pemeriksaan: jenis + (catatan ? ' — ' + catatan : ''),
        asal, catatan, status: 'Menunggu'
    });
    if (error) { alert('Gagal: ' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pemeriksaan'; return; }
    alert('✅ ' + noRad + ' — Registrasi berhasil!');
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
        <div class="srch"><input class="fc" style="max-width:260px" placeholder="🔍 Cari nama obat..."><select class="fc" style="max-width:140px"><option>Semua Kategori</option><option>Tablet</option><option>Kapsul</option><option>Injeksi</option><option>Infus</option></select><button class="btn btn-p btn-sm">Filter</button><button class="btn btn-o btn-sm" style="margin-left:auto">+ Penerimaan Stok</button></div>
        <div class="card"><div class="ch"><div class="ct">Daftar Stok Obat</div></div>
        <table class="t"><thead><tr><th>Kode</th><th>Nama Obat</th><th>Kat.</th><th>Stok</th><th>Min.Stok</th><th>Harga</th><th>ED</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
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

    // === Render SEP & Nota from first payment ===
    const sepDiv = document.getElementById('kasir-sep');
    const notaDiv = document.getElementById('kasir-nota');
    if (payments.length > 0) {
        const first = payments[0];
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
                        <div class="rr"><span>Bayar (${first.metode || 'Tunai'})</span><span>Rp ${bayar.toLocaleString()}</span></div>
                        <div class="rr"><span style="color:var(--success);font-weight:700">Kembali</span><span style="color:var(--success);font-weight:700">Rp ${kembalian.toLocaleString()}</span></div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:11px">
                        <button class="btn btn-p" style="flex:1" onclick="prosesBayar()">✅ Proses Bayar</button>
                        <button class="btn btn-o btn-sm" onclick="cetakKwitansi()">🖨️ Kwitansi</button>
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
    
    if (!patientId || !bedId) { alert('Pilih pasien dan bed!'); return; }
    
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
        
        // Create registration
        const { error: regErr } = await window.__sb.from('registrations').insert({
            patient_id: patientId,
            status: 'Opname',
            no_antrian: newNo,
            penjamin: 'BPJS',
            doctor_id: dpjpId || null
        });
        
        if (regErr) { alert('Gagal: ' + regErr.message); btn.disabled = false; btn.textContent = '✅ Konfirmasi Admit'; return; }
        
        // Update bed status
        await window.__sb.from('beds').update({ status: 'Terpakai' }).eq('id', bedId);
        
        hideM('mdl-admit');
        alert(`✅ ${patientName} berhasil di-admit\nNo. Antrian: ${newNo}`);
        loadRawatInap();
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '✅ Konfirmasi Admit';
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
    if (!patientId) { alert('Cari dan pilih pasien dulu!'); return; }
    
    const triase = document.getElementById('ugd-triase').value;
    const dokterId = document.getElementById('ugd-dokter').value;
    const gcs = document.getElementById('ugd-gcs').value.trim() || '-';
    const td = document.getElementById('ugd-td').value.trim() || '-';
    const nadi = document.getElementById('ugd-nadi').value.trim() || '-';
    const keluhan = document.getElementById('ugd-keluhan').value.trim();
    
    if (!keluhan) { alert('Isi keluhan utama pasien!'); return; }
    
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
        
        if (error) { alert('Gagal: ' + error.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pasien UGD'; return; }
        
        hideM('mdl-ugd');
        alert(`✅ Pasien UGD terdaftar\nNo. Antrian: ${newNo}`);
        loadUGD();
    } catch (e) { alert('Error: ' + e.message); btn.disabled = false; btn.textContent = '✅ Daftarkan Pasien UGD'; }
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

    if (!patId || !noReg || total <= 0) { alert('Isi pasien, No.Reg, dan Total Tagihan!'); return; }

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
        alert('✅ Transaksi berhasil!');
        hideM('mdl-transaksi');
        loadKasir();
        document.getElementById('trx-no-reg').value = '';
        document.getElementById('trx-total').value = '';
        document.getElementById('trx-bayar').value = '';
    } catch (e) { alert('❌ ' + e.message); }
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

    if (!patId || !noOp || !tindakan) { alert('Isi pasien, No.Operasi, dan Tindakan!'); return; }

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
        alert('✅ Jadwal operasi berhasil disimpan!');
        hideM('mdl-operasi');
        loadOK();
        document.getElementById('ok-no').value = '';
        document.getElementById('ok-tindakan').value = '';
        document.getElementById('ok-diagnosa').value = '';
        document.getElementById('ok-operator').value = '';
        document.getElementById('ok-anastesi').value = '';
        document.getElementById('ok-mulai').value = '';
    } catch (e) { alert('❌ ' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '✅ Simpan Jadwal'; }
}

// ===== RETUR OBAT (client-side only) =====
function submitRetur() {
    const pasien = document.getElementById('retur-pasien').value;
    const obat = document.getElementById('retur-obat').value.trim();
    const jumlah = document.getElementById('retur-jumlah').value.trim();
    const kondisi = document.getElementById('retur-kondisi').value;
    const alasan = document.getElementById('retur-alasan').value.trim();
    if (!obat || !jumlah) { alert('Isi nama obat dan jumlah!'); return; }
    alert('✅ Retur diajukan: ' + obat + ' (' + jumlah + ') — ' + pasien + '\nAlasan: ' + (alasan || kondisi));
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
function prosesBayar() { alert('✅ Pembayaran diproses'); loadKasir(); }
function cetakKwitansi() { window.print(); }

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
    if (!patId || !noTag || total <= 0) { alert('Isi pasien, No. Tagihan, dan Total Tagihan!'); return; }
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
        alert('✅ Tagihan berhasil dibuat!');
        hideM('mdl-tagihan');
        loadTagihan();
        document.getElementById('tag-no').value = '';
        document.getElementById('tag-total').value = '';
        document.getElementById('tag-keterangan').value = '';
        document.getElementById('tag-jatuh-tempo').value = '';
    } catch (e) { alert('❌ ' + e.message); }
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
    if (!nama) { alert('Nama dokter wajib diisi!'); return; }
    const poliId = document.getElementById('dr-poli').value;
    if (!poliId) { alert('Poli wajib dipilih!'); return; }
    
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
    if (error) { alert('❌ Gagal menyimpan: ' + error.message); return; }
    
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
    
    if (!username || !password || !nama || !role) { alert('Username, password, nama, dan role wajib diisi!'); return; }
    
    // Try insert to Supabase users table
    const { data, error } = await window.__sb.from('users').insert({
        username, password, nama, role, unit: unit || 'Semua', status: 'Aktif'
    }).select().maybeSingle();
    
    if (error) {
        // Fallback: table doesn't exist yet — use array
        if (!window._appUsers) window._appUsers = [];
        if (window._appUsers.find(u => u.username === username)) {
            alert('❌ Username sudah terdaftar!');
            return;
        }
        window._appUsers.push({ username, nama, role, unit: unit || 'Semua', status: 'Aktif' });
        renderUsersTable();
        hideM('mdl-add-karyawan');
        alert('✅ Akun karyawan berhasil ditambahkan (local)');
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
    alert('✅ Konfigurasi berhasil disimpan!');
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
  const saved = localStorage.getItem('medicore_user');
  if (saved) {
    try {
      window.medicoreUser = JSON.parse(saved);
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
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const btn = document.querySelector('.login-btn');
  const err = document.getElementById('login-error');
  
  if (!username || !password) {
    err.textContent = 'Isi username dan password';
    err.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Memproses...';
  err.style.display = 'none';
  
  let data, error;
  try {
    const result = await window.__sb.from('users')
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
  btn.innerHTML = '🔐 Masuk';
  
  if (error || !data) {
    err.textContent = '❌ Username atau password salah';
    err.style.display = 'block';
    return;
  }
  
  window.medicoreUser = data;
  localStorage.setItem('medicore_user', JSON.stringify(data));
  updateUserChip();
  document.getElementById('login-overlay').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');
  
  // Render dashboard after login
  renderDashboard();
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    tick();
    setInterval(tick, 1000);
    renderDashboard();

    // Init users from DB (fallback to array)
    loadUsers();

    // Listen for real-time updates
    SharedState.onUpdate((key) => {
        renderDashboard();
    });
});
