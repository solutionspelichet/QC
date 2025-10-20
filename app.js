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
document.getElementById('toggleTheme').addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
});

// Afficher champs KO
document.querySelectorAll('.okko input[type=radio]').forEach(r=>{
  r.addEventListener('change', ()=>{
    const name = r.name;
    const val = r.value;
    const extra = document.querySelector(`.ko-extra[data-for="${name}"]`);
    if (!extra) return;
    extra.style.display = (val === 'KO') ? 'block' : 'none';
  });
});

// ZXing (décodage à partir d’une photo)
async function decodeFileToBarcode(file) {
  const img = await fileToImage(file);
  const codeReader = new ZXingBrowser.BrowserBarcodeReader();
  const res = await codeReader.decodeFromImageElement(img).catch(()=>null);
  return res ? res.getText() : '';
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
    if (!txt) alert('Aucun code-barres détecté. Réessayez avec une photo plus nette.');
  });
});

// Soumission formulaires
document.querySelectorAll('.qc-form').forEach(form=>{
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const type = form.dataset.type;
    const result = form.querySelector('.result');
    result.textContent = '';

    // Collecte champs
    const date = form.querySelector('input[name="date_jour"]').value;
    const codeBarres = form.querySelector('input[name="code_barres"]').value.trim();
    if (!date || !codeBarres) {
      alert('Date et code-barres sont requis.');
      return;
    }

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
      const r = await fetch(`${CONFIG.WEBAPP_BASE_URL}?route=qc&type=${encodeURIComponent(type)}`, {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const js = await r.json();
      if (!js.ok) throw new Error(js.error || 'Erreur');
      result.textContent = '✅ Enregistrement réussi';
      form.reset();
      // Masquer tous les blocs KO
      form.querySelectorAll('.ko-extra').forEach(x=>x.style.display='none');
    } catch (err) {
      result.textContent = '❌ '+ String(err.message || err);
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
document.getElementById('btnKpi').addEventListener('click', async ()=>{
  const from = document.getElementById('kpi_from').value;
  const to   = document.getElementById('kpi_to').value;
  const url = new URL(CONFIG.WEBAPP_BASE_URL);
  url.searchParams.set('route','kpi');
  if (from) url.searchParams.set('from', from);
  if (to)   url.searchParams.set('to', to);
  const box = document.getElementById('kpiResults');
  box.textContent = 'Chargement KPI…';
  const js = await fetch(url).then(r=>r.json()).catch(()=>({ok:false}));
  if (!js.ok) { box.textContent = 'Erreur KPI'; return; }
  box.innerHTML = renderKpi(js.kpi);
});

function renderKpi(kpi){
  const types = Object.keys(kpi);
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
document.getElementById('btnExport').addEventListener('click', async ()=>{
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
