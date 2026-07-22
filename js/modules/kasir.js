/**
 * modules/kasir.js — Transaksi, Tagihan, SEP
 */

async function loadKasir() {
    var { data: invoices } = await window.__sb.from('invoices').select('*, registrations(patient_id, penjamin, no_antrian, status, patients(nama, no_rm))').in('status',['Belum Dibayar','Menunggu Konfirmasi']).order('created_at',{ascending:true});
    var sidebar = document.getElementById('kasir-sidebar');
    var konten = document.getElementById('kasir-table');
    if(!invoices||!invoices.length) {
        if(sidebar) sidebar.innerHTML='<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Tidak ada tagihan</div></div>';
        return;
    }
    if(sidebar) {
        sidebar.innerHTML = '<div class="card"><div class="ch"><div class="ct">Antrian Kasir</div><span class="b bd">'+invoices.length+' menunggu</span></div><div class="pasien-list">' + invoices.map(function(inv,i){
            var reg = inv.registrations;
            var pat = reg?.patients;
            return '<div class="pasien-item '+(i===0?'active':'')+'" onclick="loadPasien(\''+inv.id+'\')"><div class="p-av">'+(pat?pat.nama?.charAt(0)||'?':'?')+'</div><div><div class="p-name">'+(pat?.nama||'—')+'</div><div class="p-meta">'+(pat?.no_rm||'')+'</div></div><div class="p-q">'+(reg?.no_antrian||'')+'</div></div>';
        }).join('') + '</div></div>';
    }
}

async function loadPasien(invoiceId) {
    var { data: inv } = await window.__sb.from('invoices').select('*, registrations(patient_id, penjamin, status, patients(nama, no_rm, jk, tgl_lahir))').eq('id',invoiceId).single();
    if(!inv) return;
    var reg = inv.registrations;
    var pat = reg?.patients;
    var container = document.getElementById('kasir-table');
    if(!container) return;
    container.innerHTML = '<div class="card"><div class="ch"><div class="ct">💳 Tagihan '+(pat?.nama||'')+'</div></div><div class="cb"><div style="margin-bottom:12px"><strong>'+(pat?.nama||'')+'</strong> ('+(pat?.no_rm||'')+')<br><span style="font-size:12px;color:var(--text-muted)">'+(reg?.penjamin||'')+' • Antrian: '+(reg?.no_antrian||'')+'</span></div><div style="font-size:24px;font-weight:800;color:var(--primary-500)">'+formatRupiah(inv.total||0)+'</div><button class="btn btn-p btn-block" onclick="showMdlTransaksi()" style="margin-top:12px">💳 Proses Bayar</button></div></div>';
}

async function showMdlTransaksi() {
    showM('mdl-transaksi');
}
