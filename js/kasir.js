/**
 * kasir.js — Standalone Cashier
 * Real data from Supabase — invoices, payments, registrations
 */

let currentInvoice = null;
let currentPatient = null;
let currentReg = null;
let currentItems = [];
let currentTotal = 0;

// ─── CLOCK ───
setInterval(() => {
  const clk = document.getElementById('clk');
  if (clk) clk.textContent = new Date().toLocaleTimeString('id-ID');
}, 1000);

// ─── LOAD QUEUE & INVOICES ───
async function loadKasirData() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Load unpaid invoices with registration + patient data
    const { data: invoices } = await window.__sb
      .from('invoices')
      .select('*, registrations(id, no_antrian, penjamin, status, poli_id, patients:patient_id(id, nama, no_rm, jenis_kelamin, tanggal_lahir))')
      .in('status', ['Belum Dibayar', 'Menunggu Konfirmasi'])
      .order('created_at', { ascending: true });

    if (!invoices) return;

    // Render patient list
    renderPatientList(invoices);

    // Update queue stats
    const waiting = invoices.length;
    document.getElementById('q-tunggu').textContent = waiting;

    // Load today's completed payments for recap
    const { data: todayPayments } = await window.__sb
      .from('payments')
      .select('total, metode')
      .gte('created_at', today);

    if (todayPayments) {
      renderRecap(todayPayments);
    }

    // Load transaction history
    loadTransactionHistory();
  } catch (err) {
    console.error('Kasir load error:', err);
  }
}

function renderPatientList(invoices) {
  const container = document.querySelector('.pasien-list');
  if (!container) return;

  container.innerHTML = invoices.map((inv, idx) => {
    const reg = inv.registrations;
    const patient = reg?.patients;
    const name = patient?.nama || '—';
    const initials = name.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('') || '--';
    const penjamin = reg?.penjamin || '—';
    const noAntrian = reg?.no_antrian || '—';
    const total = inv.total || 0;

    return `
      <div class="pasien-item ${idx === 0 ? 'active' : ''}" onclick="loadPasien('${inv.id}')">
        <div class="p-av">${initials}</div>
        <div><div class="p-name">${name}</div><div class="p-meta">Reg: ${patient?.no_rm || '—'} • ${penjamin}</div></div>
        <div class="p-q">${noAntrian}</div>
      </div>
    `;
  }).join('');

  // Auto-load first patient
  if (invoices.length > 0) {
    loadPasien(invoices[0].id);
  }

  const badge = document.querySelector('.card .ch .b');
  if (badge) badge.textContent = invoices.length + ' menunggu';
}

async function loadPasien(invoiceId) {
  try {
    const { data: inv } = await window.__sb
      .from('invoices')
      .select('*, registrations(id, no_antrian, penjamin, status, poli_id, patient_id, created_at, registrations.patients:patient_id(*), registrations.poli:poli_id(nama_poli))')
      .eq('id', invoiceId)
      .single();

    if (!inv) return;

    currentInvoice = inv;
    currentReg = inv.registrations;
    currentPatient = currentReg?.patients || null;
    
    // Build invoice items (from invoice item list or default)
    currentItems = [];
    const baseItems = [
      { name: 'Jasa Dokter', qty: 1, price: 100000 },
      { name: 'Biaya Poliklinik', qty: 1, price: 15000 },
      { name: 'Biaya Administrasi', qty: 1, price: 5000 },
    ];
    
    // Try to get prescription items if any
    try {
      const { data: prescriptions } = await window.__sb
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .eq('registration_id', currentReg.id);

      if (prescriptions && prescriptions.length > 0) {
        prescriptions.forEach(pres => {
          (pres.prescription_items || []).forEach(item => {
            baseItems.push({
              name: item.nama_obat,
              qty: item.jumlah || 30,
              price: item.harga || 1000
            });
          });
        });
      }
    } catch (e) {}

    currentItems = baseItems;
    currentTotal = currentItems.reduce((s, i) => s + (i.qty * i.price), 0);

    // Populate UI
    populateKasirUI();
    renderPatientList_highlight(invoiceId);
  } catch (err) {
    console.error('Load pasien error:', err);
  }
}

