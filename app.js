const STORAGE = {
  master: "abg_master_v1",
  consumption: "abg_consumption_v1",
  stock: "abg_stock_v1",
  lastStock: "abg_last_stock_v1",
  warehouse: "abg_warehouse_decisions_v1"
};

let master = loadJSON(STORAGE.master, []);
let consumptionMap = loadJSON(STORAGE.consumption, {});
let stockMap = loadJSON(STORAGE.stock, {});
let warehouseDecisions = loadJSON(STORAGE.warehouse, {});
let unmatchedStock = [];
let activeActionFilter = "";

const els = {
  masterFile: document.getElementById("masterFile"),
  stockFile: document.getElementById("stockFile"),
  consumptionFile: document.getElementById("consumptionFile"),
  masterStatus: document.getElementById("masterStatus"),
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
  resetBtn: document.getElementById("resetBtn"),
  clearFilters: document.getElementById("clearFilters"),
  dialog: document.getElementById("warehouseDialog"),
  dialogTitle: document.getElementById("dialogTitle"),
  dialogWarehouseName: document.getElementById("dialogWarehouseName")
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
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
  const x = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function boolYes(value) {
  const x = normalizeText(value);
  return ["SI","SÍ","YES","TRUE","1"].includes(x);
}
function findHeader(headers, candidates) {
  const norm = headers.map(normalizeText);
  for (const c of candidates) {
    const target = normalizeText(c);
    const idx = norm.findIndex(h => h === target || h.includes(target));
    if (idx >= 0) return headers[idx];
  }
  return null;
}
function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:"array", cellDates:false});
        resolve(wb);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function sheetToRows(wb, preferredName) {
  let name = preferredName && wb.SheetNames.find(x => normalizeText(x) === normalizeText(preferredName));
  if (!name) name = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {defval:null, raw:true});
}

async function handleMaster(file) {
  const wb = await readWorkbook(file);
  const rows = sheetToRows(wb, "Maestro medicamentos");
  if (!rows.length) throw new Error("El maestro está vacío.");

  const headers = Object.keys(rows[0]);
  const glosaABG = findHeader(headers, ["Glosa ABG"]);
  const glosaBodega = findHeader(headers, ["Glosa Bodega"]);
  const iaaps = findHeader(headers, ["IAAPS"]);
  const fofar = findHeader(headers, ["FOFAR"]);
  const programa = findHeader(headers, ["Programa"]);
  const controlado = findHeader(headers, ["Controlado psicotrópico","Controlado psicotropico"]);
  if (!glosaABG) throw new Error("No encontré la columna “Glosa ABG”.");

  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  master = rows.filter(r => r[glosaABG]).map((r, idx) => {
    const months = {};
    monthNames.forEach(m => {
      const h = headers.find(x => normalizeText(x) === normalizeText(m));
      if (h && n(r[h]) !== null) months[m] = n(r[h]);
    });
    return {
      id: "m" + idx + "_" + normalizeText(r[glosaABG]).slice(0,20),
      glosaABG: String(r[glosaABG]).trim(),
      glosaBodega: glosaBodega ? String(r[glosaBodega] ?? "").trim() : "",
      iaaps: iaaps ? boolYes(r[iaaps]) : false,
      fofar: fofar ? boolYes(r[fofar]) : false,
      programa: programa ? String(r[programa] ?? "").trim() : "",
      controlado: controlado ? boolYes(r[controlado]) : false,
      embeddedMonths: months
    };
  });
  saveJSON(STORAGE.master, master);

  // Si el maestro trae consumos históricos, se usan como base salvo que ya haya consumos cargados.
  if (!Object.keys(consumptionMap).length) {
    master.forEach(m => {
      if (Object.keys(m.embeddedMonths).length) consumptionMap[normalizeText(m.glosaABG)] = m.embeddedMonths;
    });
    saveJSON(STORAGE.consumption, consumptionMap);
  }
  render();
}

async function handleStock(file) {
  if (!master.length) throw new Error("Primero carga el maestro ABG.");
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
  const stamp = new Date().toISOString();
  localStorage.setItem(STORAGE.lastStock, stamp);
  render();
}

