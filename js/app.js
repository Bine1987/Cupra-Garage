const PURCHASE_KM = 41100;
const els = {
  fuelForm: document.getElementById('fuelForm'), fuelModule: document.getElementById('fuelModule'), fuelList: document.getElementById('fuelList'),
  openFuelForm: document.getElementById('openFuelForm'), closeFuelForm: document.getElementById('closeFuelForm'), syncStatus: document.getElementById('syncStatus'),
  heroUpload: document.getElementById('heroUpload'), uploadHero: document.getElementById('uploadHero'), heroBg: document.getElementById('heroBg'),
  statKm: document.getElementById('statKm'), statConsumption: document.getElementById('statConsumption'), statCosts: document.getElementById('statCosts')
};
const fmt = new Intl.NumberFormat('sl-SI');
const money = new Intl.NumberFormat('sl-SI',{style:'currency',currency:'EUR'});
let fuels = JSON.parse(localStorage.getItem('cupra.fuels') || '[]');
function save(){ localStorage.setItem('cupra.fuels', JSON.stringify(fuels)); }
function render(){
  const sorted = [...fuels].sort((a,b)=>Number(b.km)-Number(a.km));
  const lastKm = sorted[0]?.km || PURCHASE_KM;
  const total = fuels.reduce((s,x)=>s+Number(x.total||0),0);
  els.statKm.textContent = fmt.format(lastKm);
  els.statCosts.textContent = money.format(total);
  const computable = sorted.filter(x=>x.consumption);
  if(computable.length){ els.statConsumption.textContent = (computable.reduce((s,x)=>s+x.consumption,0)/computable.length).toFixed(1).replace('.',','); }
  if(!fuels.length){ els.fuelList.className='list empty'; els.fuelList.textContent='Ni še pravih tankanj. Dodaj prvo tankanje po nakupu.'; return; }
  els.fuelList.className='list';
  els.fuelList.innerHTML = sorted.slice(0,5).map(x=>`<div class="fuel-entry"><div><strong>${x.date}</strong><span>${x.fuel} · ${x.station||'črpalka ni vpisana'}</span></div><div><strong>${fmt.format(x.km)} km</strong><span>${Number(x.liters).toFixed(2).replace('.',',')} L</span></div><div><strong>${money.format(x.total)}</strong><span>${x.consumption ? x.consumption.toFixed(1).replace('.',',')+' l/100 km' : '—'}</span></div></div>`).join('');
}
function openFuel(){ els.fuelModule.classList.remove('hidden'); els.fuelModule.scrollIntoView({behavior:'smooth',block:'start'}); }
function closeFuel(){ els.fuelModule.classList.add('hidden'); }
els.openFuelForm.addEventListener('click', openFuel); els.closeFuelForm.addEventListener('click', closeFuel);
document.querySelectorAll('[data-view="fuel"]').forEach(b=>b.addEventListener('click', openFuel));
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(btn.dataset.view==='fuel')openFuel();}));
els.fuelForm.addEventListener('submit', async (e)=>{
  e.preventDefault(); const fd = new FormData(e.target); const km=Number(fd.get('km')), liters=Number(fd.get('liters')), total=Number(fd.get('total'));
  const previousKm = fuels.length ? Math.max(...fuels.map(x=>Number(x.km))) : PURCHASE_KM;
  const distance = km - previousKm;
  const entry = {date:fd.get('date'), km, liters, total, pricePerLiter: liters ? +(total/liters).toFixed(3):0, fuel:fd.get('fuel'), station:fd.get('station'), note:fd.get('note'), consumption: distance>0 ? +(liters/distance*100).toFixed(2) : null};
  fuels.push(entry); save(); render(); els.syncStatus.textContent='Pošiljam v Google Sheet...';
  try{ await window.CupraApi.appendFuel(entry); els.syncStatus.textContent='Shranjeno lokalno in poslano v Google Sheet.'; e.target.reset(); }
  catch(err){ els.syncStatus.textContent='Shranjeno lokalno, Google Sheet trenutno ni dosegljiv.'; console.error(err); }
});
els.uploadHero.addEventListener('click',()=>els.heroUpload.click());
els.heroUpload.addEventListener('change',(e)=>{const file=e.target.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{localStorage.setItem('cupra.hero',reader.result); els.heroBg.style.backgroundImage=`url(${reader.result})`;}; reader.readAsDataURL(file);});
const savedHero = localStorage.getItem('cupra.hero'); if(savedHero) els.heroBg.style.backgroundImage=`url(${savedHero})`; render();
if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }
