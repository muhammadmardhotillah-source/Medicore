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

// SAVE ADMIN REGISTRATION
function saveAdminRegistration() {
    const name = document.getElementById('adm-reg-name').value.trim();
    const poli = document.getElementById('adm-reg-poli').value;
    const penjamin = document.getElementById('adm-reg-penjamin').value;
    const id = document.getElementById('adm-reg-id').value.trim() || ('009' + Math.floor(Math.random() * 900000 + 100000));

    if (!name) {
        alert('Harap masukkan nama pasien');
        return;
    }

    const newPatient = {
        id: id,
        name: name,
        age: '—',
        poli: poli,
        penjamin: penjamin,
        status: 'Menunggu',
        date: new Date().toISOString().split('T')[0],
        tipe_daftar: 'Loket'
    };

    SharedState.addPatient(newPatient);
    
    // Reset and close
    document.getElementById('adm-reg-name').value = '';
    document.getElementById('adm-reg-id').value = '';
    hideM('mdl-daftar-admin');
    
    alert('✅ Pasien berhasil didaftarkan secara manual oleh Admin.');
}

// RENDER DATA
function renderDashboard() {
    const stats = SharedState.getStats();
    const patients = SharedState.getPatients();
    const queues = SharedState.getQueues();
    const beds = SharedState.getData('icha_beds');

    // Stats
    if (document.getElementById('stat-mandiri')) document.getElementById('stat-mandiri').textContent = stats.mandiriCount || 0;
    document.getElementById('stat-rj').textContent = stats.rawatJalan;
    document.getElementById('stat-ri').textContent = stats.rawatInap;
    if (document.getElementById('stat-ugd')) document.getElementById('stat-ugd').textContent = stats.ugd;
    document.getElementById('stat-income').textContent = 'Rp ' + (stats.pendapatan / 1000000).toFixed(1) + 'jt';

    // Patients Table (Dashboard Summary)
    const tableBody = document.querySelector('#latest-patients-table tbody');
    if (tableBody) {
        tableBody.innerHTML = patients.slice(0, 5).map(p => `
            <tr>
                <td class="mono">${p.id}</td>
                <td><strong>${p.name}</strong> ${p.tipe_daftar === 'Mandiri' ? '<span class="b bpu" style="font-size:9px;padding:2px 6px">Mandiri</span>' : ''}</td>
                <td>${p.poli}</td>
                <td><span class="b ${p.penjamin === 'BPJS' ? 'bi' : 'bp'}">${p.penjamin}</span></td>
                <td><span class="b ${p.status === 'Selesai' ? 'bs' : (p.status === 'Proses' ? 'bp' : 'bw')}">${p.status}</span></td>
            </tr>
        `).join('');
    }

    // Patients Table (Full Pendaftaran Page)
    const fullTableBody = document.querySelector('#pendaftaran-table tbody');
    if (fullTableBody) {
        fullTableBody.innerHTML = patients.map(p => `
            <tr>
                <td class="mono">${p.id}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.poli}</td>
                <td><span class="b ${p.penjamin === 'BPJS' ? 'bi' : 'bp'}">${p.penjamin}</span></td>
                <td><span class="b ${p.status === 'Selesai' ? 'bs' : (p.status === 'Proses' ? 'bp' : 'bw')}">${p.status}</span></td>
            </tr>
        `).join('');
    }

    // Queues
    Object.keys(queues).forEach(id => {
        const el = document.getElementById('q-' + id);
        if (el) el.textContent = queues[id].current;
    });

    // Beds
    document.getElementById('bed-tersedia').textContent = beds.tersedia;
    document.getElementById('bed-terpakai').textContent = beds.terpakai;
    document.getElementById('bed-reservasi').textContent = beds.reservasi;
}

// CLOCK
function tick() {
    const n = new Date();
    document.getElementById('clk').textContent = n.toLocaleTimeString('id-ID');
    document.getElementById('pgd').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// IMPORT HANDLER
async function handleImport(input) {
    const file = input.files[0];
    if (!file) return;

    if (confirm('Apakah Anda yakin ingin mengimpor data? Data saat ini akan ditimpa.')) {
        try {
            await SharedState.importData(file);
            alert('✅ Data berhasil diimpor dan disinkronkan.');
            // Reset input
            input.value = '';
        } catch (err) {
            console.error(err);
            alert('❌ Gagal mengimpor data. Pastikan format file JSON benar.');
        }
    } else {
        input.value = '';
    }
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