async function handleConsumption(file) {
  if (!master.length) throw new Error("Primero carga el maestro ABG.");
  const wb = await readWorkbook(file);
  const rows = sheetToRows(wb);
  if (!rows.length) throw new Error("El archivo de consumos está vacío.");

  const headers = Object.keys(rows[0]);
  const article = findHeader(headers, ["Glosa ABG","ARTÍCULO","ARTICULO","Medicamento","Producto","Glosa"]);
  if (!article) throw new Error("No encontré una columna con el nombre del medicamento.");

  const monthTokens = [
    ["enero","ene"],["febrero","feb"],["marzo","mar"],["abril","abr"],
    ["mayo","may"],["junio","jun"],["julio","jul"],["agosto","ago"],
    ["septiembre","sep"],["octubre","oct"],["noviembre","nov"],["diciembre","dic"]
  ];
  const monthHeaders = [];
  headers.forEach(h => {
    const hn = normalizeText(h).toLowerCase();
    monthTokens.forEach(([full, short]) => {
      if (hn === full || hn === short || hn.startsWith(full+" ") || hn.startsWith(short+" ")) {
        monthHeaders.push({name:full, header:h});
      }
    });
  });
  if (!monthHeaders.length) throw new Error("No encontré columnas mensuales (enero, febrero, marzo, etc.).");

  rows.forEach(r => {
    if (!r[article]) return;
    const key = normalizeText(r[article]);
    const existing = consumptionMap[key] || {};
    monthHeaders.forEach(({name, header}) => {
      const value = n(r[header]);
      if (value !== null) existing[name] = value;
    });
    consumptionMap[key] = existing;
  });
  saveJSON(STORAGE.consumption, consumptionMap);
  render();
}

