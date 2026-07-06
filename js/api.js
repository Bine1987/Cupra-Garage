window.CupraApi = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxtBUDsEvPy3NudjOg58-vne_iWKUfln5QllhqGD4Jf5TqZbpSSNqPPOu9MX9v1Vtcd/exec',
  async appendFuel(entry){
    const payload = {
      sheet: 'Tankanja',
      values: [entry.date, entry.km, entry.liters, entry.total, entry.pricePerLiter, entry.fuel, '', '', '', entry.station, entry.note]
    };
    const response = await fetch(this.endpoint, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    return {status:'sent', response};
  }
};
