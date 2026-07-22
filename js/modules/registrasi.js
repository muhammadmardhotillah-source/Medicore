/**
 * modules/registrasi.js — Pendaftaran & Rawat Jalan
 */

async function loadPendaftaran() {
    const { data: regs } = await window.__sb
        .from('registrations')
        .select('*, patients(no_rm, nama, tgl_lahir), poli(nama_poli)')
        .order('created_at', { ascending: false });

    if (!regs) return;
    const tbody = document.getElementById('pendaftaran-tbody');
    if (!tbody) return;

    const total = regs.length;
    const menunggu = regs.filter(r => r.status === 'Menunggu').length;
    const proses = regs.filter(r => r.status === 'Proses').length;
    const selesai = regs.filter(r => r.status === 'Selesai').length;

    document.getElementById('stat-kunjungan-total').textContent = total;
    document.getElementById('stat-kunjungan-menunggu').textContent = menunggu;
    document.getElementById('stat-kunjungan-proses').textContent = proses;
    document.getElementById('stat-kunjungan-selesai').textContent = selesai;
    document.getElementById('stat-kunjungan-count').textContent = total + ' kunjungan';

    tbody.innerHTML = '';
    regs.forEach(function(r) {
        var usia = r.patients?.tgl_lahir ? Math.floor((new Date() - new Date(r.patients.tgl_lahir)) / 31557600000) + 'th' : '—';
        var statusClass = r.status === 'Selesai' ? 'bs' : r.status === 'Proses' ? 'bp' : 'bw';
        tbody.innerHTML += '<tr><td class="mono">REG-' + r.id.slice(0,6).toUpperCase() + '</td><td class="mono">' + (r.patients?.no_rm || '—') + '</td><td>' + (r.patients?.nama || '—') + '</td><td>' + usia + '</td><td>' + (r.poli?.nama_poli || '—') + '</td><td>—</td><td>' + (r.penjamin || '—') + '</td><td class="mono">' + (r.no_antrian || '—') + '</td><td><span class="b ' + statusClass + '">' + r.status + '</span></td><td><button class="btn btn-o btn-xs" onclick="showPendaftaranDetail(\'' + r.id + '\')">Detail</button></td></tr>';
    });
    document.getElementById('stat-kunjungan-count').textContent = total + ' kunjungan';
}

async function showPendaftaranDetail(regId) {
    var { data: r } = await window.__sb.from('registrations').select('*, patients(no_rm,nama,nik,jk,tgl_lahir,alamat,no_hp), poli(nama_poli)').eq('id',regId).single();
    if (!r) return showToast('Data tidak ditemukan','error');
    document.getElementById('dtl-title').textContent = '📋 Detail Registrasi';
    document.getElementById('dtl-body').innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">' +
        '<div><strong>No. RM</strong><br><span class="mono">' + (r.patients?.no_rm||'—') + '</span></div>' +
        '<div><strong>Nama</strong><br>' + (r.patients?.nama||'—') + '</div>' +
        '<div><strong>No. Antrian</strong><br><span class="mono">' + (r.no_antrian||'—') + '</span></div>' +
        '<div><strong>Poli</strong><br>' + (r.poli?.nama_poli||'—') + '</div>' +
        '<div><strong>Penjamin</strong><br>' + (r.penjamin||'—') + '</div>' +
        '<div><strong>Status</strong><br><span class="b ' + (r.status==='Selesai'?'bs':'bw') + '">' + r.status + '</span></div>' +
        '</div>';
    showM('mdl-detail');
}

async function searchPatient() {
    var nama = document.getElementById('reg-name').value.trim();
    if (!nama) return showToast('Masukkan nama pasien');
    var { data } = await window.__sb.from('patients').select('id, no_rm, nama').ilike('nama', '%' + nama + '%').limit(5);
    var resultDiv = document.getElementById('search-result');
    if (!data || data.length === 0) { resultDiv.style.display = 'none'; return showToast('Pasien tidak ditemukan.'); }
    resultDiv.style.display = 'block';
    document.getElementById('res-name').textContent = data[0].nama;
    document.getElementById('res-rm').textContent = data[0].no_rm;
    window._regPatientId = data[0].id;
    window._regPatientRM = data[0].no_rm;
}

