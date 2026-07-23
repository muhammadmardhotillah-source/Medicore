/**
 * modules/pagination.js — Pagination for main tables
 * Load after helpers.js
 */

// ─── PENDAFTARAN PAGINATION ───
var _pp = { page: 1, perPage: 25, total: 0 };

async function loadPendaftaran(page) {
  page = page || _pp.page;
  _pp.page = page;
  var pp = _pp.perPage;
  var off = (page - 1) * pp;

  var cr = await window.__sb.from('registrations').select('id', { count: 'exact', head: true });
  _pp.total = cr.count || 0;

  var { data: regs } = await window.__sb.from('registrations')
    .select('*, patients(no_rm, nama, tgl_lahir), poli(nama_poli)')
    .order('created_at', { ascending: false })
    .range(off, off + pp - 1);

  if (!regs) { document.getElementById('pendaftaran-tbody').innerHTML = '<tr><td colspan="10">Gagal memuat</td></tr>'; return; }

  var total = _pp.total;
  var menunggu = 0, proses = 0, selesai = 0;
  for (var i = 0; i < regs.length; i++) {
    if (regs[i].status === 'Menunggu') menunggu++;
    else if (regs[i].status === 'Proses') proses++;
    else if (regs[i].status === 'Selesai') selesai++;
  }

  document.getElementById('stat-kunjungan-total').textContent = total;
  document.getElementById('stat-kunjungan-menunggu').textContent = menunggu;
  document.getElementById('stat-kunjungan-proses').textContent = proses;
  document.getElementById('stat-kunjungan-selesai').textContent = selesai;
  document.getElementById('stat-kunjungan-count').textContent = total + ' kunjungan';

  var tb = document.getElementById('pendaftaran-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  for (var i = 0; i < regs.length; i++) {
    var r = regs[i];
    var usia = r.patients && r.patients.tgl_lahir ? Math.floor((new Date() - new Date(r.patients.tgl_lahir)) / 31557600000) + 'th' : '—';
    var sc = r.status === 'Selesai' ? 'bs' : r.status === 'Proses' ? 'bp' : 'bw';
    tb.innerHTML += '<tr>' +
      '<td class="mono">REG-' + r.id.slice(0,6).toUpperCase() + '</td>' +
      '<td class="mono">' + (r.patients ? r.patients.no_rm || '—' : '—') + '</td>' +
      '<td>' + (r.patients ? r.patients.nama || '—' : '—') + '</td>' +
      '<td>' + usia + '</td>' +
      '<td>' + (r.poli ? r.poli.nama_poli || '—' : '—') + '</td>' +
      '<td>—</td>' +
      '<td>' + (r.penjamin || '—') + '</td>' +
      '<td class="mono">' + (r.no_antrian || '—') + '</td>' +
      '<td><span class="b ' + sc + '">' + r.status + '</span></td>' +
      '<td><button class="btn btn-o btn-xs" onclick="showPendaftaranDetail(\'' + r.id + '\')">Detail</button></td>' +
      '</tr>';
  }

  renderPagination(total, page, pp, 'pag-pendaftaran', 'loadPendaftaran');
}

// ─── STOK PAGINATION ───
var _ps = { page: 1, perPage: 25, total: 0 };

async function loadStok(page) {
  page = page || _ps.page;
  _ps.page = page;
  var pp = _ps.perPage;
  var off = (page - 1) * pp;

  var cr = await window.__sb.from('medicines').select('id', { count: 'exact', head: true });
  _ps.total = cr.count || 0;

  var { data: meds } = await window.__sb.from('medicines')
    .select('*')
    .order('nama_obat', { ascending: true })
    .range(off, off + pp - 1);

  var list = meds || [];
  var totalItems = _ps.total;
  var totalQty = 0, lowItems = 0, totalValue = 0;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    totalQty += m.stok || 0;
    if ((m.stok||0) <= (m.stok_minimum||0)) lowItems++;
    totalValue += (m.harga_satuan||0) * (m.stok||0);
  }

  document.getElementById('stok-total-items').textContent = totalItems;
  document.getElementById('stok-total-qty').textContent = totalQty;
  document.getElementById('stok-low-items').textContent = lowItems;
  document.getElementById('stok-total-value').textContent = formatRupiah(totalValue);

  var tb = document.getElementById('stok-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    var st = (m.stok||0) <= 0 ? 'danger' : (m.stok||0) <= (m.stok_minimum||0) ? 'warning' : 'success';
    tb.innerHTML += '<tr>' +
      '<td class="mono">' + (m.kode||'—') + '</td>' +
      '<td>' + m.nama_obat + '</td><td>' + (m.kategori||'') + '</td>' +
      '<td style="font-weight:700;color:var(--' + st + '-500)">' + (m.stok||0) + '</td>' +
      '<td>' + (m.stok_minimum||0) + '</td>' +
      '<td><span class="b b' + st[0] + '">' + (st==='danger'?'🚨':st==='warning'?'⚠️':'✅') + ' ' + (st==='danger'?'Habis':st==='warning'?'Min':'Tersedia') + '</span></td>' +
      '<td>' + (m.satuan||'') + '</td>' +
      '<td>' + formatRupiah(m.harga_satuan||0) + '</td>' +
      '<td><button class="btn btn-o btn-xs">✏️ Edit</button></td></tr>';
  }

  renderPagination(totalItems, page, pp, 'pg-stok', 'loadStok');
}