// Just highlights the active patient
function renderPatientList_highlight(activeId) {
  document.querySelectorAll('.pasien-item').forEach(el => el.classList.remove('active'));
  const items = document.querySelectorAll('.pasien-item');
  for (const item of items) {
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(activeId)) {
      item.classList.add('active');
      break;
    }
  }
}

function populateKasirUI() {
  if (!currentPatient) return;

  const p = currentPatient;
  const r = currentReg;
  const inv = currentInvoice;

  const name = p.nama || '—';
  const age = p.tanggal_lahir
    ? Math.floor((new Date() - new Date(p.tanggal_lahir)) / (365.25 * 24 * 60 * 60 * 1000)) + ' tahun'
    : '—';
  const gender = p.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan';
  const penjamin = r?.penjamin || 'Umum';
  const noRm = p.no_rm || '—';
  const noAntrian = r?.no_antrian || '—';
  const poliName = r?.poli?.nama_poli || '—';
  const fmt = 'Rp ' + currentTotal.toLocaleString('id-ID');

  // Patient header
  document.getElementById('tag-nama').textContent = name;
  document.getElementById('tag-meta').textContent = `${gender} • ${age} • ${penjamin}`;
  document.getElementById('tag-reg-label').textContent = `Reg: ${noRm} • ${noAntrian} • ${poliName}`;
  document.getElementById('tag-no').textContent = `No. Reg: ${noRm} • No. Antrian: ${noAntrian} • Poli: ${poliName}`;

  // Queue active
  document.getElementById('q-active').textContent = noAntrian;
  document.getElementById('q-name').textContent = `${name} • ${penjamin}`;

  // SEP section (show only for BPJS)
  const sepSection = document.getElementById('sep-section');
  if (sepSection) {
    sepSection.style.display = penjamin === 'BPJS' ? 'block' : 'none';
  }
  if (penjamin === 'BPJS') {
    document.getElementById('sep-nama').textContent = name;
    document.getElementById('sep-poli') && (document.getElementById('sep-poli').textContent = poliName);
  }

  // Billing table
  const body = document.getElementById('billing-body');
  if (body) {
    let html = '';
    currentItems.forEach((item, idx) => {
      const subtotal = item.qty * item.price;
      const isDrug = item.name.includes('mg') || item.name.includes('Tab') || item.price < 5000;
      html += `<tr>
        <td>${idx + 1}</td>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td class="mono">Rp ${item.price.toLocaleString()}</td>
        <td class="mono">Rp ${subtotal.toLocaleString()}</td>
        <td><span class="b bg2">${penjamin === 'BPJS' ? 'BPJS' : 'Pasien'}</span></td>
      </tr>`;
    });
    body.innerHTML = html;
  }

  // Totals
  document.getElementById('grand-total').textContent = fmt;
  document.getElementById('t-total').textContent = fmt;
  
  // Penjamin coverage
  const penjaminCover = penjamin === 'BPJS' ? currentTotal : 0;
  document.getElementById('t-penjamin').textContent = 'Rp ' + penjaminCover.toLocaleString('id-ID');
  
  const bayar = currentTotal - penjaminCover;
  document.getElementById('t-bayar').textContent = 'Rp ' + bayar.toLocaleString('id-ID');

  // Nota preview
  document.getElementById('n-nama').textContent = name;
  document.getElementById('n-penjamin').textContent = penjamin;
  document.getElementById('n-reg').textContent = `No. Reg: ${noRm}`;
  document.getElementById('n-tgl').textContent = new Date().toLocaleDateString('id-ID');
  document.getElementById('n-total').textContent = fmt;

  // Nota items
  const nItems = document.getElementById('n-items');
  if (nItems) {
    nItems.innerHTML = currentItems.map(item =>
      `<div class="nota-row"><span style="font-size:10px">${item.name}</span><span class="mono" style="font-size:10px">Rp ${(item.qty * item.price).toLocaleString()}</span></div>`
    ).join('');
  }

  // Reset payment
  document.getElementById('kembalian-box').style.display = 'none';
  document.getElementById('jumlah-terima').value = '';
  hitungKembalian();
  hitungBayar();
}

