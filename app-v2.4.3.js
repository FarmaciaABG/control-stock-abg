const STORAGE = {
  consumption: "abg_consumption_v2",
  stock: "abg_stock_v2",
  lastStock: "abg_last_stock_v2",
  warehouse: "abg_warehouse_decisions_v2",
  arsenalAdditions: "abg_arsenal_additions_v1",
  arsenalOverrides: "abg_arsenal_overrides_v1",
  arsenalRemoved: "abg_arsenal_removed_v1",
  inventoryHistory: "abg_inventory_history_v1"
};

const MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"
];

let master = [];
let baseMaster = [];
let masterVersion = "";
let arsenalAdditions = loadJSON(STORAGE.arsenalAdditions, []);
let arsenalOverrides = loadJSON(STORAGE.arsenalOverrides, {});
let arsenalRemoved = loadJSON(STORAGE.arsenalRemoved, []);
let consumptionMap = loadJSON(STORAGE.consumption, {});
let stockMap = loadJSON(STORAGE.stock, {});
let warehouseDecisions = loadJSON(STORAGE.warehouse, {});
let unmatchedStock = [];
let activeActionFilter = "";
let currentInventory = [];
let inventoryHistory = loadJSON(STORAGE.inventoryHistory, []);

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
  monthlyConsumptionCheck: document.getElementById("monthlyConsumptionCheck"),
  arsenalBtn: document.getElementById("arsenalBtn"),
  arsenalDialog: document.getElementById("arsenalDialog"),
  arsenalGlosaABG: document.getElementById("arsenalGlosaABG"),
  arsenalGlosaBodega: document.getElementById("arsenalGlosaBodega"),
  arsenalCategoria: document.getElementById("arsenalCategoria"),
  arsenalPrograma: document.getElementById("arsenalPrograma"),
  arsenalControlado: document.getElementById("arsenalControlado"),
  arsenalDisponibleBodega: document.getElementById("arsenalDisponibleBodega"),
  saveArsenalBtn: document.getElementById("saveArsenalBtn"),
  clearArsenalFormBtn: document.getElementById("clearArsenalFormBtn"),
  arsenalSearch: document.getElementById("arsenalSearch"),
  arsenalTable: document.getElementById("arsenalTable"),
  singleConsumptionBtn: document.getElementById("singleConsumptionBtn"),
  singleConsumptionDialog: document.getElementById("singleConsumptionDialog"),
  singleConsumptionProduct: document.getElementById("singleConsumptionProduct"),
  singleConsumptionMonth: document.getElementById("singleConsumptionMonth"),
  singleConsumptionValue: document.getElementById("singleConsumptionValue"),
  medicineOptions: document.getElementById("medicineOptions"),
  saveSingleConsumptionBtn: document.getElementById("saveSingleConsumptionBtn"),
  weeklyInventoryBtn: document.getElementById("weeklyInventoryBtn"),
  weeklyInventoryDialog: document.getElementById("weeklyInventoryDialog"),
  generateInventoryBtn: document.getElementById("generateInventoryBtn"),
  exportInventoryBtn: document.getElementById("exportInventoryBtn"),
  saveInventoryBtn: document.getElementById("saveInventoryBtn"),
  inventorySummary: document.getElementById("inventorySummary"),
  inventoryTable: document.getElementById("inventoryTable"),
  inventoryHistoryList: document.getElementById("inventoryHistoryList")
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


function applyLocalArsenalChanges() {
  const removed = new Set(arsenalRemoved.map(normalizeText));
  const combined = [];

  baseMaster.forEach(m => {
    const key = normalizeText(m.glosaABG);
    if (removed.has(key)) return;
    combined.push({...m, ...(arsenalOverrides[key] || {}), source: "maestro"});
  });

  arsenalAdditions.forEach(m => {
    const key = normalizeText(m.glosaABG);
    if (removed.has(key)) return;
    const existingIndex = combined.findIndex(x => normalizeText(x.glosaABG) === key);
    const finalMed = {...m, ...(arsenalOverrides[key] || {}), source: "local"};
    if (existingIndex >= 0) combined[existingIndex] = finalMed;
    else combined.push(finalMed);
  });

  master = combined.sort((a,b) => a.glosaABG.localeCompare(b.glosaABG, "es"));
}

