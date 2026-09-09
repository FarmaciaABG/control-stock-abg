const STORAGE = {
  consumption: "abg_consumption_v2",
  stock: "abg_stock_v2",
  lastStock: "abg_last_stock_v2",
  warehouse: "abg_warehouse_decisions_v2"
};

const MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"
];

let master = [];
let masterVersion = "";
let consumptionMap = loadJSON(STORAGE.consumption, {});
let stockMap = loadJSON(STORAGE.stock, {});
let warehouseDecisions = loadJSON(STORAGE.warehouse, {});
let unmatchedStock = [];
let activeActionFilter = "";

const els = {
  masterStatus: document.getElementById("masterStatus"),
  stockFile: document.getElementById("stockFile"),
  consumptionFile: document.getElementById("consumptionFile"),
  monthSelect: document.getElementById("monthSelect"),
  importBackupFile: document.getElementById("importBackupFile"),
  exportBackupBtn: document.getElementById("exportBackupBtn"),
  consumptionStatus: document.getElementById("consumptionStatus"),
  stockStatus: document.getElementById("stockStatus"),
  lastUpdate: document.getElementById("lastUpdate"),
  searchInput: document.getElementById("searchInput"),
  programFilter: document.getElementById("programFilter"),
  stateFilter: document.getElementById("stateFilter"),
  medTable: document.getElementById("medTable"),
  summaryText: document.getElementById("summaryText"),
  unmatchedBox: document.getElementById("unmatchedBox"),
  unmatchedList: document.getElementById("unmatchedList"),
  exportBtn: document.getElementById("exportBtn"),
  resetOperationalBtn: document.getElementById("resetOperationalBtn"),
  clearFilters: document.getElementById("clearFilters"),
  dialog: document.getElementById("warehouseDialog"),
  dialogTitle: document.getElementById("dialogTitle"),
  dialogWarehouseName: document.getElementById("dialogWarehouseName"),
  historyBtn: document.getElementById("historyBtn"),
  historyDialog: document.getElementById("historyDialog"),
  historyTable: document.getElementById("historyTable"),
  monthlyConsumptionCheck: document.getElementById("monthlyConsumptionCheck")
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .replace(/[^\w.%/+\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function n(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s/g,"");
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g,"").replace(",",".");
    else s = s.replace(/,/g,"");
  } else if (s.includes(",")) {
    s = s.replace(",",".");
  }
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}
function findHeader(headers, candidates) {
  const norm = headers.map(normalizeText);
  for (const c of candidates) {
    const target = normalizeText(c);
    const exact = norm.findIndex(h => h === target);
    if (exact >= 0) return headers[exact];
    const partial = norm.findIndex(h => h.includes(target));
    if (partial >= 0) return headers[partial];
  }
  return null;
}
function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        resolve(XLSX.read(data, {type:"array", cellDates:false}));
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function sheetToRows(wb) {
  const name = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {defval:null, raw:true});
}

async function loadMaster() {
  const response = await fetch("./maestro.json", {cache:"no-store"});
  if (!response.ok) throw new Error("No fue posible cargar maestro.json.");
  const payload = await response.json();
  master = payload.medicamentos || [];
  masterVersion = payload.version || "";

  // Primera vez: sembrar histórico con los consumos que ya venían en el maestro.
  if (!Object.keys(consumptionMap).length) {
    master.forEach(m => {
      const key = normalizeText(m.glosaABG);
      consumptionMap[key] = {...(m.initialConsumption || {})};
    });
    saveJSON(STORAGE.consumption, consumptionMap);
  } else {
    // Si aparecen medicamentos nuevos en el maestro, añadir su histórico inicial sin pisar lo ya guardado.
    master.forEach(m => {
      const key = normalizeText(m.glosaABG);
      if (!consumptionMap[key]) consumptionMap[key] = {...(m.initialConsumption || {})};
    });
    saveJSON(STORAGE.consumption, consumptionMap);
  }

  render();
}

function previousMonthName() {
  const d = new Date();
  return MONTHS[(d.getMonth() + 11) % 12];
}