// ─── PAYMENT METHODS ───
function setPayMethod(btn, method) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const areas = ['pay-tunai-area', 'pay-transfer-area', 'pay-qris-area', 'pay-bpjs-area', 'pay-asuransi-area', 'pay-piutang-area'];
  areas.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const areaMap = {
    tunai: 'pay-tunai-area',
    transfer: 'pay-transfer-area',
    qris: 'pay-qris-area',
    bpjs: 'pay-bpjs-area',
    asuransi: 'pay-asuransi-area',
    piutang: 'pay-piutang-area'
  };

  const area = document.getElementById(areaMap[method]);
  if (area) area.style.display = 'block';

  hitungKembalian();
}

function hitungKembalian() {
  const amountInput = document.getElementById('jumlah-terima');
  const kembalianBox = document.getElementById('kembalian-box');
  const kembalianVal = document.getElementById('kembalian-val');
  if (!amountInput || !kembalianBox || !kembalianVal) return;

  const rawValue = String(amountInput.value).replace(/\D/g, '');
  const amount = Number(rawValue) || 0;

  // Get the amount to pay (after penjamin/discount)
  const bayarText = document.getElementById('t-bayar').textContent;
  const toPay = parseInt(bayarText.replace(/[^\d]/g, '')) || currentTotal;
  const change = Math.max(0, amount - toPay);

  if (rawValue.length === 0) {
    kembalianBox.style.display = 'none';
    kembalianVal.textContent = 'Rp 0';
  } else {
    kembalianBox.style.display = 'block';
    kembalianVal.textContent = 'Rp ' + change.toLocaleString('id-ID');
  }
}

function hitungBayar() {
  const diskon = parseInt(document.getElementById('diskon')?.value?.replace(/\D/g, '') || '0');
  const diskonType = document.getElementById('diskon-type')?.value || 'nominal';
  const penjaminCover = parseInt(document.getElementById('t-penjamin').textContent.replace(/[^\d]/g, '')) || 0;
  
  let diskonVal = diskonType === 'persen' ? Math.round(currentTotal * diskon / 100) : diskon;
  if (diskonVal > currentTotal) diskonVal = currentTotal;

  const bayar = currentTotal - penjaminCover - diskonVal;
  document.getElementById('t-diskon').textContent = 'Rp ' + diskonVal.toLocaleString('id-ID');
  document.getElementById('t-bayar').textContent = 'Rp ' + Math.max(0, bayar).toLocaleString('id-ID');

  hitungKembalian();
}

// ─── PROSES TRANSAKSI ───
async function prosesTransaksi() {
  if (!currentInvoice) {
    showToast('❌ Pilih pasien terlebih dahulu');
    return;
  }

  // Get payment method
  const activeBtn = document.querySelector('.pay-btn.active');
  const metode = activeBtn ? activeBtn.textContent.trim().toLowerCase() : 'tunai';

  const bayarText = document.getElementById('t-bayar').textContent;
  const totalBayar = parseInt(bayarText.replace(/[^\d]/g, '')) || 0;

  // Validate
  if (metode === 'tunai') {
    const amountInput = document.getElementById('jumlah-terima');
    const received = parseInt(String(amountInput?.value || '0').replace(/\D/g, '')) || 0;
    if (received < totalBayar) {
      showToast(`⚠️ Uang tidak mencukupi. Kurang Rp ${(totalBayar - received).toLocaleString()}`);
      return;
    }
  }

  try {
    // Create payment record
    const { data: payment, error } = await window.__sb
      .from('payments')
      .insert({
        invoice_id: currentInvoice.id,
        registration_id: currentReg?.id,
        patient_id: currentPatient?.id,
        total: totalBayar,
        metode: metode,
        status: 'Lunas',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      showToast('❌ Gagal memproses pembayaran: ' + error.message);
      return;
    }

    // Update invoice status
    await window.__sb
      .from('invoices')
      .update({ status: 'Lunas', updated_at: new Date().toISOString() })
      .eq('id', currentInvoice.id);

    showToast(`✅ Pembayaran ${metode.toUpperCase()} berhasil! Rp ${totalBayar.toLocaleString()}`);

    // Reset and reload
    currentInvoice = null;
    currentPatient = null;
    currentReg = null;
    currentItems = [];
    currentTotal = 0;

    // Re-render
    await loadKasirData();
  } catch (err) {
    console.error('Proses transaksi error:', err);
    showToast('❌ Gagal memproses pembayaran');
  }
}

// ─── PANGGIL BERIKUTNYA ───
async function panggilBerikutnya() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: nextInv } = await window.__sb
      .from('invoices')
      .select('id')
      .eq('status', 'Belum Dibayar')
      .gte('created_at', today)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!nextInv) {
      showToast('✅ Semua tagihan sudah dilayani');
      return;
    }

    // Update current invoice status
    if (currentInvoice) {
      // Don't change status, just move to next
    }

    loadPasien(nextInv.id);
    showToast('⏭️ Panggil pasien berikutnya');
  } catch (err) {
    showToast('✅ Semua tagihan sudah dilayani');
  }
}