function saveArsenalState() {
  saveJSON(STORAGE.arsenalAdditions, arsenalAdditions);
  saveJSON(STORAGE.arsenalOverrides, arsenalOverrides);
  saveJSON(STORAGE.arsenalRemoved, arsenalRemoved);
}

function programFlags(program) {
  return {
    iaaps: program === "IAAPS" || program === "IAAPS/FOFAR",
    fofar: program === "FOFAR" || program === "IAAPS/FOFAR",
    trazador: ["IAAPS","FOFAR","IAAPS/FOFAR"].includes(program)
  };
}

function clearArsenalForm() {
  els.arsenalGlosaABG.value = "";
  els.arsenalGlosaABG.dataset.editKey = "";
  els.arsenalGlosaBodega.value = "";
  els.arsenalCategoria.value = "";
  els.arsenalPrograma.value = "";
  els.arsenalControlado.checked = false;
  els.arsenalDisponibleBodega.checked = true;
  els.saveArsenalBtn.textContent = "Guardar medicamento";
}

function renderArsenalTable() {
  const q = normalizeText(els.arsenalSearch.value);
  const rows = master.filter(m => !q || normalizeText(m.glosaABG + " " + (m.glosaBodega || "")).includes(q));

  els.arsenalTable.innerHTML = rows.map(m => {
    const source = m.source === "local" ? "Agregado localmente" : "Maestro";
    return `<tr>
      <td><strong>${escapeHtml(m.glosaABG)}</strong><br><span class="glosa">${escapeHtml(m.glosaBodega || "—")}</span></td>
      <td>${badge(programFor(m))}</td>
      <td>${m.controlado ? "Sí" : "No"}</td>
      <td>${source}</td>
      <td>
        <button type="button" class="small-btn" data-edit-med="${encodeURIComponent(m.glosaABG)}">Editar</button>
        <button type="button" class="small-btn remove" data-remove-med="${encodeURIComponent(m.glosaABG)}">Retirar</button>
      </td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-edit-med]").forEach(btn => {
    btn.addEventListener("click", () => editArsenalMedication(decodeURIComponent(btn.dataset.editMed)));
  });
  document.querySelectorAll("[data-remove-med]").forEach(btn => {
    btn.addEventListener("click", () => removeArsenalMedication(decodeURIComponent(btn.dataset.removeMed)));
  });
}

function editArsenalMedication(glosa) {
  const med = master.find(m => m.glosaABG === glosa);
  if (!med) return;
  els.arsenalGlosaABG.value = med.glosaABG;
  els.arsenalGlosaABG.dataset.editKey = normalizeText(med.glosaABG);
  els.arsenalGlosaBodega.value = med.glosaBodega || "";
  els.arsenalCategoria.value = med.categoria || "";
  els.arsenalPrograma.value = programFor(med) === "NO TRAZADOR" ? "" : programFor(med);
  els.arsenalControlado.checked = !!med.controlado;
  els.arsenalDisponibleBodega.checked = med.disponibleBodega !== false;
  els.saveArsenalBtn.textContent = "Guardar cambios";
}

function removeArsenalMedication(glosa) {
  if (!confirm(`¿Retirar “${glosa}” del arsenal de esta herramienta?`)) return;
  const key = normalizeText(glosa);
  if (!arsenalRemoved.includes(key)) arsenalRemoved.push(key);
  arsenalAdditions = arsenalAdditions.filter(m => normalizeText(m.glosaABG) !== key);
  delete arsenalOverrides[key];
  saveArsenalState();
  applyLocalArsenalChanges();
  renderArsenalTable();
  populateMedicineOptions();
  render();
}

function upsertArsenalMedication() {
  const glosaABG = els.arsenalGlosaABG.value.trim();
  if (!glosaABG) return alert("La Glosa ABG es obligatoria.");

  const oldKey = els.arsenalGlosaABG.dataset.editKey || "";
  const newKey = normalizeText(glosaABG);
  const flags = programFlags(els.arsenalPrograma.value);

  const record = {
    glosaABG,
    glosaBodega: els.arsenalGlosaBodega.value.trim(),
    categoria: els.arsenalCategoria.value.trim() || "MEDICAMENTO",
    ...flags,
    programa: els.arsenalPrograma.value,
    controlado: els.arsenalControlado.checked,
    disponibleBodega: els.arsenalDisponibleBodega.checked,
    accionSiCritico: els.arsenalControlado.checked || !els.arsenalDisponibleBodega.checked
      ? "INFORMAR QUIEBRE / NO REVISAR BODEGA"
      : "REVISAR BODEGA",
    initialConsumption: {}
  };

  const baseExists = baseMaster.some(m => normalizeText(m.glosaABG) === oldKey || normalizeText(m.glosaABG) === newKey);

  if (oldKey && oldKey !== newKey) {
    if (!arsenalRemoved.includes(oldKey)) arsenalRemoved.push(oldKey);
    arsenalAdditions = arsenalAdditions.filter(m => normalizeText(m.glosaABG) !== oldKey);
    delete arsenalOverrides[oldKey];
  }

  if (baseExists && (!oldKey || oldKey === newKey)) {
    arsenalOverrides[newKey] = record;
  } else {
    const idx = arsenalAdditions.findIndex(m => normalizeText(m.glosaABG) === newKey);
    if (idx >= 0) arsenalAdditions[idx] = record;
    else arsenalAdditions.push(record);
  }

  arsenalRemoved = arsenalRemoved.filter(k => k !== newKey);
  saveArsenalState();
  applyLocalArsenalChanges();

  if (!consumptionMap[newKey]) consumptionMap[newKey] = {};
  saveJSON(STORAGE.consumption, consumptionMap);

  clearArsenalForm();
  renderArsenalTable();
  populateMedicineOptions();
  render();
  alert("Arsenal actualizado.");
}

function populateMedicineOptions() {
  if (!els.medicineOptions) return;
  els.medicineOptions.innerHTML = master.map(m =>
    `<option value="${escapeHtml(m.glosaABG)}"></option>`
  ).join("");
}

function saveSingleConsumption() {
  const name = els.singleConsumptionProduct.value.trim();
  const month = els.singleConsumptionMonth.value;
  const value = n(els.singleConsumptionValue.value);

  if (!name) return alert("Selecciona un medicamento.");
  if (!month) return alert("Selecciona el mes.");
  if (value === null || value < 0) return alert("Ingresa un consumo válido.");

  const med = master.find(m => normalizeText(m.glosaABG) === normalizeText(name));
  if (!med) return alert("El medicamento no está en el arsenal. Agrégalo primero desde “Gestionar arsenal”.");

  const key = normalizeText(med.glosaABG);
  if (!consumptionMap[key]) consumptionMap[key] = {};

  const previous = consumptionMap[key][month];
  if (previous !== undefined && previous !== null) {
    if (!confirm(`Ya existe un consumo de ${month} para ${med.glosaABG}: ${previous}. ¿Reemplazarlo por ${value}?`)) return;
  }

  consumptionMap[key][month] = value;
  saveJSON(STORAGE.consumption, consumptionMap);
  els.singleConsumptionDialog.close();
  els.singleConsumptionProduct.value = "";
  els.singleConsumptionValue.value = "";
  render();
  alert(`Consumo de ${month} guardado para ${med.glosaABG}.`);
}

async function loadMaster() {
  const response = await fetch("./maestro.json", {cache:"no-store"});
  if (!response.ok) throw new Error("No fue posible cargar maestro.json.");
  const payload = await response.json();
  baseMaster = payload.medicamentos || [];
  masterVersion = payload.version || "";
  applyLocalArsenalChanges();

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

  populateMedicineOptions();
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
  const options = MONTHS.map(m => `<option value="${m}">${m[0].toUpperCase()+m.slice(1)}</option>`).join("");
  els.monthSelect.innerHTML = options;
  els.monthSelect.value = previousMonthName();
  if (els.singleConsumptionMonth) {
    els.singleConsumptionMonth.innerHTML = options;
    els.singleConsumptionMonth.value = previousMonthName();
  }
}


function classifyABC() {
  const items = master.map(m => ({med:m, cpm:cpm3(m) ?? 0})).filter(x => x.cpm > 0).sort((a,b) => b.cpm - a.cpm);
  const total = items.reduce((s,x)=>s+x.cpm,0); let acc=0; const classes={};
  items.forEach(x => { acc += x.cpm; const share = total>0 ? acc/total : 1; classes[normalizeText(x.med.glosaABG)] = share<=0.80 ? "A" : (share<=0.95 ? "B" : "C"); });
  master.forEach(m => { const k=normalizeText(m.glosaABG); if(!classes[k]) classes[k]="C"; });
  return classes;
}
function recentInventoryKeys(weeks=4){ const s=new Set(); inventoryHistory.slice(0,weeks).forEach(h=>(h.items||[]).forEach(i=>s.add(normalizeText(i.glosaABG)))); return s; }
function weightedPick(pool,count,abc,recent){ const chosen=[], candidates=[...pool]; function weight(m){ const k=normalizeText(m.glosaABG), cls=abc[k]||"C"; let w=cls==="A"?5:cls==="B"?3:1; if(m.iaaps||m.fofar) w*=2.2; if(recent.has(k)) w*=0.18; return Math.max(w,.01);} while(chosen.length<count&&candidates.length){ const ws=candidates.map(weight), total=ws.reduce((a,b)=>a+b,0); let r=Math.random()*total, idx=0; for(;idx<candidates.length;idx++){r-=ws[idx]; if(r<=0) break;} idx=Math.min(idx,candidates.length-1); chosen.push(candidates[idx]); candidates.splice(idx,1);} return chosen; }
function generateWeeklyInventory(){ const abc=classifyABC(), recent=recentInventoryKeys(4); const g={A:master.filter(m=>(abc[normalizeText(m.glosaABG)]||"C")==="A"),B:master.filter(m=>(abc[normalizeText(m.glosaABG)]||"C")==="B"),C:master.filter(m=>(abc[normalizeText(m.glosaABG)]||"C")==="C")}; let sel=[...weightedPick(g.A,Math.min(9,g.A.length),abc,recent),...weightedPick(g.B,Math.min(4,g.B.length),abc,recent),...weightedPick(g.C,Math.min(2,g.C.length),abc,recent)]; if(sel.length<15){const ks=new Set(sel.map(m=>normalizeText(m.glosaABG))); sel=sel.concat(weightedPick(master.filter(m=>!ks.has(normalizeText(m.glosaABG))),15-sel.length,abc,recent));} currentInventory=sel.slice(0,15).map((m,i)=>({numero:i+1,glosaABG:m.glosaABG,abc:abc[normalizeText(m.glosaABG)]||"C",programa:programFor(m),stockSistema:stockFor(m),stockFisico:null})); renderInventory(); }
function renderInventory(){ if(!currentInventory.length){els.inventoryTable.innerHTML=""; els.inventorySummary.textContent="Aún no se ha generado un listado."; return;} const counts=currentInventory.reduce((a,i)=>(a[i.abc]=(a[i.abc]||0)+1,a),{}); const tracer=currentInventory.filter(i=>i.programa!=="NO TRAZADOR").length; els.inventorySummary.textContent=`15 productos · A: ${counts.A||0} · B: ${counts.B||0} · C: ${counts.C||0} · Trazadores: ${tracer}`; els.inventoryTable.innerHTML=currentInventory.map((i,idx)=>{ const diff=i.stockFisico===null||i.stockSistema===null?null:i.stockFisico-i.stockSistema; const result=diff===null?"":diff===0?"Concordante":"Diferencia"; return `<tr><td>${i.numero}</td><td><strong>${escapeHtml(i.glosaABG)}</strong></td><td>${badge(i.abc)}</td><td>${i.programa==="NO TRAZADOR"?"No":escapeHtml(i.programa)}</td><td>${fmt(i.stockSistema)}</td><td><input class="inventory-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-inv-index="${idx}" value="${i.stockFisico ?? ""}" placeholder="Conteo"></td><td data-diff-index="${idx}">${diff===null?"—":fmt(diff)}</td><td data-result-index="${idx}" class="${result==="Concordante"?"result-ok":result?"result-diff":""}">${result||"—"}</td></tr>`; }).join(""); document.querySelectorAll("[data-inv-index]").forEach(inp=>{
    inp.addEventListener("input",()=>{
      const idx=Number(inp.dataset.invIndex);
      const clean=inp.value.replace(/[^0-9]/g,"");
      if(inp.value!==clean) inp.value=clean;
      const value=clean===""?null:Number(clean);
      currentInventory[idx].stockFisico=value;
      const system=currentInventory[idx].stockSistema;
      const diff=value===null||system===null?null:value-system;
      const result=diff===null?"":diff===0?"Concordante":"Diferencia";
      const diffCell=document.querySelector(`[data-diff-index="${idx}"]`);
      const resultCell=document.querySelector(`[data-result-index="${idx}"]`);
      if(diffCell) diffCell.textContent=diff===null?"—":fmt(diff);
      if(resultCell){
        resultCell.textContent=result||"—";
        resultCell.className=result==="Concordante"?"result-ok":result?"result-diff":"";
      }
    });
    inp.addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        e.preventDefault();
        const inputs=[...document.querySelectorAll("[data-inv-index]")];
        const pos=inputs.indexOf(inp);
        if(pos>=0 && pos<inputs.length-1) inputs[pos+1].focus();
      }
    });
  }); }
