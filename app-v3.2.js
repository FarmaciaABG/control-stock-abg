const VERSION="3.2";
const MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const STORAGE={
  timeline:"abg_v3_consumption_timeline",stock:"abg_v3_stock",prevStock:"abg_v3_prev_stock",lastStock:"abg_v3_last_stock",
  warehouse:"abg_v3_warehouse",arsenalAdd:"abg_v3_arsenal_add",arsenalOverride:"abg_v3_arsenal_override",arsenalRemoved:"abg_v3_arsenal_removed",
  weekly:"abg_v3_weekly_inventory",generalDates:"abg_v3_general_dates",generalHistory:"abg_v3_general_history",
  participants:"abg_v3_participants",orders:"abg_v3_orders",expiries:"abg_v3_expiries",stockouts:"abg_v3_stockouts",
  orderDates:"abg_v3_order_dates"
};
const DEFAULT_ORDER_DATES=["2026-09-17","2026-10-16","2026-11-13","2026-12-18"];
let baseMaster=[],master=[],masterVersion="",pedidoTemplate={};
let timeline=load(STORAGE.timeline,{}),stockMap=load(STORAGE.stock,{}),prevStockMap=load(STORAGE.prevStock,{});
let warehouse=load(STORAGE.warehouse,{}),arsenalAdd=load(STORAGE.arsenalAdd,[]),arsenalOverride=load(STORAGE.arsenalOverride,{});
let arsenalRemoved=load(STORAGE.arsenalRemoved,[]),weeklyHistory=load(STORAGE.weekly,[]),generalDates=load(STORAGE.generalDates,[{date:"2026-09-01",status:"Postergado"},{date:"2026-12-19",status:"Programado"}]);
let generalHistory=load(STORAGE.generalHistory,[]),participants=load(STORAGE.participants,{tens1:"",tens2:"",tens3:"",qf:""});
let orderDates=load(STORAGE.orderDates,DEFAULT_ORDER_DATES);
let ordersHistory=load(STORAGE.orders,[]),expiries=load(STORAGE.expiries,[]),stockouts=load(STORAGE.stockouts,{});
let currentWeekly=[],currentOrder=[],activeQuick="";
let annualDraftOrders=[],annualDraftGeneral=[];

const $=id=>document.getElementById(id);
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/,/g,".").replace(/[^\w.%/+\- ]/g," ").replace(/\s+/g," ").trim()}
function num(v){if(v===null||v===undefined||v==="")return null;if(typeof v==="number")return Number.isFinite(v)?v:null;let s=String(v).trim().replace(/\s/g,"");if(s.includes(",")&&!s.includes("."))s=s.replace(",",".");else if(s.includes(",")&&s.includes(".")){if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"")}const x=Number(s);return Number.isFinite(x)?x:null}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function fmt(v,d=1){return v===null||v===undefined||Number.isNaN(v)?"—":Number(v).toLocaleString("es-CL",{maximumFractionDigits:d})}
function todayISO(){return new Date().toISOString().slice(0,10)}
function sameDay(iso){return iso&&new Date(iso).toISOString().slice(0,10)===todayISO()}
function previousMonthKey(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthLabel(key){const [y,m]=key.split("-").map(Number);return `${MONTHS[m-1][0].toUpperCase()+MONTHS[m-1].slice(1)} ${y}`}
function monthKeyFromName(name,year=2026){return `${year}-${String(MONTHS.indexOf(name)+1).padStart(2,"0")}`}
function badge(v){let c="neutral";if(v==="CRÍTICO")c="critical";else if(["REVISAR","VIGILAR"].includes(v))c="warning";else if(v==="OK")c="good";else if(["REVISAR BODEGA","PEDIR"].includes(v))c="storage";else if(v==="INFORMAR")c="notify";else if(v==="ALTO")c="risk";return `<span class="badge ${c}">${esc(v)}</span>`}
function program(m){if(m.iaaps&&m.fofar)return"IAAPS/FOFAR";if(m.iaaps)return"IAAPS";if(m.fofar)return"FOFAR";return"NO TRAZADOR"}
function applyArsenal(){const removed=new Set(arsenalRemoved);let x=[];baseMaster.forEach(m=>{const k=norm(m.glosaABG);if(!removed.has(k))x.push({...m,...(arsenalOverride[k]||{}),source:"maestro"})});arsenalAdd.forEach(m=>{const k=norm(m.glosaABG);if(!removed.has(k)){const i=x.findIndex(a=>norm(a.glosaABG)===k);const r={...m,...(arsenalOverride[k]||{}),source:"local"};if(i>=0)x[i]=r;else x.push(r)}});master=x.sort((a,b)=>a.glosaABG.localeCompare(b.glosaABG,"es"))}
function ensureTimelineSeed(){let changed=false;master.forEach(m=>{const k=norm(m.glosaABG);if(!timeline[k])timeline[k]={};const init=m.initialConsumption||{};Object.entries(init).forEach(([mn,v])=>{const mk=monthKeyFromName(mn,2026);if(timeline[k][mk]===undefined&&num(v)!==null){timeline[k][mk]=num(v);changed=true}})});if(changed)save(STORAGE.timeline,timeline)}
function getTimeline(m){return timeline[norm(m.glosaABG)]||{}}
function lastMonthValues(m,count=3){const entries=Object.entries(getTimeline(m)).filter(([,v])=>num(v)!==null).sort((a,b)=>a[0].localeCompare(b[0]));return entries.slice(-count).map(([key,v])=>({key,value:num(v)}))}
function cpm3(m){const vals=lastMonthValues(m,3);return vals.length?vals.reduce((s,x)=>s+x.value,0)/vals.length:null}
function trend(m){const vals=lastMonthValues(m,3);if(vals.length<2)return"Sin datos";const first=vals[0].value,last=vals[vals.length-1].value;if(first===0&&last===0)return"Estable";const pct=(last-first)/Math.max(first,1);if(pct>0.15)return"↑ Al alza";if(pct<-0.15)return"↓ A la baja";return"→ Estable"}
function stockFor(m){const k=norm(m.glosaABG);return Object.prototype.hasOwnProperty.call(stockMap,k)?stockMap[k]:null}
function prevStockFor(m){const k=norm(m.glosaABG);return Object.prototype.hasOwnProperty.call(prevStockMap,k)?prevStockMap[k]:null}
function stockDelta(m){const a=stockFor(m),b=prevStockFor(m);return a===null||b===null?null:a-b}
function coverageMonths(m){const c=cpm3(m),s=stockFor(m);return c&&s!==null?s/c:null}
function state(m){const c=cpm3(m),s=stockFor(m);if(s===null)return"SIN STOCK";if(c===null||c<=0)return"SIN CPM";if(s<c*.2)return"CRÍTICO";if(s<c*.4)return"REVISAR";return"OK"}
function action(m){const st=state(m);if(st!=="CRÍTICO")return st==="REVISAR"?"VIGILAR":"—";if(m.controlado||m.disponibleBodega===false)return"INFORMAR";const d=warehouse[norm(m.glosaABG)];if(d==="available")return"PEDIR";if(d==="unavailable")return"INFORMAR";return"REVISAR BODEGA"}
function risk(m){const cov=coverageMonths(m),tr=trend(m),st=state(m);if(st==="CRÍTICO"||cov!==null&&cov<.4)return"ALTO";if(cov!==null&&(cov<1||tr.includes("al alza")&&cov<1.5))return"MEDIO";if(cov===null)return"SIN DATOS";return"BAJO"}
function isOverstock(m){const cov=coverageMonths(m);return cov!==null&&cov>3}
function noRecentConsumption(m){const vals=lastMonthValues(m,2);return vals.length<2||vals.every(x=>x.value===0)}
function expiryStatus(e){const days=Math.ceil((new Date(e.date)-new Date(todayISO()))/86400000);if(days<=30)return"≤30 días";if(days<=90)return"31–90 días";if(days<=180)return"91–180 días";return">180 días"}
function expiryFor(m){return expiries.filter(e=>norm(e.product)===norm(m.glosaABG)).sort((a,b)=>a.date.localeCompare(b.date))[0]||null}
function exceptionsFor(m){const arr=[];if(cpm3(m)===null)arr.push("Sin CPM");if(stockFor(m)===null)arr.push("Sin stock");if(!m.glosaBodega&&!m.controlado)arr.push("Sin glosa bodega");if(!Object.prototype.hasOwnProperty.call(getTimeline(m),previousMonthKey()))arr.push("Sin consumo último mes");return arr}
function readWorkbook(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>{try{res(XLSX.read(new Uint8Array(e.target.result),{type:"array"}))}catch(x){rej(x)}};r.onerror=rej;r.readAsArrayBuffer(file)})}
function sheetRows(wb,name){const n=name&&wb.SheetNames.find(x=>norm(x)===norm(name))||wb.SheetNames[0];return XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:null,raw:true})}
function findHeader(hs,cands){const ns=hs.map(norm);for(const c of cands){const t=norm(c);let i=ns.findIndex(x=>x===t);if(i>=0)return hs[i];i=ns.findIndex(x=>x.includes(t));if(i>=0)return hs[i]}return null}