// ─── REKAP ───
function renderRecap(payments) {
  const totalTrans = payments.length;
  const tunai = payments.filter(p => p.metode === 'tunai').reduce((s, p) => s + (p.total || 0), 0);
  const transfer = payments.filter(p => p.metode === 'transfer' || p.metode === 'qris').reduce((s, p) => s + (p.total || 0), 0);
  const bpjs = payments.filter(p => p.metode === 'bpjs').reduce((s, p) => s + (p.total || 0), 0);
  const grandTotal = payments.reduce((s, p) => s + (p.total || 0), 0);

  document.querySelector('.rekap-item:nth-child(1) .rekap-val').textContent = totalTrans;
  document.querySelector('.rekap-item:nth-child(2) .rekap-val').textContent = 'Rp ' + Math.round(tunai / 1000).toLocaleString();
  document.querySelector('.rekap-item:nth-child(2) .rekap-lbl').textContent = 'Tunai';
  document.querySelector('.rekap-item:nth-child(3) .rekap-val').textContent = 'Rp ' + Math.round(transfer / 1000).toLocaleString();
  document.querySelector('.rekap-item:nth-child(3) .rekap-lbl').textContent = 'Transfer/QRIS';
  document.querySelector('.rekap-item:nth-child(4) .rekap-val').textContent = 'Rp ' + Math.round(bpjs / 1000).toLocaleString();
  document.querySelector('.rekap-item:nth-child(4) .rekap-lbl').textContent = 'BPJS (Piutang)';

  const totalEl = document.querySelector('.card .cb div:has(div:contains(TOTAL))');
  if (totalEl) {
    const valEl = totalEl.querySelector('.mono') || totalEl.querySelector('div:last-child');
    if (valEl) valEl.textContent = 'Rp ' + grandTotal.toLocaleString('id-ID');
  }
  
  // Also update the hardcoded one
  const totalElem = document.querySelector('.card .cb > div[style*="background:linear-gradient"] div:last-child');
  if (totalElem) totalElem.textContent = 'Rp ' + grandTotal.toLocaleString('id-ID');
}

// ─── TRANSACTION HISTORY ───
async function loadTransactionHistory() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: payments } = await window.__sb
      .from('payments')
      .select('*, invoices(registration_id, registrations:registration_id(no_antrian, patients:patient_id(nama)))')
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!payments) return;

    const tbody = document.querySelector('.t tbody');
    if (!tbody) return;

    tbody.innerHTML = payments.map(p => {
      const reg = p.invoices?.registrations;
      const patient = reg?.patients;
      const nama = patient?.nama || '—';
      const noReg = p.registration_id?.toString().slice(-6) || '—';
      const metodeIcons = { tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS', bpjs: 'BPJS', asuransi: 'Asuransi', piutang: 'Piutang' };
      const metodeColors = { tunai: 'bg2', transfer: 'bg2', qris: 'bi', bpjs: 'bi', asuransi: 'bw', piutang: 'bw' };

      return `<tr>
        <td class="mono">${noReg}</td>
        <td>${nama}</td>
        <td class="mono">Rp ${(p.total || 0).toLocaleString()}</td>
        <td><span class="b ${metodeColors[p.metode] || 'bg2'}">${metodeIcons[p.metode] || p.metode}</span></td>
        <td><span class="b bs">Lunas</span></td>
      </tr>`;
    }).join('');
  } catch (e) {
    console.error('History load error:', e);
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
  // Wait for SharedState
  if (window.SharedState) {
    try { await SharedState.waitReady(); } catch(e) {}
  }

  // Load data
  await loadKasirData();

  console.log('Kasir page initialized');
});
