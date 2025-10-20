/* ===========================
   QC PWA — app.js (complet)
   =========================== */

let CONFIG = { WEBAPP_BASE_URL: '' };

// Charger config.json (URL backend /exec)
fetch('config.json')
  .then(r => r.json())
  .then(c => { CONFIG = c; })
  .catch(() => { /* laisser CONFIG par défaut si fichier absent */ });

/* ---------- Helpers DOM ---------- */
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function initThemeToggle() {
  const toggle = qs('#toggleTheme');
  if (!toggle) return;
  // restaurer
  const pref = localStorage.getItem('theme');
  if (pref === 'dark') document.body.classList.add('dark');
  if (pref === 'light') document.body.classList.remove('dark');

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
}



/* ---------- Tabs ---------- */
function initTabs() {
  qsa('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tab').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.tab;
      qsa('.tab-pane').forEach(p => p.classList.remove('active'));
      qs('#tab-' + t).classList.add('active');
    });
  });
}

/* ---------- Thème ---------- */
function initThemeToggle() {
  const toggle = qs('#toggleTheme');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });
}

/* ---------- Afficher/Masquer blocs KO ---------- */
function initKoBlocks() {
  qsa('.okko input[type=radio]').forEach(radio => {
    radio.addEventListener('change', () => {
      const name = radio.name;
      const extra = qs(`.ko-extra[data-for="${name}"]`);
      if (!extra) return;
      extra.style.display = (radio.value === 'KO') ? 'block' : 'none';
    });
  });
}

/* ---------- Décodage code-barres (native BarcodeDetector -> ZXing fallback) ---------- */
async function decodeFileToBarcode(file) {
  // 1) Décodage natif si disponible (Chrome/Android)
  if ('BarcodeDetector' in window) {
    try {
      const formats = ['ean_13', 'code_128', 'code_39'];
      const bd = new window.BarcodeDetector({ formats });
      const img = await fileToImage(file);
      const pngDataUrl = await imageToPngDataUrl(img, 800); // upscale + normalisation PNG
      const imgEl = await dataUrlToImage(pngDataUrl);

      const c = document.createElement('canvas');
      c.width = imgEl.naturalWidth || imgEl.width;
      c.height = imgEl.naturalHeight || imgEl.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, c.width, c.height);

      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      if (blob) {
        const bitmap = await createImageBitmap(blob);
        const codes = await bd.detect(bitmap);
        if (codes && codes[0] && codes[0].rawValue) return String(codes[0].rawValue);
      }
    } catch (_) {
      // on passe au fallback ZXing
    }
  }

  // 2) Fallback ZXing
  const img = await fileToImage(file);
  const pngDataUrl = await imageToPngDataUrl(img, 800);
  const reader = new ZXingBrowser.BrowserMultiFormatReader();
  const hints = new Map();
  const formats = [
    ZXingBrowser.BarcodeFormat.EAN_13,
    ZXingBrowser.BarcodeFormat.CODE_128,
    ZXingBrowser.BarcodeFormat.CODE_39
  ];
  hints.set(ZXingBrowser.DecodeHintType.POSSIBLE_FORMATS, formats);
  reader.setHints(hints);
  const imgPng = await dataUrlToImage(pngDataUrl);
  try {
    const res = await reader.decodeFromImage(imgPng);
    return res ? res.getText() : '';
  } catch {
    return '';
  }
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const fr = new FileReader();
    fr.onload = () => img.src = fr.result; // HEIC/JPEG/PNG -> dataURL
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
function imageToPngDataUrl(img, minWidth = 800) {
  return new Promise(resolve => {
    const baseW = img.naturalWidth || img.width || minWidth;
    const baseH = img.naturalHeight || img.height || minWidth;
    const scale = Math.max(1, Math.ceil(minWidth / Math.max(1, baseW)));
    const w = baseW * scale;
    const h = baseH * scale;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    resolve(c.toDataURL('image/png'));
  });
}