async function init(){
  const [m,p]=await Promise.all([fetch("./maestro.json",{cache:"no-store"}).then(r=>r.json()),fetch("./pedido_template.json",{cache:"no-store"}).then(r=>r.json())]);
  baseMaster=m.medicamentos||[];masterVersion=m.version||"";pedidoTemplate=p;applyArsenal();ensureTimelineSeed();populateMonths();populateDatalist();renderAll()
}
function populateMonths(){const opts=[];const currentYear=new Date().getFullYear();for(let y=currentYear-1;y<=currentYear+4;y++)MONTHS.forEach((m,i)=>opts.push(`<option value="${y}-${String(i+1).padStart(2,"0")}">${m[0].toUpperCase()+m.slice(1)} ${y}</option>`));$("monthSelect").innerHTML=opts.join("");$("singleMonth").innerHTML=opts.join("");$("monthSelect").value=previousMonthKey();$("singleMonth").value=previousMonthKey()}
function populateDatalist(){$("medicineOptions").innerHTML=master.map(m=>`<option value="${esc(m.glosaABG)}"></option>`).join("")}

async function loadStock(file){
  const wb=await readWorkbook(file),rows=sheetRows(wb);if(!rows.length)throw Error("Archivo de stock vacío");
  const hs=Object.keys(rows[0]),art=findHeader(hs,["ARTÍCULO","ARTICULO","PRODUCTO","MEDICAMENTO"]),stk=findHeader(hs,["TOTAL EN BODEGA","STOCK ACTUAL","STOCK INSTITUCIONAL","STOCK"]);
  if(!art||!stk)throw Error("No encontré las columnas de producto y stock.");
  prevStockMap={...stockMap};save(STORAGE.prevStock,prevStockMap);stockMap={};
  rows.forEach(r=>{if(r[art]){const v=num(r[stk]);if(v!==null)stockMap[norm(r[art])]=v}});
  save(STORAGE.stock,stockMap);localStorage.setItem(STORAGE.lastStock,new Date().toISOString());updateStockouts();renderAll()
}
function updateStockouts(){
  const now=new Date().toISOString();
  master.forEach(m=>{const k=norm(m.glosaABG),s=stockFor(m),rec=stockouts[k];if(s===0&&!rec?.active)stockouts[k]={active:true,start:now,end:null};if(s!==null&&s>0&&rec?.active){rec.active=false;rec.end=now}});
  save(STORAGE.stockouts,stockouts)
}
async function loadMonthlyConsumption(file,key){
  const wb=await readWorkbook(file),rows=sheetRows(wb);if(!rows.length)throw Error("Archivo de consumo vacío");
  const hs=Object.keys(rows[0]),art=findHeader(hs,["GLOSA ABG","ARTÍCULO","ARTICULO","MEDICAMENTO","PRODUCTO","GLOSA"]);if(!art)throw Error("No encontré la columna de medicamento.");
  let ch=findHeader(hs,[monthLabel(key).split(" ")[0],"CONSUMO","CONSUMO MES","CONSUMO MENSUAL","CANTIDAD","TOTAL"]);
  if(!ch){const cand=hs.filter(h=>h!==art).filter(h=>rows.slice(0,30).map(r=>num(r[h])).filter(v=>v!==null).length>=3);if(cand.length===1)ch=cand[0]}
  if(!ch)throw Error("No pude identificar la columna de consumo.");
  const valid=new Set(master.map(m=>norm(m.glosaABG)));let nup=0;
  rows.forEach(r=>{if(!r[art])return;const k=norm(r[art]),v=num(r[ch]);if(valid.has(k)&&v!==null){timeline[k]=timeline[k]||{};timeline[k][key]=v;nup++}});
  save(STORAGE.timeline,timeline);renderAll();alert(`Consumo ${monthLabel(key)} incorporado para ${nup} medicamentos.`)
}
function saveSingleConsumption(){
  const name=$("singleProduct").value,key=$("singleMonth").value,v=num($("singleValue").value);const m=master.find(x=>norm(x.glosaABG)===norm(name));if(!m)return alert("Medicamento no encontrado en arsenal.");if(v===null||v<0)return alert("Ingresa un valor válido.");
  const k=norm(m.glosaABG);timeline[k]=timeline[k]||{};if(timeline[k][key]!==undefined&&!confirm(`Ya existe ${timeline[k][key]} para ${monthLabel(key)}. ¿Reemplazar?`))return;timeline[k][key]=v;save(STORAGE.timeline,timeline);$("singleConsumptionDialog").close();renderAll()
}

