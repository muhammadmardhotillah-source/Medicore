// CLOCK
function tick(){
  const n=new Date();
  const t=n.toLocaleTimeString('id-ID');
  const d=n.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  ['clk','pd-clk','aq-clk'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=t;});
  ['dt','pd-dt'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=d;});
}
tick();setInterval(tick,1000);

// MODE SWITCH
function setMode(mode){
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  const mk = document.getElementById('mode-kunjungan');
  const mp = document.getElementById('mode-poli');
  const ms = document.getElementById('mode-semua');
  
  if(mk) mk.style.display='none';
  if(mp) mp.classList.remove('active');
  if(ms) ms.classList.remove('active');
  
  if(mode==='kunjungan'){ if(mk) mk.style.display='flex';}
  else if(mode==='poli'){ if(mp) mp.classList.add('active');}
  else if(mode==='semua'){ if(ms) ms.classList.add('active');}
}

// SIMULATE QUEUE UPDATES
const queues={A:47,B:23,C:11,D:5,F:38,K:15};
const loketMap={1:'A',2:'B',3:'C',4:'D',5:'F',6:'K'};

function simulateNext(){
  const loket=Math.floor(Math.random()*6)+1;
  const prefix=loketMap[loket];
  queues[prefix]++;
  
  const ln = document.getElementById('ln'+loket);
  const cn = document.getElementById('call-num');
  const cln = document.getElementById('call-loket-name');
  const pdn = document.getElementById('pd-num');
  const pdt = document.getElementById('pd-tunggu');
  const aqn = document.getElementById('aq-num');

  if(ln) ln.textContent=prefix+'-'+queues[prefix];
  if(cn) cn.textContent=prefix+'-'+queues[prefix];
  if(cln) cln.textContent='Loket '+loket;
  
  document.querySelectorAll('.loket-item').forEach(el=>el.classList.remove('active'));
  const lkt = document.getElementById('loket-'+loket);
  if(lkt) lkt.classList.add('active');
  
  // Update poli display
  if(pdn) pdn.textContent='S-'+queues[prefix];
  if(pdt) pdt.textContent=Math.max(0,Math.floor(Math.random()*15));
  
  // Update all queue display
  if(aqn) aqn.textContent=String(queues[prefix]).padStart(4,'0');
}

// Auto simulate every 8 seconds
setInterval(simulateNext, 8000);
