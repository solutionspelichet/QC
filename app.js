/* ========== Helpers DOM ========== */
function qs(s, r=document){return r.querySelector(s);}
function qsa(s, r=document){return Array.from(r.querySelectorAll(s));}

/* ========== Tabs (header only) ========== */
function initTabs(){
  const headerTabs=document.querySelectorAll('.app-header .tab');
  headerTabs.forEach(btn=>{
    btn.addEventListener('click',()=>{
      headerTabs.forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      const t=btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      const pane=document.getElementById('tab-'+t);
      if(pane)pane.classList.add('active');
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
}

/* ========== Thème clair/sombre ========== */
function initThemeToggle(){
  const toggle=document.getElementById('toggleTheme');
  if(!toggle)return;
  let theme=localStorage.getItem('theme')||
    (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.setAttribute('data-theme',theme);
  setThemeColorMeta(theme);
  toggle.addEventListener('click',()=>{
    theme=(theme==='dark')?'light':'dark';
    document.documentElement.setAttribute('data-theme',theme);
    localStorage.setItem('theme',theme);
    setThemeColorMeta(theme);
  });
}
function setThemeColorMeta(theme){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',theme==='dark'?'#0f1115':'#FF6A00');
}

/* ========== ZXing + BarcodeDetector ========== */
async function decodeFileToBarcode(file){
  // Natif si dispo
  if('BarcodeDetector' in window){
    try{
      const formats=['ean_13','code_128','code_39'];
      const bd=new window.BarcodeDetector({formats});
      const img=await fileToImage(file);
      const png=await imageToPngDataUrl(img,800);
      const el=await dataUrlToImage(png);
      const c=document.createElement('canvas');
      c.width=el.naturalWidth||el.width; c.height=el.naturalHeight||el.height;
      c.getContext('2d').drawImage(el,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,'image/png'));
      if(blob){
        const bmp=await createImageBitmap(blob);
        const codes=await bd.detect(bmp);
        if(codes && codes[0] && codes[0].rawValue) return String(codes[0].rawValue);
      }
    }catch(_){}
  }
  // Fallback ZXing
  const img=await fileToImage(file);
  const png=await imageToPngDataUrl(img,800);
  const reader=new ZXingBrowser.BrowserMultiFormatReader();
  const hints=new Map();
  const formats=[ZXingBrowser.BarcodeFormat.EAN_13, ZXingBrowser.BarcodeFormat.CODE_128, ZXingBrowser.BarcodeFormat.CODE_39];
  hints.set(ZXingBrowser.DecodeHintType.POSSIBLE_FORMATS,formats);
  reader.setHints(hints);
  const el=await dataUrlToImage(png);
  try{
    const res=await reader.decodeFromImage(el);
    return res?res.getText():'';
  }catch{ return ''; }
}
function fileToImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    const fr=new FileReader();
    fr.onload=()=>img.src=fr.result;
    fr.onerror=reject;
    fr.readAsDataURL(file);
  });
}
function dataUrlToImage(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    img.src=dataUrl;
  });
}
function imageToPngDataUrl(img,minWidth=800){
  return new Promise(resolve=>{
    const baseW=img.naturalWidth||img.width||minWidth;
    const baseH=img.naturalHeight||img.height||minWidth;
    const scale=Math.max(1,Math.ceil(minWidth/Math.max(1,baseW)));
    const w=baseW*scale, h=baseH*scale;
    const c=document.createElement('canvas');
    c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,w,h);
    resolve(c.toDataURL('image/png'));
  });
}

/* ========== Decode buttons ========== */
function initDecodeButtons(){
  qsa('button[data-action="decode"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const input=qs('#'+btn.dataset.target);
      const out=qs('#'+btn.dataset.out);
      if(!input || !out){return;}
      if(!input.files || !input.files[0]){ alert('Sélectionnez une photo avec le code-barres.'); return; }
      out.value='Décodage en cours…';
      const txt=await decodeFileToBarcode(input.files[0]);
      out.value=txt||'';
      if(!txt) alert('Aucun code-barres détecté. Photo plus nette/rapprochée svp.');
    });
  });
}