function renderMonthlyStatus(){
  const key=previousMonthKey(),missing=master.filter(m=>!Object.prototype.hasOwnProperty.call(getTimeline(m),key));
  const box=$("monthlyStatus");if(!missing.length){box.className="status-strip ok";box.innerHTML=`✅ Consumo de ${monthLabel(key)} cargado para los ${master.length} fármacos.`}
  else{box.className="status-strip warning";box.innerHTML=`⚠️ Consumo de ${monthLabel(key)} incompleto: ${master.length-missing.length} de ${master.length}.<details class="month-missing"><summary>Ver ${missing.length} productos faltantes</summary><ol>${missing.map(m=>`<li>${esc(m.glosaABG)}</li>`).join("")}</ol></details>`}
}
function nextOrderInfo(){
  const today=new Date(todayISO()+"T00:00:00");for(const d of [...orderDates].sort()){const od=new Date(d+"T00:00:00"),diff=Math.round((od-today)/86400000);if(diff>=0)return{date:d,diff,eligible:diff<=3}}return null
}
function nextGeneralInfo(){
  return generalDates.filter(x=>x.status==="Programado"&&x.date>=todayISO()).sort((a,b)=>a.date.localeCompare(b.date))[0]||null
}
function renderAlerts(){
  const a=[];
  const currentYear=String(new Date().getFullYear());
  const hasOrdersThisYear=orderDates.some(d=>d.startsWith(currentYear+"-"));
  const hasGeneralThisYear=generalDates.some(x=>String(x.date||"").startsWith(currentYear+"-"));
  if(!hasOrdersThisYear)a.push(`<div class="alert warning">🗓️ No hay fechas de pedidos configuradas para ${currentYear}. Puedes agregarlas en Configuración anual.</div>`);
  if(!hasGeneralThisYear)a.push(`<div class="alert info">📋 No hay inventarios generales configurados para ${currentYear}.</div>`);
  const o=nextOrderInfo();if(o){if(o.eligible)a.push(`<div class="alert warning">📦 Pedido mensual el ${new Date(o.date+"T00:00:00").toLocaleDateString("es-CL")} · faltan ${o.diff} días. Antes de generarlo se exigirá stock cargado hoy.</div>`);else a.push(`<div class="alert info">Próximo pedido mensual: ${new Date(o.date+"T00:00:00").toLocaleDateString("es-CL")}.</div>`)}
  const g=nextGeneralInfo();if(g)a.push(`<div class="alert info">📋 Próximo inventario general: ${new Date(g.date+"T00:00:00").toLocaleDateString("es-CL")}.</div>`);
  const lastStock=localStorage.getItem(STORAGE.lastStock);if(lastStock&&!sameDay(lastStock))a.push(`<div class="alert warning">Último stock Rayen: ${new Date(lastStock).toLocaleString("es-CL")}. Para pedidos y reporte de trazadores debes actualizar stock el mismo día.</div>`);
  $("alertsArea").innerHTML=a.join("")
}
function renderKPIs(){
  const xs=master.map(m=>({m,st:state(m),ac:action(m),ri:risk(m),ex:exceptionsFor(m)}));
  $("kpiCritical").textContent=xs.filter(x=>x.st==="CRÍTICO").length;$("kpiReview").textContent=xs.filter(x=>x.st==="REVISAR").length;$("kpiWarehouse").textContent=xs.filter(x=>x.ac==="REVISAR BODEGA").length;$("kpiNotify").textContent=xs.filter(x=>x.ac==="INFORMAR").length;$("kpiRisk").textContent=xs.filter(x=>x.ri==="ALTO").length;$("kpiOverstock").textContent=xs.filter(x=>isOverstock(x.m)).length;$("kpiExpiry").textContent=expiries.filter(e=>expiryStatus(e)!==">180 días").length;$("kpiException").textContent=xs.filter(x=>x.ex.length).length
}
function filteredMaster(){const q=norm($("searchInput").value),p=$("programFilter").value,s=$("stateFilter").value;return master.filter(m=>{if(q&&!norm(m.glosaABG+" "+(m.glosaBodega||"")).includes(q))return false;if(p&&program(m)!==p)return false;if(s&&state(m)!==s)return false;if(activeQuick==="critical"&&state(m)!=="CRÍTICO")return false;if(activeQuick==="review"&&state(m)!=="REVISAR")return false;if(activeQuick==="warehouse"&&action(m)!=="REVISAR BODEGA")return false;if(activeQuick==="notify"&&action(m)!=="INFORMAR")return false;if(activeQuick==="risk"&&risk(m)!=="ALTO")return false;if(activeQuick==="overstock"&&!isOverstock(m))return false;if(activeQuick==="expiry"&&!expiryFor(m))return false;if(activeQuick==="exception"&&!exceptionsFor(m).length)return false;return true})}
function renderTable(){
  const rows=filteredMaster();$("summaryText").textContent=`${rows.length} de ${master.length} medicamentos mostrados.`;
  $("medTable").innerHTML=rows.map(m=>{const c=cpm3(m),s=stockFor(m),d=stockDelta(m),cov=coverageMonths(m),ac=action(m);return `<tr><td><strong>${esc(m.glosaABG)}</strong>${m.controlado?'<br><span class="badge neutral">Controlado</span>':''}</td><td>${badge(program(m))}</td><td>${fmt(s)}</td><td>${d===null?"—":(d>0?"+":"")+fmt(d,0)}</td><td>${fmt(c)}</td><td>${cov===null?"—":fmt(cov,2)+" meses"}</td><td>${esc(trend(m))}</td><td>${badge(risk(m))}</td><td>${fmt(c===null?null:c*.2)}</td><td>${fmt(c===null?null:c*.4)}</td><td>${badge(state(m))}</td><td>${ac==="REVISAR BODEGA"?`<button class="secondary warehouse-btn" data-med="${encodeURIComponent(m.glosaABG)}">Revisar bodega</button>`:badge(ac)}</td><td>${esc(m.glosaBodega||"—")}</td></tr>`}).join("");
  document.querySelectorAll(".warehouse-btn").forEach(b=>b.onclick=()=>openWarehouse(decodeURIComponent(b.dataset.med)))
}
function renderAll(){
  $("masterBadge").textContent=`Maestro ABG: ${master.length} fármacos · ${masterVersion}`;const ls=localStorage.getItem(STORAGE.lastStock);$("stockBadge").textContent=ls?`Stock: ${new Date(ls).toLocaleString("es-CL")}`:"Sin stock cargado";renderMonthlyStatus();renderAlerts();renderKPIs();renderTable()
}

function openWarehouse(name){const m=master.find(x=>x.glosaABG===name);$("warehouseTitle").textContent=m.glosaABG;$("warehouseGlosa").innerHTML=`<strong>Buscar en bodega como:</strong><br>${esc(m.glosaBodega||"Sin glosa registrada")}`;$("warehouseDialog").dataset.med=name;$("warehouseDialog").showModal()}
$("warehouseDialog").addEventListener("close",()=>{const r=$("warehouseDialog").returnValue;if(!["available","unavailable"].includes(r))return;const name=$("warehouseDialog").dataset.med,k=norm(name);warehouse[k]=r;save(STORAGE.warehouse,warehouse);if(r==="available"){ordersHistory.unshift({type:"bodega",date:new Date().toISOString(),product:name,status:"Pendiente"});save(STORAGE.orders,ordersHistory)}renderAll()});

