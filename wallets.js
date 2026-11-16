/* Brújula v4: efectivo, cuenta bancaria y movimientos entre dinero propio.
   El saldo inicial y las transferencias internas no son ingresos ni gastos. */
(() => {
  'use strict';
  const emptyWallet = () => ({
    configured: false, cash: 0, bank: 0, date: '',
    ignoredIds: [], ignoredTransfers: []
  });
  const isAmount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e15;
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  function readWallet(raw) {
    if (!raw || raw.configured !== true) return emptyWallet();
    const cash = Number(raw.cash), bank = Number(raw.bank);
    if (!isAmount(cash) || !isAmount(bank) || !isDate(raw.date)) return emptyWallet();
    return {
      configured: true, cash, bank, date: raw.date,
      ignoredIds: Array.isArray(raw.ignoredIds) ? raw.ignoredIds.filter(x => typeof x === 'string') : [],
      ignoredTransfers: Array.isArray(raw.ignoredTransfers) ? raw.ignoredTransfers.filter(x => typeof x === 'string') : []
    };
  }
  function readTransfers(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && typeof t.id === 'string' && isAmount(t.amount) && t.amount > 0 &&
      isDate(t.date) && ['cash', 'bank'].includes(t.from) &&
      ['cash', 'bank'].includes(t.to) && t.from !== t.to)
      .slice(0, 50000).map(t => ({
        id: t.id, date: t.date, amount: t.amount, from: t.from, to: t.to,
        note: String(t.note || '').slice(0, 100)
      }));
  }
  // Conserva el nuevo esquema incluso al importar un respaldo JSON.
  const previousNormalize = normalize;
  normalize = raw => {
    const data = previousNormalize(raw);
    data.wallets = readWallet(raw?.wallets);
    data.transfers = readTransfers(raw?.transfers);
    return data;
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    db.wallets = readWallet(raw?.wallets);
    db.transfers = readTransfers(raw?.transfers);
  } catch {
    db.wallets = emptyWallet();
    db.transfers = [];
  }

  const configured = () => db.wallets?.configured === true;
  const walletLabel = type => type === 'cash' ? 'Efectivo' : 'Cuenta bancaria';
  const accountFor = tx => ['cash', 'bank'].includes(tx.account) ? tx.account :
    String(tx.method || '').toLowerCase() === 'efectivo' ? 'cash' : 'bank';

  function legacyTotal() {
    const b = db.balance;
    if (!b || b.configured !== true) return null;
    const excluded = new Set(b.ignoredIds || []);
    let total = Number(b.amount) || 0;
    for (const t of db.transactions) {
      if (excluded.has(t.id) || !isDate(t.date) || t.date < b.date || t.date > today()) continue;
      total += (t.kind === 'income' ? 1 : t.kind === 'expense' ? -1 : 0) * (Number(t.amount) || 0);
    }
    return total;
  }

  function balances() {
    if (!configured()) return null;
    const w = db.wallets;
    const ignored = new Set(w.ignoredIds);
    const ignoredTransfers = new Set(w.ignoredTransfers);
    const result = {cash: Number(w.cash), bank: Number(w.bank)};
    for (const t of db.transactions) {
      if (ignored.has(t.id) || !isDate(t.date) || t.date < w.date || t.date > today()) continue;
      const amount = Number(t.amount);
      if (!isAmount(amount) || amount === 0) continue;
      const a = accountFor(t);
      if (t.kind === 'income') result[a] += amount;
      else if (t.kind === 'expense') result[a] -= amount;
    }
    for (const t of db.transfers || []) {
      if (ignoredTransfers.has(t.id) || t.date < w.date || t.date > today()) continue;
      result[t.from] -= t.amount;
      result[t.to] += t.amount;
    }
    result.total = result.cash + result.bank;
    return result;
  }

  // Lo reservado en metas forma parte del dinero físico, no crea ingresos nuevos.
  window.brujulaWalletSummary = () => {
    const funds = balances();
    if (!funds) return null;
    const ids = new Set(db.goals.map(g => g.id));
    const reserved = db.goalEntries.reduce((total, e) => {
      const amount = Number(e.amount);
      return ids.has(e.goalId) && Number.isSafeInteger(amount) && amount > 0 ? total + amount : total;
    }, 0);
    return { ...funds, reserved, unallocated: Math.max(0, funds.total - reserved),
      shortfall: Math.max(0, reserved - funds.total) };
  };

  // Un cero inicial se muestra como sugerencia, no como valor editable:
  // al escribir 5 no debe convertirse en "05". En saldos, vacío significa $0.
  const moneyInput = (field, label, value, hint) => {
    const text = String(value ?? '').trim();
    const walletField = field === 'wallet-cash' || field === 'wallet-bank';
    const visibleValue = walletField && parseCOP(text) === 0 ? '' : text;
    return '<div class="wallet-input-block"><label for="' + field + '">' + label + '</label>' +
      '<div class="balance-money-input"><span>$</span><input id="' + field + '" name="' + field +
      '" type="text" inputmode="numeric" autocomplete="off"' + (walletField ? '' : ' required') +
      ' placeholder="' + (walletField ? '0' : 'Ej: 150.000') + '" value="' +
      safe(visibleValue) + '"></div>' +
      (hint ? '<small>' + hint + '</small>' : '') + '</div>';
  };

  function walletForm(adjust = false) {
    const now = balances();
    const legacy = legacyTotal();
    const cash = adjust && now ? now.cash : 0;
    const bank = adjust && now ? now.bank : legacy !== null ? Math.max(0, legacy) : 0;
    const previousHint = !adjust && legacy !== null ?
      '<div class="wallet-migration">Tu saldo anterior era <b>' + pesos(legacy) +
      '</b>. Como antes no se separaba, dejamos ese valor sugerido en cuenta. Ajusta ambos campos para que reflejen tu dinero real.</div>' : '';
    return '<form id="wallet-form" class="wallet-form">' +
      previousHint +
      '<div class="wallet-form-grid">' +
      moneyInput('wallet-cash', '💵 Dinero en efectivo', Number(cash).toLocaleString('es-CO'),
        'Billetes y monedas que tienes contigo.') +
      moneyInput('wallet-bank', '🏦 Dinero en cuenta', Number(bank).toLocaleString('es-CO'),
        'Bancos, Nequi, Daviplata y otras billeteras digitales.') +
      '</div>' +
      '<div class="wallet-form-total">Dinero total: <strong id="wallet-form-total">' +
      pesos(Number(cash) + Number(bank)) + '</strong></div>' +
      '<p class="wallet-small-note">Estos valores son una fotografía de tu dinero actual: no son ingresos. ' +
      'Si ya tenías movimientos registrados, se conservarán sin contarlos dos veces.</p>' +
      '<button class="btn primary full" type="submit">' +
      (adjust ? 'Guardar saldos actualizados' : 'Guardar y empezar') + '</button>' +
      '</form>';
  }
  function walletWelcome() {
    return '<section class="balance-welcome wallet-welcome" aria-labelledby="wallet-welcome-title">' +
      '<span class="balance-eyebrow">BIENVENIDO A BRÚJULA</span>' +
      '<h2 id="wallet-welcome-title">¿Dónde tienes tu dinero ahora mismo?</h2>' +
      '<p>Comienza registrando cuánto tienes en efectivo y cuánto guardas en tus cuentas. ' +
      'Así sabrás exactamente de dónde sale cada gasto.</p>' +
      walletForm() +
      '<div class="wallet-welcome-actions"><button type="button" class="link-btn" data-wallet-action="start-zero">' +
      'Empezar con $0 en ambas</button>' +
      '<button type="button" class="link-btn" data-action="demo">Explorar demostración sin dinero real</button></div>' +
      '<div class="wallet-onboarding-steps"><span>1 · Añade tus saldos</span>' +
      '<span>2 · Registra ingresos y gastos</span><span>3 · Consigna o retira sin duplicar ingresos</span></div>' +
      '</section>';
  }
  function walletSummary() {
    const v = window.brujulaWalletSummary();
    if (!v) return '<section class="balance-prompt"><div><span class="balance-eyebrow">CONFIGURACIÓN INICIAL</span>' +
      '<h2>Separa tu dinero entre efectivo y cuenta</h2><p>Registra lo que tienes hoy para controlar cada saldo.</p></div>' +
      '<button type="button" class="btn primary" data-wallet-action="adjust">Configurar saldos</button></section>';
    return '<section class="wallet-summary" aria-label="Mis saldos actuales">' +
      (db.demo ? '<p class="wallet-demo-warning">⚠ DATOS FICTICIOS · Estás viendo una demostración. Para comenzar con tus finanzas reales, entra en Configuración y borra los datos de ejemplo.</p>' : '') +
      '<div class="wallet-summary-header"><div><span class="balance-eyebrow">RESUMEN GENERAL DE TU DINERO</span>' +
      '<p class="wallet-total-label">Dinero total entre efectivo y cuenta</p><h2>' + pesos(v.total) + '</h2><p>Incluye lo reservado para metas, sin contarlo dos veces.</p></div>' +
      '<button type="button" class="btn ghost small" data-wallet-action="adjust">Ajustar saldos</button></div>' +
      '<div class="wallet-accounts">' +
      '<div class="wallet-account"><span>💵 Efectivo</span><strong>' + pesos(v.cash) + '</strong>' +
      '<small>Dinero que tienes físicamente</small></div>' +
      '<div class="wallet-account"><span>🏦 Cuenta y billeteras</span><strong>' + pesos(v.bank) + '</strong>' +
      '<small>Dinero en bancos y apps</small></div></div>' +
      '<div class="wallet-total-breakdown">' +
      '<div><span>🎯 Reservado para metas</span><strong>' + pesos(v.reserved) + '</strong></div>' +
      '<div class="wallet-unallocated"><span>💚 Libre para gastar o ahorrar</span><strong>' + pesos(v.unallocated) + '</strong></div></div>' +
      (v.shortfall>0?'<p class="balance-warning">Tus aportes anteriores superan tu dinero total por '+pesos(v.shortfall)+'. Revisa los saldos y las metas.</p>':'') +
      '<div class="wallet-summary-actions">' +
      '<button type="button" class="btn primary" data-wallet-action="transfer" data-from="cash">↑ Consignar efectivo</button>' +
      '<button type="button" class="btn ghost" data-wallet-action="transfer" data-from="bank">↓ Retirar de cuenta</button></div>' +
      '<p class="wallet-explain">Los ahorros reservados siguen formando parte de tu efectivo y cuenta. Las transferencias internas no son ingresos ni gastos.</p>' +
      ((v.cash < 0 || v.bank < 0) ? '<p class="balance-warning">Hay un saldo negativo. Revisa los movimientos y sus cuentas o ajusta tus saldos.</p>' : '') +
      '</section>';
  }

  function transferHistory() {
    const list = [...(db.transfers || [])].sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    return '<section class="panel wallet-history"><div class="panel-heading"><div><h3>Consignaciones y retiros propios</h3>' +
      '<p>Movimientos entre tu efectivo y tu cuenta, separados de ingresos y gastos.</p></div>' +
      '<button type="button" class="btn primary small" data-wallet-action="transfer" data-from="cash">+ Trasladar dinero</button></div>' +
      (list.length ? '<div class="wallet-history-list">' +
      list.map(t => '<div class="wallet-history-item"><div><strong>' +
        (t.from === 'cash' ? '💵 Efectivo → 🏦 Cuenta' : '🏦 Cuenta → 💵 Efectivo') +
        '</strong><small>' + prettyDate(t.date) + (t.note ? ' · ' + safe(t.note) : '') +
        '</small></div><b>' + pesos(t.amount) + '</b><button type="button" class="btn small ghost" ' +
        'data-wallet-action="delete-transfer" data-id="' + safe(t.id) +
        '" aria-label="Eliminar traslado">Eliminar</button></div>').join('') +
      '</div>' : '<p class="wallet-empty">Aún no tienes consignaciones ni retiros propios registrados.</p>') +
      '<p class="wallet-small-note">No se suman a tus ingresos, gastos ni presupuestos. ' +
      'Revisa por separado las consignaciones y depósitos en el radar tributario.</p></section>';
  }

  // Sustituye la tarjeta de saldo único de v3 sin perder el tablero de v2.
  function stripOldTop(html) {
    if (html.startsWith('<section class="balance-welcome')) return '';
    if (html.startsWith('<section class="balance-card') ||
        html.startsWith('<section class="balance-prompt')) {
      return html.replace(/^<section class="balance-(?:card|prompt)[\s\S]*?<\/section>/, '');
    }
    if (html.startsWith('<section class="panel balance-settings')) {
      return html.replace(/^<section class="panel balance-settings[\s\S]*?<\/section>/, '');
    }
    return html;
  }
  const v3Dashboard = dashboard;
  dashboard = () => configured() ? walletSummary() + stripOldTop(v3Dashboard()) : walletWelcome();
  const v3Transactions = transactions;
  transactions = () => transferHistory() + stripOldTop(v3Transactions());
  const v3Settings = settings;
  settings = () => '<section class="panel wallet-settings"><div class="panel-heading"><div>' +
    '<h3>Mi dinero: efectivo y cuenta</h3><p>Consulta o reconcilia tus saldos sin borrar movimientos.</p></div>' +
    '<button type="button" class="btn primary small" data-wallet-action="adjust">' +
    (configured() ? 'Actualizar ambos saldos' : 'Configurar mis saldos') + '</button></div>' +
    '<p class="wallet-small-note">Los ajustes empiezan un nuevo punto de partida: tus movimientos y transferencias pasados ' +
    'siguen en el historial, pero no vuelven a afectar el saldo actual.</p></section>' +
    stripOldTop(v3Settings());

  // El formulario de movimientos pide explícitamente la cuenta afectada.
  const oldOpenTx = openTx;
  openTx = (transaction, initialKind) => {
    oldOpenTx(transaction, initialKind);
    const form = document.getElementById('tx-form');
    if (!form) return;
    const selected = transaction ? accountFor(transaction) : 'cash';
    const field = '<div class="field wallet-tx-account"><label for="tx-account">¿En dónde ' +
      ((transaction?.kind || initialKind) === 'income' ? 'recibiste' : 'salió') + ' el dinero?</label>' +
      '<select id="tx-account" name="account" required>' +
      '<option value="cash"' + (selected === 'cash' ? ' selected' : '') + '>💵 Efectivo</option>' +
      '<option value="bank"' + (selected === 'bank' ? ' selected' : '') + '>🏦 Cuenta bancaria o billetera</option>' +
      '</select><small class="muted">Este movimiento actualizará el saldo que elijas.</small></div>';
    const amountField = form.querySelector('.tx-money');
    if (amountField) amountField.insertAdjacentHTML('afterend', field);
    const method = document.getElementById('tx-method');
    if (method) {
      if (selected==='cash') method.value='Efectivo';
      else if (method.value==='Efectivo') method.value='Transferencia';
    }
  };

  function openWalletAdjust() {
    showModal(configured() ? 'Ajustar efectivo y cuenta' : 'Configurar mi dinero', walletForm(true));
  }
  function openWalletTransfer(from = 'cash') {
    if (!configured()) return openWalletAdjust();
    const current = balances();
    const origin = from === 'bank' ? 'bank' : 'cash';
    showModal(origin === 'cash' ? 'Consignar efectivo a mi cuenta' : 'Retirar dinero de mi cuenta',
      '<form id="wallet-transfer-form" class="wallet-form wallet-transfer-form">' +
      '<div class="field"><label for="wallet-transfer-from">Desde</label>' +
      '<select id="wallet-transfer-from" name="from">' +
      '<option value="cash"' + (origin === 'cash' ? ' selected' : '') + '>💵 Efectivo</option>' +
      '<option value="bank"' + (origin === 'bank' ? ' selected' : '') + '>🏦 Cuenta bancaria</option>' +
      '</select></div>' +
      '<div class="wallet-destination">Hacia <strong id="wallet-transfer-to">' +
      walletLabel(origin === 'cash' ? 'bank' : 'cash') + '</strong></div>' +
      moneyInput('wallet-transfer-amount', '¿Cuánto dinero vas a trasladar?', '', '') +
      '<p class="wallet-available">Disponible en origen: <strong id="wallet-available">' +
      pesos(current[origin]) + '</strong></p>' +
      '<div class="field"><label for="wallet-transfer-date">Fecha del traslado</label>' +
      '<input id="wallet-transfer-date" type="date" name="date" value="' + today() +
      '" max="' + today() + '" required></div>' +
      '<div class="field"><label for="wallet-transfer-note">Descripción (opcional)</label>' +
      '<input id="wallet-transfer-note" name="note" maxlength="100" placeholder="Ej: consignación a Nequi"></div>' +
      '<p class="wallet-small-note">Este traslado resta dinero del origen y suma lo mismo al destino. ' +
      'No genera un ingreso nuevo ni cambia tu patrimonio total.</p>' +
      '<button type="submit" class="btn primary full">Registrar traslado</button></form>');
  }
  function parseNonnegative(raw) {
    const s = String(raw ?? '').trim();
    if (!s || s.startsWith('-')) return NaN;
    return parseCOP(s);
  }
  // Solo para los dos saldos: dejar el campo sin escribir equivale a $0.
  const parseWalletAmount = raw => String(raw ?? '').trim() === '' ? 0 : parseNonnegative(raw);
  function saveWallet(cash, bank) {
    if (!isAmount(cash) || !isAmount(bank) || cash + bank > 1e15) {
      return toast('Escribe cantidades válidas en pesos colombianos.');
    }
    const ignoredIds = db.transactions.map(t => t.id);
    db.wallets = {
      configured: true, cash, bank, date: today(),
      ignoredIds, ignoredTransfers: (db.transfers || []).map(t => t.id)
    };
    // Mantener compatibilidad con el saldo anterior, sin duplicar transacciones.
    db.balance = {configured: true, amount: cash + bank, date: today(), ignoredIds};
    closeModal();
    st.view = 'dashboard';
    if (save()) toast('✓ Tu efectivo y tu cuenta ya están separados.');
  }

  document.addEventListener('click', event => {
    const el = event.target.closest('[data-wallet-action]');
    if (!el) return;
    event.preventDefault();
    const action = el.dataset.walletAction;
    if (action === 'adjust') openWalletAdjust();
    if (action === 'transfer') openWalletTransfer(el.dataset.from);
    if (action === 'start-zero') saveWallet(0, 0);
    if (action === 'delete-transfer') {
      const t = (db.transfers || []).find(x => x.id === el.dataset.id);
      if (t && confirm('¿Eliminar este traslado de ' + pesos(t.amount) + '? Se revertirá su efecto sobre los saldos cuando corresponda.')) {
        db.transfers = db.transfers.filter(x => x.id !== t.id);
        save(); toast('Traslado eliminado');
      }
    }
  });

  document.addEventListener('focusin', event => {
    const input = event.target;
    if (input?.id !== 'wallet-cash' && input?.id !== 'wallet-bank') return;
    if (input.value.trim() === '0') input.value = '';
    // Cuando hay un importe anterior, seleccionarlo facilita reemplazarlo.
    else if (input.value.trim() && typeof input.select === 'function') input.select();
  });
  document.addEventListener('input', event => {
    const form = event.target.closest('#wallet-form');
    if (!form) return;
    const cash = parseWalletAmount(form.elements['wallet-cash']?.value);
    const bank = parseWalletAmount(form.elements['wallet-bank']?.value);
    const el = document.getElementById('wallet-form-total');
    if (el) el.textContent = Number.isFinite(cash + bank) ? pesos(cash + bank) : '—';
  });
  document.addEventListener('change', event => {
    if (event.target.id==='tx-account') {
      const method=document.getElementById('tx-method');
      if(method) {
        if(event.target.value==='cash') method.value='Efectivo';
        else if(method.value==='Efectivo') method.value='Transferencia';
      }
      return;
    }
    if(event.target.id==='tx-method') {
      const account=document.getElementById('tx-account');
      if(account) account.value=event.target.value==='Efectivo'?'cash':'bank';
      return;
    }
    if (event.target.id !== 'wallet-transfer-from') return;
    const from = event.target.value;
    const next = document.getElementById('wallet-transfer-to');
    const available = document.getElementById('wallet-available');
    if (next) next.textContent = walletLabel(from === 'cash' ? 'bank' : 'cash');
    if (available) available.textContent = pesos(balances()[from]);
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'wallet-form') {
      event.preventDefault();
      const cash = parseWalletAmount(event.target.elements['wallet-cash'].value);
      const bank = parseWalletAmount(event.target.elements['wallet-bank'].value);
      saveWallet(cash, bank);
    }
    if (event.target.id === 'wallet-transfer-form') {
      event.preventDefault();
      const form = event.target, from = form.elements.from.value;
      const to = from === 'cash' ? 'bank' : 'cash';
      const amount = parseNonnegative(form.elements['wallet-transfer-amount'].value);
      const date = form.elements.date.value;
      if (!isAmount(amount) || amount <= 0) return toast('Introduce un monto positivo válido.');
      if (!isDate(date) || date > today() || date < db.wallets.date) {
        return toast('Elige una fecha desde tu configuración de saldo hasta hoy.');
      }
      const available = balances()[from];
      if (amount > available) return toast('No tienes suficiente dinero en ' + walletLabel(from).toLowerCase() + '.');
      db.transfers.push({
        id: id(), date, amount, from, to,
        note: String(form.elements.note.value || '').slice(0, 100)
      });
      closeModal();
      st.view = 'transactions';
      if (save()) toast('✓ Traslado realizado sin crear ingresos ni gastos.');
    }
  });
  render();
})();