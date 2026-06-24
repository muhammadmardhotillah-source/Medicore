/**
 * index.js
 * Main Dashboard Logic for ICHA SIM Rumah Sakit
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

function go(name, el) {
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
    
    if (el) {
        el.classList.add('active');
    } else {
        document.querySelectorAll('.ni').forEach(n => {
            if (n.getAttribute('onclick')?.includes(`'${name}'`)) n.classList.add('active');
        });
    }
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
        .select('*, patients!inner(no_rm, nama, tgl_lahir, jk), poli!inner(nama_poli)')
        .eq('id', regId)
        .single();

    if (!reg) return;

    const p = reg.patients;
    const umur = p.tgl_lahir ? Math.floor((new Date() - new Date(p.tgl_lahir)) / 31557600000) : '?';
    const inisial = p.nama ? p.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '--';

    document.getElementById('rj-emr-patient').innerHTML = `
        <div class="pc" style="margin-bottom:10px;cursor:default"><div class="p-av">${inisial}</div><div><div class="p-name">${p.nama}</div><div class="p-meta">No.RM: ${p.no_rm || '—'} • ${umur}th • ${p.jk || '—'}</div><div class="p-meta">${reg.penjamin || '—'} • Antrian ${reg.no_antrian}</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px">
            <div><span style="color:var(--text-muted)">Poli:</span> <strong>${reg.poli?.nama_poli || '—'}</strong></div>
            <div><span style="color:var(--text-muted)">Dokter:</span> <strong>${SharedState.getDokterByPoli(reg.poli_id) || '—'}</strong></div>
        </div>`;

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
            return `<tr class="${cls}"><td>${i+1}</td><td><strong>${pat?.nama || '—'}</strong></td><td>${r.no_antrian || '—'}</td><td><span class="b ${r.status === 'URGENT' ? 'bd' : 'bw'}">${r.status}</span></td><td><button class="btn btn-p btn-xs" onclick="showM('mdl-emr')">EMR</button></td></tr>`;
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
            <div class="pc" onclick="viewRMPatient(${p.id})" style="cursor:pointer">
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
            <div class="pc" onclick="viewRMPatient(${p.id})" style="cursor:pointer">
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
            <td><button class="btn btn-o btn-xs" onclick="alert('Lihat lab ${r.id}')">Detail</button></td>
        </tr>`;
    });

    if (!rows) {
        rows = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Tidak ada data laboratorium</td></tr>';
    }

    tableDiv.innerHTML = `<table class="t"><thead><tr><th>No.Lab</th><th>Nama Pasien</th><th>Jenis Pemeriksaan</th><th>Asal</th><th>Sampel</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== RADIOLOGI — from radiology_requests table =====
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
            <td><button class="btn btn-o btn-xs" onclick="alert('Lihat rad ${r.id}')">Detail</button></td>
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
            <td><button class="btn btn-o btn-xs" onclick="alert('Detail resep ${r.id}')">Detail</button></td>
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
            <td><button class="btn btn-o btn-xs" onclick="alert('Detail operasi ${s.id}')">Detail</button></td>
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
                <td><button class="btn btn-o btn-xs">Kwitansi</button></td>
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
        .select('*')
        .eq('status', 'Lunas');

    if (!payments) {
        const finM = document.getElementById('fin-m');
        if (finM) finM.textContent = '❌ Gagal memuat';
        return;
    }

    // Total pendapatan
    const totalPendapatan = payments.reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const finM = document.getElementById('fin-m');
    if (finM) finM.textContent = 'Rp ' + totalPendapatan.toLocaleString();

    // Per penjamin — untuk progress bars
    const bpjs = payments.filter(p => p.penjamin === 'BPJS').reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const umum = payments.filter(p => p.penjamin === 'Umum' || !p.penjamin).reduce((s, p) => s + Number(p.total_tagihan || 0), 0);
    const asuransi = payments.filter(p => p.penjamin === 'Asuransi').reduce((s, p) => s + Number(p.total_tagihan || 0), 0);

    const maxVal = Math.max(bpjs, umum, asuransi, 1);
    const bpjsPct = Math.round((bpjs / maxVal) * 100);
    const umumPct = Math.round((umum / maxVal) * 100);
    const asuransiPct = Math.round((asuransi / maxVal) * 100);

    const fmt = (v) => 'Rp ' + Number(v).toLocaleString();

    // Find progress bar containers — there are 3 existing ones with specific class structure
    const pbContainer = document.querySelector('#pg-laporan .card .pb');
    // Replace the progress bars directly
    const pbItems = document.querySelectorAll('#pg-laporan .card .pb');
    if (pbItems && pbItems.length >= 3) {
        // BPJS
        pbItems[0].previousElementSibling.innerHTML = `<span style="font-weight:600">BPJS Kesehatan</span><span style="color:var(--text-muted)">${fmt(bpjs)}</span>`;
        pbItems[0].querySelector('.pf').style.width = bpjsPct + '%';
        // Umum
        pbItems[1].previousElementSibling.innerHTML = `<span style="font-weight:600">Umum</span><span style="color:var(--text-muted)">${fmt(umum)}</span>`;
        pbItems[1].querySelector('.pf').style.width = umumPct + '%';
        // Asuransi
        pbItems[2].previousElementSibling.innerHTML = `<span style="font-weight:600">Asuransi Swasta</span><span style="color:var(--text-muted)">${fmt(asuransi)}</span>`;
        pbItems[2].querySelector('.pf').style.width = asuransiPct + '%';
    }

    // Also update the fin-g items (rawat jalan, rawat inap, farmasi) — keep static as instructed
}
function tick() {
    const n = new Date();
    document.getElementById('clk').textContent = n.toLocaleTimeString('id-ID');
    document.getElementById('pgd').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
    tick();
    setInterval(tick, 1000);
    renderDashboard();

    // Listen for real-time updates
    SharedState.onUpdate((key) => {
        renderDashboard();
    });
});
