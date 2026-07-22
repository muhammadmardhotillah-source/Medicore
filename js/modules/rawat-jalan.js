/**
 * modules/rawat-jalan.js — Antrian Poli, EMR, Resep
 */

var _RJ = { regs: [], patients: {}, polis: {}, doctors: {} };

async function loadRawatJalan() {
    var container = document.getElementById('rj-queue-container');
    if (!container) return;
    container.innerHTML = '<div class="pending-skeleton"><div class="skeleton skeleton-card" style="height:160px"></div><div class="skeleton skeleton-card" style="height:160px"></div><div class="skeleton skeleton-card" style="height:160px"></div></div>';
    var poliMap = {};
    SharedState.getPoli().forEach(function(p) { poliMap[p.id] = p.nama_poli; });
    var { data: regs } = await window.__sb.from('registrations').select('id, patient_id, poli_id, doctor_id, no_antrian, status, penjamin, created_at').not('status','in','("Opname","calling","URGENT")').order('created_at',{ascending:true});
    if (!regs||!regs.length) { container.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:10px">🏥</div>Tidak ada antrian poli hari ini</div>'; return; }
    var pIds = [...new Set(regs.map(function(r){return r.patient_id;}))];
    var { data: patients } = await window.__sb.from('patients').select('id,no_rm,nama,tgl_lahir,jk').in('id',pIds);
    var pMap = {}; (patients||[]).forEach(function(p){pMap[p.id]=p;});
    var groups = {};
    regs.forEach(function(r){if(!r.poli_id)return;if(!groups[r.poli_id])groups[r.poli_id]=[];groups[r.poli_id].push(r);});
    var html = '';
    for (var pid in groups) {
        var pr = parseInt(pid);
        var name = poliMap[pr]||'Poli #'+pr;
        var list = groups[pid];
        var waiting = list.filter(function(r){return r.status==='Menunggu';}).length;
        html += '<div class="card" style="margin-bottom:16px"><div class="ch"><div class="ct">'+name+'</div><div style="display:flex;gap:10px;align-items:center"><span class="chip chip-warning">'+waiting+' menunggu</span></div></div><div style="padding:6px">';
        list.forEach(function(r){
            var pat = pMap[r.patient_id];
            var isProses = r.status==='Proses';
            html += '<div class="pc" onclick="loadEMR(\''+r.id+'\')" style="'+ (isProses?'border-left:3px solid var(--primary-500);background:var(--primary-50);':'') +'"><div class="p-av">' + ((pat?pat.nama:'--').charAt(0)||'?') + '</div><div><div class="p-name">' + (pat?pat.nama:'—') + '</div><div class="p-meta">' + (r.no_antrian||'—') + ' • ' + (r.penjamin||'—') + (pat?' • '+pat.no_rm:'') + '</div></div><span class="b ' + (isProses?'bp':'bw') + '" style="margin-left:auto">' + r.status + '</span></div>';
        });
        html += '</div></div>';
    }
    container.innerHTML = html;
}

async function loadEMR(regId) {
    var { data: reg } = await window.__sb.from('registrations').select('*, patients(*), poli(nama_poli)').eq('id',regId).single();
    if (!reg) return showToast('Data tidak ditemukan','error');
    window._activeRegId = reg.id;
    window._activePatient = reg.patients;
    document.getElementById('rj-emr-patient').innerHTML = '<div class="pasien-header"><div class="pasien-av">'+(reg.patients.nama?.charAt(0)||'?')+'</div><div><div class="pasien-name">'+reg.patients.nama+'</div><div class="pasien-meta">'+reg.patients.no_rm+' • '+(reg.poli?.nama_poli||'')+' • '+(reg.penjamin||'')+'</div></div></div>';
    document.getElementById('rx-pasien-nama').textContent = reg.patients.nama;
    if (!reg.status||reg.status==='Menunggu') {
        await window.__sb.from('registrations').update({status:'Proses'}).eq('id',reg.id);
    }
    loadEMRHistory(reg.patients.id);
    loadEMRVitals(reg.patients.id);
    document.querySelectorAll('#rj-q,#rj-rx').forEach(function(el){if(el)el.style.display='none';});
    var emrTab = document.getElementById('rj-emr');
    if(emrTab) emrTab.style.display='';
    document.querySelectorAll('.tgb').forEach(function(t){t.classList.remove('active');});
}

async function loadEMRHistory(patientId) {
    var { data: history } = await window.__sb.from('registrations').select('*, poli(nama_poli)').eq('patient_id',patientId).order('created_at',{ascending:false}).limit(10);
    var container = document.getElementById('rj-emr-history');
    if(!container) return;
    if(!history||!history.length) { container.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Belum ada riwayat kunjungan</div>'; return; }
    container.innerHTML = '<div class="tl">' + history.map(function(r){
        return '<div class="tl-item"><div class="tl-dot" style="background:'+(r.status==='Selesai'?'var(--success-100)':'var(--warning-100)')+'">'+(r.status==='Selesai'?'✅':'⏳')+'</div><div class="tl-body"><div class="tl-title">'+(r.poli?.nama_poli||'—')+'</div><div class="tl-sub">'+(r.penjamin||'')+' • '+(r.status||'')+'</div><div class="tl-date">'+(r.created_at?new Date(r.created_at).toLocaleDateString('id-ID'):'')+'</div></div></div>';
    }).join('') + '</div>';
}

function loadEMRVitals(patientId) {
    // Placeholder for vitals — from latest EMR record
    document.getElementById('vit-bb').value = '';
    document.getElementById('vit-tb').value = '';
}

function swSub(el, tabId) {
    document.querySelectorAll('#rj-emr .tab').forEach(function(t){t.classList.remove('active');});
    if(el) el.classList.add('active');
    document.querySelectorAll('#rj-emr .tab-content').forEach(function(tc){if(tc)tc.style.display='none';});
    var target = document.getElementById(tabId);
    if(target) target.style.display='block';
}

async function simpanEMR(mode) {
    var regId = window._activeRegId;
    if(!regId) return showToast('Pilih pasien dulu dari antrian','warning');
    var data = {
        registration_id: regId, mode: mode,
        keluhan: document.getElementById('emr-keluhan')?.value||'',
        rps: document.getElementById('emr-rps')?.value||'',
        rpd: document.getElementById('emr-rpd')?.value||'',
        alergi: document.getElementById('emr-alergi')?.value||'',
        fisik: document.getElementById('emr-fisik')?.value||'',
        khusus: document.getElementById('emr-khusus')?.value||'',
        dx1: document.getElementById('emr-dx1')?.value||'',
        dx2: document.getElementById('emr-dx2')?.value||'',
        asesmen: document.getElementById('emr-asesmen')?.value||'',
        plan: document.getElementById('emr-plan')?.value||''
    };
    var { error } = await window.__sb.from('emr_notes').insert({
        registration_id: regId, mode: mode,
        keluhan: data.keluhan, rps: data.rps, rpd: data.rpd, alergi: data.alergi,
        fisik: data.fisik, khusus: data.khusus,
        dx1: data.dx1, dx2: data.dx2, asesmen: data.asesmen, plan: data.plan,
        created_at: new Date().toISOString()
    });
    if(error) return showToast('Gagal: '+error.message,'error');
    if(mode === 'selesai') {
        await window.__sb.from('registrations').update({status:'Selesai'}).eq('id',regId);
        showToast('Rekam medis selesai & tersimpan!','success');
        logActivity('EMR Selesai','Pasien',window._activePatient?.nama||'','Rekam medis selesai');
    } else {
        showToast('Draft EMR tersimpan!','success');
    }
    loadRawatJalan();
}

function lanjutResep() {
    document.querySelectorAll('.tgb').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('#rj-q,#rj-emr').forEach(function(el){if(el)el.style.display='none';});
    var rxTab = document.getElementById('rj-rx');
    if(rxTab) rxTab.style.display='';
    loadMedicines();
}

function printKontrol() {
    var pt = window._activePatient;
    if(!pt) return showToast('Pilih pasien dulu','warning');
    var w = window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Surat Kontrol</title><style>body{font-family:sans-serif;padding:32px}table{width:100%}td{padding:6px}</style></head><body><h2 style="text-align:center">SURAT KONTROL</h2><hr><p><strong>'+pt.nama+'</strong> ('+pt.no_rm+')</p><p>Kontrol kembali: '+document.getElementById('emr-kontrol')?.value||'—'+'</p><br><p>Dokter, _________________________</p></body></html>');
    w.document.close();
    if(!w) return showToast('Izinkan popup untuk mencetak');
    setTimeout(function(){w.print();},500);
}

// ─── RESEP ───
window._rxItems = [];

async function loadMedicines() {
    var { data } = await window.__sb.from('medicines').select('*').limit(50);
    var list = data||[];
    var container = document.getElementById('rx-obat-list');
    if(!container) return;
    container.innerHTML = list.map(function(m){
        var stokClass = m.stok <= (m.stok_minimum||0) ? 'var(--danger-500)' : 'var(--success-500)';
        return '<div class="di"><div class="d-icon">💊</div><div><div class="d-name">'+m.nama_obat+'</div><div class="d-det">'+m.kategori+' • Rp '+Number(m.harga_satuan||0).toLocaleString()+'/'+m.satuan+'</div></div><div class="d-stock"><div class="d-qty" style="color:'+stokClass+'">'+(m.stok||0)+'</div><div class="d-unit">'+m.satuan+'</div></div><button class="btn btn-p btn-xs" onclick="tambahObat(\''+m.id+'\',\''+m.nama_obat.replace(/'/g,"\\'")+'\','+(m.harga_satuan||0)+',\''+m.satuan+'\')">+ Tambah</button></div>';
    }).join('');
}

function tambahObat(id, nama, harga, satuan) {
    if(!id && nama && !harga && !satuan) {
        var existing = window._rxItems.find(function(i){return i.nama===nama;});
        if(existing) { existing.jumlah = (existing.jumlah||1)+1; renderRx(); return; }
        window._rxItems.push({id:null,nama:nama,jumlah:1,dosis:'',frek:'',ket:'',harga:0,satuan:'tab'});
        renderRx(); hitungTotal(); return;
    }
    var rx = window._rxItems.find(function(i){return i.id===id;});
    if(rx) { rx.jumlah = (rx.jumlah||1)+1; renderRx(); hitungTotal(); return; }
    window._rxItems.push({id:id,nama:nama,jumlah:1,dosis:'',frek:'',harga:harga||0,satuan:satuan||'tab'});
    renderRx(); hitungTotal();
}

function renderRx() {
    var tbody = document.getElementById('rx-tbody');
    if(!tbody) return;
    tbody.innerHTML = window._rxItems.map(function(item,i){
        return '<tr><td>'+item.nama+'</td><td><input class="fc" style="padding:4px 6px;min-height:auto" value="'+(item.dosis||'')+'" onchange="updateRx('+i+',\'dosis\',this.value)"></td><td><input class="fc" style="padding:4px 6px;min-height:auto;width:60px" value="'+(item.frek||'')+'" onchange="updateRx('+i+',\'frek\',this.value)"></td><td><input class="fc" style="padding:4px 6px;min-height:auto;width:60px" type="number" value="'+(item.jumlah||1)+'" onchange="updateRx('+i+',\'jumlah\',this.value)"></td><td><input class="fc" style="padding:4px 6px;min-height:auto" value="'+(item.ket||'')+'" onchange="updateRx('+i+',\'ket\',this.value)"></td><td><button class="btn btn-d btn-xs" onclick="hapusRx('+i+')">✕</button></td></tr>';
    }).join('');
}

function updateRx(idx, field, val) {
    if(window._rxItems[idx]) window._rxItems[idx][field] = val;
    hitungTotal();
}

function hapusRx(idx) {
    window._rxItems.splice(idx,1);
    renderRx(); hitungTotal();
}

function hitungTotal() {
    var sub = window._rxItems.reduce(function(s,i){return s+((i.harga||0)*(i.jumlah||1));},0);
    document.getElementById('rx-subtotal').textContent = formatRupiah(sub);
    document.getElementById('rx-total').textContent = formatRupiah(sub + 5000);
}

async function kirimFarmasi() {
    var regId = window._activeRegId;
    var pt = window._activePatient;
    if(!regId||!pt) return showToast('Pilih pasien dulu dari EMR','warning');
    var items = window._rxItems||[];
    if(!items.length) return showToast('Belum ada obat di resep','warning');
    var noResep = 'RX-'+Date.now().toString(36).toUpperCase();
    var { data: presc, error: pe } = await window.__sb.from('prescriptions').insert({
        no_resep: noResep, patient_id: pt.id, registration_id: regId, unit: 'RJ', status: 'Menunggu Farmasi', created_at: new Date().toISOString()
    }).select().single();
    if(pe) return showToast('Gagal buat resep: '+pe.message,'error');
    var pItems = items.map(function(item){return {prescription_id:presc.id, medicine_id:item.id, jumlah:item.jumlah||1, dosis:item.dosis||'', harga:item.harga||0, subtotal:(item.harga||0)*(item.jumlah||1)};});
    var { error: ie } = await window.__sb.from('prescription_items').insert(pItems);
    if(ie) return showToast('Gagal simpan item: '+ie.message,'error');
    for(var si=0; si<items.length; si++) {
        var it = items[si];
        if(!it.id) continue;
        var ob = await window.__sb.from('medicines').select('stok,nama_obat').eq('id',it.id).single();
        if(ob.data && (ob.data.stok||0) < (it.jumlah||1)) { showToast('Stok '+ob.data.nama_obat+' tidak cukup','warning'); continue; }
        if(ob.data) await window.__sb.from('medicines').update({stok:(ob.data.stok||0)-(it.jumlah||1)}).eq('id',it.id);
    }
    logActivity('Kirim Resep','Resep',noResep,'Resep untuk ' + pt.nama);
    window._rxItems = []; document.getElementById('rx-tbody').innerHTML = ''; hitungTotal();
    showToast('✅ Resep terkirim ke Farmasi! Stok dikurangi otomatis.','success');
}

function cetakResep() {
    var pt = window._activePatient;
    if(!pt) return showToast('Pilih pasien dulu','warning');
    var items = window._rxItems||[];
    if(!items.length) return showToast('Belum ada obat','warning');
    var rows = items.map(function(item,i){return '<tr><td>'+(i+1)+'.</td><td><strong>'+item.nama+'</strong></td><td>'+(item.dosis||'—')+'</td><td>'+(item.frek||'—')+'</td><td>'+(item.jumlah||1)+' '+(item.satuan||'')+'</td><td>'+(item.ket||'—')+'</td></tr>';}).join('');
    var tgl = new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    var noResep = 'RX-'+Date.now().toString(36).toUpperCase();
    var w = window.open('','_blank');
    w.document.write('<!DOCTYPE html><html><head><title>Resep - '+noResep+'</title><style>'+
        '@page{margin:20mm 15mm}*{margin:0;padding:0;box-sizing:border-box}'+
        'body{font-family:"Courier New",monospace;font-size:12px;padding:20px;color:#000}'+
        '.hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:12px}'+
        '.rsn{font-size:16px;font-weight:700}.rsa{font-size:10px;color:#444}'+
        '.info{display:flex;justify-content:space-between;margin:12px 0;font-size:11px}'+
        '.r{font-size:18px;font-weight:700;margin:16px 0 8px}'+
        '.f{display:flex;justify-content:space-between;margin-top:40px;font-size:11px}'+
        '.fc{text-align:center;min-width:140px}.fl{border-top:1px solid #000;margin-top:32px;padding-top:4px}'+
        '</style></head><body>'+
        '<div class="hdr"><div class="rsn">EDOY HOSPITAL MANAGEMENT</div>'+
        '<div class="rsa">Jl. Raya Cilegon KM 8, Serang, Banten</div></div>'+
        '<div class="info"><span><b>Pasien:</b> '+pt.nama+' ('+pt.no_rm+')</span><span><b>Tgl:</b> '+tgl+'</span><span><b>No:</b> '+noResep+'</span></div>'+
        '<hr style="border:none;border-top:1px dashed #000">'+
        '<div class="r">R/<div style="border-bottom:1px solid #000;flex:1;margin:0 0 4px 12px"></div></div>'+
        '<table style="width:100%">'+
        items.map(function(item,i){
            var signa = (item.dosis||'')+(item.dosis&&item.frek?' x ':'')+(item.frek||'');
            return '<tr><td style="padding:5px 0;vertical-align:top;width:24px;font-weight:700">'+(i+1)+'.</td>'+
                '<td style="padding:5px 0"><b>'+item.nama+'</b>'+(item.jumlah>1?' (x'+item.jumlah+')':'')+'<br>'+
                '<span style="font-size:11px;color:#444">'+(signa||'—')+'</span></td>'+
                '<td style="padding:5px 0;text-align:right;font-weight:700;white-space:nowrap">'+(item.jumlah||1)+' '+(item.satuan||'')+'</td>'+
                '<td style="padding:5px 0;padding-left:12px;color:#444;font-size:11px">'+(item.ket?'('+item.ket+')':'')+'</td></tr>';
        }).join('')+
        '</table><hr style="border:none;border-top:1px dashed #000;margin:12px 0">'+
        '<p style="font-size:10px;color:#444">Resep untuk pasien bersangkutan.</p>'+
        '<div class="f"><div class="fc">Dokter,<div class="fl">('+(window.medicoreUser?.nama||'________________')+')</div></div>'+
        '<div class="fc">Paraf,<div class="fl"></div></div>'+
        '<div class="fc">Stempel,<div class="fl"></div></div></div>'+
        '</body></html>');
    w.document.close();
    logActivity('Cetak Resep','Resep',noResep,'Resep untuk '+pt.nama);
    setTimeout(function(){w.print();},500);
}

async function panggilPasien(regId) {
    if(!regId) return showToast('Tidak ada pasien yang bisa dipanggil','warning');
    var { error } = await window.__sb.from('registrations').update({status:'calling'}).eq('id',regId);
    if(error) return showToast('Gagal: '+error.message,'error');
    showToast('Pasien dipanggil.','success');
    loadRawatJalan();
}
