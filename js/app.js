const START_KM = 41100;
const fuelEntries = JSON.parse(localStorage.getItem('cupraFuel') || '[]');
function fmt(n,dec=1){return Number(n).toLocaleString('sl-SI',{maximumFractionDigits:dec,minimumFractionDigits:dec})}
function saveLocal(){localStorage.setItem('cupraFuel',JSON.stringify(fuelEntries));render();}
function calcConsumption(entry, prevKm){const km=Number(entry.km)-prevKm;return km>0&&Number(entry.liters)>0?(Number(entry.liters)/km*100):null;}
function render(){
  const sorted=[...fuelEntries].sort((a,b)=>Number(a.km)-Number(b.km));
  let prev=START_KM,totalLiters=0,totalCost=0,lastKm=START_KM,cons=[];
  sorted.forEach(e=>{const c=calcConsumption(e,prev); if(c) cons.push(c); prev=Number(e.km); lastKm=Number(e.km)||lastKm; totalLiters+=Number(e.liters)||0; totalCost+=Number(e.total)||0;});
  document.getElementById('statKm').textContent=lastKm.toLocaleString('sl-SI');
  document.getElementById('statCost').textContent=fmt(totalCost,2)+' €';
  document.getElementById('statAvg').textContent=cons.length?fmt(cons.reduce((a,b)=>a+b,0)/cons.length,1):'—';
  const list=document.getElementById('fuelList'); list.innerHTML='';
  [...sorted].reverse().slice(0,5).forEach((e,i)=>{const prevKm=i===sorted.length-1?START_KM:(sorted[sorted.length-2-i]?.km||START_KM); const c=calcConsumption(e,prevKm); const div=document.createElement('div'); div.className='list-item'; div.innerHTML=`<div><b>${e.date}</b><br><small>${e.fuel} • ${Number(e.liters).toFixed(2)} L • ${Number(e.km).toLocaleString('sl-SI')} km</small></div><div><b>${Number(e.total).toFixed(2)} €</b><br><small>${c?fmt(c,1)+' l/100km':'—'}</small></div>`; list.appendChild(div);});
  drawChart(cons.slice(-8));
}
function drawChart(values){const c=document.getElementById('fuelChart'); if(!c)return; const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; for(let i=0;i<5;i++){let y=30+i*48;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(c.width-20,y);ctx.stroke();} if(!values.length){ctx.fillStyle='#aaa';ctx.fillText('Premalo podatkov za graf',50,140);return} const max=Math.max(10,...values)+1,min=Math.min(5,...values)-1; ctx.strokeStyle='#ffb17a';ctx.fillStyle='#ffb17a';ctx.lineWidth=3; values.forEach((v,i)=>{const x=50+i*((c.width-90)/Math.max(1,values.length-1));const y=240-((v-min)/(max-min))*190;if(i===0)ctx.beginPath(),ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();values.forEach((v,i)=>{const x=50+i*((c.width-90)/Math.max(1,values.length-1));const y=240-((v-min)/(max-min))*190;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(fmt(v,1),x-10,y-12);ctx.fillStyle='#ffb17a';});}
document.querySelectorAll('.nav,[data-view-target]').forEach(btn=>btn.addEventListener('click',()=>{const v=btn.dataset.view||btn.dataset.viewTarget; document.querySelectorAll('.view').forEach(x=>x.classList.remove('active')); document.getElementById(v).classList.add('active'); document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));}));
document.getElementById('openFuel').addEventListener('click',()=>document.querySelector('[data-view="fuel"]').click());
document.getElementById('fuelForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);const entry=Object.fromEntries(fd.entries());fuelEntries.push(entry);saveLocal();document.getElementById('saveStatus').textContent='Pošiljam v Google Sheets...';try{await saveToSheet('Tankanja',[entry.date,Number(entry.km),Number(entry.liters),Number(entry.total),Number(entry.total)/Number(entry.liters),entry.fuel,'','','',entry.station||'',entry.note||'']);document.getElementById('saveStatus').textContent='Shranjeno lokalno + poslano v Google Sheets ✅';e.target.reset();}catch(err){document.getElementById('saveStatus').textContent='Shranjeno lokalno, Google Sheets ni uspel ⚠️';}});
render();