function previousMonthInfo() {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return {
    name: MONTHS[prev.getMonth()],
    label: MONTHS[prev.getMonth()][0].toUpperCase() + MONTHS[prev.getMonth()].slice(1),
    year: prev.getFullYear()
  };
}

function previousMonthCoverage() {
  const info = previousMonthInfo();
  let withValue = 0;
  let total = master.length;

  master.forEach(m => {
    const months = getMonthsFor(m);
    if (months && Object.prototype.hasOwnProperty.call(months, info.name)) {
      const value = n(months[info.name]);
      if (value !== null) withValue++;
    }
  });

  return { ...info, withValue, total };
}

function renderPreviousMonthStatus() {
  if (!els.monthlyConsumptionCheck) return;
  if (!master.length) {
    els.monthlyConsumptionCheck.className = "month-check pending";
    els.monthlyConsumptionCheck.textContent = "Verificando consumo del mes anterior…";
    return;
  }

  const c = previousMonthCoverage();

  if (c.withValue === 0) {
    els.monthlyConsumptionCheck.className = "month-check pending";
    els.monthlyConsumptionCheck.textContent =
      `⚠️ Falta cargar el consumo de ${c.label} ${c.year}.`;
  } else if (c.withValue < c.total) {
    els.monthlyConsumptionCheck.className = "month-check partial";
    els.monthlyConsumptionCheck.textContent =
      `⚠️ Consumo de ${c.label} ${c.year} cargado parcialmente: ${c.withValue} de ${c.total} fármacos.`;
  } else {
    els.monthlyConsumptionCheck.className = "month-check ok";
    els.monthlyConsumptionCheck.textContent =
      `✅ Consumo de ${c.label} ${c.year} cargado correctamente (${c.withValue} fármacos).`;
  }
}
function populateMonthSelect() {
  els.monthSelect.innerHTML = MONTHS.map(m => `<option value="${m}">${m[0].toUpperCase()+m.slice(1)}</option>`).join("");
  els.monthSelect.value = previousMonthName();
}

async function handleStock(file) {
  if (!master.length) throw new Error("El maestro aún no termina de cargar.");
  const wb = await readWorkbook(file);
  const rows = sheetToRows(wb);
  if (!rows.length) throw new Error("El archivo de stock está vacío.");

  const headers = Object.keys(rows[0]);
  const article = findHeader(headers, ["ARTÍCULO","ARTICULO","Glosa ABG","Producto","Medicamento"]);
  const stock = findHeader(headers, ["TOTAL EN BODEGA","STOCK ACTUAL","STOCK INSTITUCIONAL","Stock"]);
  if (!article || !stock) throw new Error("No encontré las columnas de medicamento y stock.");

  stockMap = {};
  unmatchedStock = [];
  const masterKeys = new Set(master.map(m => normalizeText(m.glosaABG)));

  rows.forEach(r => {
    if (!r[article]) return;
    const key = normalizeText(r[article]);
    const qty = n(r[stock]);
    if (qty === null) return;
    stockMap[key] = qty;
    if (!masterKeys.has(key)) unmatchedStock.push(String(r[article]));
  });

  saveJSON(STORAGE.stock, stockMap);
  localStorage.setItem(STORAGE.lastStock, new Date().toISOString());
  render();
}

