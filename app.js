'use strict';
const KEY='brujula_colombia_v1';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const currentMonth=today().slice(0,7);
const id=()=>('id'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
const pesos=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0);
const short=n=>{let v=Math.abs(Number(n)||0);return v>=1000000?(n<0?'-':'')+'$'+(v/1000000).toLocaleString('es-CO',{maximumFractionDigits:1})+' M':v>=1000?(n<0?'-':'')+'$'+(v/1000).toLocaleString('es-CO',{maximumFractionDigits:0})+' mil':pesos(n)};
const num=n=>Number(n)||0;
// COP is displayed without cents. Accept Colombian grouping: 15000, 15.000, $15.000.
function parseCOP(raw){const digits=String(raw??'').trim().replace(/[^\d.,$\s]/g,'').replace(/[^\d]/g,'');return digits?Number(digits):NaN}

const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=(a,b)=>b>0?Math.round(a/b*100):0;
const clamp=n=>Math.max(0,Math.min(100,n));
const monthName=m=>new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1).toLocaleDateString('es-CO',{month:'long',year:'numeric'});
const prettyDate=date=>date?new Date(date+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'Sin fecha';
const cat=['Alimentación','Vivienda','Transporte','Servicios','Salud','Educación','Deudas','Familia','Entretenimiento','Otros'];
const incomeCat=['Trabajo','Negocio','Ingreso extra','Regalos','Otros'];
const colors=['#63e1ad','#76a9ff','#f9bc70','#b8a6ff','#fd91ab','#6bd2e7','#d2aa79','#81dfd9','#b9c5de','#97aabe'];
const taxData={2025:{uvt:49799,source:'https://micrositios.dian.gov.co/renta-personas-naturales-ag-2025/todo-lo-que-usted-debe-saber-sobre-renta/'},2026:{uvt:52374,source:'https://www.dian.gov.co/Paginas/Inicio.aspx'}};
const empty=()=>({transactions:[],budgets:{},goals:[],goalEntries:[],tasks:[],fiscal:{},preferences:{name:'',savingsTarget:0},demo:false});
function load(){if(window.BRUJULA_CLOUD_ENABLED)return empty();try{let o=JSON.parse(localStorage.getItem(KEY));return normalize(o)}catch{return empty()}}
function normalize(o){let d=empty();if(!o||typeof o!=='object'||Array.isArray(o))return d;for(let k of ['transactions','goals','goalEntries','tasks'])if(Array.isArray(o[k]))d[k]=o[k].filter(x=>x&&typeof x==='object').slice(0,50000);if(o.budgets&&typeof o.budgets==='object'&&!Array.isArray(o.budgets))d.budgets=o.budgets;if(o.fiscal&&typeof o.fiscal==='object'&&!Array.isArray(o.fiscal))d.fiscal=o.fiscal;if(o.preferences&&typeof o.preferences==='object')d.preferences={...d.preferences,...o.preferences};d.demo=!!o.demo;return d}
let db=load();let st={highlightTx:null,view:'dashboard',month:currentMonth,taxYear:String(new Date().getFullYear()) in taxData?String(new Date().getFullYear()):'2026',transactionFilter:'all',search:'',modal:null};
function save(){
  if(window.BRUJULA_CLOUD_ENABLED){
    if(!window.brujulaCloud?.ready){toast('Inicia sesión y espera a cargar tu cuenta antes de hacer cambios.');return false}
    const queued=window.brujulaCloud.enqueue(db);
    if(queued)render();
    return queued;
  }
  try{localStorage.setItem(KEY,JSON.stringify(db))}
  catch(e){toast('No se pudo guardar en este navegador. Exporta una copia de tus datos.');return false}
  render();return true
}
function toast(message){const el=document.getElementById('toast-root');el.innerHTML=`<div class="toast">${safe(message)}</div>`;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.innerHTML='',3400)}
function icon(name){return `<svg width="19" height="19" style="vertical-align:middle"><use href="#i-${name}"/></svg>`}
function button(label,act,extra=''){return `<button type="button" class="btn ${extra}" data-action="${act}">${label}</button>`}
function section(title,sub,actText,act){return `<div class="section-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${act?`<button class="tiny-link" data-action="${act}">${actText}</button>`:''}</div>`}
function emptyState(title,body,act,txt){return `<div class="empty"><div class="empty-icon">✦</div><b>${title}</b><p>${body}</p>${act?button(txt,act,'small'):''}</div>`}
function sum(list){return list.reduce((s,x)=>s+num(x.amount),0)}
const txMonth=(m=st.month)=>db.transactions.filter(t=>typeof t.date==='string'&&t.date.slice(0,7)===m);
const txYear=(y)=>db.transactions.filter(t=>typeof t.date==='string'&&t.date.slice(0,4)===String(y));
const byKind=(records,kind)=>records.filter(x=>x.kind===kind);
const spendCat=(m=st.month)=>{let out={};for(let x of byKind(txMonth(m),'expense'))out[x.category]=(out[x.category]||0)+num(x.amount);return out};
const goalSum=g=>sum(db.goalEntries.filter(e=>e.goalId===g.id));
const goalFunding=()=>typeof window.brujulaWalletSummary==='function' ? window.brujulaWalletSummary() : null;
const monthReserve=(m=st.month)=>sum(db.goalEntries.filter(e=>typeof e.date==='string'&&e.date.slice(0,7)===m));
function changeMonth(delta){let [y,m]=st.month.split('-').map(Number);let d=new Date(y,m-1+delta,1);st.month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()}
function render(){document.querySelectorAll('[data-nav]').forEach(x=>{const active=x.dataset.nav===st.view;x.classList.toggle('active',active);x.setAttribute('aria-current',active?'page':'false')});renderTop();let v=document.getElementById('view');v.innerHTML=({dashboard:dashboard,transactions:transactions,budgets:budgets,goals:goals,taxes:taxes,tasks:tasks,settings:settings}[st.view]||dashboard)();}
function renderTop(){const names={dashboard:'Tu panorama financiero',transactions:'Todos tus movimientos',budgets:'Presupuesto mensual',goals:'Tus metas de ahorro',taxes:'Radar tributario Colombia',tasks:'Organiza tu día a día',settings:'Configuración y datos'};document.getElementById('topbar').innerHTML=`<div class="topbar"><div><div class="top-meta">${st.view==='taxes'?'Información fiscal de Colombia':new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}${db.demo?' · DATOS DE DEMOSTRACIÓN':''}</div><h1>${names[st.view]}</h1></div><div class="top-actions"><div class="month-controls"><button type="button" data-action="prevMonth" aria-label="Mes anterior">‹</button><span>${monthName(st.month)}</span><button type="button" data-action="nextMonth" aria-label="Mes siguiente">›</button></div>${button('+ Registrar movimiento','addTx','primary')}</div></div>`}
function metrics(m=st.month){let list=txMonth(m);let income=sum(byKind(list,'income'));let expense=sum(byKind(list,'expense'));let left=income-expense;let target=num((db.budgets[m]||{}).target??db.preferences.savingsTarget);return{income,expense,left,rate:income?Math.round(left/income*100):0,reserve:monthReserve(m),target}}
function dashboard(){let a=metrics();let totalB=Object.values(db.budgets[st.month]||{}).reduce((acc,v)=>acc+((typeof v==='number'&&v>0)?v:0),0);let budgetSpent=spendCat();let leading=Object.entries(budgetSpent).sort((a,b)=>b[1]-a[1]);return `
${db.demo?`<div class="soft warn" style="margin-bottom:16px">Estás viendo datos de ejemplo. Puedes borrarlos desde Configuración cuando quieras.</div>`:''}
<section class="quick-entry" aria-label="Registrar movimientos"><div class="quick-copy"><span class="badge-year">TU DINERO EN ORDEN</span><h2>Registra lo que ganas y lo que gastas</h2><p>Solo necesitas el monto y una categoría. Cada movimiento aparecerá en el mes correspondiente.</p></div><div class="quick-buttons"><button type="button" class="btn primary" data-action="addExpense">− Registrar gasto</button><button type="button" class="btn income-quick" data-action="addIncome">+ Registrar ingreso</button></div></section>
${db.transactions.length===0?`<div class="start-hint"><strong>Empieza con un movimiento:</strong> registra tu ingreso principal o tu primer gasto. ${button('Prefiero ver una demostración','demo','small ghost')}</div>`:''}
<div class="cards">
${metricCard('Ingresos del mes',a.income,'↑','green','Todo lo que recibiste')}
${metricCard('Gastos del mes',a.expense,'↓','orange','Dinero que gastaste')}
${metricCard('Saldo del mes',a.left,'≈','blue','Ingresos menos gastos')}
${metricCard('Ahorro apartado',a.reserve,'◇','purple','Aportes anotados a metas')}
</div>
<div class="grid-2" style="margin-top:18px"><section class="panel"><div class="panel-heading"><div><h3>Flujo de dinero</h3><p>Ingresos y gastos de los últimos 6 meses</p></div><span class="tag">COP</span></div>${chartBars()}</section><section class="panel"><div class="panel-heading"><div><h3>¿En qué se fue tu dinero?</h3><p>Distribución de gastos · ${monthName(st.month)}</p></div></div>${donut(leading)}</section></div>
<div class="grid-2" style="margin-top:18px"><section class="panel"><div class="panel-heading"><div><h3>Movimientos recientes</h3><p>Últimos registrados durante el mes</p></div><button class="tiny-link" data-action="goTx">Ver todos</button></div>${transactionTable(txMonth().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5),true)}</section><section class="panel"><div class="panel-heading"><div><h3>Pulso del presupuesto</h3><p>Límites y gastos por categoría</p></div><button class="tiny-link" data-action="goBudgets">Administrar</button></div>${budgetMini(budgetSpent)}<div class="hr"></div>${num(db.preferences.savingsTarget)>0?`<div style="margin-bottom:15px"><div class="budget-row-head"><b>Meta de ahorro mensual</b><span>${short(a.reserve)} / ${short(num(db.preferences.savingsTarget))}</span></div><div class="progress-track"><div class="progress-fill" style="width:${clamp(percent(a.reserve,num(db.preferences.savingsTarget)))}%"></div></div></div>`:''}<div class="soft ${a.left>=0?'good':'warn'}"><strong>${a.income===0?'Registra ingresos para analizar tu saldo':a.left>=0?'Tu saldo del mes es positivo':'Estás gastando más de lo ingresado'}</strong><div style="margin-top:4px">${a.income?`Margen después de gastos: ${a.rate}% de tus ingresos. `:''}El saldo no equivale necesariamente a dinero ahorrado.</div></div></section></div>`}
function metricCard(label,value,glyph,sty,desc){return `<article class="metric ${sty}"><div class="corner"></div><div class="small-title"><span>${label}</span><span class="glyph">${glyph}</span></div><div class="number" title="${pesos(value)}">${pesos(value)}</div><div class="description">${desc}</div></article>`}
function chartBars(){const months=[];for(let i=5;i>=0;i--){let [y,m]=st.month.split('-').map(Number);let d=new Date(y,m-1-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}let vals=months.map(m=>metrics(m));let max=Math.max(1,...vals.flatMap(x=>[x.income,x.expense]));let W=690,H=188,left=34,base=171,usable=152,group=104;let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Comparación mensual de ingresos y gastos" class="chart">`;for(let k=0;k<=4;k++){let y=base-usable*k/4;svg+=`<line x1="${left}" y1="${y}" x2="686" y2="${y}" stroke="#344259" stroke-dasharray="3 5" opacity=".55"/>`;}vals.forEach((v,i)=>{let x=left+22+i*group;let h1=Math.max(v.income?2:0,v.income/max*usable),h2=Math.max(v.expense?2:0,v.expense/max*usable);svg+=`<rect x="${x}" y="${base-h1}" width="30" height="${h1}" rx="5" fill="#63e1ad"><title>${safe(monthName(months[i]))}: ingresos ${pesos(v.income)}</title></rect><rect x="${x+34}" y="${base-h2}" width="30" height="${h2}" rx="5" fill="#76a9ff"><title>${safe(monthName(months[i]))}: gastos ${pesos(v.expense)}</title></rect>`});svg+='</svg>';return `${svg}<div class="chart-labels">${months.map(m=>`<span>${new Date(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1).toLocaleDateString('es-CO',{month:'short'})}</span>`).join('')}</div><div class="actions-row" style="justify-content:center;margin-top:15px"><span class="small"><span class="dot" style="background:var(--green)"></span>Ingresos</span><span class="small"><span class="dot" style="background:var(--blue)"></span>Gastos</span></div>`}
function donut(leading){if(!leading.length)return emptyState('Sin gastos por ahora','Cuando registres gastos, verás qué categorías consumen más de tu presupuesto.');let total=leading.reduce((a,x)=>a+x[1],0);let start=0;let stops=leading.map(([cat,val],i)=>{let size=val/total*100;let s=`${colors[catIndex(cat)]} ${start}% ${start+size}%`;start+=size;return s});return `<div class="donut-layout"><div class="donut" style="background:conic-gradient(${stops.join(',')})"><div class="donut-hole"><small>Gastos</small><strong>${short(total)}</strong></div></div><div class="legend">${leading.slice(0,6).map(([c,v])=>`<div class="legend-item"><span><span class="dot" style="background:${colors[catIndex(c)]}"></span>${safe(c)}</span><b>${percent(v,total)}%</b></div>`).join('')}</div></div>`}
function catIndex(c){const i=cat.indexOf(c);return i>=0?i:9}
function budgetMini(spends){const bud=db.budgets[st.month]||{};let keys=Object.keys(bud).filter(c=>cat.includes(c)&&num(bud[c])>0);if(!keys.length)return emptyState('Aún no hay límites definidos','Establece un máximo de gasto por categoría para comparar lo planeado con la realidad.','goBudgets','Crear presupuesto');return `<div class="budget-list">${keys.slice(0,5).map(c=>budgetRow(c,num(bud[c]),spends[c]||0)).join('')}</div>`}
function budgetRow(c,limit,spent,edit=false){let p=percent(spent,limit);return `<div><div class="budget-row-head"><b>${safe(c)}</b><span>${short(spent)} <span class="muted">/ ${short(limit)}</span> ${edit?`<button class="tiny-link" data-action="budgetEdit" data-category="${safe(c)}" style="margin-left:6px">Editar</button>`:''}</span></div><div class="progress-track"><div class="progress-fill ${p>=100?'red':p>=80?'orange':''}" style="width:${clamp(p)}%"></div></div><div class="budget-row-foot"><span>${p}% usado</span><span>${spent>limit?`Exceso: ${pesos(spent-limit)}`:`Disponible: ${pesos(limit-spent)}`}</span></div></div>`}
function transactionTable(list,compact=false){if(!list.length)return emptyState('No hay movimientos registrados','Agrega ingresos o gastos para empezar a visualizar tu economía.','addTx','Añadir movimiento');return `<div class="table-wrap"><table><thead><tr><th>Movimiento</th><th>Categoría</th><th>Fecha</th><th style="text-align:right">Monto</th>${compact?'':'<th>Acciones</th>'}</tr></thead><tbody>${list.map(t=>`<tr class="${t.id===st.highlightTx?'tx-new-row':''}"><td><strong>${safe(t.note|| (t.kind==='income'?'Ingreso':'Gasto'))}</strong><div class="muted" style="margin-top:3px;font-size:11px">${safe(t.account==='cash'?'Efectivo':t.account==='bank'&&t.method==='Efectivo'?'Transferencia':t.method||'Sin método')} · ${safe(t.account==='cash'?'Efectivo':t.account==='bank'?'Cuenta':String(t.method||'').toLowerCase()==='efectivo'?'Efectivo':'Cuenta')}</div></td><td><span class="tag">${safe(t.category)}</span></td><td>${prettyDate(t.date)}</td><td style="text-align:right" class="amount ${t.kind}">${t.kind==='income'?'+':'−'}${pesos(t.amount)}</td>${compact?'':`<td><div class="actions-row"><button class="btn small ghost" data-action="editTx" data-id="${safe(t.id)}" aria-label="Editar movimiento">Editar</button><button class="btn small ghost" style="color:var(--red)" data-action="deleteTx" data-id="${safe(t.id)}" aria-label="Eliminar movimiento">Eliminar</button></div></td>`}</tr>`).join('')}</tbody></table></div>`}
function transactions(){let list=txMonth().filter(t=>st.transactionFilter==='all'||t.kind===st.transactionFilter).filter(t=>(t.note+' '+t.category+' '+t.method).toLowerCase().includes(st.search.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));let total=metrics();return `<div class="cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">${metricCard('Ingresos',total.income,'↑','green','Este mes')}${metricCard('Gastos',total.expense,'↓','orange','Este mes')}${metricCard('Saldo',total.left,'≈','blue','Ingresos menos gastos')}</div>${section('Registro de movimientos','Puedes corregir o eliminar cada movimiento.','Exportar CSV','csv')}<div class="panel"><div class="filter-row"><input id="tx-search" placeholder="Buscar por descripción, categoría..." value="${safe(st.search)}"><select id="tx-filter"><option value="all" ${st.transactionFilter==='all'?'selected':''}>Todos los tipos</option><option value="income" ${st.transactionFilter==='income'?'selected':''}>Solo ingresos</option><option value="expense" ${st.transactionFilter==='expense'?'selected':''}>Solo gastos</option></select>${button('+ Movimiento','addTx','primary small')}</div><div id="tx-table">${transactionTable(list)}</div></div>`}
const budgetArtwork={
 'Alimentación':'🍲','Vivienda':'🏡','Transporte':'🛵','Servicios':'💡',
 'Salud':'🩺','Educación':'🎓','Deudas':'💳','Familia':'👨‍👩‍👧',
 'Entretenimiento':'🎮','Otros':'📦'
};
const budgetStatus=(limit,spent)=>{
  if(limit<=0)return {label:'Sin asignar',tone:'neutral'};
  if(spent>limit)return {label:'Excedido',tone:'danger'};
  if(spent>=limit)return {label:'Límite alcanzado',tone:'danger'};
  if(spent/limit>=0.8)return {label:'Cerca del límite',tone:'warning'};
  return {label:'Dentro del límite',tone:'good'};
};
function budgetCategoryCard(c,budget,spent,index){
 const hasLimit=budget>0;
 const percentage=hasLimit?Math.round(spent/budget*100):0;
 const status=budgetStatus(budget,spent);
 const left=budget-spent;
 return `<article class="budget-category-card budget-theme-${index%5}" aria-label="Presupuesto de ${safe(c)}">
   <div class="budget-category-card-head">
     <span class="budget-illustration" role="img" aria-label="Categoría ${safe(c)}">${budgetArtwork[c]||'📦'}</span>
     <button type="button" class="budget-card-edit" data-action="budgetEdit" data-category="${safe(c)}" aria-label="Editar presupuesto de ${safe(c)}" title="Editar presupuesto de ${safe(c)}">
       <span aria-hidden="true" class="budget-edit-pencil">✎</span><span>Editar</span>
     </button>
   </div>
   <h3>${safe(c)}</h3>
   <div class="budget-card-caption">Presupuesto asignado</div>
   <div class="budget-card-amount">${hasLimit?pesos(budget):'Sin definir'}</div>
   <div class="budget-card-progress" role="progressbar" aria-label="Uso del presupuesto de ${safe(c)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,percentage)}">
     <span class="budget-card-progress-bar ${status.tone}" style="width:${Math.min(100,Math.max(0,percentage))}%"></span>
   </div>
   <div class="budget-card-spent"><span>Gastado este mes</span><strong>${pesos(spent)}</strong></div>
   <div class="budget-card-bottom">
     <span class="budget-status budget-status-${status.tone}">${status.label}</span>
     <span class="budget-card-remaining">${!hasLimit?'Sin límite definido':left>=0?'Quedan '+pesos(left):'Exceso '+pesos(-left)}</span>
   </div>
 </article>`;
}
function budgetOverviewItem(c,budget,spent,index){
 const assigned=budget>0;
 const percentage=assigned?Math.round(spent/budget*100):0;
 const state=budgetStatus(budget,spent);
 const remaining=budget-spent;
 return `<div class="budget-overview-item">
   <div class="budget-overview-category">
     <span class="budget-overview-illustration budget-theme-${index%5}" aria-hidden="true">${budgetArtwork[c]||'📦'}</span>
     <div><strong>${safe(c)}</strong><small class="budget-status budget-status-${state.tone}">${state.label}</small></div>
   </div>
   <div class="budget-overview-value"><small>Asignado</small><strong>${assigned?pesos(budget):'Sin definir'}</strong></div>
   <div class="budget-overview-value"><small>Gastado</small><strong>${pesos(spent)}</strong></div>
   <div class="budget-overview-remaining"><small>${assigned&&remaining<0?'Exceso':'Disponible'}</small>
     <strong>${assigned?pesos(Math.abs(remaining)):'—'}</strong>
     <span class="budget-overview-track" role="progressbar" aria-label="Uso de ${safe(c)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,percentage)}">
       <span class="budget-overview-fill ${state.tone}" style="width:${Math.min(100,Math.max(0,percentage))}%"></span>
     </span>
   </div>
   <button type="button" class="budget-overview-edit" data-action="budgetEdit" data-category="${safe(c)}" aria-label="Editar presupuesto de ${safe(c)}" title="Editar presupuesto de ${safe(c)}">
     <span class="budget-edit-pencil" aria-hidden="true">✎</span><span>Editar</span>
   </button>
 </div>`;
}
function budgets(){
 const bd=db.budgets[st.month]||{},sp=spendCat();
 const budgetTotal=cat.reduce((total,c)=>total+num(bd[c]),0);
 const spentTotal=cat.reduce((total,c)=>total+num(sp[c]),0);
 const used=budgetTotal>0?Math.round(spentTotal/budgetTotal*100):0;
 const count=cat.filter(c=>num(bd[c])>0).length;
 const featuredCats=[...cat].sort((a,b)=>
   Number(num(bd[b])>0)-Number(num(bd[a])>0) || cat.indexOf(a)-cat.indexOf(b));
 return `<section class="budget-page-hero">
   <div class="budget-page-hero-copy">
     <span class="badge-year">CONTROL POR CATEGORÍAS</span>
     <h2>Tu dinero, organizado a tu manera</h2>
     <p>Desliza las tarjetas para consultar cada categoría y toca <strong>Editar</strong> para asignar su presupuesto. Los límites se guardan por mes.</p>
   </div>
   <div class="budget-page-hero-month">${safe(monthName(st.month))}</div>
 </section>
 <section class="budget-featured" aria-label="Presupuestos por categoría">
   <div class="budget-featured-header">
     <div><h3>Explora tus categorías</h3><p>Desliza a los lados para verlas todas</p></div>
     <div class="budget-carousel-controls">
       <button type="button" class="budget-carousel-arrow" data-action="budgetsPrev" aria-label="Ver categorías anteriores" title="Anterior">‹</button>
       <button type="button" class="budget-carousel-arrow" data-action="budgetsNext" aria-label="Ver siguientes categorías" title="Siguiente">›</button>
     </div>
   </div>
   <div id="budget-featured-track" class="budget-featured-track" role="region" aria-label="Tarjetas de presupuestos desplazables" tabindex="0">
     ${featuredCats.map(c=>budgetCategoryCard(c,num(bd[c]),num(sp[c]),cat.indexOf(c))).join('')}
   </div>
   <div class="budget-carousel-help">Desliza ← → o utiliza los botones para explorar las 10 categorías</div>
 </section>
 <section class="budget-full-picture" aria-labelledby="budget-full-heading">
   <div class="budget-full-header">
     <div><span class="badge-year">PANORAMA DEL MES</span><h2 id="budget-full-heading">Resumen completo de tus presupuestos</h2>
       <p>${count} de ${cat.length} categorías con presupuesto definido · ${safe(monthName(st.month))}</p></div>
     <button type="button" class="btn budget-copy-month" data-action="copyBudgets">Copiar presupuestos del mes anterior</button>
   </div>
   <div class="budget-summary-stats">
     <div><span>Presupuesto asignado</span><strong>${pesos(budgetTotal)}</strong></div>
     <div><span>Gasto del mes</span><strong>${pesos(spentTotal)}</strong></div>
     <div class="${spentTotal>budgetTotal?'over-budget':''}"><span>Diferencia</span><strong>${pesos(budgetTotal-spentTotal)}</strong></div>
   </div>
   <div class="budget-overall-progress">
     <div><strong>Uso del presupuesto total</strong><span>${budgetTotal?used+'% utilizado':'Sin límites definidos'}</span></div>
     <div class="budget-overall-progress-track"><div class="budget-overall-progress-fill ${used>=100?'danger':used>=80?'warning':'good'}" style="width:${Math.min(100,Math.max(0,used))}%"></div></div>
   </div>
   <div class="budget-overview-list" aria-label="Todas las categorías y sus presupuestos">
     ${cat.map((c,index)=>budgetOverviewItem(c,num(bd[c]),num(sp[c]),index)).join('')}
   </div>
   <p class="budget-footnote">Los presupuestos son límites de gasto, no dinero separado de tus cuentas. Los gastos se actualizan con los movimientos de cada mes. Una categoría puede registrar gastos aunque no tenga límite definido.</p>
 </section>`;
}

function goals(){let all=db.goals;let totalGoal=all.reduce((a,g)=>a+num(g.target),0),gSaved=all.reduce((a,g)=>a+goalSum(g),0);const funding=goalFunding();return `<div class="hero"><div><span class="badge-year">METAS CONCRETAS</span><h2 style="margin-top:10px">Dale un destino a tu dinero</h2><p>Registra lo que realmente apartas para tus metas. Los aportes se contabilizan por separado de los gastos para evitar duplicarlos.</p></div>${button('+ Nueva meta','addGoal','primary')}</div><section class="goal-funds-summary" aria-label="Dinero para metas"><div><span>Dinero total</span><strong>${pesos(funding?.total??0)}</strong></div><div><span>Ahorrado en metas</span><strong>${pesos(funding?.reserved??gSaved)}</strong></div><div class="goal-funds-free"><span>Disponible para aportar</span><strong>${pesos(funding?.unallocated??0)}</strong></div><p>El ahorro reservado ya está dentro del dinero de tus cuentas y efectivo; no se cuenta dos veces.</p></section><div class="cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">${metricCard('Metas activas',all.length,'◇','purple','Objetivos registrados')}${metricCard('Total de objetivos',totalGoal,'◎','blue','Dinero que quieres acumular')}${metricCard('Total apartado',gSaved,'↑','green','Aportes registrados')}</div>${section('Objetivos de ahorro','Progreso acumulado de tus metas')}${all.length?`<div class="goal-grid">${all.map(g=>{let s=goalSum(g),p=percent(s,num(g.target));return `<article class="panel goal-card"><div class="goal-top"><span class="tag info">${safe(g.icon||'🎯')} ${g.deadline?'Meta con fecha':'Meta personal'}</span><button class="btn small ghost" data-action="deleteGoal" data-id="${safe(g.id)}" aria-label="Eliminar meta">Eliminar</button></div><h3>${safe(g.title)}</h3><p>${g.deadline?'Fecha objetivo: '+prettyDate(g.deadline):'Sin fecha límite'}</p><div class="goal-total">${pesos(s)}</div><div class="muted small">de ${pesos(g.target)} · ${p}% completado</div><div class="progress-track" style="height:10px;margin-top:13px"><div class="progress-fill" style="width:${clamp(p)}%"></div></div><div class="goal-actions"><button class="btn small primary" data-action="addContribution" data-id="${safe(g.id)}">+ Añadir aporte</button><button class="btn small" data-action="goalHistory" data-id="${safe(g.id)}">Ver aportes</button></div></article>`}).join('')}</div>`:emptyState('Tu primera meta comienza aquí','Crea una meta para fondo de emergencia, estudios, vacaciones o lo que quieras.','addGoal','Crear meta')}`}
function fiscalRecord(y){return {patrimony:null,card:null,purchases:null,deposits:null,additional:0,vat:false,...(db.fiscal[y]||{})}}
function taxResults(y){let f=fiscalRecord(y),uvt=taxData[y].uvt,limit=1400*uvt,wealth=4500*uvt;let ledger=sum(byKind(txYear(y),'income'));let extra=num(f.additional),income=ledger+extra;let rows=[{name:'Ingresos brutos',value:income,limit,mode:'gte',detail:'Ingresos registrados durante el año + ingresos adicionales.'},{name:'Patrimonio bruto al 31 de diciembre',value:f.patrimony,limit:wealth,mode:'gt',detail:'Bienes y derechos antes de restar deudas.'},{name:'Consumos con tarjeta de crédito',value:f.card,limit,mode:'gt',detail:'Total anual de consumos con tarjetas de crédito.'},{name:'Compras y consumos',value:f.purchases,limit,mode:'gt',detail:'Compras y consumos anuales, registrados por separado.'},{name:'Consignaciones, depósitos e inversiones',value:f.deposits,limit,mode:'gt',detail:'Total acumulado anual. No equivale necesariamente a ingresos.'}];let flagged=rows.filter(r=>r.value!==null&& (r.mode==='gte'?num(r.value)>=r.limit:num(r.value)>r.limit));return{f,uvt,limit,wealth,rows,flagged,ledger,obligated:flagged.length>0||!!f.vat}}
function taxes(){let y=st.taxYear,o=taxResults(y),f=o.f;return `<div class="notice"><span class="notice-symbol">⚖</span><div><b>Declarar no siempre significa pagar</b><p>Este radar detecta posibles motivos para presentar declaración de renta de personas naturales residentes fiscales. No liquida impuestos ni determina por sí solo tu obligación definitiva. Registra los datos completos de cada año para una orientación útil.</p></div></div><div class="panel" style="margin-bottom:17px"><div class="panel-heading"><div><h3>Selecciona el año gravable</h3><p>La UVT cambia según el año al que corresponden tus ingresos</p></div><select id="tax-year" style="width:160px">${Object.keys(taxData).map(y=>`<option value="${y}" ${st.taxYear===y?'selected':''}>${y}</option>`).join('')}</select></div><div class="stats-row"><div class="stat-mini"><small>UVT del año ${y}</small><b>${pesos(o.uvt)}</b></div><div class="stat-mini"><small>Tope de ingresos · 1.400 UVT</small><b>${pesos(o.limit)}</b></div><div class="stat-mini"><small>Tope de patrimonio · 4.500 UVT</small><b>${pesos(o.wealth)}</b></div></div></div>
<div class="grid-2"><section class="panel"><div class="panel-heading"><div><h3>Indicadores fiscales ${y}</h3><p>Compara los datos registrados con las reglas oficiales</p></div><span class="tag ${o.obligated?'warn':'info'}">${o.obligated?'Revisar declaración':'Evaluación parcial'}</span></div>${o.obligated?`<div class="soft warn" style="margin-bottom:15px"><strong>Hay al menos un criterio que puede obligarte a declarar.</strong><div style="margin-top:4px">${o.flagged.map(r=>safe(r.name)).join(', ')}${f.vat?(o.flagged.length?', ':'')+'Responsable del IVA':''}. Verifica tu situación concreta antes de presentar.</div></div>`:`<div class="soft info" style="margin-bottom:15px"><strong>No se detectan topes superados con los valores ingresados.</strong><div style="margin-top:4px">Si tus datos están incompletos, este resultado no significa que estés exento de declarar.</div></div>`}<div class="tax-list">${o.rows.map(r=>{let met=r.value!==null&&(r.mode==='gte'?num(r.value)>=r.limit:num(r.value)>r.limit);let p=percent(num(r.value),r.limit);return `<div class="tax-row"><div class="tax-top"><div><b>${safe(r.name)}</b><p>${safe(r.detail)}</p></div><div class="tax-value">${r.value===null?'<span class="muted">Sin dato</span>':pesos(r.value)}</div></div><div class="progress-track"><div class="progress-fill ${met?'red':p>=80?'orange':''}" style="width:${clamp(p)}%"></div></div><div class="tax-bottom"><span>${r.value===null?'Pendiente':p+'% del tope'}</span><span>Tope: ${pesos(r.limit)}</span></div></div>`}).join('')}</div><div class="soft" style="margin-top:15px">${y==='2025'?'Las declaraciones correspondientes al año gravable 2025 tuvieron vencimientos entre agosto y octubre de 2026, según NIT.':'Los plazos de declaración del año gravable 2026 corresponden al calendario de 2027 y deben confirmarse oficialmente.'}</div></section>
<section class="panel"><div class="panel-heading"><div><h3>Completa tu información</h3><p>Se guarda por año, sin enviar datos a la DIAN</p></div></div><form id="fiscal-form" class="form-grid"><div class="field full"><label>Ingresos adicionales no registrados en Movimientos (COP)</label><input name="additional" type="number" min="0" step="1" value="${num(f.additional)}" required><small class="muted">Ya se sumaron ${pesos(o.ledger)} de ingresos guardados en Movimientos para ${y}.</small></div><div class="field full"><label>Patrimonio bruto al cierre del año (COP)</label><input name="patrimony" type="number" min="0" step="1" placeholder="Sin información" value="${f.patrimony??''}"></div><div class="field full"><label>Consumos con tarjeta de crédito (COP)</label><input name="card" type="number" min="0" step="1" placeholder="Total anual" value="${f.card??''}"></div><div class="field full"><label>Compras y consumos del año (COP)</label><input name="purchases" type="number" min="0" step="1" placeholder="Total anual" value="${f.purchases??''}"></div><div class="field full"><label>Consignaciones, depósitos e inversiones (COP)</label><input name="deposits" type="number" min="0" step="1" placeholder="Total anual" value="${f.deposits??''}"></div><label class="field full" style="display:flex;align-items:flex-start;gap:10px"><input type="checkbox" name="vat" ${f.vat?'checked':''}><span class="small">Fui responsable del IVA al 31 de diciembre de ${y}.</span></label><div class="field full">${button('Guardar evaluación tributaria','saveFiscal','primary full')}</div></form><div class="hr"></div><h3 style="font-size:14px">Otros impuestos por revisar</h3><p class="small muted" style="line-height:1.7">Según tu actividad y bienes, también podrían aplicar IVA, impuesto de industria y comercio (ICA) municipal, predial o impuesto de vehículos. No hay un único tope de ingresos que permita decidir todos esos impuestos.</p><div class="soft info">Para IVA, ICA y otros regímenes se necesita información adicional sobre actividad económica, municipio, RUT y bienes. No están calculados automáticamente en esta versión.</div></section></div>
<div class="panel" style="margin-top:17px"><div class="panel-heading"><h3>Fuentes oficiales</h3><span class="tag">DIAN · revisado noviembre de 2026</span></div><div class="small" style="line-height:2"><a href="${taxData[y].source}" target="_blank" rel="noopener">DIAN: información tributaria y UVT para ${y}</a><br><a href="https://normograma.dian.gov.co/dian/compilacion/docs/decreto_2229_2023.htm" target="_blank" rel="noopener">Decreto 2229 de 2023 — requisitos para no declarar</a><br><a href="https://micrositios.dian.gov.co/renta-personas-naturales-ag-2025/" target="_blank" rel="noopener">DIAN — declaración de personas naturales, año gravable 2025</a></div><p class="small muted" style="line-height:1.6">Los topes se muestran con el producto exacto UVT × número de UVT, por lo que pueden diferir unos pocos pesos de cifras oficiales publicadas redondeadas al millar. Se aplican criterios distintos para alcanzar el umbral de ingresos y exceder los demás umbrales.</p></div>`}
function tasks(){let items=[...db.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||(a.due||'9999').localeCompare(b.due||'9999'));let pending=items.filter(x=>!x.done),done=items.filter(x=>x.done),overdue=pending.filter(x=>x.due&&x.due<today());return `<div class="hero"><div><span class="badge-year">VIDA EN ORDEN</span><h2 style="margin-top:10px">Lo importante, en un solo lugar</h2><p>Organiza tus pendientes personales, académicos, financieros o del trabajo con fechas y prioridades.</p></div>${button('+ Nueva tarea','addTask','primary')}</div><div class="cards" style="grid-template-columns:repeat(3,minmax(0,1fr))">${metricCard('Pendientes',pending.length,'○','blue','Por completar')}${metricCard('Completadas',done.length,'✓','green','En total')}${metricCard('Atrasadas',overdue.length,'!','orange','Con fecha vencida')}</div>${section('Tu lista de tareas','Ordenadas por estado y fecha')}${items.length?`<section class="panel"><div class="task-list">${items.map(t=>`<div class="task ${t.done?'done':''}"><input type="checkbox" aria-label="Completar ${safe(t.title)}" data-task="${safe(t.id)}" ${t.done?'checked':''}><div class="task-text"><b>${safe(t.title)}</b><p>${t.due?'Fecha: '+prettyDate(t.due):'Sin vencimiento'}</p></div><span class="tag task-priority ${t.priority==='Alta'?'warn':t.priority==='Baja'?'info':''}">${safe(t.priority||'Media')}</span><button class="btn small ghost" data-action="deleteTask" data-id="${safe(t.id)}">×</button></div>`).join('')}</div></section>`:emptyState('No tienes tareas pendientes','Crea tu primera tarea para organizar tu semana.','addTask','Crear tarea')}`}
function settings(){return `<div class="grid-equal"><section class="panel"><div class="panel-heading"><h3>Perfil y preferencias</h3></div><form id="profile-form" class="form-grid"><div class="field full"><label>Cómo quieres que te llamemos</label><input name="name" maxlength="80" placeholder="Tu nombre (opcional)" value="${safe(db.preferences.name)}"></div><div class="field full"><label>Meta de ahorro mensual de referencia (COP)</label><input name="savingsTarget" type="number" min="0" step="1" value="${num(db.preferences.savingsTarget)}"><small class="muted">Esta es solo una meta orientativa, no se descuenta automáticamente.</small></div><div class="field full"><button type="submit" class="btn primary full">Guardar preferencias</button></div></form></section><section class="panel"><div class="panel-heading"><h3>Privacidad y copia de seguridad</h3></div><p class="subtitle">Todo se guarda en este navegador mediante almacenamiento local. Si borras sus datos, cambias de dispositivo o abres el archivo desde otra ubicación, tus registros pueden dejar de estar disponibles. No hay cuenta ni sincronización.</p><div class="actions-row">${button('Descargar respaldo JSON','exportData','primary')}${button('Importar respaldo','importData')}${button('Exportar CSV','csv')}</div><div class="hr"></div><div class="soft"><strong>Recomendación:</strong> descarga una copia cada semana y guárdala en un lugar seguro. El JSON puede contener datos financieros privados.</div></section></div><div class="grid-equal" style="margin-top:17px"><section class="panel"><div class="panel-heading"><h3>Datos de ejemplo</h3></div><p class="small muted" style="line-height:1.7">Prueba gráficos y presupuestos con datos ficticios. Solo puedes activar el ejemplo cuando todavía no tienes datos propios.</p>${demoAllowed()?button('Cargar demostración','demo','small'):'<p class="small muted">Para ver la demostración, primero exporta un respaldo y borra los datos actuales. Tus saldos reales están protegidos.</p>'}</section><section class="panel"><div class="panel-heading"><h3>Borrar información</h3></div><p class="small muted" style="line-height:1.7">Eliminarás movimientos, metas, presupuestos, tareas y evaluaciones fiscales guardados en este navegador.</p>${button('Borrar todos mis datos','erase','danger small')}</section></div><div class="panel" style="margin-top:17px"><h3>Acerca de la versión 1.0</h3><p class="small muted" style="line-height:1.8">Incluye control manual de finanzas, presupuestos, metas de ahorro, tareas y alertas orientativas de declaración de renta para 2025 y 2026. No conecta bancos, no presenta declaraciones, no calcula el impuesto de renta a pagar ni calcula IVA o ICA, no sincroniza entre equipos y no ofrece notificaciones en segundo plano.</p></div>`}
function showModal(title,html){document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${safe(title)}"><div class="modal-header"><h2>${safe(title)}</h2><button type="button" class="close-modal" data-action="closeModal" aria-label="Cerrar">×</button></div>${html}</div></div>`;document.querySelector('.modal input,.modal select')?.focus()}
function closeModal(){document.getElementById('modal-root').innerHTML=''}
function openTx(t,initialKind){
  const edit=!!t,kind=t?.kind||initialKind||'expense';
  const chosen=t?.date||(st.month===currentMonth?today():st.month+'-01');
  const categoryOptions=(kind==='income'?incomeCat:cat).map(x=>`<option value="${safe(x)}" ${x===t?.category?'selected':''}>${safe(x)}</option>`).join('');
  const payOptions=['Efectivo','Transferencia','Débito','Crédito','Otro'].map(x=>`<option value="${x}" ${x===t?.method?'selected':''}>${x}</option>`).join('');
  showModal(edit?'Editar movimiento':'Registrar movimiento',`<form id="tx-form" data-edit="${edit?safe(t.id):''}" class="tx-form">
    <div class="tx-choices" role="group" aria-label="Tipo de movimiento">
      <button type="button" class="tx-choice ${kind==='expense'?'selected':''}" data-tx-kind="expense" aria-pressed="${kind==='expense'}">− Gasto</button>
      <button type="button" class="tx-choice ${kind==='income'?'selected':''}" data-tx-kind="income" aria-pressed="${kind==='income'}">+ Ingreso</button>
    </div>
    <input type="hidden" name="kind" id="tx-kind" value="${kind}">
    <div class="field tx-money"><label for="tx-amount">¿Cuánto ${kind==='expense'?'gastaste':'recibiste'}?</label><div class="money-input"><span>$</span><input id="tx-amount" name="amount" type="text" inputmode="numeric" pattern="[0-9.$, ]+" autocomplete="off" value="${edit?num(t.amount).toLocaleString('es-CO'):''}" required placeholder="Ej: 25.000" aria-describedby="money-help"></div><small id="money-help" class="muted">Pesos colombianos. Puedes escribir 25000 o 25.000.</small></div>
    <div class="field"><label for="tx-note">¿En qué fue? (opcional)</label><input id="tx-note" name="note" maxlength="120" placeholder="Ej: Mercado, arriendo, pago de cliente" value="${safe(t?.note||'')}"></div>
    <div class="form-grid tx-secondary"><div class="field"><label for="tx-category">Categoría</label><select name="category" id="tx-category">${categoryOptions}</select></div>
    <div class="field"><label for="tx-date">Fecha</label><input id="tx-date" type="date" name="date" value="${safe(chosen)}" required></div></div>
    <details class="tx-more"><summary>Más opciones</summary><div class="field"><label for="tx-method">Medio de pago o recepción</label><select id="tx-method" name="method">${payOptions}</select></div></details>
    <div class="tx-help">El movimiento se mostrará automáticamente en el mes de su fecha. Tus datos permanecen en este navegador.</div>
    <button type="submit" class="btn primary full tx-submit">${edit?'Guardar cambios':'Guardar movimiento'}</button>
  </form>`);
  document.getElementById('tx-amount')?.focus();
}
function budgetEdit(c){let v=num((db.budgets[st.month]||{})[c]);showModal('Presupuesto: '+c,`<form id="budget-form" data-category="${safe(c)}" class="form-grid"><p class="small muted field full" style="margin:0">Define el límite de gasto para ${safe(monthName(st.month))}. Usa 0 para quitar el límite.</p><div class="field full"><label>Límite para ${safe(c)} (COP)</label><input name="amount" type="number" min="0" step="1" value="${v}" required></div><div class="field full"><button type="submit" class="btn primary full">Guardar presupuesto</button></div></form>`)}
function openGoal(){showModal('Crear meta de ahorro',`<form id="goal-form" class="form-grid"><div class="field full"><label>Nombre de la meta</label><input name="title" required maxlength="80" placeholder="Ej: Fondo de emergencia"></div><div class="field"><label>Objetivo (COP)</label><input name="target" type="number" min="1" step="1" required placeholder="Ej: 1000000"></div><div class="field"><label>Fecha objetivo (opcional)</label><input type="date" name="deadline"></div><div class="field full"><button type="submit" class="btn primary full">Crear meta</button></div></form>`)}
function openContribution(g){
  const funds=goalFunding();
  const free=Math.max(0,Math.floor(funds?.unallocated??0));
  const remaining=Math.max(0,Math.floor(num(g.target)-goalSum(g)));
  const maxAmount=Math.min(free,remaining);
  showModal('Aporte a '+g.title,`<form id="contribution-form" data-goal="${safe(g.id)}" class="form-grid">
    <div class="field full"><div class="goal-contribution-note">
      <span>Dinero libre para aportar: <strong>${pesos(free)}</strong></span>
      <span>Pendiente para completar la meta: <strong>${pesos(remaining)}</strong></span>
    </div></div>
    <div class="field"><label for="goal-contribution-amount">Monto apartado (COP)</label>
      <input id="goal-contribution-amount" name="amount" type="number" min="1" step="1" max="${maxAmount}" required ${maxAmount===0?'disabled':''}>
    </div>
    <div class="field"><label>Fecha</label><input name="date" type="date" value="${today()}" max="${today()}" required></div>
    <div class="field full"><div class="soft">${maxAmount===0?'No tienes dinero libre para aportar. Registra ingresos o revisa tus ahorros anteriores.':'Máximo que puedes aportar ahora: '+pesos(maxAmount)+'.'} Este importe queda reservado de tu dinero existente, sin contarlo como ingreso o gasto.</div></div>
    <div class="field full"><button type="submit" class="btn primary full" ${maxAmount===0?'disabled':''}>Registrar aporte</button></div>
  </form>`);
}
function history(g){let entries=db.goalEntries.filter(e=>e.goalId===g.id).sort((a,b)=>b.date.localeCompare(a.date));showModal('Aportes a '+g.title,entries.length?`<div class="task-list">${entries.map(e=>`<div class="task"><div class="task-text"><b>${pesos(e.amount)}</b><p>${prettyDate(e.date)}</p></div><button class="btn small ghost" data-action="removeContribution" data-id="${safe(e.id)}">Eliminar</button></div>`).join('')}</div>`:emptyState('Todavía no hay aportes','Añade un monto que hayas apartado para esta meta.'))}
function openTask(){showModal('Nueva tarea',`<form id="task-form" class="form-grid"><div class="field full"><label>Tarea</label><input name="title" maxlength="160" required placeholder="Ej: Pagar servicio de luz"></div><div class="field"><label>Fecha límite</label><input name="due" type="date"></div><div class="field"><label>Prioridad</label><select name="priority"><option>Media</option><option>Alta</option><option>Baja</option></select></div><div class="field full"><button type="submit" class="btn primary full">Guardar tarea</button></div></form>`)}
function download(content,name,type){let b=new Blob([content],{type});let u=URL.createObjectURL(b);let a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500)}
function backup(){download(JSON.stringify({app:'Brujula',version:1,exportedAt:new Date().toISOString(),data:db},null,2),'brujula-respaldo-'+today()+'.json','application/json;charset=utf-8');toast('Respaldo descargado')}
function csvExport(){let list=[...db.transactions].sort((a,b)=>a.date.localeCompare(b.date));let rows=[['fecha','tipo','categoria','descripcion','metodo','monto_COP'],...list.map(t=>[t.date,t.kind==='income'?'ingreso':'gasto',t.category,t.note||'',t.method||'',num(t.amount)])];let csv=rows.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');download('\ufeff'+csv,'brujula-movimientos-'+today()+'.csv','text/csv;charset=utf-8');toast('Archivo CSV descargado')}
function demoAllowed(){return !(db.wallets?.configured||db.balance?.configured||db.transactions.length||db.goals.length||db.goalEntries.length||db.tasks.length||(db.transfers||[]).length||Object.keys(db.budgets).length||Object.keys(db.fiscal).length)}
function demo(){if(!demoAllowed()){toast('La demostración solo se puede cargar antes de configurar saldos o registrar datos. Tus finanzas reales no se modificaron.');return}let [y,m]=st.month.split('-').map(Number),maxday=new Date(y,m,0).getDate();const date=d=>`${st.month}-${String(Math.min(maxday,st.month===currentMonth?new Date().getDate():maxday,d)).padStart(2,'0')}`;let entries=[['income',2700000,'Trabajo','Pago de trabajo',2,'Transferencia'],['income',410000,'Ingreso extra','Proyecto adicional',13,'Transferencia'],['expense',700000,'Vivienda','Arriendo',3,'Transferencia'],['expense',225000,'Alimentación','Mercado',4,'Débito'],['expense',125000,'Servicios','Servicios del hogar',7,'Transferencia'],['expense',90000,'Transporte','Gasolina',9,'Efectivo'],['expense',280000,'Alimentación','Comidas y compras',15,'Débito'],['expense',155000,'Deudas','Cuota de crédito',17,'Transferencia'],['expense',68000,'Entretenimiento','Plan de ocio',19,'Efectivo'],['expense',60000,'Salud','Farmacia',21,'Débito']];db.transactions=entries.map(([kind,amount,category,note,d,method])=>({id:id(),kind,amount,category,note,date:date(d),method}));db.budgets[st.month]={Alimentación:600000,Vivienda:700000,Transporte:180000,Servicios:190000,Salud:100000,Deudas:220000,Entretenimiento:120000};let gid=id();db.goals=[{id:gid,title:'Fondo de emergencia',target:2000000,deadline:''}];db.goalEntries=[{id:id(),goalId:gid,amount:320000,date:date(11)}];db.tasks=[{id:id(),title:'Revisar los gastos del mes',due:date(24),priority:'Media',done:false},{id:id(),title:'Separar ahorro para emergencias',due:date(26),priority:'Alta',done:false}];// La demostración tiene saldos ficticios independientes y no modifica cuentas reales.
const sampleIds=db.transactions.map(t=>t.id);
db.wallets={configured:true,cash:180000,bank:940000,date:today(),ignoredIds:sampleIds,ignoredTransfers:[]};
db.balance={configured:true,amount:1120000,date:today(),ignoredIds:sampleIds};
db.demo=true;save();toast('Demostración con datos ficticios activada')}
function action(name,el){let t,goal;switch(name){case'prevMonth':changeMonth(-1);break;case'nextMonth':changeMonth(1);break;case'addTx':openTx();break;case'addExpense':openTx(null,'expense');break;case'addIncome':openTx(null,'income');break;case'editTx':t=db.transactions.find(x=>x.id===el.dataset.id);if(t)openTx(t);break;case'deleteTx':if(confirm('¿Eliminar este movimiento?')){db.transactions=db.transactions.filter(x=>x.id!==el.dataset.id);save();toast('Movimiento eliminado')}break;case'goTx':st.view='transactions';render();break;case'goBudgets':st.view='budgets';render();break;case'budgetsPrev':case'budgetsNext':{
  const track=document.getElementById('budget-featured-track');
  if(track&&typeof track.scrollBy==='function'){
    const distance=Math.max(268,Math.floor((track.clientWidth||340)*0.85));
    track.scrollBy({left:name==='budgetsNext'?distance:-distance,behavior:'smooth'});
  }
  break;
}case'budgetEdit':if(cat.includes(el.dataset.category))budgetEdit(el.dataset.category);break;case'copyBudgets':{let [y,m]=st.month.split('-').map(Number);let d=new Date(y,m-2,1);let prev=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;if(!db.budgets[prev]){toast('No hay presupuesto en el mes anterior');break}if(!confirm('¿Copiar presupuesto anterior y reemplazar los límites actuales del mes?'))break;db.budgets[st.month]={...db.budgets[prev]};save();toast('Presupuesto copiado');break}case'addGoal':openGoal();break;case'addContribution':goal=db.goals.find(g=>g.id===el.dataset.id);if(goal)openContribution(goal);break;case'goalHistory':goal=db.goals.find(g=>g.id===el.dataset.id);if(goal)history(goal);break;case'deleteGoal':if(confirm('¿Eliminar la meta y todos sus aportes anotados?')){db.goals=db.goals.filter(g=>g.id!==el.dataset.id);db.goalEntries=db.goalEntries.filter(e=>e.goalId!==el.dataset.id);save();toast('Meta eliminada')}break;case'removeContribution':if(confirm('¿Eliminar este aporte?')){db.goalEntries=db.goalEntries.filter(x=>x.id!==el.dataset.id);closeModal();save();toast('Aporte eliminado')}break;case'addTask':openTask();break;case'deleteTask':if(confirm('¿Eliminar tarea?')){db.tasks=db.tasks.filter(x=>x.id!==el.dataset.id);save()}break;case'exportData':backup();break;case'importData':document.getElementById('import-file').click();break;case'csv':csvExport();break;case'demo':demo();break;case'erase':if(confirm('¿Eliminar TODOS los datos guardados en este navegador? Esta acción no se puede deshacer sin un respaldo.')&&confirm('Confirma por segunda vez: ¿borrar todo?')){db=empty();st.view='dashboard';st.month=currentMonth;st.transactionFilter='all';st.search='';st.highlightTx=null;save();toast('Datos borrados')}break;case'closeModal':closeModal();break;case'saveFiscal':document.getElementById('fiscal-form')?.requestSubmit();break;}}
document.addEventListener('click',e=>{let kindBtn=e.target.closest('[data-tx-kind]');if(kindBtn){
  const v=kindBtn.dataset.txKind;document.getElementById('tx-kind').value=v;
  document.querySelectorAll('[data-tx-kind]').forEach(b=>{const on=b.dataset.txKind===v;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
  document.getElementById('tx-category').innerHTML=(v==='income'?incomeCat:cat).map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join('');
  document.querySelector('.tx-money label').textContent=v==='expense'?'¿Cuánto gastaste?':'¿Cuánto recibiste?';return;
}let nav=e.target.closest('[data-nav]');if(nav){st.view=nav.dataset.nav;render();return}let act=e.target.closest('[data-action]');if(act){e.preventDefault();action(act.dataset.action,act);return}if(e.target.id==='modal-backdrop')closeModal()});
document.addEventListener('change',e=>{if(e.target.id==='tx-kind'){const values=e.target.value==='income'?incomeCat:cat;document.getElementById('tx-category').innerHTML=values.map(x=>`<option>${x}</option>`).join('')}if(e.target.id==='tx-filter'){st.transactionFilter=e.target.value;let inp=document.getElementById('tx-search');st.search=inp?.value||'';render()}if(e.target.id==='tax-year'){st.taxYear=e.target.value;render()}if(e.target.dataset.task){let task=db.tasks.find(t=>t.id===e.target.dataset.task);if(task){task.done=e.target.checked;save()}}});
document.addEventListener('input',e=>{if(e.target.id==='tx-search'){st.search=e.target.value;let list=txMonth().filter(t=>st.transactionFilter==='all'||t.kind===st.transactionFilter).filter(t=>(t.note+' '+t.category+' '+t.method).toLowerCase().includes(st.search.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('tx-table').innerHTML=transactionTable(list)}});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,a=new FormData(f);if(f.id==='tx-form'){
  let amount=parseCOP(a.get('amount'));
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1e15)return toast('Escribe un monto válido. Ejemplo: 25.000');
  let kind=String(a.get('kind')),category=String(a.get('category'));
  if(!['income','expense'].includes(kind)||!(kind==='income'?incomeCat:cat).includes(category))return toast('Selecciona una categoría válida');
  // La cuenta elegida manda: nunca guardar "Efectivo · Cuenta" ni "Transferencia · Efectivo".
  const account=String(a.get('account')||'');
  let method=String(a.get('method')||'Efectivo');
  if(account==='cash') method='Efectivo';
  else if(account==='bank' && method==='Efectivo') method='Transferencia';
  let entry={id:f.dataset.edit||id(),kind,amount,category,note:String(a.get('note')||'').slice(0,120),method,account,date:String(a.get('date')||today())};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||Number.isNaN(Date.parse(entry.date)))return toast('Selecciona una fecha válida');
  if(f.dataset.edit){let i=db.transactions.findIndex(x=>x.id===f.dataset.edit);if(i>=0)db.transactions[i]=entry;else return toast('No encontramos el movimiento para editar')}
  else db.transactions.push(entry);
  st.month=entry.date.slice(0,7);st.view='transactions';st.transactionFilter='all';st.search='';st.highlightTx=entry.id;
  closeModal();
  if(save())toast('✓ Movimiento guardado. Ya aparece en '+monthName(st.month)+'.');
}
else if(f.id==='budget-form'){let amount=Number(a.get('amount'));if(!Number.isFinite(amount)||amount<0||amount>1e15)return toast('Presupuesto inválido');db.budgets[st.month]??={};db.budgets[st.month][f.dataset.category]=amount;closeModal();save();toast('Presupuesto actualizado')}
else if(f.id==='goal-form'){let target=Number(a.get('target'));if(!Number.isFinite(target)||target<=0||target>1e15)return toast('Meta inválida');db.goals.push({id:id(),title:String(a.get('title')).slice(0,80),target,deadline:String(a.get('deadline')||'')});closeModal();save();toast('Meta creada')}
else if(f.id==='contribution-form'){
  const goal=db.goals.find(g=>g.id===f.dataset.goal);
  if(!goal)return toast('La meta seleccionada ya no existe.');
  const amount=Number(a.get('amount'));
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1e15)return toast('El aporte debe ser un número entero positivo.');
  const date=String(a.get('date')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||date>today())return toast('Selecciona una fecha válida no futura.');
  const funds=goalFunding();
  if(!funds)return toast('Primero registra cuánto dinero tienes en efectivo y en cuenta.');
  const free=Math.max(0,Math.floor(funds.unallocated));
  if(amount>free)return toast('Solo tienes '+pesos(free)+' libres. No puedes aportar dinero que no tienes.');
  const remaining=Math.max(0,Math.floor(num(goal.target)-goalSum(goal)));
  if(amount>remaining)return toast('A esta meta solo le faltan '+pesos(remaining)+' para completarse.');
  db.goalEntries.push({id:id(),goalId:goal.id,amount,date});
  closeModal();save();toast('Aporte reservado correctamente');
}
else if(f.id==='task-form'){db.tasks.push({id:id(),title:String(a.get('title')).slice(0,160),due:String(a.get('due')||''),priority:String(a.get('priority')||'Media'),done:false});closeModal();save();toast('Tarea creada')}
else if(f.id==='profile-form'){db.preferences.name=String(a.get('name')||'').slice(0,80);db.preferences.savingsTarget=Math.max(0,num(a.get('savingsTarget')));save();toast('Preferencias guardadas')}
else if(f.id==='fiscal-form'){let y=st.taxYear,next={};for(let x of ['patrimony','card','purchases','deposits']){let raw=String(a.get(x)||'').trim();next[x]=raw===''?null:Number(raw);if(next[x]!==null&&(!Number.isFinite(next[x])||next[x]<0||next[x]>1e15))return toast('Valor fiscal inválido')}next.additional=Math.max(0,num(a.get('additional')));next.vat=a.get('vat')!==null;db.fiscal[y]=next;save();toast('Evaluación tributaria guardada')}
});
document.getElementById('import-file').addEventListener('change',async e=>{let file=e.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('Archivo demasiado grande');let obj=JSON.parse(await file.text());if(obj.app!=='Brujula'||!obj.data||!Array.isArray(obj.data.transactions)||!Array.isArray(obj.data.goals))throw new Error('El archivo no es un respaldo válido de Brújula');if(!confirm('¿Reemplazar todos los datos de este navegador con el respaldo importado?'))return;db=normalize(obj.data);save();toast('Respaldo importado correctamente')}catch(err){toast('No se pudo importar: '+err.message)}finally{e.target.value=''}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
render();