/* ========== Helpers fichiers -> dataURL ========= */
async function fileToDataUrlWithExt(input){
  if(!input || !input.files || !input.files[0]) return null;
  const file=input.files[0];
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  const dataUrl=await new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>resolve(fr.result);
    fr.onerror=reject;
    fr.readAsDataURL(file);
  });
  return { dataUrl, ext };
}

/* ========== Envoi formulaires -> Apps Script ========== */
const CONFIG = { WEBAPP_BASE_URL: "" }; // rempli par config.json si tu en as un
fetch('config.json').then(r=>r.ok?r.json():{}).then(c=>Object.assign(CONFIG,c)).catch(()=>{});

function initKoBlocks(){
  qsa('.okko input[type=radio]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const extra=qs(`.ko-extra[data-for="${r.name}"]`);
      if(!extra) return;
      extra.style.display=(r.value==='KO')?'block':'none';
    });
  });
}

function initForms(){
  qsa('.qc-form').forEach(form=>{
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const type=form.dataset.type;
      const result=qs('.result',form); if(result) result.textContent='';

      // champs requis
      const date=qs('input[name="date_jour"]',form).value;
      const codeBarres=qs('input[name="code_barres"]',form).value.trim();
      if(!date || !codeBarres){ alert('Date et code-barres requis.'); return; }

      // photo principale facultative
      const photoMain=await fileToDataUrlWithExt(qs('input[name="photo_principale"]',form));

      const questionsMap={
        Cartons:['callage_papier','intercalaires_livres','ordre_colonnes','scotch','depoussierage'],
        Palettes_Avant:['cartons_etat','intercalaires_cartons','ordre_cartons','cerclage','stabilite'],
        Palettes_Destination:['cartons_etat','cerclage']
      };
      const questions=questionsMap[type]||[];

      const answers=[];
      for(const q of questions){
        const val=(qs(`input[name="${q}"]:checked`,form)||{}).value;
        if(!val){ alert('Veuillez répondre à toutes les questions.'); return; }
        let photo=null, commentaire='';
        if(val==='KO'){
          const koPhoto=await fileToDataUrlWithExt(qs(`input[data-photofor="${q}"]`,form));
          const ta=qs(`textarea[data-commentfor="${q}"]`,form);
          commentaire=(ta && ta.value.trim())||'';
          if(!koPhoto || !commentaire){ alert(`KO sur "${q}" ⇒ photo + commentaire obligatoires.`); return; }
          photo=koPhoto;
        }
        answers.push({ field:q, value:val, photo, commentaire });
      }

      const payload={ date_jour:date, type, code_barres:codeBarres, photo_principale:photoMain, answers };

      try{
        const fd=new FormData();
        fd.append('route','qc');
        fd.append('type',type);
        fd.append('payload',JSON.stringify(payload));

        const url=CONFIG.WEBAPP_BASE_URL || window.WEBAPP_BASE_URL || ''; // fallback
        if(!url){ alert('URL backend non configurée (config.json → WEBAPP_BASE_URL).'); return; }

        const r=await fetch(url,{ method:'POST', body:fd });
        const js=await r.json();
        if(!js.ok) throw new Error(js.error||'Erreur serveur');

        if(result) result.textContent='✅ Enregistrement réussi';
        form.reset();
        qsa('.ko-extra',form).forEach(x=>x.style.display='none');
      }catch(err){
        if(result) result.textContent='❌ '+String(err.message||err);
      }
    });
  });
}