function renderArsenal(){const q=norm($("arsenalSearch").value);$("arsenalTable").innerHTML=master.filter(m=>!q||norm(m.glosaABG).includes(q)).map(m=>`<tr><td><strong>${esc(m.glosaABG)}</strong></td><td>${badge(program(m))}</td><td>${m.controlado?"Sí":"No"}</td><td><button type="button" class="secondary edit-med" data-med="${encodeURIComponent(m.glosaABG)}">Editar</button> <button type="button" class="secondary remove-med" data-med="${encodeURIComponent(m.glosaABG)}">Retirar</button></td></tr>`).join("");document.querySelectorAll(".edit-med").forEach(b=>b.onclick=()=>editMed(decodeURIComponent(b.dataset.med)));document.querySelectorAll(".remove-med").forEach(b=>b.onclick=()=>removeMed(decodeURIComponent(b.dataset.med)))}
function clearArsenalForm(){$("arsenalABG").value="";$("arsenalABG").dataset.key="";$("arsenalBodega").value="";$("arsenalProgram").value="";$("arsenalControlled").checked=false}
function editMed(name){const m=master.find(x=>x.glosaABG===name);$("arsenalABG").value=m.glosaABG;$("arsenalABG").dataset.key=norm(m.glosaABG);$("arsenalBodega").value=m.glosaBodega||"";$("arsenalProgram").value=program(m)==="NO TRAZADOR"?"":program(m);$("arsenalControlled").checked=!!m.controlado}
function removeMed(name){if(!confirm(`¿Retirar ${name} del arsenal?`))return;const k=norm(name);if(!arsenalRemoved.includes(k))arsenalRemoved.push(k);arsenalAdd=arsenalAdd.filter(m=>norm(m.glosaABG)!==k);delete arsenalOverride[k];save(STORAGE.arsenalRemoved,arsenalRemoved);save(STORAGE.arsenalAdd,arsenalAdd);save(STORAGE.arsenalOverride,arsenalOverride);applyArsenal();populateDatalist();renderArsenal();renderAll()}
function saveMed(){const name=$("arsenalABG").value.trim();if(!name)return alert("Glosa ABG obligatoria.");const p=$("arsenalProgram").value,flags={iaaps:p==="IAAPS"||p==="IAAPS/FOFAR",fofar:p==="FOFAR"||p==="IAAPS/FOFAR",trazador:!!p};const rec={glosaABG:name,glosaBodega:$("arsenalBodega").value.trim(),categoria:"MEDICAMENTO",...flags,programa:p,controlado:$("arsenalControlled").checked,disponibleBodega:!$("arsenalControlled").checked,initialConsumption:{}};const old=$("arsenalABG").dataset.key,newk=norm(name),base=baseMaster.some(m=>norm(m.glosaABG)===old||norm(m.glosaABG)===newk);if(old&&old!==newk){if(!arsenalRemoved.includes(old))arsenalRemoved.push(old);delete arsenalOverride[old];arsenalAdd=arsenalAdd.filter(m=>norm(m.glosaABG)!==old)}if(base&&(!old||old===newk))arsenalOverride[newk]=rec;else{const i=arsenalAdd.findIndex(m=>norm(m.glosaABG)===newk);if(i>=0)arsenalAdd[i]=rec;else arsenalAdd.push(rec)}arsenalRemoved=arsenalRemoved.filter(k=>k!==newk);save(STORAGE.arsenalRemoved,arsenalRemoved);save(STORAGE.arsenalAdd,arsenalAdd);save(STORAGE.arsenalOverride,arsenalOverride);applyArsenal();timeline[newk]=timeline[newk]||{};save(STORAGE.timeline,timeline);clearArsenalForm();populateDatalist();renderArsenal();renderAll()}

function classifyABC(){const arr=master.map(m=>({m,c:cpm3(m)||0})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c),total=arr.reduce((s,x)=>s+x.c,0);let a=0,map={};arr.forEach(x=>{a+=x.c;const sh=a/total;map[norm(x.m.glosaABG)]=sh<=.8?"A":sh<=.95?"B":"C"});master.forEach(m=>map[norm(m.glosaABG)]=map[norm(m.glosaABG)]||"C");return map}
function weightedPick(pool,n,abc,recent){const c=[...pool],out=[];while(out.length<n&&c.length){const ws=c.map(m=>{let w=(abc[norm(m.glosaABG)]==="A"?5:abc[norm(m.glosaABG)]==="B"?3:1);if(m.iaaps||m.fofar)w*=2.2;if(recent.has(norm(m.glosaABG)))w*=.18;return w});let r=Math.random()*ws.reduce((s,x)=>s+x,0),i=0;for(;i<c.length;i++){r-=ws[i];if(r<=0)break}i=Math.min(i,c.length-1);out.push(c[i]);c.splice(i,1)}return out}
function generateWeekly(){const abc=classifyABC(),recent=new Set();weeklyHistory.slice(0,4).forEach(h=>(h.items||[]).forEach(i=>recent.add(norm(i.product))));const g={A:master.filter(m=>abc[norm(m.glosaABG)]==="A"),B:master.filter(m=>abc[norm(m.glosaABG)]==="B"),C:master.filter(m=>abc[norm(m.glosaABG)]==="C")};let sel=[...weightedPick(g.A,Math.min(9,g.A.length),abc,recent),...weightedPick(g.B,Math.min(4,g.B.length),abc,recent),...weightedPick(g.C,Math.min(2,g.C.length),abc,recent)];if(sel.length<15){const used=new Set(sel.map(m=>norm(m.glosaABG)));sel=sel.concat(weightedPick(master.filter(m=>!used.has(norm(m.glosaABG))),15-sel.length,abc,recent))}currentWeekly=sel.slice(0,15).map((m,i)=>({n:i+1,product:m.glosaABG,abc:abc[norm(m.glosaABG)],tracer:program(m),system:stockFor(m),physical:null}));renderWeekly()}
function renderWeekly(){if(!currentWeekly.length){$("weeklyTable").innerHTML="";$("weeklySummary").textContent="Aún no se genera listado.";return}const counts=currentWeekly.reduce((x,i)=>(x[i.abc]=(x[i.abc]||0)+1,x),{});$("weeklySummary").textContent=`15 productos · A ${counts.A||0} · B ${counts.B||0} · C ${counts.C||0} · IAAPS/FOFAR ${currentWeekly.filter(i=>i.tracer!=="NO TRAZADOR").length}`;$("weeklyTable").innerHTML=currentWeekly.map((i,idx)=>{const d=i.physical===null||i.system===null?null:i.physical-i.system;return `<tr><td>${i.n}</td><td>${esc(i.product)}</td><td>${i.abc}</td><td>${i.tracer==="NO TRAZADOR"?"No":i.tracer}</td><td>${fmt(i.system)}</td><td><input class="inventory-input weekly-input" data-i="${idx}" inputmode="numeric" value="${i.physical??""}"></td><td data-d="${idx}">${fmt(d,0)}</td><td data-r="${idx}" class="${d===0?"result-ok":d!==null?"result-diff":""}">${d===null?"—":d===0?"Concordante":"Diferencia"}</td></tr>`}).join("");document.querySelectorAll(".weekly-input").forEach(inp=>inp.addEventListener("input",()=>{const i=Number(inp.dataset.i),v=inp.value.replace(/\D/g,"");inp.value=v;currentWeekly[i].physical=v===""?null:Number(v);const d=currentWeekly[i].physical===null||currentWeekly[i].system===null?null:currentWeekly[i].physical-currentWeekly[i].system;$(`[data-d="${i}"]`).textContent=fmt(d,0);const rc=$(`[data-r="${i}"]`);rc.textContent=d===null?"—":d===0?"Concordante":"Diferencia";rc.className=d===0?"result-ok":d!==null?"result-diff":""}))}
function saveWeekly(){const resp=$("weeklyResponsible").value.trim();if(!resp)return alert("Indica quién realizó el inventario.");if(!currentWeekly.length)return alert("Genera el listado.");weeklyHistory.unshift({date:$("weeklyDate").value||todayISO(),responsible:resp,items:currentWeekly.map(x=>({...x}))});weeklyHistory=weeklyHistory.slice(0,52);save(STORAGE.weekly,weeklyHistory);renderWeeklyHistory();alert("Inventario guardado.")}
function renderWeeklyHistory(){$("weeklyHistory").innerHTML=weeklyHistory.slice(0,8).map(h=>{const dif=(h.items||[]).filter(i=>i.physical!==null&&i.system!==null&&i.physical!==i.system).length;const done=(h.items||[]).filter(i=>i.physical!==null).length;const acc=done?((done-dif)/done*100):null;return `<div class="history-card"><strong>${new Date(h.date+"T00:00:00").toLocaleDateString("es-CL")}</strong> · ${esc(h.responsible)} · Exactitud ${acc===null?"—":fmt(acc,1)+"%"} · ${dif} diferencias</div>`}).join("")||'<div class="history-card">Sin inventarios guardados.</div>'}
function exportWeekly(){if(!currentWeekly.length)return alert("Genera inventario.");const rows=currentWeekly.map(i=>({"N°":i.n,"Medicamento":i.product,"Clase ABC":i.abc,"Programa":i.tracer,"Stock sistema":i.system,"Stock físico":i.physical,"Diferencia":i.physical===null||i.system===null?null:i.physical-i.system,"Responsable":$("weeklyResponsible").value}));exportWorkbook({"Inventario rotativo":rows},`Inventario_rotativo_ABG_${todayISO()}.xlsx`)}