function saveCurrentInventory(){ if(!currentInventory.length) return alert("Primero genera un inventario."); inventoryHistory.unshift({fecha:new Date().toISOString(),items:currentInventory.map(x=>({...x}))}); inventoryHistory=inventoryHistory.slice(0,52); saveJSON(STORAGE.inventoryHistory,inventoryHistory); renderInventoryHistory(); alert("Inventario semanal guardado."); }
function renderInventoryHistory(){ els.inventoryHistoryList.innerHTML=inventoryHistory.length?inventoryHistory.slice(0,8).map(h=>`<div class="history-card"><strong>${new Date(h.fecha).toLocaleDateString("es-CL")}</strong> · ${(h.items||[]).length} productos</div>`).join(""):'<div class="history-card">Sin inventarios guardados todavía.</div>'; }
function exportCurrentInventory(){ if(!currentInventory.length) return alert("Primero genera un inventario."); const rows=currentInventory.map(i=>{const diff=i.stockFisico===null||i.stockSistema===null?null:i.stockFisico-i.stockSistema; return {"N°":i.numero,"Medicamento":i.glosaABG,"Clase ABC":i.abc,"Programa":i.programa,"Stock sistema":i.stockSistema,"Stock físico":i.stockFisico,"Diferencia":diff,"Resultado":diff===null?"":diff===0?"Concordante":"Diferencia"};}); const ws=XLSX.utils.json_to_sheet(rows), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Inventario semanal"); XLSX.writeFile(wb,`Inventario_rotativo_ABG_${new Date().toISOString().slice(0,10)}.xlsx`); }

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
  else if (["A","B","C"].includes(value)) cls="neutral";
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


els.arsenalBtn.addEventListener("click", () => {
  clearArsenalForm();
  renderArsenalTable();
  els.arsenalDialog.showModal();
});
els.arsenalSearch.addEventListener("input", renderArsenalTable);
els.saveArsenalBtn.addEventListener("click", upsertArsenalMedication);
els.clearArsenalFormBtn.addEventListener("click", clearArsenalForm);

els.singleConsumptionBtn.addEventListener("click", () => {
  populateMedicineOptions();
  els.singleConsumptionMonth.value = previousMonthName();
  els.singleConsumptionDialog.showModal();
});
els.saveSingleConsumptionBtn.addEventListener("click", saveSingleConsumption);

els.weeklyInventoryBtn.addEventListener("click",()=>{ renderInventoryHistory(); renderInventory(); els.weeklyInventoryDialog.showModal(); });
els.generateInventoryBtn.addEventListener("click",generateWeeklyInventory);
els.exportInventoryBtn.addEventListener("click",exportCurrentInventory);
els.saveInventoryBtn.addEventListener("click",saveCurrentInventory);

populateMonthSelect();
loadMaster().catch(err=>{
  els.masterStatus.textContent="Error al cargar maestro";
  els.summaryText.textContent=err.message;
  console.error(err);
});