/* ========== KPI (charts + tableau) ========== */
let CHARTS=[];
function initKpi(){
  const btnKpi=qs('#btnKpi'); if(btnKpi) btnKpi.addEventListener('click', loadAndRenderKpi);
  const btnExport=qs('#btnExport'); if(btnExport) btnExport.addEventListener('click', doExportXlsx);
}
async function loadAndRenderKpi(){
  const from=qs('#kpi_from').value, to=qs('#kpi_to').value;
  const url=new URL(CONFIG.WEBAPP_BASE_URL);
  url.searchParams.set('route','kpi');
  if(from) url.searchParams.set('from',from);
  if(to) url.searchParams.set('to',to);
  const box=qs('#kpiResults'); if(box) box.textContent='Chargement…';
  const js=await fetch(url).then(r=>r.json()).catch(()=>({ok:false}));
  if(!js.ok){ if(box) box.textContent='Erreur KPI'; return; }
  renderKpi(js.kpi);
}
function doExportXlsx(){
  const from=qs('#kpi_from').value, to=qs('#kpi_to').value;
  const url=new URL(CONFIG.WEBAPP_BASE_URL);
  url.searchParams.set('route','export');
  if(from) url.searchParams.set('from',from);
  if(to) url.searchParams.set('to',to);
  fetch(url).then(r=>r.json()).then(js=>{
    if(!js.ok){ alert('Export échoué'); return; }
    window.open(js.webViewLink,'_blank');
  }).catch(()=>alert('Export échoué'));
}
function renderKpi(kpi){
  CHARTS.forEach(ch=>{try{ch.destroy();}catch{}});
  CHARTS=[];
  const wrap=qs('#kpiResults'); wrap.innerHTML='';

  const types=Object.keys(kpi||{});
  if(!types.length){ wrap.innerHTML='<p>Aucune donnée.</p>'; return; }

  types.forEach(t=>{
    const obj=kpi[t]||{};
    const sum=obj.summary||{};
    const perQ=obj.per_question||{};
    const series=obj.by_date||[];

    const cardS=document.createElement('div');
    cardS.className='kpi-card';
    cardS.innerHTML=`
      <h3>${t} — Synthèse</h3>
      <div class="kpi-legend">
        <strong>Contrôles</strong> : ${sum.total_entries||0}
        &nbsp;|&nbsp;<strong>≥1 KO</strong> : ${sum.entries_with_any_KO||0} (${sum.entries_with_any_KO_pct||0}%)
        &nbsp;|&nbsp;<strong>Total KO</strong> : ${sum.total_KO_items||0}
        &nbsp;|&nbsp;<strong>KO moyens/entrée</strong> : ${sum.avg_KO_per_entry||0}
      </div>`;
    wrap.appendChild(cardS);

    const cardT=document.createElement('div');
    cardT.className='kpi-card';
    const rows=Object.keys(perQ).map(q=>{
      const it=perQ[q]||{OK:0,KO:0,ko_pct:0};
      return `<tr><td>${q}</td><td>${it.OK}</td><td>${it.KO}</td><td>${it.ko_pct}%</td></tr>`;
    }).join('');
    cardT.innerHTML=`
      <h3>${t} — Par point (OK vs KO)</h3>
      <table class="kpi"><thead><tr><th>Point</th><th>OK</th><th>KO</th><th>% KO</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4">Aucune donnée</td></tr>'}</tbody></table>`;
    wrap.appendChild(cardT);

    const labels=series.map(s=>s.date);
    const taux=series.map(s=>s.taux_ko_pct);
    const cardL=document.createElement('div');
    cardL.className='kpi-card';
    cardL.innerHTML=`<h3>${t} — Taux KO % par jour</h3><canvas height="220"></canvas>`;
    wrap.appendChild(cardL);
    if(typeof Chart!=='undefined'){
      const ctx=cardL.querySelector('canvas').getContext('2d');
      CHARTS.push(new Chart(ctx,{
        type:'line',
        data:{ labels, datasets:[{label:'Taux KO %', data:taux, tension:0.2, fill:false}] },
        options:{
          responsive:true, maintainAspectRatio:false,
          scales:{
            x:{ticks:{color:'#ddd'},grid:{color:'rgba(255,255,255,0.08)'}},
            y:{ticks:{color:'#ddd',callback:v=>`${v}%`},grid:{color:'rgba(255,255,255,0.08)'},beginAtZero:true}
          },
          plugins:{ legend:{ labels:{ color:'#eee' } } },
          elements:{ point:{ radius:3 } }
        }
      }));
    }
  });
}

/* ========== KO toggle ========== */
function bindKoTogglesScope(scope=document){
  qsa('.okko input[type=radio]',scope).forEach(r=>{
    r.addEventListener('change',()=>{
      const extra=qs(`.ko-extra[data-for="${r.name}"]`,scope);
      if(!extra)return;
      extra.style.display=(r.value==='KO')?'block':'none';
    });
  });
}

/* ========== Service worker ========== */
function initServiceWorker(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
}

/* ========== Boot ========== */
document.addEventListener('DOMContentLoaded',()=>{
  initTabs();
  initThemeToggle();
  initDecodeButtons();
  initKoBlocks();
  bindKoTogglesScope();
  initForms();
  initKpi();
  initServiceWorker();
});
