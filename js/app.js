const PURCHASE_KM = 41100;

const els = {
  fuelForm: document.getElementById('fuelForm'),
  fuelModule: document.getElementById('fuelModule'),
  fuelList: document.getElementById('fuelList'),
  openFuelForm: document.getElementById('openFuelForm'),
  closeFuelForm: document.getElementById('closeFuelForm'),
  syncStatus: document.getElementById('syncStatus'),
  heroUpload: document.getElementById('heroUpload'),
  uploadHero: document.getElementById('uploadHero'),
  heroBg: document.getElementById('heroBg'),
  statKm: document.getElementById('statKm'),
  statConsumption: document.getElementById('statConsumption'),
  statCosts: document.getElementById('statCosts')
};

const fmt = new Intl.NumberFormat('sl-SI');
const money = new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' });

let fuels = [];

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.,-]/g, '');

  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFuelEntries(payload) {
  const rawEntries = Array.isArray(payload?.fuel) ? payload.fuel : [];

  return rawEntries
    .map((row) => {
      const km = parseNumber(row.Kilometri ?? row.km);
      const liters = parseNumber(row['Litri (izračun)'] ?? row.liters);
      const total = parseNumber(row['Znesek (€)'] ?? row.total);
      const consumptionValue = row['BC poraba (l/100 km)'] ?? row.consumption ?? '';
      const consumption = consumptionValue === '' ? null : parseNumber(consumptionValue);

      return {
        date: row.Datum || row.date || '',
        km,
        liters,
        total,
        pricePerLiter: liters ? +(total / liters).toFixed(3) : 0,
        fuel: row.Gorivo || row.fuel || '95 RON',
        station: row['Črpalka'] || row.station || '',
        note: row.Opomba || row.note || '',
        consumption
      };
    })
    .filter((entry) => entry.date && entry.km > 0);
}

function save() {
  localStorage.setItem('cupra.fuels', JSON.stringify(fuels));
}

function render() {
  const sorted = [...fuels].sort((a, b) => Number(b.km) - Number(a.km));
  const lastKm = sorted[0]?.km || PURCHASE_KM;
  const total = fuels.reduce((sum, item) => sum + Number(item.total || 0), 0);

  els.statKm.textContent = fmt.format(lastKm);
  els.statCosts.textContent = money.format(total);

  const computable = sorted.filter((item) => item.consumption !== null && item.consumption !== undefined && item.consumption !== '');
  if (computable.length) {
    const avg = computable.reduce((sum, item) => sum + Number(item.consumption), 0) / computable.length;
    els.statConsumption.textContent = avg.toFixed(1).replace('.', ',');
  } else {
    els.statConsumption.textContent = '—';
  }

  if (!fuels.length) {
    els.fuelList.className = 'list empty';
    els.fuelList.textContent = 'Ni še pravih tankanj. Dodaj prvo tankanje po nakupu.';
    return;
  }

  els.fuelList.className = 'list';
  els.fuelList.innerHTML = sorted.slice(0, 5).map((item) => `
    <div class="fuel-entry">
      <div>
        <strong>${item.date}</strong>
        <span>${item.fuel} · ${item.station || 'črpalka ni vpisana'}</span>
      </div>
      <div>
        <strong>${fmt.format(item.km)} km</strong>
        <span>${Number(item.liters).toFixed(2).replace('.', ',')} L · ${money.format(item.total)}</span>
      </div>
      <div>
        <strong>${money.format(item.total)}</strong>
        <span>${item.consumption ? `${item.consumption.toFixed(1).replace('.', ',')} l/100 km` : 'poraba ni znana'}</span>
      </div>
    </div>
  `).join('');
}

function openFuel() {
  els.fuelModule.classList.remove('hidden');
  els.fuelModule.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeFuel() {
  els.fuelModule.classList.add('hidden');
}

async function loadRemoteData() {
  try {
    const response = await fetch(`./data.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const remoteFuels = normalizeFuelEntries(payload);

    if (remoteFuels.length) {
      fuels = remoteFuels;
      save();
      els.syncStatus.textContent = 'Povezava uspešna: podatki so naloženi iz GitHub data.json.';
      render();
      return true;
    }

    throw new Error('Data file is empty.');
  } catch (error) {
    console.warn('Falling back to local storage:', error);

    const cached = localStorage.getItem('cupra.fuels');
    if (cached) {
      try {
        fuels = JSON.parse(cached);
      } catch (localError) {
        console.warn('Invalid cached fuel data.', localError);
        fuels = [];
      }
    } else {
      fuels = [];
    }

    els.syncStatus.textContent = 'Na voljo so samo lokalni podatki; GitHub data.json trenutno ni dosegljiv.';
    render();
    return false;
  }
}

const cached = localStorage.getItem('cupra.fuels');
if (cached) {
  try {
    fuels = JSON.parse(cached);
  } catch (error) {
    console.warn('Invalid local fuel cache.', error);
    fuels = [];
  }
}

els.openFuelForm.addEventListener('click', openFuel);
els.closeFuelForm.addEventListener('click', closeFuel);
document.querySelectorAll('[data-view="fuel"]').forEach((button) => button.addEventListener('click', openFuel));
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    if (button.dataset.view === 'fuel') {
      openFuel();
    }
  });
});

els.fuelForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);
  const km = Number(formData.get('km'));
  const liters = Number(formData.get('liters'));
  const total = Number(formData.get('total'));
  const previousKm = fuels.length ? Math.max(...fuels.map((item) => Number(item.km))) : PURCHASE_KM;
  const distance = km - previousKm;

  const entry = {
    date: formData.get('date'),
    km,
    liters,
    total,
    pricePerLiter: liters ? +(total / liters).toFixed(3) : 0,
    fuel: formData.get('fuel'),
    station: formData.get('station'),
    note: formData.get('note'),
    consumption: distance > 0 && liters ? +((liters / distance) * 100).toFixed(2) : null
  };

  fuels.push(entry);
  save();
  render();
  els.syncStatus.textContent = 'Pošiljam v Google Sheet...';

  try {
    await window.CupraApi.appendFuel(entry);
    els.syncStatus.textContent = 'Shranjeno lokalno in poslano v Google Sheet.';
    event.target.reset();
  } catch (error) {
    els.syncStatus.textContent = 'Shranjeno lokalno, Google Sheet trenutno ni dosegljiv.';
    console.error(error);
  }
});

els.uploadHero.addEventListener('click', () => els.heroUpload.click());
els.heroUpload.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('cupra.hero', reader.result);
    els.heroBg.style.backgroundImage = `url(${reader.result})`;
  };
  reader.readAsDataURL(file);
});

const savedHero = localStorage.getItem('cupra.hero');
if (savedHero) {
  els.heroBg.style.backgroundImage = `url(${savedHero})`;
}

render();
void loadRemoteData();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
