/**
 * emr.js
 * EMR Logic integrated with SharedState
 */

// CLOCK
setInterval(() => {
    const t = new Date().toLocaleTimeString('id-ID');
    const clkTop = document.getElementById('clk-top');
    if (clkTop) clkTop.textContent = t;
}, 1000);

let currentPatient = null;

// LOAD DATA
function loadCurrentPatient() {
    const patients = SharedState.getPatients();
    // For prototype, we'll pick the first patient with status 'Menunggu' or 'Proses'
    currentPatient = patients.find(p => p.status === 'Menunggu' || p.status === 'Proses') || patients[0];
    
    if (currentPatient) {
        // Update Header & Identitas
        document.querySelectorAll('.pasien-name').forEach(el => el.textContent = currentPatient.name);
        document.querySelector('.pasien-av').textContent = currentPatient.name.substring(0, 2).toUpperCase();
        document.querySelector('.pasien-meta').textContent = `${currentPatient.gender || '—'} • ${currentPatient.age || '—'} • Gol. Darah: —`;
        document.querySelector('.info-row .val[style*="JetBrains Mono"]').textContent = currentPatient.id;
        
        // Update Status Strip
        const statusBadge = document.querySelector('.status-strip strong[style*="4ade80"]');
        if (statusBadge) statusBadge.textContent = currentPatient.queue_no || 'T-45';
        
        // Sync local status to 'Proses' if it was 'Menunggu'
        if (currentPatient.status === 'Menunggu') {
            currentPatient.status = 'Proses';
            SharedState.saveData('icha_patients', patients);
        }
    }
}

// TAB SWITCH
function switchTab(btn, targetId) {
    document.querySelectorAll('#emr-tabs .tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
}

// SIMPAN EMR
function simpanEMR() {
    if (confirm('Simpan rekam medis dan selesaikan kunjungan ini?')) {
        const patients = SharedState.getPatients();
        const index = patients.findIndex(p => p.id === currentPatient.id);
        if (index !== -1) {
            patients[index].status = 'Menunggu Kasir'; // Progress to next step
            SharedState.saveData('icha_patients', patients);
            
            // Also update queue if applicable
            const queues = SharedState.getQueues();
            SharedState.updateQueue('kasir', { current: 'K-' + (Math.floor(Math.random() * 20) + 10) });
        }
        
        alert('✅ Rekam medis berhasil disimpan!\n\nKunjungan diselesaikan.\nTagihan dikirim ke Kasir.');
        window.location.href = 'index.html';
    }
}

// SAVE VITAL
function saveVital() {
    alert('✅ Tanda vital berhasil disimpan!');
}

// KIRIM FARMASI / KASIR
function kirimFarmasi() { alert('💊 Resep berhasil dikirim ke Farmasi!'); }
function kirimKasir() { alert('💳 Tagihan berhasil dikirim ke Kasir!'); }

// PANGGIL BERIKUTNYA
function panggilBerikutnya() {
    alert('📢 Memanggil antrian berikutnya...');
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentPatient();
    SharedState.onUpdate(() => {
        // Optionally reload if needed
    });
});

function loadRiwayat(date) {
    alert(`📅 Menampilkan riwayat kunjungan untuk ${date}.`);
}

function showSurat(type) {
    const map = {
        kontrol: 'Surat Kontrol',
        rujukan: 'Surat Rujukan',
        istirahat: 'Surat Istirahat',
        sehat: 'Surat Sehat'
    };
    alert(`📄 Membuat ${map[type] || 'surat'} (${type}).`);
}

function updateTotal() {
    const rows = document.querySelectorAll('#rx-body tr');
    const count = rows.length;
    const totalLabel = document.getElementById('rx-total');
    if (totalLabel) {
        totalLabel.textContent = `${count} item resep aktif`;
    }
}

function searchICD(input, resultsId) {
    const query = document.getElementById(input)?.value.trim().toLowerCase();
    const results = document.getElementById(resultsId);
    if (!results) return;
    results.querySelectorAll('.icd-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = !query || text.includes(query) ? 'flex' : 'none';
    });
}

function selectICD(inputId, resultsId, code, name) {
    const input = document.getElementById(inputId);
    if (input) input.value = `${code} — ${name}`;
    const results = document.getElementById(resultsId);
    if (results) results.style.display = 'none';
}

function addDrug(name, unit, price, stock) {
    const body = document.getElementById('rx-body');
    if (!body) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><strong>${name}</strong></td>
        <td><input class="rx-input" value="1x1" style="width:50px"></td>
        <td><select class="rx-input" style="width:90px"><option>Pagi</option><option>Pagi-Siang</option><option>3x sehari</option></select></td>
        <td><input class="rx-input" value="1" style="width:40px"> ${unit}</td>
        <td><input class="rx-input" value="—" style="width:110px"></td>
        <td><button class="btn btn-d btn-xs" onclick="this.closest('tr').remove();updateTotal()">✕</button></td>
    `;
    body.appendChild(tr);
    updateTotal();
}

function filterDrug(q) {
    document.querySelectorAll('.drug-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = !q || text.includes(q.toLowerCase()) ? 'flex' : 'none';
    });
}
