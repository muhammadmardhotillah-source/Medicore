// CLOCK
function tick(){
  const n=new Date();
  document.getElementById('htime').textContent=n.toLocaleTimeString('id-ID');
  document.getElementById('hdate').textContent=n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('ticket-tgl').textContent=n.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
}
tick();setInterval(tick,1000);

// STATE
let state={penjamin:'',tipe:'NIK',poli:'',dokter:'',jadwal:'',name:''};

// STEPS
function updateSteps(active){
  for(let i=1;i<=6;i++){
    const num=document.getElementById('sn'+i);
    const lbl=document.getElementById('sl'+i);
    if(i<active){num.className='step-num done';lbl.className='step-label';}
    else if(i===active){num.className='step-num active';lbl.className='step-label active';}
    else{num.className='step-num';lbl.className='step-label';}
  }
  for(let i=1;i<=5;i++){
    const line=document.getElementById('sl'+i+(i+1));
    if(line)line.className='step-line'+(i<active?' done':'');
  }
}

// NAVIGATE
function goScreen(n){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+n).classList.add('active');
  const stepMap={1:1,2:2,3:2,4:3,5:4,6:5,7:6};
  updateSteps(stepMap[n]||n);
  window.scrollTo({top:0,behavior:'smooth'});
}

// --- INISIALISASI HALAMAN ---
document.addEventListener('DOMContentLoaded', () => {
    loadPoli();
});

// PILIH PENJAMIN
function pilihPenjamin(p){
  state.penjamin=p;
  // Pastikan elemen ID berikut ada di HTML
  const elShow = document.getElementById('show-penjamin');
  const elKonf = document.getElementById('konf-penjamin');
  const elTicket = document.getElementById('ticket-penjamin');
  
  if(elShow) elShow.textContent=p;
  if(elKonf) elKonf.textContent=p;
  if(elTicket) elTicket.textContent=p;
  
  goScreen(2);
}

// PILIH TIPE PENCARIAN
function pilihTipe(btn,tipe){
  // Hapus class active dari semua tombol tipe
  document.querySelectorAll('.stype-btn').forEach(b=>b.classList.remove('active'));
  // Tambahkan class active ke tombol yang diklik
  btn.classList.add('active');
  
  state.tipe=tipe;
  const label = document.getElementById('input-label');
  const input = document.getElementById('search-input');
  
  if(label) label.textContent='Masukkan '+tipe;
  if(input) {
      input.value='';
      input.placeholder='Ketik '+tipe+' disini...';
  }
}

// NUMPAD
function addNum(n){
  const inp=document.getElementById('search-input');
  inp.value+=n;
}
function delNum(){
  const inp=document.getElementById('search-input');
  inp.value=inp.value.slice(0,-1);
}

// CARI PASIEN
async function cariPasien(){
  const val=document.getElementById('search-input').value.trim();
  if(!val){alert('Harap masukkan '+state.tipe+' terlebih dahulu');return;}
  
  // Cari di Supabase via SharedState
  // Kita asumsikan SharedState punya fungsi findPatient
  try {
      const patient = await SharedState.findPatient(state.tipe, val);
      if (patient) {
          state.name = patient.nama;
          state.patientId = patient.id;
        
          // Update UI
          if(document.getElementById('show-name')) document.getElementById('show-name').textContent = state.name;
          if(document.getElementById('show-rm')) document.getElementById('show-rm').textContent = patient.no_rm;
          if(document.getElementById('show-nik')) document.getElementById('show-nik').textContent = patient.nik;
        
          if(document.getElementById('konf-name')) document.getElementById('konf-name').textContent = state.name;
          if(document.getElementById('ticket-name')) document.getElementById('ticket-name').textContent = state.name;
        
          goScreen(3);
      } else {
          // Pasien tidak ditemukan, tawarkan untuk menambah pasien baru
          const proceed = confirm('Data pasien tidak ditemukan. Tambahkan pasien baru dengan ' + state.tipe + ': ' + val + '?');
          if (proceed) {
              // Pindahkan ke layar pendaftaran untuk input data baru
              goScreen(2); 
              state.isNewPatient = true;
              state.newPatientValue = val;
        
              // Tampilkan modal tambah pasien baru
              const modal = document.getElementById('mdl-tambah-pasien');
              if (modal) {
                  modal.style.display = 'flex';
                  document.getElementById('new-id').value = val;
              }
          } else {
              document.getElementById('search-input').value = '';
          }
      }
      } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat mencari data.');
      }
}

// LOAD POLI DARI SUPABASE
function loadPoli() {
    const polis = SharedState.getPoli();
    const container = document.querySelector('.poli-grid');
    container.innerHTML = '';
    polis.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'poli-btn';
        btn.textContent = p.nama_poli;
        btn.onclick = () => pilihPoli(btn, p.id, p.nama_poli);
        container.appendChild(btn);
    });
}