function swTabDaftar(mode) {
    document.getElementById('daftar-tab-baru').style.display = mode === 'baru' ? 'block' : 'none';
    document.getElementById('daftar-tab-cari').style.display = mode === 'cari' ? 'block' : 'none';
    document.getElementById('tg-daftar-baru').className = 'tgb' + (mode === 'baru' ? ' active' : '');
    document.getElementById('tg-daftar-cari').className = 'tgb' + (mode === 'cari' ? ' active' : '');
    window._regPatientId = null; window._regPatientRM = null;
}

async function submitRegistration() {
    var penjamin = window.selectedPenjamin || 'Umum';
    var poliId = document.getElementById('reg-poli')?.value;
    var dokterId = document.getElementById('reg-dokter')?.value;
    var mode = document.getElementById('daftar-tab-baru')?.style.display !== 'none' ? 'baru' : 'cari';
    if (mode === 'baru') {
        if (!validateForm({ 'reg-nama':{required:true,message:'Nama wajib diisi'}, 'reg-poli':{required:true,message:'Pilih poli'} })) return;
    } else {
        if (!validateField('reg-name',{required:true,message:'Cari pasien'})) return;
        if (!window._regPatientId) return showToast('Pilih pasien dari hasil pencarian','warning');
    }
    var patientId = window._regPatientId;
    if (mode === 'baru') {
        var nama = document.getElementById('reg-nama').value.trim();
        if (!nama) return showToast('Nama pasien wajib diisi!');
        var nik = document.getElementById('reg-nik').value.trim();
        var jk = document.getElementById('reg-jk').value;
        var tglLahir = document.getElementById('reg-tgl-lahir').value;
        var alamat = document.getElementById('reg-alamat').value.trim();
        var hp = document.getElementById('reg-hp').value.trim();
        if (nik.length > 0 && nik.length !== 16) { showToast('NIK harus 16 digit','warning'); return; }
        var dup = null;
        if (nik) { var r = await window.__sb.from('patients').select('id,no_rm,nama').eq('nik',nik).limit(1); if(r.data&&r.data.length>0) dup=r.data[0]; }
        if (!dup && nama && tglLahir) { var r2 = await window.__sb.from('patients').select('id,no_rm,nama').eq('nama',nama).eq('tgl_lahir',tglLahir).limit(1); if(r2.data&&r2.data.length>0) dup=r2.data[0]; }
        if (dup && !confirm('Data mirip ditemukan: ' + dup.nama + ' (' + dup.no_rm + ')\nTetap daftarkan baru?')) return;
        if (!patientId) {
            var c = await window.__sb.from('patients').select('id',{count:'exact',head:true});
            var noRm = '009' + String((c.count||0)+1).padStart(6,'0');
            txBegin();
            var np = await window.__sb.from('patients').insert({no_rm:noRm,nama:nama,nik:nik||null,jk:jk||null,tgl_lahir:tglLahir||null,alamat:alamat||null,no_hp:hp||null}).select().single();
            if (np.error) { txRollback(); return showToast('Gagal: '+np.error.message); }
            patientId = np.data.id; window._regPatientRM = np.data.no_rm;
        }
    } else {
        if (!patientId) return showToast('Cari pasien terlebih dahulu!');
    }
    var hariIni = new Date().toISOString().slice(0,10);
    var cnt = await window.__sb.from('registrations').select('id',{count:'exact',head:true}).gte('created_at',hariIni);
    var noUrut = (cnt.count||0)+1;
    var prefix = poliId === '8' ? 'T' : 'A';
    var noAntrian = prefix + '-' + String(noUrut).padStart(2,'0');
    var { error } = await window.__sb.from('registrations').insert({
        patient_id: patientId, poli_id: parseInt(poliId), penjamin: penjamin, status: 'Menunggu', no_antrian: noAntrian
    });
    if (error) { txRollback(); return showToast('Gagal: '+error.message); }
    logActivity('Registrasi','Pasien',window._regPatientRM||'','Pasien terdaftar No.Antrian: '+noAntrian);
    hideM('mdl-daftar');
    showToast('✅ Berhasil! Pasien terdaftar. No. Antrian: ' + noAntrian);
    loadPendaftaran();
}