function getMonthsFor(med) {
  const key = normalizeText(med.glosaABG);
  return consumptionMap[key] || med.embeddedMonths || {};
}
function cpm3(med) {
  const order = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const months = getMonthsFor(med);
  const vals = order.map(m => n(months[m])).filter(v => v !== null).slice(-3);
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}
function stockFor(med) {
  const key = normalizeText(med.glosaABG);
  return Object.prototype.hasOwnProperty.call(stockMap, key) ? stockMap[key] : null;
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
  if (stock < cpm * 0.20) return "CRÍTICO";
  if (stock < cpm * 0.40) return "REVISAR";
  return "OK";
}
function actionFor(m) {
  const state = stateFor(m);
  if (state !== "CRÍTICO") return state === "REVISAR" ? "VIGILAR" : "—";
  if (m.controlado) return "INFORMAR";
  const decision = warehouseDecisions[normalizeText(m.glosaABG)];
  if (decision === "available") return "PEDIR";
  if (decision === "unavailable") return "INFORMAR";
  return "REVISAR BODEGA";
}
function fmt(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("es-CL", {maximumFractionDigits:1});
}
function badge(value) {
  let cls = "neutral";
  if (value === "CRÍTICO") cls="critical";
  else if (value === "REVISAR" || value === "VIGILAR") cls="warning";
  else if (value === "OK") cls="good";
  else if (value === "REVISAR BODEGA" || value === "PEDIR") cls="storage";
  else if (value === "INFORMAR") cls="notify";
  return `<span class="badge ${cls}">${value}</span>`;
}
function filteredRows() {
  const q = normalizeText(els.searchInput.value);
  const p = els.programFilter.value;
  const s = els.stateFilter.value;
  return master.filter(m => {
    const program = programFor(m);
    const state = stateFor(m);
    const action = actionFor(m);
    if (q && !normalizeText(m.glosaABG + " " + m.glosaBodega).includes(q)) return false;
    if (p && program !== p) return false;
    if (s && state !== s) return false;
    if (activeActionFilter === "REVISAR BODEGA" && action !== "REVISAR BODEGA") return false;
    if (activeActionFilter === "INFORMAR" && action !== "INFORMAR") return false;
    if (activeActionFilter === "OK" && state !== "OK") return false;
    if (activeActionFilter === "CRÍTICO" && state !== "CRÍTICO") return false;
    if (activeActionFilter === "REVISAR" && state !== "REVISAR") return false;
    return true;
  });
}
function render() {
  els.masterStatus.textContent = master.length ? `Maestro: ${master.length} fármacos cargados` : "Maestro: no cargado";
  els.consumptionStatus.textContent = Object.keys(consumptionMap).length ? "Consumos: disponibles" : "Consumos: no cargados";
  els.stockStatus.textContent = Object.keys(stockMap).length ? `Stock: ${Object.keys(stockMap).length} productos leídos` : "Stock: no cargado";

  const last = localStorage.getItem(STORAGE.lastStock);
  els.lastUpdate.textContent = last
    ? "Último stock: " + new Date(last).toLocaleString("es-CL")
    : "Sin stock cargado";

  const all = master.map(m => ({m, state:stateFor(m), action:actionFor(m)}));
  document.getElementById("countCritical").textContent = all.filter(x=>x.state==="CRÍTICO").length;
  document.getElementById("countReview").textContent = all.filter(x=>x.state==="REVISAR").length;
  document.getElementById("countWarehouse").textContent = all.filter(x=>x.action==="REVISAR BODEGA").length;
  document.getElementById("countNotify").textContent = all.filter(x=>x.action==="INFORMAR").length;
  document.getElementById("countOk").textContent = all.filter(x=>x.state==="OK").length;

  const rows = filteredRows();
  els.summaryText.textContent = master.length
    ? `${rows.length} de ${master.length} medicamentos mostrados.`
    : "Carga el maestro y el stock para comenzar.";

  els.medTable.innerHTML = rows.map(m => {
    const cpm = cpm3(m);
    const stock = stockFor(m);
    const state = stateFor(m);
    const action = actionFor(m);
    const actionCell = action === "REVISAR BODEGA"
      ? `<button class="action-button" data-review="${encodeURIComponent(m.glosaABG)}">Revisar bodega</button>`
      : badge(action);
    return `<tr>
      <td><strong>${escapeHtml(m.glosaABG)}</strong>${m.controlado ? '<br><span class="badge neutral">Controlado</span>' : ''}</td>
      <td>${badge(programFor(m))}</td>
      <td>${fmt(stock)}</td>
      <td>${fmt(cpm)}</td>
      <td>${fmt(cpm === null ? null : cpm*.20)}</td>
      <td>${fmt(cpm === null ? null : cpm*.40)}</td>
      <td>${badge(state)}</td>
      <td>${actionCell}</td>
      <td class="glosa">${escapeHtml(m.glosaBodega || "—")}</td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-review]").forEach(btn => {
    btn.addEventListener("click", () => openWarehouseReview(decodeURIComponent(btn.dataset.review)));
  });

  if (unmatchedStock.length) {
    els.unmatchedBox.classList.remove("hidden");
    els.unmatchedList.innerHTML = unmatchedStock.slice(0,100).map(x=>`<div class="unmatched-item">${escapeHtml(x)}</div>`).join("");
  } else {
    els.unmatchedBox.classList.add("hidden");
  }
}
function openWarehouseReview(glosa) {
  const med = master.find(m => m.glosaABG === glosa);
  if (!med) return;
  els.dialogTitle.textContent = med.glosaABG;
  els.dialogWarehouseName.innerHTML = `<strong>Buscar en bodega como:</strong><br>${escapeHtml(med.glosaBodega || "Sin glosa de bodega registrada")}`;
  els.dialog.dataset.med = glosa;
  els.dialog.showModal();
}
els.dialog.addEventListener("close", () => {
  const result = els.dialog.returnValue;
  if (!["available","unavailable"].includes(result)) return;
  warehouseDecisions[normalizeText(els.dialog.dataset.med)] = result;
  saveJSON(STORAGE.warehouse, warehouseDecisions);
  render();
});
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

els.masterFile.addEventListener("change", async e => {
  try { if (e.target.files[0]) await handleMaster(e.target.files[0]); }
  catch(err){ alert("Error al cargar maestro: " + err.message); }
  e.target.value="";
});
els.stockFile.addEventListener("change", async e => {
  try { if (e.target.files[0]) await handleStock(e.target.files[0]); }
  catch(err){ alert("Error al cargar stock: " + err.message); }
  e.target.value="";
});
els.consumptionFile.addEventListener("change", async e => {
  try { if (e.target.files[0]) await handleConsumption(e.target.files[0]); }
  catch(err){ alert("Error al cargar consumos: " + err.message); }
  e.target.value="";
});
[els.searchInput, els.programFilter, els.stateFilter].forEach(el => el.addEventListener("input", () => { activeActionFilter=""; render(); }));
els.clearFilters.addEventListener("click", () => {
  els.searchInput.value=""; els.programFilter.value=""; els.stateFilter.value=""; activeActionFilter=""; render();
});
document.querySelectorAll(".metric").forEach(btn => btn.addEventListener("click", () => {
  const f = btn.dataset.filter;
  activeActionFilter = activeActionFilter === f ? "" : f;
  if (["CRÍTICO","REVISAR","OK"].includes(f)) {
    els.stateFilter.value = activeActionFilter ? f : "";
  } else {
    els.stateFilter.value = "";
  }
  render();
}));
els.resetBtn.addEventListener("click", () => {
  if (!confirm("¿Seguro que quieres borrar maestro, consumos, stock y decisiones guardadas en este navegador?")) return;
  Object.values(STORAGE).forEach(k => localStorage.removeItem(k));
  master=[]; consumptionMap={}; stockMap={}; warehouseDecisions={}; unmatchedStock=[];
  render();
});
els.exportBtn.addEventListener("click", () => {
  if (!master.length) return alert("No hay datos para exportar.");
  const rows = filteredRows().map(m => {
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
  const csv=XLSX.utils.sheet_to_csv(ws, {FS:";"});
  const blob=new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="control_stock_ABG.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

render();