async function handleMonthlyConsumption(file, month) {
  if (!master.length) throw new Error("El maestro aún no termina de cargar.");
  if (!month) throw new Error("Selecciona el mes que estás incorporando.");

  const wb = await readWorkbook(file);
  const rows = sheetToRows(wb);
  if (!rows.length) throw new Error("El archivo de consumo está vacío.");

  const headers = Object.keys(rows[0]);
  const article = findHeader(headers, [
    "Glosa ABG","ARTÍCULO","ARTICULO","Medicamento","Producto","Glosa"
  ]);
  if (!article) throw new Error("No encontré la columna con el nombre del medicamento.");

  // Acepta una planilla de un solo mes o una planilla que ya tenga el mes seleccionado como columna.
  let consumptionHeader = findHeader(headers, [
    month, "CONSUMO", "CONSUMO MES", "CONSUMO MENSUAL", "CANTIDAD", "TOTAL"
  ]);
  if (!consumptionHeader) {
    const numericCandidates = headers.filter(h => h !== article).filter(h => {
      const vals = rows.slice(0,30).map(r => n(r[h])).filter(v => v !== null);
      return vals.length >= 3;
    });
    if (numericCandidates.length === 1) consumptionHeader = numericCandidates[0];
  }
  if (!consumptionHeader) {
    throw new Error(`No pude identificar la columna de consumo. Idealmente nómbrala “Consumo” o “${month}”.`);
  }

  const masterKeys = new Set(master.map(m => normalizeText(m.glosaABG)));
  let updated = 0;
  let unmatched = [];

  rows.forEach(r => {
    if (!r[article]) return;
    const key = normalizeText(r[article]);
    const value = n(r[consumptionHeader]);
    if (value === null) return;
    if (!masterKeys.has(key)) {
      unmatched.push(String(r[article]));
      return;
    }
    if (!consumptionMap[key]) consumptionMap[key] = {};
    consumptionMap[key][month] = value;
    updated++;
  });

  saveJSON(STORAGE.consumption, consumptionMap);
  render();

  let message = `Consumo de ${month} incorporado para ${updated} medicamentos.`;
  if (unmatched.length) message += `\n\n${unmatched.length} glosas no coincidieron exactamente con el maestro y no se incorporaron.`;
  alert(message);
  renderPreviousMonthStatus();
}

