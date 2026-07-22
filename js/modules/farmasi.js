/**
 * modules/farmasi.js — Resep, Stok, Pembelian, Penggunaan Obat
 */

// ─── FARMASI: Resep Masuk ───
async function loadFarRx() {
    var tbody = document.getElementById('far-rx-table');
    if(!tbody) return;
    tbody.innerHTML = '<div class="pending-skeleton"><div class="skeleton skeleton-card" style="height:160px"></div></div>';
    var { data: rx } = await window.__sb.from('prescriptions').select('*, patients(nama,no_rm)').order('created_at',{ascending:false}).limit(50);
    if(!rx||!rx.length) { tbody.innerHTML='<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Belum ada resep masuk</div></div>'; return; }
    tbody.innerHTML = '<table class="t"><thead><tr><th>No.Resep</th><th>Tanggal</th><th>Pasien</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' + rx.map(function(r){
        return '<tr><td class="mono">'+r.no_resep+'</td><td>'+(r.created_at?new Date(r.created_at).toLocaleDateString('id-ID'):'')+'</td><td>'+(r.patients?.nama||'—')+'</td><td><span class="b bw">'+r.status+'</span></td><td><button class="btn btn-o btn-xs">Detail</button></td></tr>';
    }).join('') + '</tbody></table>';
}

async function loadFarStok() {
    var container = document.getElementById('far-stok-table');
    if(!container) return;
    container.innerHTML = '<div class="pending-skeleton"><div class="skeleton skeleton-card" style="height:160px"></div></div>';
    var { data: meds } = await window.__sb.from('medicines').select('*').order('nama_obat',{ascending:true});
    if(!meds) { container.innerHTML='<div class="empty-state">Gagal memuat</div>'; return; }
    container.innerHTML = '<table class="t"><thead><tr><th>Nama Obat</th><th>Stok</th><th>Min</th><th>Satuan</th><th>Harga</th></tr></thead><tbody>' + meds.map(function(m){
        var warn = (m.stok||0) <= (m.stok_minimum||0) ? 'style="color:var(--danger-500);font-weight:700"' : '';
        return '<tr><td>'+m.nama_obat+'</td><td '+warn+'>'+(m.stok||0)+'</td><td>'+(m.stok_minimum||0)+'</td><td>'+m.satuan+'</td><td>'+formatRupiah(m.harga_satuan||0)+'</td></tr>';
    }).join('') + '</tbody></table>';
}

async function loadFarmasi() {
    document.getElementById('far-stats').innerHTML = '<div class="sc"><div class="sb" style="background:var(--primary)"></div><div class="si" style="background:var(--primary-light)">💊</div><div class="sv">—</div><div class="sl">Farmasi</div></div>';
    loadFarRx(); loadFarStok();
}

// ─── STOK & INVENTORY ───
async function loadStok() {
    await SharedState.waitReady();
    var countRes = await window.__sb.from('medicines').select('*',{count:'exact',head:true});
    var { data: meds } = await window.__sb.from('medicines').select('*').order('nama_obat',{ascending:true});
    var list = meds||[];
    var totalItems = list.length;
    var totalQty = list.reduce(function(s,m){return s+(m.stok||0);},0);
    var lowItems = list.filter(function(m){return (m.stok||0)<=(m.stok_minimum||0);}).length;
    var totalValue = list.reduce(function(s,m){return s+((m.harga_satuan||0)*(m.stok||0));},0);
    document.getElementById('stok-total-items').textContent = totalItems;
    document.getElementById('stok-total-qty').textContent = totalQty;
    document.getElementById('stok-low-items').textContent = lowItems;
    document.getElementById('stok-total-value').textContent = formatRupiah(totalValue);
    var tbody = document.getElementById('stok-tbody');
    if(!tbody) return;
    tbody.innerHTML = list.map(function(m){
        var status = (m.stok||0) <= 0 ? 'danger' : (m.stok||0) <= (m.stok_minimum||0) ? 'warning' : 'success';
        var statusIcon = status==='danger'?'🚨':status==='warning'?'⚠️':'✅';
        var statusLabel = status==='danger'?'Habis':status==='warning'?'Minimum':'Tersedia';
        return '<tr><td class="mono">'+(m.kode||'—')+'</td><td>'+m.nama_obat+'</td><td>'+(m.kategori||'')+'</td><td style="font-weight:'+(status!=='success'?'700':'400')+';color:var(--'+status+'-500)">'+(m.stok||0)+'</td><td>'+(m.stok_minimum||0)+'</td><td><span class="b b'+status[0]+'">'+statusIcon+' '+statusLabel+'</span></td><td>'+(m.satuan||'')+'</td><td>'+formatRupiah(m.harga_satuan||0)+'</td><td><button class="btn btn-o btn-xs" onclick="editObat(\''+m.id+'\')">✏️ Edit</button></td></tr>';
    }).join('');
    loadStokFilterOptions(list);
}