function renderGeneralCalendar(){$("generalCalendar").innerHTML=generalDates.sort((a,b)=>a.date.localeCompare(b.date)).map((x,i)=>`<div class="calendar-item"><div><strong>${new Date(x.date+"T00:00:00").toLocaleDateString("es-CL")}</strong> · ${esc(x.status)}</div><div class="button-row"><select class="general-status" data-i="${i}"><option ${x.status==="Programado"?"selected":""}>Programado</option><option ${x.status==="Postergado"?"selected":""}>Postergado</option><option ${x.status==="Realizado"?"selected":""}>Realizado</option></select><input class="general-date" data-i="${i}" type="date" value="${x.date}"><button type="button" class="secondary general-remove" data-i="${i}">Eliminar</button></div></div>`).join("");document.querySelectorAll(".general-status").forEach(e=>e.onchange=()=>{generalDates[e.dataset.i].status=e.value;save(STORAGE.generalDates,generalDates);renderAlerts()});document.querySelectorAll(".general-date").forEach(e=>e.onchange=()=>{generalDates[e.dataset.i].date=e.value;save(STORAGE.generalDates,generalDates);renderAlerts()});document.querySelectorAll(".general-remove").forEach(e=>e.onclick=()=>{generalDates.splice(Number(e.dataset.i),1);save(STORAGE.generalDates,generalDates);renderGeneralCalendar();renderAlerts()})}
function generateGeneral(){const names=[$("tens1").value.trim()||"TENS 1",$("tens2").value.trim()||"TENS 2",$("tens3").value.trim()||"TENS 3",$("qfName").value.trim()||"QF"];participants={tens1:names[0],tens2:names[1],tens3:names[2],qf:names[3]};save(STORAGE.participants,participants);const rows=master.map((m,i)=>({"N°":i+1,"Medicamento":m.glosaABG,"Glosa Bodega":m.glosaBodega||"","Responsable conteo":names[i%4],"Stock sistema":stockFor(m),"Conteo físico":"","Diferencia":"","Recuento QF":"","Stock ajustado":"","Observación":"","Vencimiento más próximo":expiryFor(m)?.date||"","Cantidad próxima a vencer":expiryFor(m)?.qty||""}));exportWorkbook({"Inventario general":rows},`Inventario_general_ABG_${todayISO()}.xlsx`)}
async function importGeneral(file){const wb=await readWorkbook(file),rows=sheetRows(wb,"Inventario general");if(!rows.length)return alert("Archivo sin datos.");const hs=Object.keys(rows[0]),prod=findHeader(hs,["MEDICAMENTO"]),sys=findHeader(hs,["STOCK SISTEMA"]),phy=findHeader(hs,["CONTEO FÍSICO","CONTEO FISICO"]),resp=findHeader(hs,["RESPONSABLE CONTEO"]);if(!prod||!phy)return alert("No reconozco la planilla de inventario general.");const items=rows.filter(r=>r[prod]).map(r=>({product:r[prod],system:num(r[sys]),physical:num(r[phy]),responsible:r[resp]||""}));generalHistory.unshift({date:todayISO(),qf:$("qfName").value||participants.qf,items});save(STORAGE.generalHistory,generalHistory);renderGeneralHistory();alert("Inventario general incorporado al historial.")}
function renderGeneralHistory(){$("generalHistory").innerHTML=generalHistory.slice(0,5).map(h=>{const done=h.items.filter(i=>i.physical!==null).length,dif=h.items.filter(i=>i.physical!==null&&i.system!==null&&i.physical!==i.system).length,acc=done?(done-dif)/done*100:null;return `<div class="history-card"><strong>${new Date(h.date+"T00:00:00").toLocaleDateString("es-CL")}</strong> · QF ${esc(h.qf||"—")} · Exactitud ${acc===null?"—":fmt(acc,1)+"%"} · ${dif} diferencias</div>`}).join("")||'<div class="history-card">Sin inventarios generales cargados.</div>'}

