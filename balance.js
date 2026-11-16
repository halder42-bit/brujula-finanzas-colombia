/* Brújula v3: saldo disponible, configuración inicial y compatibilidad v2.
   Este saldo es una fotografía de dinero real, NO un ingreso. */
(() => {
  'use strict';
  const defaultBalance = () => ({ configured: false, amount: 0, date: '', ignoredIds: [] });
  function readBalance(value) {
    if (!value || typeof value !== 'object' || value.configured !== true) return defaultBalance();
    const amount = Number(value.amount);
    const date = String(value.date || '');
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e15 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return defaultBalance();
    return { configured: true, amount, date, ignoredIds: Array.isArray(value.ignoredIds) ? value.ignoredIds.filter(x=>typeof x==='string') : [] };
  }
  // v2 descartaba propiedades desconocidas al cargar o importar JSON. Preservamos balance.
  const normalizeV2 = normalize;
  normalize = (raw) => {
    const normalized = normalizeV2(raw);
    normalized.balance = readBalance(raw?.balance);
    return normalized;
  };
  try {
    const raw = window.BRUJULA_CLOUD_ENABLED ? null : JSON.parse(localStorage.getItem(KEY) || 'null');
    db.balance = readBalance(raw?.balance);
  } catch { db.balance = defaultBalance(); }

  function currentBalance() {
    const snapshot = readBalance(db.balance);
    if (!snapshot.configured) return null;
    const excluded = new Set(snapshot.ignoredIds);
    let added = 0, spent = 0;
    for (const tx of db.transactions) {
      if (excluded.has(tx.id) || typeof tx.date !== 'string' || tx.date < snapshot.date || tx.date > today()) continue;
      const amount = Number(tx.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (tx.kind === 'income') added += amount;
      if (tx.kind === 'expense') spent += amount;
    }
    return { snapshot, added, spent, total: snapshot.amount + added - spent };
  }
  function hasExistingData() {
    return db.transactions.length > 0 || db.goals.length > 0 || db.tasks.length > 0 ||
      Object.keys(db.budgets).length > 0 || db.goalEntries.length > 0;
  }
  function welcomeView() {
    return `<section class="balance-welcome" aria-labelledby="welcome-title">
      <span class="balance-eyebrow">BIENVENIDO A BRÚJULA</span>
      <h2 id="welcome-title">Primero, ¿con cuánto dinero cuentas hoy?</h2>
      <p>Escribe cuánto tienes disponible entre efectivo, bancos y billeteras digitales. Así sabrás cuánto te queda después de cada gasto.</p>
      <form id="balance-form" class="balance-welcome-form">
        <label for="initial-amount">Dinero disponible ahora, en COP</label>
        <div class="balance-money-input"><span>$</span><input id="initial-amount" name="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="Ej: 350.000" required aria-describedby="initial-balance-hint"></div>
        <small id="initial-balance-hint">No se registra como ingreso ni afecta los impuestos. Puedes empezar con $0.</small>
        <button class="btn primary full" type="submit">Guardar y empezar →</button>
      </form>
      <div class="balance-welcome-actions">
        <button class="link-btn" type="button" data-action="skipBalance">Empezar con $0</button>
        <button class="link-btn" type="button" data-action="demo">Probar con datos de ejemplo</button>
      </div>
      <div class="balance-preview-grid">
        <div><span>1</span><b>Indica tu dinero actual</b><p>Tu punto de partida, sin duplicar ingresos.</p></div>
        <div><span>2</span><b>Registra tus gastos e ingresos</b><p>Con botones rápidos y categorías claras.</p></div>
        <div><span>3</span><b>Mira cuánto queda</b><p>Tu saldo se actualiza automáticamente.</p></div>
      </div>
    </section>`;
  }
  function balanceCard(compact = false) {
    const info = currentBalance();
    if (!info) return `<section class="balance-prompt" aria-label="Configurar dinero disponible">
      <div><span class="balance-eyebrow">CONFIGURACIÓN RECOMENDADA</span><h2>¿Cuánto dinero tienes actualmente?</h2>
      <p>Registra tu saldo actual sin perder ni duplicar tus movimientos anteriores.</p></div>
      <button type="button" class="btn primary" data-action="configureBalance">Configurar mi dinero</button>
    </section>`;
    const { snapshot, added, spent, total } = info;
    return `<section class="balance-card ${compact?'balance-card-small':''}" aria-label="Dinero disponible actual">
      <div class="balance-card-header"><div><span class="balance-eyebrow">TU DINERO DISPONIBLE HOY</span>
        <h2>${pesos(total)}</h2><p>Saldo actualizado con movimientos registrados desde que lo configuraste.</p></div>
        <button type="button" class="btn ghost small" data-action="configureBalance">Ajustar saldo</button></div>
      <div class="balance-breakdown"><div><small>Saldo al configurar</small><strong>${pesos(snapshot.amount)}</strong></div>
        <div><small>+ Ingresos nuevos</small><strong class="balance-plus">${pesos(added)}</strong></div>
        <div><small>− Gastos nuevos</small><strong class="balance-minus">${pesos(spent)}</strong></div></div>
      ${total < 0 ? '<p class="balance-warning">Tu saldo calculado es negativo. Revisa los movimientos o ajusta el saldo.</p>' : ''}
    </section>`;
  }
  const originalDashboard = dashboard;
  dashboard = () => {
    if (!readBalance(db.balance).configured && !hasExistingData()) return welcomeView();
    return balanceCard() + originalDashboard();
  };
  const originalTransactions = transactions;
  transactions = () => balanceCard(true) + originalTransactions();
  const originalSettings = settings;
  settings = () => `<section class="panel balance-settings"><div class="panel-heading"><h3>Tu dinero disponible</h3><button type="button" class="btn primary small" data-action="configureBalance">${currentBalance()?'Actualizar saldo':'Añadir saldo inicial'}</button></div>
    <p class="small muted">${currentBalance()?`Saldo calculado hoy: <strong>${pesos(currentBalance().total)}</strong>. Puedes ajustarlo si no coincide con tu efectivo y cuentas.`:'Todavía no has configurado tu dinero actual.'}</p>
    <p class="small muted">Un ajuste toma una nueva fotografía de tu dinero: conserva tus movimientos anteriores, pero solo los nuevos se suman o restan desde el ajuste.</p>
    </section>` + originalSettings();
  const originalMetricCard = metricCard;
  metricCard = (label, value, glyph, sty, desc) =>
    originalMetricCard(['Saldo','Saldo del mes'].includes(label)?'Resultado del mes':label, value, glyph, sty,
      ['Saldo','Saldo del mes'].includes(label)?'Ingresos menos gastos de ese mes (no es el dinero disponible)':desc);

  function openBalanceDialog() {
    const info = currentBalance();
    const current = info ? Math.max(0, info.total) : '';
    showModal(info?'Actualizar mi dinero actual':'Configurar mi dinero', `<form id="balance-form" class="balance-dialog-form">
      <p class="subtitle">¿Cuánto dinero tienes <strong>ahora mismo</strong> sumando efectivo y cuentas? Este importe es tu punto de partida, no un ingreso.</p>
      <div class="field"><label for="balance-amount">Dinero disponible hoy (COP)</label>
        <div class="balance-money-input"><span>$</span><input id="balance-amount" name="amount" type="text" inputmode="numeric" autocomplete="off" value="${current === ''?'':current.toLocaleString('es-CO')}" required placeholder="Ej: 350.000"></div></div>
      <div class="soft info">Al guardar, conservarás todo tu historial. Los movimientos ya registrados quedan incluidos en este saldo y <strong>no se sumarán dos veces</strong>. Los nuevos ingresos y gastos sí lo actualizarán.</div>
      <button type="submit" class="btn primary full">Guardar dinero disponible</button></form>`);
  }
  function setBalance(rawAmount) {
    const textValue = String(rawAmount ?? '').trim();
    const amount = parseCOP(textValue);
    if (textValue.startsWith('-') || !Number.isSafeInteger(amount) || amount < 0 || amount > 1e15) {
      toast('Introduce una cantidad válida en pesos (ejemplo: 350.000).'); return;
    }
    db.balance = { configured:true, amount, date:today(), ignoredIds:db.transactions.map(x=>x.id) };
    closeModal(); st.view='dashboard';
    if (save()) toast('✓ Saldo guardado. Ahora puedes registrar tus movimientos.');
  }
  document.addEventListener('click', e => {
    const act = e.target.closest('[data-action]')?.dataset.action;
    if (act === 'configureBalance') openBalanceDialog();
    if (act === 'skipBalance') setBalance('0');
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'balance-form') return;
    e.preventDefault();
    setBalance(new FormData(e.target).get('amount'));
  });
  render();
})();