function getMonthsFor(med) {
  return consumptionMap[normalizeText(med.glosaABG)] || {};
}
function cpm3(med) {
  const months = getMonthsFor(med);
  const vals = MONTHS.map(m => n(months[m])).filter(v => v !== null).slice(-3);
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}
function stockFor(med) {
  const key = normalizeText(med.glosaABG);
  return Object.prototype.hasOwnProperty.call(stockMap,key) ? stockMap[key] : null;
}
function programFor(m) {
  if (m.iaaps && m.fofar) return "IAAPS/FOFAR";
  if (m.iaaps) return "IAAPS";
  if (m.fofar) return "FOFAR";
  return "NO TRAZADOR";
}
function stateFor(m) {
  const stock = stockFor(m);
  const cpm = cpm3(m);
  if (stock === null) return "SIN STOCK";
  if (cpm === null || cpm <= 0) return "SIN CPM";
  if (stock < cpm*0.20) return "CRÍTICO";
  if (stock < cpm*0.40) return "REVISAR";
  return "OK";
}
function actionFor(m) {
  const state = stateFor(m);
  if (state !== "CRÍTICO") return state === "REVISAR" ? "VIGILAR" : "—";
  if (m.controlado || m.disponibleBodega === false) return "INFORMAR";
  const decision = warehouseDecisions[normalizeText(m.glosaABG)];
  if (decision === "available") return "PEDIR";
  if (decision === "unavailable") return "INFORMAR";
  return "REVISAR BODEGA";
}
function fmt(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("es-CL",{maximumFractionDigits:1});
}
function badge(value) {
  let cls="neutral";
  if (value==="CRÍTICO") cls="critical";
  else if (value==="REVISAR" || value==="VIGILAR") cls="warning";
  else if (value==="OK") cls="good";
  else if (value==="REVISAR BODEGA" || value==="PEDIR") cls="storage";
  else if (value==="INFORMAR") cls="notify";
  return `<span class="badge ${cls}">${value}</span>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function filteredRows() {
  const q=normalizeText(els.searchInput.value);
  const p=els.programFilter.value;
  const s=els.stateFilter.value;
  return master.filter(m => {
    const program=programFor(m), state=stateFor(m), action=actionFor(m);
    if (q && !normalizeText(m.glosaABG+" "+m.glosaBodega).includes(q)) return false;
    if (p && program!==p) return false;
    if (s && state!==s) return false;
    if (activeActionFilter==="REVISAR BODEGA" && action!=="REVISAR BODEGA") return false;
    if (activeActionFilter==="INFORMAR" && action!=="INFORMAR") return false;
    if (activeActionFilter==="OK" && state!=="OK") return false;
    if (activeActionFilter==="CRÍTICO" && state!=="CRÍTICO") return false;
    if (activeActionFilter==="REVISAR" && state!=="REVISAR") return false;
    return true;
  });
}

function monthsPresent() {
  const present = new Set();
  Object.values(consumptionMap).forEach(obj => {
    MONTHS.forEach(m => { if (obj && obj[m] !== undefined && obj[m] !== null) present.add(m); });
  });
  return MONTHS.filter(m => present.has(m));
}

function render() {
  renderPreviousMonthStatus();
  els.masterStatus.textContent = master.length ? `Maestro ABG: ${master.length} fármacos · v. ${masterVersion}` : "Cargando maestro…";
  const present=monthsPresent();
  els.consumptionStatus.textContent = present.length ? `Histórico disponible: ${present.join(", ")}` : "Histórico: sin consumos";
  els.stockStatus.textContent = Object.keys(stockMap).length ? `Stock: ${Object.keys(stockMap).length} productos leídos` : "Stock: no cargado";

  const last=localStorage.getItem(STORAGE.lastStock);
  els.lastUpdate.textContent = last ? "Último stock: "+new Date(last).toLocaleString("es-CL") : "Sin stock cargado";

  const all=master.map(m=>({m,state:stateFor(m),action:actionFor(m)}));
  document.getElementById("countCritical").textContent=all.filter(x=>x.state==="CRÍTICO").length;
  document.getElementById("countReview").textContent=all.filter(x=>x.state==="REVISAR").length;
  document.getElementById("countWarehouse").textContent=all.filter(x=>x.action==="REVISAR BODEGA").length;
  document.getElementById("countNotify").textContent=all.filter(x=>x.action==="INFORMAR").length;
  document.getElementById("countOk").textContent=all.filter(x=>x.state==="OK").length;

  const rows=filteredRows();
  els.summaryText.textContent = master.length ? `${rows.length} de ${master.length} medicamentos mostrados.` : "Cargando maestro…";

  els.medTable.innerHTML=rows.map(m=>{
    const cpm=cpm3(m), stock=stockFor(m), state=stateFor(m), action=actionFor(m);
    const actionCell=action==="REVISAR BODEGA"
      ? `<button class="action-button" data-review="${encodeURIComponent(m.glosaABG)}">Revisar bodega</button>`
      : badge(action);
    return `<tr>
      <td><strong>${escapeHtml(m.glosaABG)}</strong>${m.controlado?'<br><span class="badge neutral">Controlado</span>':''}</td>
      <td>${badge(programFor(m))}</td>
      <td>${fmt(stock)}</td>
      <td>${fmt(cpm)}</td>
      <td>${fmt(cpm===null?null:cpm*.20)}</td>
      <td>${fmt(cpm===null?null:cpm*.40)}</td>
      <td>${badge(state)}</td>
      <td>${actionCell}</td>
      <td class="glosa">${escapeHtml(m.glosaBodega||"—")}</td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-review]").forEach(btn => {
    btn.addEventListener("click",()=>openWarehouseReview(decodeURIComponent(btn.dataset.review)));
  });

  if (unmatchedStock.length) {
    els.unmatchedBox.classList.remove("hidden");
    els.unmatchedList.innerHTML=unmatchedStock.slice(0,100).map(x=>`<div class="unmatched-item">${escapeHtml(x)}</div>`).join("");
  } else els.unmatchedBox.classList.add("hidden");
}

function openWarehouseReview(glosa) {
  const med=master.find(m=>m.glosaABG===glosa);
  if (!med) return;
  els.dialogTitle.textContent=med.glosaABG;
  els.dialogWarehouseName.innerHTML=`<strong>Buscar en bodega como:</strong><br>${escapeHtml(med.glosaBodega||"Sin glosa de bodega registrada")}`;
  els.dialog.dataset.med=glosa;
  els.dialog.showModal();
}