/* ---------- Boutons "Décoder" ---------- */
function initDecodeButtons() {
  qsa('button[data-action="decode"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inputId = btn.dataset.target;
      const outId = btn.dataset.out;
      const input = qs('#' + inputId);
      const out = qs('#' + outId);
      if (!input || !out) return;
      if (!input.files || !input.files[0]) {
        alert('Sélectionnez d’abord une photo contenant le code-barres.');
        return;
      }
      out.value = 'Décodage en cours…';
      const txt = await decodeFileToBarcode(input.files[0]);
      out.value = txt || '';
      if (!txt) alert('Aucun code-barres détecté. Réessayez avec une photo plus nette / rapprochée / bien cadrée.');
    });
  });
}

/* ---------- Convertir input[file] -> {dataUrl, ext} ---------- */
async function fileToDataUrlWithExt(input) {
  if (!input || !input.files || !input.files[0]) return null;
  const file = input.files[0];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  return { dataUrl, ext };
}

/* ---------- Soumission formulaires (FormData sans header => pas de préflight CORS) ---------- */
function initForms() {
  qsa('.qc-form').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const type = form.dataset.type;
      const result = qs('.result', form);
      if (result) result.textContent = '';

      // Champs requis
      const date = qs('input[name="date_jour"]', form).value;
      const codeBarres = qs('input[name="code_barres"]', form).value.trim();
      if (!date || !codeBarres) { alert('Date et code-barres sont requis.'); return; }

      // Photo principale (optionnelle)
      const photoMainInput = qs('input[name="photo_principale"]', form);
      const photoMain = await fileToDataUrlWithExt(photoMainInput);

      // Questions selon type
      const questionsMap = {
        Cartons: ['callage_papier','intercalaires_livres','ordre_colonnes','scotch','depoussierage'],
        Palettes_Avant: ['cartons_etat','intercalaires_cartons','ordre_cartons','cerclage','stabilite'],
        Palettes_Destination: ['cartons_etat','cerclage']
      };
      const questions = questionsMap[type] || [];

      const answers = [];
      for (const q of questions) {
        const val = (qs(`input[name="${q}"]:checked`, form) || {}).value;
        if (!val) { alert('Veuillez répondre à toutes les questions.'); return; }
        let photo = null, commentaire = '';
        if (val === 'KO') {
          const fileInput = qs(`input[data-photofor="${q}"]`, form);
          const ta = qs(`textarea[data-commentfor="${q}"]`, form);
          const koPhoto = await fileToDataUrlWithExt(fileInput);
          commentaire = (ta && ta.value.trim()) || '';
          if (!koPhoto || !commentaire) {
            alert(`Pour "${q}", KO ⇒ photo + commentaire obligatoires.`);
            return;
          }
          photo = koPhoto;
        }
        answers.push({ field: q, value: val, photo, commentaire });
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
        qsa('.ko-extra', form).forEach(x => x.style.display = 'none');
      } catch (err) {
        if (result) result.textContent = '❌ ' + String(err.message || err);
      }
    });
  });
}

/* =========================
   KPI — synthèse + tableaux + courbes
   ========================= */

let CHART_INSTANCES = [];

function initKpi() {
  const btnKpi = qs('#btnKpi');
  if (btnKpi) btnKpi.addEventListener('click', loadAndRenderKpi);
  const btnExport = qs('#btnExport');
  if (btnExport) btnExport.addEventListener('click', doExportXlsx);
}

async function loadAndRenderKpi() {
  const from = qs('#kpi_from').value;
  const to   = qs('#kpi_to').value;

  const url = new URL(CONFIG.WEBAPP_BASE_URL);
  url.searchParams.set('route', 'kpi');
  if (from) url.searchParams.set('from', from);
  if (to)   url.searchParams.set('to', to);

  const box = qs('#kpiResults');
  if (box) box.textContent = 'Chargement KPI…';

  const js = await fetch(url).then(r=>r.json()).catch(()=>({ok:false}));
  if (!js.ok) { if (box) box.textContent = 'Erreur KPI'; return; }

  renderKpiBlocks(js.kpi);
}

