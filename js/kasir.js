/**
 * kasir.js
 * Cashier Logic integrated with SharedState
 */

// CLOCK
setInterval(() => {
    const clk = document.getElementById('clk');
    if (clk) clk.textContent = new Date().toLocaleTimeString('id-ID');
}, 1000);

let currentPatient = null;
let currentTotal = 0;

// RENDER PATIENT LIST
function renderPatientList() {
    const patients = SharedState.getPatients();
    const container = document.querySelector('.pasien-list');
    if (!container) return;

    // Filter patients waiting for cashier or already in process at cashier
    const waitingPatients = patients.filter(p => p.status === 'Menunggu Kasir');

    container.innerHTML = waitingPatients.map(p => `
        <div class="pasien-item ${currentPatient?.id === p.id ? 'active' : ''}" 
             onclick="selectPatient('${p.id}')">
            <div class="p-av">${p.name.substring(0, 2).toUpperCase()}</div>
            <div><div class="p-name">${p.name}</div><div class="p-meta">RM: ${p.id} • ${p.penjamin}</div></div>
            <div class="p-q">${p.queue_no || 'K-??'}</div>
        </div>
    `).join('');
    
    const badge = document.querySelector('.card .ch .b');
    if (badge) badge.textContent = waitingPatients.length + ' menunggu';
}

// SELECT PATIENT
function selectPatient(id) {
    const patients = SharedState.getPatients();
    currentPatient = patients.find(p => p.id === id);
    if (!currentPatient) return;

    // Update UI
    document.getElementById('tag-nama').textContent = currentPatient.name;
    document.getElementById('tag-meta').textContent = `${currentPatient.penjamin} — RM: ${currentPatient.id}`;
    document.getElementById('tag-reg-label').textContent = `RM: ${currentPatient.id}`;
    document.getElementById('n-nama').textContent = currentPatient.name;
    document.getElementById('n-penjamin').textContent = currentPatient.penjamin;
    
    // Mock prices for prototype
    currentTotal = currentPatient.penjamin === 'BPJS' ? 0 : 279300;
    const fmt = 'Rp ' + currentTotal.toLocaleString('id-ID');
    document.getElementById('grand-total').textContent = fmt;
    document.getElementById('t-total').textContent = fmt;
    document.getElementById('t-bayar').textContent = fmt;
    document.getElementById('n-total').textContent = fmt;
    
    renderPatientList();
}

// PROSES TRANSAKSI
function prosesTransaksi() {
    if (!currentPatient) {
        alert('Pilih pasien terlebih dahulu');
        return;
    }

    if (confirm(`Proses pembayaran untuk ${currentPatient.name}?`)) {
        const patients = SharedState.getPatients();
        const index = patients.findIndex(p => p.id === currentPatient.id);
        if (index !== -1) {
            patients[index].status = 'Selesai';
            SharedState.saveData('icha_patients', patients);
            
            // Update Income Stats
            const stats = SharedState.getStats();
            stats.pendapatan += currentTotal;
            SharedState.saveStats(stats);
        }

        alert('✅ Pembayaran Berhasil!\n\nStatus pasien diperbarui menjadi Selesai.');
        currentPatient = null;
        renderPatientList();
        resetUI();
    }
}

function resetUI() {
    document.getElementById('tag-nama').textContent = '—';
    document.getElementById('grand-total').textContent = 'Rp 0';
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
    renderPatientList();
    SharedState.onUpdate(() => {
        renderPatientList();
    });
});

// Load a patient from the static list or an inline patient card
function loadPasien(el, name, id, queue, penjamin, amount) {
    currentPatient = { id, name, penjamin, queue_no: queue, status: 'Menunggu Kasir' };
    currentTotal = Number(String(amount || '').replace(/\D/g, '')) || 0;

    document.querySelectorAll('.pasien-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    const fmt = 'Rp ' + currentTotal.toLocaleString('id-ID');
    document.getElementById('tag-nama').textContent = name;
    document.getElementById('tag-meta').textContent = `${penjamin} — RM: ${id}`;
    document.getElementById('tag-reg-label').textContent = `RM: ${id}`;
    document.getElementById('tag-no').textContent = `No. Reg: ${id} • No. Antrian: ${queue} • Poli: Jantung • Dokter: Dr. Taka Mehi, Sp.JP`;
    document.getElementById('n-nama').textContent = name;
    document.getElementById('n-penjamin').textContent = penjamin;
    document.getElementById('grand-total').textContent = fmt;
    document.getElementById('t-total').textContent = fmt;
    document.getElementById('t-bayar').textContent = fmt;
    document.getElementById('n-total').textContent = fmt;
    document.getElementById('kembalian-box').style.display = 'none';
    const jumlahTerima = document.getElementById('jumlah-terima');
    if (jumlahTerima) jumlahTerima.value = '';
}

// Helper functions for payment methods
function setPayMethod(btn, method) {
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const areas = ['pay-tunai-area', 'pay-transfer-area', 'pay-qris-area', 'pay-bpjs-area', 'pay-asuransi-area', 'pay-piutang-area'];
    areas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (method === 'tunai') {
        document.getElementById('pay-tunai-area').style.display = 'block';
    } else if (method === 'transfer') {
        document.getElementById('pay-transfer-area').style.display = 'block';
    } else if (method === 'qris') {
        document.getElementById('pay-qris-area').style.display = 'block';
    } else if (method === 'bpjs') {
        document.getElementById('pay-bpjs-area').style.display = 'block';
    } else if (method === 'asuransi') {
        document.getElementById('pay-asuransi-area').style.display = 'block';
    } else if (method === 'piutang') {
        document.getElementById('pay-piutang-area').style.display = 'block';
    }

    hitungKembalian();
}

function hitungKembalian() {
    const amountInput = document.getElementById('jumlah-terima');
    const kembalianBox = document.getElementById('kembalian-box');
    const kembalianVal = document.getElementById('kembalian-val');
    if (!amountInput || !kembalianBox || !kembalianVal) return;

    const rawValue = String(amountInput.value).replace(/\D/g, '');
    const amount = Number(rawValue) || 0;
    const change = Math.max(0, amount - currentTotal);

    if (rawValue.length === 0) {
        kembalianBox.style.display = 'none';
        kembalianVal.textContent = 'Rp 0';
    } else {
        kembalianBox.style.display = 'block';
        kembalianVal.textContent = 'Rp ' + change.toLocaleString('id-ID');
    }
}
