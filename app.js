let CONFIG = { WEBAPP_BASE_URL: '' };

// Charger config.json
fetch('config.json').then(r=>r.json()).then(c=>CONFIG=c);

// Tabs
document.querySelectorAll('.tab').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const t = b.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
  });
});

// Thème
const toggleThemeBtn = document.getElementById('toggleTheme');
if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener('click', ()=> document.body.classList.toggle('dark'));
}

// Afficher/Masquer champs KO
document.querySelectorAll('.okko input[type=radio]').forEach(r=>{
  r.addEventListener('change', ()=>{
    const name = r.name;
    const extra = document.querySelector(`.ko-extra[data-for="${name}"]`);
    if (!extra) return;
    extra.style.display = (r.value === 'KO') ? 'block' : 'none';
  });
});

// ZXing — décodage à partir d’une photo
async function decodeFileToBarcode(file) {
  const img = await fileToImage(file);
  // si image petite, on up-scale x2 pour aider le décodage
  if (img.naturalWidth < 400) {
    const scaled = await scaleImage(img, 2);
    img.src = scaled;
  }
  const reader = new ZXingBrowser.BrowserMultiFormatReader();
  try {
    const res = await reader.decodeFromImage(img);
    return res ? res.getText() : '';
  } catch {
    return '';
  }
}

function fileToImage(file){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    const fr = new FileReader();
    fr.onload = ()=> img.src = fr.result;
    fr.readAsDataURL(file);
  });
}

function scaleImage(img, factor) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width  = img.naturalWidth  * factor;
    c.height = img.naturalHeight * factor;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    resolve(c.toDataURL('image/png'));
  });
}

// Boutons "Décoder"
document.querySelectorAll('button[data-action="decode"]').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const inputId = btn.dataset.target;
    const outId = btn.dataset.out;
    const input = document.getElementById(inputId);
    const out = document.getElementById(outId);
    if (!input.files || !input.files[0]) {
      alert('Sélectionnez d’abord une photo contenant le code-barres.');
      return;
    }
    out.value = 'Décodage en cours…';
    const txt = await decodeFileToBarcode(input.files[0]);
    out.value = txt || '';
    if (!txt) alert('Aucun code-barres détecté. Réessayez avec une photo plus nette / plus proche.');
  });
});

// Soumission formulaires (POST en FormData pour éviter CORS préflight)
document.querySelectorAll('.qc-form').forEach(form=>{
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const type = form.dataset.type;
    const result = form.querySelector('.result');
    if (result) result.textContent = '';

    // Champs requis
    const date = form.querySelector('input[name="date_jour"]').value;
    const codeBarres = form.querySelector('input[name="code_barres"]').value.trim();
    if (!date || !codeBarres) { alert('Date et code-barres sont requis.'); return; }

    // Photo principale (optionnelle)
    const photoMainInput = form.querySelector('input[name="photo_principale"]');
    const photoMain = await fileToDataUrlWithExt(photoMainInput);

    // Questions selon type
    const questions = {
      Cartons: ['callage_papier','intercalaires_livres','ordre_colonnes','scotch','depoussierage'],
      Palettes_Avant: ['cartons_etat','intercalaires_cartons','ordre_cartons','cerclage','stabilite'],
      Palettes_Destination: ['cartons_etat','cerclage']
    }[type];

    const answers = [];
    for (const q of questions) {
      const val = (form.querySelector(`input[name="${q}"]:checked`)||{}).value;
      if (!val) { alert('Veuillez répondre à toutes les questions.'); return; }

      let photo = null, commentaire = '';
      if (val === 'KO') {
        const fileInput = form.querySelector(`input[data-photofor="${q}"]`);
        const ta = form.querySelector(`textarea[data-commentfor="${q}"]`);
        const koPhoto = await fileToDataUrlWithExt(fileInput);
        commentaire = (ta && ta.value.trim()) || '';
        if (!koPhoto || !commentaire) {
          alert(`Pour "${q}", KO ⇒ photo + commentaire obligatoires.`);
          return;
        }
        photo = koPhoto;
      }
      answers.push({ field:q, value:val, photo, commentaire });
    }

    const payload = {
      date_jour: date,
      type,
      code_barres: codeBarres,
      photo_principale: photoMain,
      answers
    };

    try {
      const fd = new FormData();
      fd.append('route', 'qc');
      fd.append('type', type);
      fd.append('payload', JSON.stringify(payload));

      const r = await fetch(CONFIG.WEBAPP_BASE_URL, { method: 'POST', body: fd });
      const js = await r.json();
      if (!js.ok) throw new Error(js.error || 'Erreur');

      if (result) result.textContent = '✅ Enregistrement réussi';
      form.reset();
      form.querySelectorAll('.ko-extra').forEach(x=>x.style.display='none');
    } catch (err) {
      if (result) result.textContent = '❌ '+ String(err.message || err);
    }
  });
});

async function fileToDataUrlWithExt(input){
  if (!input || !input.files || !input.files[0]) return null;
  const file = input.files[0];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const dataUrl = await new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return { dataUrl, ext };
}

// KPI
const btnKpi = document.getElementById('btnKpi');
if (btnKpi) {
  btnKpi.addEventListener('click', async ()=>{
    const from = document.getElementById('kpi_from').value;
    const to   = document.getElementById('kpi_to').value;
    const url = new URL(CONFIG.WEBAPP_BASE_URL);
    url.searchParams.set('route','kpi');
    if (from) url.searchParams.set('from', from);
    if (to)   url.searchParams.set('to', to);
    const box = document.getElementById('kpiResults');
    if (box) box.textContent = 'Chargement KPI…';
    const js = await fetch(url).then(r=>r.json()).catch(()=>({ok:false}));
    if (!js.ok) { if (box) box.textContent = 'Erreur KPI'; return; }
    if (box) box.innerHTML = renderKpi(js.kpi);
  });
}

function renderKpi(kpi){
  const types = Object.keys(kpi||{});
  if (!types.length) return '<p>Aucune donnée.</p>';
  let html = '';
  for (const t of types) {
    html += `<h3>${t}</h3><table class="kpi"><thead><tr><th>Date</th><th>Total</th><th>KO</th><th>Taux KO %</th><th>Par question</th></tr></thead><tbody>`;
    for (const row of kpi[t]) {
      const qs = Object.entries(row.par_question||{}).map(([k,v])=>`${k}: ${v}%`).join('<br>');
      html += `<tr><td>${row.date}</td><td>${row.total}</td><td>${row.ko}</td><td>${row.taux_ko_pct}</td><td>${qs}</td></tr>`;
    }
    html += '</tbody></table>';
  }
  return html;
}

// Export Excel
const btnExport = document.getElementById('btnExport');
if (btnExport) {
  btnExport.addEventListener('click', async ()=>{
    const from = document.getElementById('kpi_from').value;
    const to   = document.getElementById('kpi_to').value;
    const url = new URL(CONFIG.WEBAPP_BASE_URL);
    url.searchParams.set('route','export');
    if (from) url.searchParams.set('from', from);
    if (to)   url.searchParams.set('to', to);
    const js = await fetch(url).then(r=>r.json()).catch(()=>({ok:false}));
    if (!js.ok) { alert('Export échoué'); return; }
    window.open(js.webViewLink, '_blank');
  });
}

// Service Worker (installabilité PWA, sans offline)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
