const CUPRA_API_URL = 'https://script.google.com/macros/s/AKfycbxtBUDsEvPy3NudjOg58-vne_iWKUfln5QllhqGD4Jf5TqZbpSSNqPPOu9MX9v1Vtcd/exec';
async function saveToSheet(sheet, values){
  const res = await fetch(CUPRA_API_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({sheet, values})});
  return {status:'sent'};
}