function orderEligibility(){const o=nextOrderInfo();if(!o)return{ok:false,msg:"No hay pedidos futuros configurados."};if(!o.eligible)return{ok:false,msg:`El próximo pedido es ${new Date(o.date+"T00:00:00").toLocaleDateString("es-CL")}. Se habilita 3 días antes.`};const ls=localStorage.getItem(STORAGE.lastStock);if(!sameDay(ls))return{ok:false,msg:"Debes cargar el stock Rayen actualizado hoy antes de preparar el pedido."};return{ok:true,date:o.date,msg:`Pedido ${new Date(o.date+"T00:00:00").toLocaleDateString("es-CL")} listo para preparar.`}}
function matchMasterByBodega(product){const k=norm(product);let m=master.find(x=>norm(x.glosaBodega)===k);if(m)return m;const toks=new Set(k.split(" ").filter(x=>x.length>2));let best=null,score=0;master.forEach(x=>{const a=new Set(norm(x.glosaBodega).split(" ").filter(t=>t.length>2)),inter=[...toks].filter(t=>a.has(t)).length,s=inter/Math.max(toks.size,a.size,1);if(s>score){score=s;best=x}});return score>=.78?best:null}
function prepareOrder(){const e=orderEligibility();$("orderStatus").textContent=e.msg;if(!e.ok)return alert(e.msg);currentOrder=[];["MEDICAMENTOS","PATERNIDAD"].forEach(sh=>(pedidoTemplate.sheets[sh]||[]).forEach(r=>{const m=matchMasterByBodega(r.producto);if(!m)return;const c=cpm3(m),s=stockFor(m);if(c===null||s===null)return;const theoretical=Math.max(0,Math.round(c*1.15-s));currentOrder.push({sheet:sh,type:r.tipo,product:r.producto,master:m.glosaABG,cpm:c,stock:s,theoretical,real:theoretical})}));renderOrderTable()}
function renderOrderTable(){$("orderTable").innerHTML=currentOrder.map((r,i)=>`<tr><td>${r.sheet}</td><td>${esc(r.product)}</td><td>${fmt(r.cpm)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.theoretical,0)}</td><td><input class="order-input" data-i="${i}" type="number" min="0" value="${r.real}"></td></tr>`).join("");document.querySelectorAll(".order-input").forEach(x=>x.oninput=()=>currentOrder[Number(x.dataset.i)].real=num(x.value)||0)}
async function exportOrder(){
  const e=orderEligibility();
  if(!e.ok)return alert(e.msg);
  if(!currentOrder.length)return alert("Primero prepara el pedido.");
  if(typeof ExcelJS==="undefined")return alert("No se pudo cargar el módulo para generar la plantilla oficial. Recarga la página.");

  try{
    const response=await fetch("./pedido_template.xlsx",{cache:"no-store"});
    if(!response.ok)throw new Error("No se pudo abrir pedido_template.xlsx");
    const buffer=await response.arrayBuffer();
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    // La solicitud final debe contener solamente MEDICAMENTOS y PATERNIDAD.
    ["INSUMOS","DENTAL","CURACIONES"].forEach(name=>{
      const ws=wb.getWorksheet(name);
      if(ws)wb.removeWorksheet(ws.id);
    });

    const bySheet={};
    ["MEDICAMENTOS","PATERNIDAD"].forEach(sh=>{
      bySheet[sh]=new Map(
        currentOrder.filter(r=>r.sheet===sh).map(r=>[norm(r.product),r])
      );
    });

    ["MEDICAMENTOS","PATERNIDAD"].forEach(sh=>{
      const ws=wb.getWorksheet(sh);
      if(!ws)return;

      // Fecha programada del pedido.
      const [y,m,d]=e.date.split("-").map(Number);
      ws.getCell("F3").value=new Date(y,m-1,d);
      ws.getCell("F3").numFmt="dd-mm-yyyy";

      const map=bySheet[sh];

      // Fila 5 = encabezado; los productos comienzan en fila 6.
      for(let row=6;row<=ws.rowCount;row++){
        const product=String(ws.getCell(row,2).value??"").trim();
        if(!product)continue;
        const x=map.get(norm(product));

        if(x){
          ws.getCell(row,3).value=Math.round(x.cpm*10)/10;   // consumo mensual
          ws.getCell(row,4).value=x.stock;                   // stock actual
          // Mantener la fórmula original de SOLICITUD TEÓRICA de la plantilla.
          ws.getCell(row,6).value=x.real;                    // solicitud real editable
          ws.getCell(row,7).value=null;                      // entrega bodega
        }else{
          // Los productos que no corresponden a medicamentos del maestro quedan fuera del pedido.
          ws.getCell(row,3).value=null;
          ws.getCell(row,4).value=null;
          ws.getCell(row,6).value=null;
          ws.getCell(row,7).value=null;
        }
      }
    });

    wb.calcProperties.fullCalcOnLoad=true;
    wb.calcProperties.forceFullCalc=true;

    const output=await wb.xlsx.writeBuffer();
    const blob=new Blob([output],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`Pedido_Farmacia_ABG_${e.date}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);

    ordersHistory.unshift({
      type:"mensual",
      date:new Date().toISOString(),
      scheduled:e.date,
      status:"Generado",
      items:currentOrder.length
    });
    save(STORAGE.orders,ordersHistory);
    renderOrderHistory();
    renderAlerts();
  }catch(err){
    console.error(err);
    alert("No fue posible generar la plantilla oficial del pedido: "+err.message);
  }
}
function renderOrderHistory(){$("orderHistory").innerHTML=ordersHistory.filter(x=>x.type==="mensual").slice(0,6).map(x=>`<div class="history-card"><strong>${new Date(x.scheduled+"T00:00:00").toLocaleDateString("es-CL")}</strong> · ${esc(x.status)} · ${x.items||0} líneas</div>`).join("")||'<div class="history-card">Sin pedidos mensuales generados.</div>'}

function tracerReportValidation(){
  const key=previousMonthKey();
  const tracers=master.filter(m=>m.trazador);
  const missingConsumption=tracers.filter(m=>!Object.prototype.hasOwnProperty.call(getTimeline(m),key));
  const missingCPM=tracers.filter(m=>cpm3(m)===null);
  const missingStock=tracers.filter(m=>stockFor(m)===null);
  const lastStock=localStorage.getItem(STORAGE.lastStock);
  const stockToday=sameDay(lastStock);
  const ok=!missingConsumption.length&&!missingCPM.length&&!missingStock.length&&stockToday;
  return{ok,key,tracers,missingConsumption,missingCPM,missingStock,stockToday,lastStock};
}

function renderTracerValidation(){
  const v=tracerReportValidation();
  const box=$("tracerValidationStatus"),details=$("tracerValidationDetails"),btn=$("generateTracerReport");
  if(v.ok){
    box.className="status-strip ok";
    box.textContent=`✅ Informe listo para generar · stock actualizado hoy · consumo ${monthLabel(v.key)} completo.`;
  }else{
    box.className="status-strip warning";
    if(!v.stockToday) box.textContent="⚠️ Falta cargar el stock Rayen actualizado de hoy.";
    else if(v.missingConsumption.length) box.textContent=`⚠️ Faltan consumos de ${monthLabel(v.key)} para ${v.missingConsumption.length} trazadores.`;
    else if(v.missingStock.length) box.textContent=`⚠️ Hay ${v.missingStock.length} trazadores sin stock reconocido.`;
    else box.textContent=`⚠️ Hay ${v.missingCPM.length} trazadores sin CPM disponible.`;
  }
  const blocks=[];
  blocks.push(`<div class="tracer-check ${v.stockToday?'tracer-ok':'tracer-bad'}"><strong>${v.stockToday?'✅':'❌'} Stock actual Rayen</strong>${v.stockToday?`Cargado hoy (${todayISO()}).`:`Debes cargar el stock Rayen de hoy antes de generar el informe.`}</div>`);
  blocks.push(`<div class="tracer-check ${v.missingConsumption.length?'tracer-bad':'tracer-ok'}"><strong>${v.missingConsumption.length?'❌':'✅'} Consumo ${monthLabel(v.key)}</strong>${v.missingConsumption.length?`${v.missingConsumption.length} trazadores pendientes.<ul>${v.missingConsumption.map(m=>`<li>${esc(m.glosaABG)}</li>`).join("")}</ul>`:'Completo para todos los trazadores.'}</div>`);
  blocks.push(`<div class="tracer-check ${v.missingCPM.length?'tracer-bad':'tracer-ok'}"><strong>${v.missingCPM.length?'❌':'✅'} CPM últimos 3 meses</strong>${v.missingCPM.length?`${v.missingCPM.length} trazadores sin CPM calculable.<ul>${v.missingCPM.map(m=>`<li>${esc(m.glosaABG)}</li>`).join("")}</ul>`:'Disponible para todos los trazadores.'}</div>`);
  blocks.push(`<div class="tracer-check ${v.missingStock.length?'tracer-bad':'tracer-ok'}"><strong>${v.missingStock.length?'❌':'✅'} Reconocimiento de stock</strong>${v.missingStock.length?`${v.missingStock.length} trazadores no fueron reconocidos en el archivo Rayen.<ul>${v.missingStock.map(m=>`<li>${esc(m.glosaABG)}</li>`).join("")}</ul>`:'Todos los trazadores tienen stock reconocido.'}</div>`);
  details.innerHTML=`<div class="tracer-checks">${blocks.join("")}</div>`;
  btn.disabled=!v.ok;
}

function openTracerReport(){renderTracerValidation();$("tracerReportDialog").showModal()}

function exportTracerReport(){
  const v=tracerReportValidation();
  if(!v.stockToday)return alert("Debes cargar el stock Rayen actualizado hoy antes de generar el informe de trazadores.");
  if(v.missingConsumption.length)return alert(`Faltan consumos de ${monthLabel(v.key)} para ${v.missingConsumption.length} trazadores.`);
  if(v.missingCPM.length)return alert(`Hay ${v.missingCPM.length} trazadores sin CPM de los últimos 3 meses.`);
  if(v.missingStock.length)return alert(`Hay ${v.missingStock.length} trazadores sin stock reconocido. Revísalos antes de generar el informe.`);
  const rows=v.tracers.map(m=>{const c=cpm3(m),s=stockFor(m);return{"Fármaco":m.glosaABG,"Programa":program(m),"CPM últimos 3 meses":c,"20% disponibilidad":c*.2,"Stock actual":s,"Estado":s<c*.2?"BAJO 20%":"OK","Fecha stock":todayISO()}});
  exportWorkbook({"Trazadores":rows},`Trazadores_IAAPS_FOFAR_${todayISO()}.xlsx`);
  $("tracerReportDialog").close();
}

function renderExpiries(){$("expiryTable").innerHTML=expiries.sort((a,b)=>a.date.localeCompare(b.date)).map((e,i)=>`<tr><td>${esc(e.product)}</td><td>${new Date(e.date+"T00:00:00").toLocaleDateString("es-CL")}</td><td>${fmt(e.qty,0)}</td><td class="${expiryStatus(e)==="≤30 días"?"expiry-high":expiryStatus(e)==="31–90 días"?"expiry-med":"expiry-low"}">${expiryStatus(e)}</td><td><button type="button" class="secondary exp-remove" data-i="${i}">Eliminar</button></td></tr>`).join("");document.querySelectorAll(".exp-remove").forEach(b=>b.onclick=()=>{expiries.splice(Number(b.dataset.i),1);save(STORAGE.expiries,expiries);renderExpiries();renderAll()})}
function saveExpiry(){const p=$("expiryProduct").value.trim(),d=$("expiryDate").value,q=num($("expiryQty").value);if(!master.some(m=>norm(m.glosaABG)===norm(p)))return alert("Medicamento no encontrado.");if(!d||q===null)return alert("Completa fecha y cantidad.");expiries.push({product:p,date:d,qty:q,updated:todayISO()});save(STORAGE.expiries,expiries);renderExpiries();renderAll()}

function renderExceptions(){const cards=[];master.forEach(m=>{const ex=exceptionsFor(m);if(ex.length)cards.push(`<div class="exception-card"><strong>${esc(m.glosaABG)}</strong><br>${ex.map(x=>badge(x)).join(" ")}</div>`)});$("exceptionsList").innerHTML=cards.join("")||'<div class="history-card">Sin excepciones.</div>'}

function repeatedDifferences(m){const k=norm(m.glosaABG);let n=0;weeklyHistory.forEach(h=>(h.items||[]).forEach(i=>{if(norm(i.product)===k&&i.physical!==null&&i.system!==null&&i.physical!==i.system)n++}));generalHistory.forEach(h=>(h.items||[]).forEach(i=>{if(norm(i.product)===k&&i.physical!==null&&i.system!==null&&i.physical!==i.system)n++}));return n}
function exportManagement(){const sheets={Críticos:[],Bodega:[],Informar:[],Sobrestock:[],Excepciones:[],Vencimientos:[]};master.forEach(m=>{const row={"Medicamento":m.glosaABG,"Programa":program(m),"Stock":stockFor(m),"CPM 3M":cpm3(m),"Cobertura meses":coverageMonths(m),"Tendencia":trend(m),"Riesgo":risk(m),"Estado":state(m),"Acción":action(m),"Diferencias repetidas":repeatedDifferences(m)};if(state(m)==="CRÍTICO")sheets.Críticos.push(row);if(["REVISAR BODEGA","PEDIR"].includes(action(m)))sheets.Bodega.push(row);if(action(m)==="INFORMAR")sheets.Informar.push(row);if(isOverstock(m))sheets.Sobrestock.push(row);if(exceptionsFor(m).length)sheets.Excepciones.push({...row,"Excepciones":exceptionsFor(m).join(", ")});const e=expiryFor(m);if(e)sheets.Vencimientos.push({...row,"Vencimiento":e.date,"Cantidad":e.qty,"Alerta":expiryStatus(e)})});exportWorkbook(sheets,`Gestion_inventario_ABG_${todayISO()}.xlsx`)}
function exportWorkbook(sheets,filename){const wb=XLSX.utils.book_new();Object.entries(sheets).forEach(([name,rows])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name.slice(0,31)));XLSX.writeFile(wb,filename)}

function backup(){downloadJSON({version:VERSION,date:new Date().toISOString(),timeline,warehouse,arsenalAdd,arsenalOverride,arsenalRemoved,weeklyHistory,generalDates,generalHistory,participants,ordersHistory,expiries,stockouts},`Respaldo_ABG_${todayISO()}.json`)}
function downloadJSON(obj,name){const b=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href)}
async function importBackup(file){const x=JSON.parse(await file.text());if(!confirm("Esto reemplazará los datos guardados localmente. ¿Continuar?"))return;timeline=x.timeline||{};warehouse=x.warehouse||{};arsenalAdd=x.arsenalAdd||[];arsenalOverride=x.arsenalOverride||{};arsenalRemoved=x.arsenalRemoved||[];weeklyHistory=x.weeklyHistory||[];generalDates=x.generalDates||generalDates;generalHistory=x.generalHistory||[];participants=x.participants||participants;ordersHistory=x.ordersHistory||[];expiries=x.expiries||[];stockouts=x.stockouts||{};Object.entries({[STORAGE.timeline]:timeline,[STORAGE.warehouse]:warehouse,[STORAGE.arsenalAdd]:arsenalAdd,[STORAGE.arsenalOverride]:arsenalOverride,[STORAGE.arsenalRemoved]:arsenalRemoved,[STORAGE.weekly]:weeklyHistory,[STORAGE.generalDates]:generalDates,[STORAGE.generalHistory]:generalHistory,[STORAGE.participants]:participants,[STORAGE.orders]:ordersHistory,[STORAGE.expiries]:expiries,[STORAGE.stockouts]:stockouts}).forEach(([k,v])=>save(k,v));applyArsenal();populateDatalist();renderAll();alert("Respaldo importado.")}

$("stockFile").onchange=async e=>{try{if(e.target.files[0])await loadStock(e.target.files[0])}catch(x){alert(x.message)}e.target.value=""};
$("consumptionFile").onchange=async e=>{try{if(e.target.files[0])await loadMonthlyConsumption(e.target.files[0],$("monthSelect").value)}catch(x){alert(x.message)}e.target.value=""};
$("singleConsumptionBtn").onclick=()=>{$("singleProduct").value="";$("singleValue").value="";$("singleMonth").value=previousMonthKey();$("singleConsumptionDialog").showModal()};
$("saveSingleConsumption").onclick=saveSingleConsumption;$("arsenalBtn").onclick=()=>{clearArsenalForm();renderArsenal();$("arsenalDialog").showModal()};$("arsenalSearch").oninput=renderArsenal;$("saveArsenal").onclick=saveMed;$("clearArsenal").onclick=clearArsenalForm;
$("backupBtn").onclick=backup;$("backupFile").onchange=async e=>{if(e.target.files[0])await importBackup(e.target.files[0]);e.target.value=""};
$("weeklyInventoryBtn").onclick=()=>{$("weeklyDate").value=todayISO();renderWeekly();renderWeeklyHistory();$("weeklyInventoryDialog").showModal()};$("generateWeekly").onclick=generateWeekly;$("saveWeekly").onclick=saveWeekly;$("exportWeekly").onclick=exportWeekly;

function annualYearOptions(){
  const y=new Date().getFullYear(),years=[];
  for(let i=y-1;i<=y+4;i++)years.push(i);
  $("annualYear").innerHTML=years.map(v=>`<option value="${v}">${v}</option>`).join("");
  $("annualYear").value=String(y);
}

function loadAnnualDraft(){
  const y=$("annualYear").value;
  annualDraftOrders=orderDates.filter(d=>d.startsWith(y+"-")).sort().map(d=>({date:d}));
  annualDraftGeneral=generalDates.filter(x=>String(x.date||"").startsWith(y+"-"))
    .sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({...x}));
  renderAnnualDraft();
}

function renderAnnualDraft(){
  const y=$("annualYear").value;
  $("annualYearStatus").textContent=`${annualDraftOrders.length} pedido(s) · ${annualDraftGeneral.length} inventario(s) general(es)`;

  $("annualOrderDates").innerHTML=annualDraftOrders.length
    ? annualDraftOrders.map((x,i)=>`<div class="annual-row">
        <input class="annual-order-date" data-i="${i}" type="date" value="${x.date}">
        <span></span>
        <button type="button" class="secondary annual-order-remove" data-i="${i}">Eliminar</button>
      </div>`).join("")
    : `<div class="annual-empty">Sin fechas de pedidos para ${y}.</div>`;

  $("annualGeneralDates").innerHTML=annualDraftGeneral.length
    ? annualDraftGeneral.map((x,i)=>`<div class="annual-row">
        <input class="annual-general-date" data-i="${i}" type="date" value="${x.date}">
        <select class="annual-general-status" data-i="${i}">
          <option ${x.status==="Programado"?"selected":""}>Programado</option>
          <option ${x.status==="Postergado"?"selected":""}>Postergado</option>
          <option ${x.status==="Realizado"?"selected":""}>Realizado</option>
        </select>
        <button type="button" class="secondary annual-general-remove" data-i="${i}">Eliminar</button>
      </div>`).join("")
    : `<div class="annual-empty">Sin inventarios generales para ${y}.</div>`;

  document.querySelectorAll(".annual-order-date").forEach(el=>el.onchange=()=>{annualDraftOrders[Number(el.dataset.i)].date=el.value});
  document.querySelectorAll(".annual-order-remove").forEach(el=>el.onclick=()=>{annualDraftOrders.splice(Number(el.dataset.i),1);renderAnnualDraft()});
  document.querySelectorAll(".annual-general-date").forEach(el=>el.onchange=()=>{annualDraftGeneral[Number(el.dataset.i)].date=el.value});
  document.querySelectorAll(".annual-general-status").forEach(el=>el.onchange=()=>{annualDraftGeneral[Number(el.dataset.i)].status=el.value});
  document.querySelectorAll(".annual-general-remove").forEach(el=>el.onclick=()=>{annualDraftGeneral.splice(Number(el.dataset.i),1);renderAnnualDraft()});
}

function openAnnualConfig(){
  annualYearOptions();
  loadAnnualDraft();
  $("annualConfigDialog").showModal();
}

function saveAnnualConfiguration(){
  const y=$("annualYear").value;
  const validOrders=annualDraftOrders.map(x=>x.date).filter(d=>d&&d.startsWith(y+"-"));
  const validGeneral=annualDraftGeneral.filter(x=>x.date&&x.date.startsWith(y+"-"))
    .map(x=>({date:x.date,status:x.status||"Programado"}));

  orderDates=orderDates.filter(d=>!d.startsWith(y+"-")).concat(validOrders).sort();
  generalDates=generalDates.filter(x=>!String(x.date||"").startsWith(y+"-")).concat(validGeneral)
    .sort((a,b)=>a.date.localeCompare(b.date));

  save(STORAGE.orderDates,orderDates);
  save(STORAGE.generalDates,generalDates);
  renderAlerts();
  renderGeneralCalendar();
  loadAnnualDraft();
  alert(`Configuración ${y} guardada.`);
}

$("annualConfigBtn").onclick=openAnnualConfig;
$("annualYear").onchange=loadAnnualDraft;
$("addOrderDate").onclick=()=>{const y=$("annualYear").value;annualDraftOrders.push({date:`${y}-01-01`});renderAnnualDraft()};
$("addAnnualGeneralDate").onclick=()=>{const y=$("annualYear").value;annualDraftGeneral.push({date:`${y}-01-01`,status:"Programado"});renderAnnualDraft()};
$("saveAnnualConfig").onclick=saveAnnualConfiguration;

$("generalInventoryBtn").onclick=()=>{$("tens1").value=participants.tens1;$("tens2").value=participants.tens2;$("tens3").value=participants.tens3;$("qfName").value=participants.qf;renderGeneralCalendar();renderGeneralHistory();$("generalInventoryDialog").showModal()};$("addGeneralDate").onclick=()=>{generalDates.push({date:todayISO(),status:"Programado"});save(STORAGE.generalDates,generalDates);renderGeneralCalendar()};$("generateGeneral").onclick=generateGeneral;$("generalCompletedFile").onchange=async e=>{if(e.target.files[0])await importGeneral(e.target.files[0]);e.target.value=""};
$("ordersBtn").onclick=()=>{const e=orderEligibility();$("orderStatus").textContent=e.msg;renderOrderTable();renderOrderHistory();$("ordersDialog").showModal()};$("prepareOrder").onclick=prepareOrder;$("exportOrder").onclick=exportOrder;
$("tracerReportBtn").onclick=openTracerReport;$("generateTracerReport").onclick=exportTracerReport;$("expiriesBtn").onclick=()=>{renderExpiries();$("expiriesDialog").showModal()};$("saveExpiry").onclick=saveExpiry;$("exceptionsBtn").onclick=()=>{renderExceptions();$("exceptionsDialog").showModal()};$("exportManagementBtn").onclick=exportManagement;
$("searchInput").oninput=()=>{activeQuick="";renderTable()};$("programFilter").onchange=()=>{activeQuick="";renderTable()};$("stateFilter").onchange=()=>{activeQuick="";renderTable()};$("clearFilters").onclick=()=>{$("searchInput").value="";$("programFilter").value="";$("stateFilter").value="";activeQuick="";renderTable()};
document.querySelectorAll("[data-kpi]").forEach(b=>b.onclick=()=>{activeQuick=activeQuick===b.dataset.kpi?"":b.dataset.kpi;renderTable()});
init().catch(e=>{$("masterBadge").textContent="Error al cargar maestro";$("summaryText").textContent=e.message;console.error(e)});