function doExportXlsx() {
  const from = qs('#kpi_from').value;
  const to   = qs('#kpi_to').value;
  const url = new URL(CONFIG.WEBAPP_BASE_URL);
  url.searchParams.set('route', 'export');
  if (from) url.searchParams.set('from', from);
  if (to)   url.searchParams.set('to', to);
  fetch(url)
    .then(r=>r.json())
    .then(js=>{
      if (!js.ok) { alert('Export échoué'); return; }
      window.open(js.webViewLink, '_blank');
    })
    .catch(()=> alert('Export échoué'));
}

function renderKpiBlocks(kpi) {
  // Détruire les anciens charts
  CHART_INSTANCES.forEach(ch=>{ try{ ch.destroy(); }catch(_){} });
  CHART_INSTANCES = [];

  const wrap = qs('#kpiResults');
  wrap.innerHTML = '';

  const types = Object.keys(kpi || {});
  if (!types.length) {
    wrap.innerHTML = '<p>Aucune donnée.</p>';
    return;
  }

  types.forEach(typeName => {
    const obj = kpi[typeName] || {};
    const sum = obj.summary || {};
    const perQ = obj.per_question || {};
    const series = obj.by_date || [];

    // --- Carte synthèse
    const cardSummary = document.createElement('div');
    cardSummary.className = 'kpi-card';
    cardSummary.innerHTML = `
      <h3>${typeName} — Synthèse</h3>
      <div class="kpi-legend">
        <strong>Contrôles</strong> : ${sum.total_entries || 0}
        &nbsp;|&nbsp; <strong>Entrées avec ≥1 KO</strong> : ${sum.entries_with_any_KO || 0} (${sum.entries_with_any_KO_pct || 0}%)
        &nbsp;|&nbsp; <strong>Total KO (tous points)</strong> : ${sum.total_KO_items || 0}
        &nbsp;|&nbsp; <strong>KO moyens / entrée</strong> : ${sum.avg_KO_per_entry || 0}
      </div>
    `;
    wrap.appendChild(cardSummary);

    // --- Tableau OK/KO par point
    const cardTable = document.createElement('div');
    cardTable.className = 'kpi-card';
    const rows = Object.keys(perQ).map(q=>{
      const it = perQ[q] || {OK:0, KO:0, ko_pct:0};
      return `<tr><td>${q}</td><td>${it.OK}</td><td>${it.KO}</td><td>${it.ko_pct}%</td></tr>`;
    }).join('');
    cardTable.innerHTML = `
      <h3>${typeName} — Par point (OK vs KO)</h3>
      <table class="kpi">
        <thead><tr><th>Point</th><th>OK</th><th>KO</th><th>% KO</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Aucune donnée</td></tr>'}</tbody>
      </table>
    `;
    wrap.appendChild(cardTable);

    // --- Courbe % KO par jour
    const labels = series.map(s=>s.date);
    const taux   = series.map(s=>s.taux_ko_pct);
    const cardLine = document.createElement('div');
    cardLine.className = 'kpi-card';
    cardLine.innerHTML = `
      <h3>${typeName} — Taux KO % par jour</h3>
      <canvas height="220"></canvas>
    `;
    wrap.appendChild(cardLine);

    if (typeof Chart !== 'undefined') {
      const ctx = cardLine.querySelector('canvas').getContext('2d');
      CHART_INSTANCES.push(new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Taux KO %', data:taux, tension:0.2, fill:false }] },
        options: baseChartOptions('Pourcentage', '%')
      }));
    } else {
      // fallback texte si Chart.js pas chargé
      cardLine.innerHTML += `<div style="margin-top:8px;color:#bbb">Installe Chart.js pour voir le graphique.</div>`;
    }
  });
}

function baseChartOptions(yTitle, suffix='') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color:'#ddd' }, grid: { color:'rgba(255,255,255,0.08)' } },
      y: {
        ticks: { color:'#ddd', callback: v => `${v}${suffix}` },
        grid: { color:'rgba(255,255,255,0.08)' },
        beginAtZero: true
      }
    },
    plugins: {
      legend: { labels: { color:'#eee' } }
    },
    elements: { point: { radius: 3 } }
  };
}

/* ---------- Service Worker (installabilité, pas d'offline) ---------- */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

/* ---------- Démarrage ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initThemeToggle();
  initKoBlocks();
  initDecodeButtons();
  initForms();
  initKpi();
  initServiceWorker();
});