// PILIH POLI
function pilihPoli(btn, poliId, poliNama) {
    document.querySelectorAll('.poli-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    state.poli = poliNama;
    state.poliId = poliId;
    document.getElementById('konf-poli').textContent = poliNama;
    document.getElementById('ticket-poli').textContent = 'Poli ' + poliNama;
    // Load dokter sesuai poli dari Supabase
    loadDokter(poliId, poliNama);
    goScreen(5);
}

// LOAD DOKTER PER POLI DARI SUPABASE
function loadDokter(poliId, poliNama) {
    const list = SharedState.getDoctorsByPoli(poliId);
    const container = document.getElementById('dokter-list');
    document.getElementById('poli-label').textContent = 'Poli ' + poliNama;
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6">Belum ada dokter tersedia.</div>';
        return;
    }

    list.forEach(d=>{
        const div = document.createElement('div');
        div.className = 'dokter-item';
        div.innerHTML = `<div class="dokter-avatar">👨‍⚕️</div><div><div class="dokter-name">${d.nama_dokter}</div><div class="dokter-spesialis">Poli ${poliNama}</div><div class="dokter-jadwal">⏰ ${d.jadwal_praktik}</div></div><div class="dokter-arrow">›</div>`;
        div.onclick = () => pilihDokter(d.nama_dokter, d.jadwal_praktik, d.id);
        container.appendChild(div);
    });
}

// PILIH DOKTER
function pilihDokter(nama,jadwal,no){
  state.dokter=nama;
  state.jadwal=jadwal;
  document.getElementById('konf-dokter').textContent=nama;
  document.getElementById('konf-jadwal').textContent=jadwal;
  document.getElementById('konf-nojadwal').textContent=no;
  document.getElementById('ticket-jadwal').textContent=jadwal;
  document.getElementById('ticket-poli').textContent='Poli '+state.poli+' — '+nama;
  goScreen(6);
}

// DAFTAR
async function daftar(){
  // Pastikan kita menggunakan data dari state yang sudah terverifikasi dari DB
  const antrian = 'T-' + Math.floor(Math.random() * 20 + 45);
  const booking = Math.floor(Math.random() * 90000 + 10000) + 'T' + Math.floor(Math.random() * 90000 + 10000);
  
  const registration = {
      patient_id: state.patientId,
      poli_id: state.poliId,
      penjamin: state.penjamin,
      status: 'Menunggu',
      no_antrian: antrian,
      created_at: new Date().toISOString()
  };

  // Kirim ke database (registrations)
  try {
      const { data, error } = await sb.from('registrations').insert([registration]);
      
      if (error) throw error;

      // Update tampilan tiket
      document.getElementById('ticket-antrian').textContent = antrian;
      document.getElementById('ticket-booking').textContent = booking;
      document.getElementById('ticket-reg').textContent = data ? data[0].id.substring(0,8) : 'REG-' + Math.floor(Math.random()*9999);
      
      goScreen(7);
  } catch (err) {
      console.error('Error saat mendaftar:', err);
      alert('Gagal menyimpan pendaftaran ke database.');
  }
}

// SIMPAN PASIEN BARU
async function saveNewPatient(e) {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const idVal = document.getElementById('new-id').value;
    const dob = document.getElementById('new-dob').value;
    const jk = document.getElementById('new-jk').value;

    const newPatient = {
        nama: name,
        [state.tipe === 'NIK' ? 'nik' : 'no_rm']: idVal,
        tgl_lahir: dob,
        jk: jk
    };

    try {
        const { data, error } = await sb.from('patients').insert([newPatient]).select().single();
        if (error) throw error;

        state.name = data.nama;
        state.patientId = data.id;
        
        // Update UI
        if(document.getElementById('show-name')) document.getElementById('show-name').textContent = data.nama;
        if(document.getElementById('show-rm')) document.getElementById('show-rm').textContent = data.no_rm || '-';
        if(document.getElementById('show-nik')) document.getElementById('show-nik').textContent = data.nik || '-';
        
        if(document.getElementById('konf-name')) document.getElementById('konf-name').textContent = data.nama;
        if(document.getElementById('ticket-name')) document.getElementById('ticket-name').textContent = data.nama;
        
        hideM('mdl-tambah-pasien');
        goScreen(3);
    } catch (err) {
        console.error(err);
        alert('Gagal menyimpan pasien baru.');
    }
}

// MODAL UTILS
function hideM(id) { document.getElementById(id).style.display = 'none'; }

// FILL KONFIRMASI
function fillConfirmation() {
    goScreen(4);
}