function buildHistoryTable() {
  const present=monthsPresent();
  const header=["Medicamento",...present,"CPM 3M"];
  const body=master.map(m=>{
    const months=getMonthsFor(m);
    return [m.glosaABG,...present.map(mm=>fmt(n(months[mm]))),fmt(cpm3(m))];
  });
  els.historyTable.innerHTML =
    `<thead><tr>${header.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${body.map(r=>`<tr>${r.map((x,i)=>`<td>${i===0?`<strong>${escapeHtml(x)}</strong>`:escapeHtml(x)}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function downloadJSON(obj, filename) {
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

els.dialog.addEventListener("close",()=>{
  const result=els.dialog.returnValue;
  if (!["available","unavailable"].includes(result)) return;
  warehouseDecisions[normalizeText(els.dialog.dataset.med)]=result;
  saveJSON(STORAGE.warehouse,warehouseDecisions);
  render();
});

els.stockFile.addEventListener("change",async e=>{
  try { if(e.target.files[0]) await handleStock(e.target.files[0]); }
  catch(err){ alert("Error al cargar stock: "+err.message); }
  e.target.value="";
});
els.consumptionFile.addEventListener("change",async e=>{
  try { if(e.target.files[0]) await handleMonthlyConsumption(e.target.files[0],els.monthSelect.value); }
  catch(err){ alert("Error al cargar consumo: "+err.message); }
  e.target.value="";
});
els.exportBackupBtn.addEventListener("click",()=>{
  downloadJSON({
    tipo:"respaldo-consumos-abg",
    fecha:new Date().toISOString(),
    maestroVersion:masterVersion,
    consumos:consumptionMap
  },`respaldo_consumos_ABG_${new Date().toISOString().slice(0,10)}.json`);
});
els.importBackupFile.addEventListener("change",async e=>{
  const file=e.target.files[0];
  if (!file) return;
  try {
    const text=await file.text();
    const data=JSON.parse(text);
    if (!data.consumos || typeof data.consumos!=="object") throw new Error("El archivo no contiene un respaldo válido.");
    if (!confirm("Esto reemplazará el histórico de consumos guardado en este navegador. ¿Continuar?")) return;
    consumptionMap=data.consumos;
    saveJSON(STORAGE.consumption,consumptionMap);
    render();
    alert("Respaldo importado correctamente.");
  } catch(err){ alert("No fue posible importar el respaldo: "+err.message); }
  e.target.value="";
});
els.historyBtn.addEventListener("click",()=>{
  buildHistoryTable();
  els.historyDialog.showModal();
});
[els.searchInput,els.programFilter,els.stateFilter].forEach(el=>el.addEventListener("input",()=>{activeActionFilter="";render();}));
els.clearFilters.addEventListener("click",()=>{
  els.searchInput.value=""; els.programFilter.value=""; els.stateFilter.value=""; activeActionFilter=""; render();
});
document.querySelectorAll(".metric").forEach(btn=>btn.addEventListener("click",()=>{
  const f=btn.dataset.filter;
  activeActionFilter=activeActionFilter===f?"":f;
  if(["CRÍTICO","REVISAR","OK"].includes(f)) els.stateFilter.value=activeActionFilter?f:"";
  else els.stateFilter.value="";
  render();
}));
els.resetOperationalBtn.addEventListener("click",()=>{
  if(!confirm("¿Borrar el stock cargado y las decisiones de bodega? El histórico de consumos se conservará.")) return;
  localStorage.removeItem(STORAGE.stock);
  localStorage.removeItem(STORAGE.lastStock);
  localStorage.removeItem(STORAGE.warehouse);
  stockMap={}; warehouseDecisions={}; unmatchedStock=[]; render();
});
els.exportBtn.addEventListener("click",()=>{
  if(!master.length) return;
  const rows=filteredRows().map(m=>{
    const cpm=cpm3(m);
    return {
      "Medicamento":m.glosaABG,
      "Programa":programFor(m),
      "Controlado":m.controlado?"Sí":"No",
      "Stock":stockFor(m),
      "CPM 3M":cpm,
      "Crítico 20%":cpm===null?null:cpm*.20,
      "Mínimo 40%":cpm===null?null:cpm*.40,
      "Estado":stateFor(m),
      "Acción":actionFor(m),
      "Glosa Bodega":m.glosaBodega
    };
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Control stock");
  XLSX.writeFile(wb,`Control_stock_ABG_${new Date().toISOString().slice(0,10)}.xlsx`);
});

populateMonthSelect();
loadMaster().catch(err=>{
  els.masterStatus.textContent="Error al cargar maestro";
  els.summaryText.textContent=err.message;
  console.error(err);
});
