/* ===========================
   QC PWA — app.js (complet)
   =========================== */

let CONFIG = { WEBAPP_BASE_URL: '' };

// Charger config.json (URL backend /exec)
fetch('config.json')
  .then(r => r.json())
  .then(c => { CONFIG = c; })
  .catch(() => { /* laisser CONFIG par défaut */ });

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

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

/* ---------- Afficher/Masquer KO ---------- */
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

/* ---------- ZXing + BarcodeDetector ---------- */
async function decodeFileToBarcode(file) {
  // 1) Décodage natif si dispo (Chrome/Android souvent)
  if ('BarcodeDetector' in window) {
    try {
      const formats = ['ean_13', 'code_128', 'code_39'];
      const bd = new window.BarcodeDetector({ formats });
      const img = await fileToImage(file);
      const pngDataUrl = await imageToPngDataUrl(img, 800);
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
    } catch (_) { /* fallback ZXing */ }
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
    fr.onload = () => img.src = fr.result;
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

/* ---------- Soumission formulaires ---------- */
function initForms() {
  qsa('.qc-form').forEach(form => {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const type = form.dataset.type;
      const result = qs('.result', form);
      if (result) result.textContent = '';

      const date = qs('input[name="date_jour"]', form).value;
      const codeBarres = qs('input[name="code_barres"]', form).value.trim();
      if (!date || !codeBarres) { alert('Date et code-barres sont requis.'); return; }

      const photoMainInput = qs('input[name="photo_principale"]', form);
      const photoMain = await fileToDataUrlWithExt(photoMainInput);

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

/* ---------- KPI & Export ---------- */
function initKpi() {
  const btnKpi = qs('#btnKpi');
  if (btnKpi) {
    btnKpi.addEventListener('click', async () => {
      const from = qs('#kpi_from').value;
      const to   = qs('#kpi_to').value;
      const url = new URL(CONFIG.WEBAPP_BASE_URL);
      url.searchParams.set('route', 'kpi');
      if (from) url.searchParams.set('from', from);
      if (to)   url.searchParams.set('to', to);
      const box = qs('#kpiResults');
      if (box) box.textContent = 'Chargement KPI…';
      const js = await fetch(url).then(r => r.json()).catch(() => ({ ok: false }));
      if (!js.ok) { if (box) box.textContent = 'Erreur KPI'; return; }
      if (box) box.innerHTML = renderKpi(js.kpi);
    });
  }

  const btnExport = qs('#btnExport');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const from = qs('#kpi_from').value;
      const to   = qs('#kpi_to').value;
      const url = new URL(CONFIG.WEBAPP_BASE_URL);
      url.searchParams.set('route', 'export');
      if (from) url.searchParams.set('from', from);
      if (to)   url.searchParams.set('to', to);
      const js = await fetch(url).then(r => r.json()).catch(() => ({ ok: false }));
      if (!js.ok) { alert('Export échoué'); return; }
      window.open(js.webViewLink, '_blank');
    });
  }
}

function renderKpi(kpi) {
  const types = Object.keys(kpi || {});
  if (!types.length) return '<p>Aucune donnée.</p>';
  let html = '';
  for (const t of types) {
    html += `<h3>${t}</h3><table class="kpi"><thead><tr><th>Date</th><th>Total</th><th>KO</th><th>Taux KO %</th><th>Par question</th></tr></thead><tbody>`;
    for (const row of kpi[t]) {
      const qsHtml = Object.entries(row.par_question || {}).map(([k, v]) => `${k}: ${v}%`).join('<br>');
      html += `<tr><td>${row.date}</td><td>${row.total}</td><td>${row.ko}</td><td>${row.taux_ko_pct}</td><td>${qsHtml}</td></tr>`;
    }
    html += '</tbody></table>';
  }
  return html;
}

/* ---------- Service Worker ---------- */
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
