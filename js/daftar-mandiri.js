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

// PILIH PENJAMIN
function pilihPenjamin(p){
  state.penjamin=p;
  document.getElementById('show-penjamin').textContent=p;
  document.getElementById('konf-penjamin').textContent=p;
  document.getElementById('ticket-penjamin').textContent=p;
  goScreen(2);
}

// PILIH TIPE PENCARIAN
function pilihTipe(btn,tipe){
  document.querySelectorAll('.stype-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.tipe=tipe;
  document.getElementById('input-label').textContent='Masukkan '+tipe;
  document.getElementById('search-input').value='';
  document.getElementById('search-input').placeholder='Ketik '+tipe+' disini...';
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
function cariPasien(){
  const val=document.getElementById('search-input').value.trim();
  if(!val){alert('Harap masukkan '+state.tipe+' terlebih dahulu');return;}
  
  // Mock finding a patient for prototype
  state.name = (val === '123' || val === '009001461') ? 'Rumiah Ny' : 'Pasien Baru (' + val + ')';
  
  // Update UI Displays
  if(document.getElementById('show-name')) document.getElementById('show-name').textContent = state.name;
  if(document.getElementById('show-rm')) document.getElementById('show-rm').textContent = (state.tipe === 'No. RM' ? val : '009' + Math.floor(Math.random()*900000+100000));
  if(document.getElementById('show-nik')) document.getElementById('show-nik').textContent = (state.tipe === 'NIK' ? val : '3602' + Math.floor(Math.random()*900000000000));
  
  if(document.getElementById('konf-name')) document.getElementById('konf-name').textContent = state.name;
  if(document.getElementById('ticket-name')) document.getElementById('ticket-name').textContent = state.name;
  
  goScreen(3);
}

// PILIH POLI
function pilihPoli(btn,poli){
  document.querySelectorAll('.poli-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  state.poli=poli;
  document.getElementById('konf-poli').textContent=poli;
  document.getElementById('ticket-poli').textContent='Poli '+poli;
  // Load dokter sesuai poli
  loadDokter(poli);
  goScreen(5);
}

// LOAD DOKTER PER POLI
const dokterData={
  'Jantung':[{nama:'Dr. Taka Mehi, Sp.JP, FIHA',jadwal:'Siang 13:00 – 15:00',no:'32860'}],
  'Kandungan':[{nama:'Dr. Budi Hartono, Sp.OG',jadwal:'Pagi 09:00 – 13:00',no:'32861'},{nama:'Dr. Zainuri Miltas, Sp.OG',jadwal:'Siang 14:00 – 17:00',no:'32862'}],
  'Penyakit Dalam':[{nama:'Dr. Siti Rahmawati, Sp.PD',jadwal:'Pagi 08:00 – 12:00',no:'32863'}],
  'Bedah Umum':[{nama:'Dr. Ahmad Yani, Sp.B',jadwal:'Pagi 10:00 – 14:00',no:'32864'}],
  'Anak':[{nama:'Dr. Sitoresmi Prabaningrum, Sp.A',jadwal:'Pagi 08:00 – 11:00',no:'32865'}],
  'default':[{nama:'Dr. Umum Jaga',jadwal:'08:00 – 14:00',no:'32866'}]
};

function loadDokter(poli){
  const list=dokterData[poli]||dokterData['default'];
  const container=document.getElementById('dokter-list');
  document.getElementById('poli-label').textContent='Poli '+poli;
  container.innerHTML='';
  list.forEach(d=>{
    const div=document.createElement('div');
    div.className='dokter-item';
    div.innerHTML=`<div class="dokter-avatar">👨‍⚕️</div><div><div class="dokter-name">${d.nama}</div><div class="dokter-spesialis">Poli ${poli}</div><div class="dokter-jadwal">⏰ ${d.jadwal}</div></div><div class="dokter-arrow">›</div>`;
    div.onclick=()=>pilihDokter(d.nama,d.jadwal,d.no);
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
function daftar(){
  const antrian='T-'+Math.floor(Math.random()*20+45);
  const booking=Math.floor(Math.random()*90000+10000)+'T'+Math.floor(Math.random()*90000+10000);
  const reg=974000+Math.floor(Math.random()*999);
  
  // Create patient object
  const newPatient = {
      id: '009' + Math.floor(Math.random()*900000+100000),
      name: state.name || 'Pasien Baru', 
      age: '64th',
      poli: state.poli,
      penjamin: state.penjamin,
      status: 'Menunggu',
      date: new Date().toISOString().split('T')[0],
      tipe_daftar: 'Mandiri'
  };

  // Save to SharedState
  SharedState.addPatient(newPatient);
  
  // Update Queue in SharedState
  const queues = SharedState.getQueues();
  // Find relevant queue (e.g. Loket 1 if Umum)
  if (state.penjamin === 'UMUM') {
      SharedState.updateQueue('qa1', { current: antrian });
  } else if (state.penjamin === 'BPJS') {
      SharedState.updateQueue('qa2', { current: antrian });
  }

  document.getElementById('ticket-antrian').textContent=antrian;
  document.getElementById('ticket-booking').textContent=booking;
  document.getElementById('ticket-reg').textContent=reg;
  goScreen(7);
}
