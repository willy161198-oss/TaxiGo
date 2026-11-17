// =========================================================
// TAXIGO · EXTRAS-DUENO.JS v2.0 (CONFIRMACIÓN CON PIN 2026 EN TODA ACCIÓN)
// =========================================================
(function () {
  function initOwnerModule() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initOwnerModule, 70);
      return;
    }

    const appShell = document.getElementById('app-shell');
    let pendingSecurityAction = null;

    // 1. PIN 2026 tras 5 toques al logo TaxiGo
    window.verifyOwnerPin = function () {
      const inp = document.getElementById('owner-pin-input');
      const val = inp ? String(inp.value).replace(/\s+/g, '').trim() : '';
      if (val === '2026') {
        if (typeof closeOwnerPinModal === 'function') closeOwnerPinModal();
        if (typeof closeDrawer === 'function') closeDrawer();
        switchScreen('screen-owner');
        renderOwnerDashboard();
        showToast('Panel de Dueño desbloqueado');
      } else {
        showToast('Clave incorrecta');
      }
    };

    // 2. Modal de confirmación de seguridad con PIN (2026) para acciones críticas
    if (!document.getElementById('owner-action-pin-modal')) {
      appShell.insertAdjacentHTML('beforeend', `
        <div id="owner-action-pin-modal" class="hidden absolute inset-0 z-[140] bg-black/75 flex items-center justify-center p-5">
          <div class="w-full max-w-xs bg-white dark:bg-[#1e2233] rounded-3xl p-5 shadow-2xl space-y-3 text-center">
            <div class="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-xl mx-auto">🔐</div>
            <h3 class="text-base font-extrabold">Confirmar acción</h3>
            <p id="owner-action-pin-desc" class="text-xs text-gray-500">Ingresa tu código PIN de dueño para continuar:</p>
            <input id="owner-action-pin-input" type="password" inputmode="numeric" maxlength="6" placeholder="••••" class="w-full input-surface rounded-2xl px-4 py-3 text-center text-lg font-extrabold tracking-widest focus:outline-none" />
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onclick="closeOwnerActionPinModal()" class="py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold">Cancelar</button>
              <button type="button" onclick="confirmOwnerActionPin()" class="py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow">Confirmar</button>
            </div>
          </div>
        </div>
      `);
    }

    window.requireOwnerPinAction = function (description, callbackFn) {
      pendingSecurityAction = callbackFn;
      const descEl = document.getElementById('owner-action-pin-desc');
      const inp = document.getElementById('owner-action-pin-input');
      const modal = document.getElementById('owner-action-pin-modal');
      if (descEl) descEl.textContent = description || 'Ingresa tu código PIN de dueño para confirmar:';
      if (inp) inp.value = '';
      if (modal) modal.classList.remove('hidden');
      setTimeout(() => { if (inp) inp.focus(); }, 100);
    };

    window.closeOwnerActionPinModal = function () {
      pendingSecurityAction = null;
      const modal = document.getElementById('owner-action-pin-modal');
      if (modal) modal.classList.add('hidden');
    };

    window.confirmOwnerActionPin = function () {
      const inp = document.getElementById('owner-action-pin-input');
      const val = inp ? String(inp.value).replace(/\s+/g, '').trim() : '';
      if (val !== '2026') {
        showToast('Código PIN incorrecto. Acción cancelada');
        return;
      }
      const fn = pendingSecurityAction;
      closeOwnerActionPinModal();
      if (typeof fn === 'function') fn();
    };

    // 3. Estructura del Panel de Dueño
    const ownerScreen = document.getElementById('screen-owner');
    if (ownerScreen) {
      ownerScreen.innerHTML = `
        <div class="px-4 pt-4 pb-3 bg-[#11131a] text-white flex items-center justify-between">
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">Acceso Privado · Administración</span>
            <h1 class="text-lg font-extrabold">Panel de Dueño · TaxiGo</h1>
          </div>
          <button type="button" onclick="exitOwnerPanel()" class="px-3.5 py-2 rounded-xl bg-white/10 text-xs font-bold">Salir</button>
        </div>

        <div class="px-4 pt-2 pb-3 bg-[#11131a] text-white">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-[#00a84c] to-[#046c38] shadow-lg mb-3">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-extrabold uppercase tracking-wider text-emerald-100">Ganancia Neta del Dueño (10%)</p>
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/25">Solo visible para ti</span>
            </div>
            <div class="flex items-center justify-between mt-1.5">
              <p id="owner-net-profit" class="text-3xl font-extrabold">$0.00</p>
              <button type="button" onclick="openOwnerPMModal()" class="px-4 py-2 rounded-xl bg-[#11131a] text-white text-xs font-extrabold shadow-md active:scale-95 transition">
                Pago movil
              </button>
            </div>
            <div class="flex items-center justify-between text-xs text-emerald-100 mt-3 pt-2.5 border-t border-white/15">
              <span>Por cobrar (semana): <strong id="owner-pending-collect">$0.00</strong></span>
              <span>Ya cobrado: <strong id="owner-collected-total">$0.00</strong></span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1.5 bg-white/10 p-1 rounded-2xl text-xs font-extrabold">
            <button type="button" id="owner-tab-passengers" onclick="setOwnerTab('passengers')" class="py-2 rounded-xl bg-white text-[#11131a] transition">Pasajeros</button>
            <button type="button" id="owner-tab-drivers" onclick="setOwnerTab('drivers')" class="py-2 rounded-xl text-gray-300 transition">Conductores</button>
            <button type="button" id="owner-tab-ledger" onclick="setOwnerTab('ledger')" class="py-2 rounded-xl text-gray-300 transition">Movimientos</button>
          </div>
        </div>

        <div class="scroll-area px-4 py-3">
          <div id="owner-view-passengers" class="space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-extrabold uppercase text-gray-500">Pasajeros Registrados</h2>
              <span id="owner-pass-pending-badge" class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">0 pendientes</span>
            </div>
            <div id="owner-passengers-list" class="space-y-3"></div>
          </div>

          <div id="owner-view-drivers" class="hidden space-y-3">
            <div class="card-surface rounded-2xl p-3 bg-amber-500/5 border-amber-500/30 flex items-center justify-between gap-2">
              <div>
                <p class="text-xs font-extrabold">Corte Semanal (Lunes)</p>
                <p class="text-[10px] text-gray-500">Bloquea conductores con saldo 10% pendiente</p>
              </div>
              <button type="button" onclick="protectedRunMondayCutoff()" class="shrink-0 px-3 py-2 rounded-xl bg-[#e51d2e] text-white text-[11px] font-extrabold shadow active:scale-95">
                Ejecutar Corte Lunes
              </button>
            </div>

            <div id="owner-reported-payments-box" class="space-y-2"></div>

            <div class="flex items-center justify-between">
              <h2 class="text-xs font-extrabold uppercase text-gray-500">Conductores Registrados</h2>
              <span id="owner-drv-pending-badge" class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">0 pendientes</span>
            </div>
            <div id="owner-drivers-list" class="space-y-3"></div>
          </div>

          <div id="owner-view-ledger" class="hidden space-y-2.5">
            <h2 class="text-xs font-extrabold uppercase text-gray-500">Auditoría de Carreras y Comisiones (10%)</h2>
            <div id="owner-ledger-list" class="space-y-2"></div>
          </div>
        </div>
      `;
    }

    if (!document.getElementById('owner-pm-modal')) {
      appShell.insertAdjacentHTML('beforeend', `
        <div id="owner-pm-modal" class="hidden absolute inset-0 z-[125] bg-black/70 flex items-center justify-center p-5">
          <div class="w-full max-w-sm bg-white dark:bg-[#1e2233] rounded-3xl p-5 shadow-2xl space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-extrabold">📱 Mi Pago Móvil (Dueño)</h3>
              <button type="button" onclick="document.getElementById('owner-pm-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <p class="text-xs text-gray-500">Ingresa tus datos bancarios donde los conductores reportarán su comisión del 10%:</p>
            <input id="own-pm-bank" type="text" placeholder="Nombre del Banco" class="w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none" />
            <input id="own-pm-cedula" type="text" placeholder="Cédula o RIF" class="w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none" />
            <input id="own-pm-phone" type="tel" placeholder="Teléfono afiliado a Pago Móvil" class="w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none" />
            <input id="own-pm-titular" type="text" placeholder="Nombre del Titular" class="w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none" />
            <button type="button" onclick="saveOwnerPagoMovil()" class="w-full py-3.5 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow-lg active:scale-95 transition">
              Guardar datos de Pago Móvil
            </button>
          </div>
        </div>
      `);
    }

    let activeOwnerTab = 'drivers';

    window.exitOwnerPanel = function () {
      if (state.isLoggedIn) {
        switchScreen(state.mode === 'driver' ? 'screen-driver' : 'screen-passenger');
      } else {
        switchScreen('screen-auth');
      }
    };

    window.openOwnerPMModal = function () {
      const o = state.ownerPagoMovil || {};
      document.getElementById('own-pm-bank').value = o.banco || '';
      document.getElementById('own-pm-cedula').value = o.cedula || '';
      document.getElementById('own-pm-phone').value = o.telefono || '';
      document.getElementById('own-pm-titular').value = o.titular || '';
      document.getElementById('owner-pm-modal').classList.remove('hidden');
    };

    window.saveOwnerPagoMovil = function () {
      const banco = document.getElementById('own-pm-bank').value.trim();
      const cedula = document.getElementById('own-pm-cedula').value.trim();
      const telefono = document.getElementById('own-pm-phone').value.trim();
      const titular = document.getElementById('own-pm-titular').value.trim();

      if (!banco || !cedula || !telefono) { showToast('Completa Banco, Cédula y Teléfono'); return; }

      requireOwnerPinAction('Ingresa tu PIN para guardar o modificar tus datos de Pago Móvil:', () => {
        state.ownerPagoMovil = { banco, cedula, telefono, titular };
        saveState();
        document.getElementById('owner-pm-modal').classList.add('hidden');
        showToast('Pago Móvil del dueño guardado');
      });
    };

    window.setOwnerTab = function (tab) {
      activeOwnerTab = tab;
      ['passengers', 'drivers', 'ledger'].forEach(t => {
        const view = document.getElementById('owner-view-' + t);
        const btn = document.getElementById('owner-tab-' + t);
        if (view) view.classList.toggle('hidden', t !== tab);
        if (btn) {
          if (t === tab) {
            btn.className = t === 'drivers'
              ? 'py-2 rounded-xl bg-[#f97316] text-white transition'
              : 'py-2 rounded-xl bg-white text-[#11131a] transition';
          } else {
            btn.className = 'py-2 rounded-xl text-gray-300 transition';
          }
        }
      });
    };

    // Acciones protegidas con PIN obligatorio
    window.protectedSetUserStatus = function (userId, newStatus) {
      const target = state.users.find(u => u.id === userId);
      if (!target) return;
      const label = newStatus === 'approved' ? `Autorizar a ${target.name}` : `Bloquear a ${target.name}`;
      requireOwnerPinAction(`Confirmar: ${label}`, () => {
        setUserStatus(userId, newStatus);
        renderOwnerDashboard();
      });
    };

    window.protectedDeleteUser = function (userId) {
      const target = state.users.find(u => u.id === userId);
      if (!target) return;
      requireOwnerPinAction(`⚠️ Eliminar definitivamente a "${target.name}". Ingresa tu PIN:`, () => {
        state.users = state.users.filter(u => u.id !== userId);
        if (state.activeUserId === userId) {
          state.isLoggedIn = false;
          state.activeUserId = state.users[0] ? state.users[0].id : '';
        }
        saveState();
        renderOwnerDashboard();
        showToast(`Usuario "${target.name}" eliminado`);
      });
    };

    window.protectedSettleDriverDebt = function (userId) {
      const target = state.users.find(u => u.id === userId);
      if (!target) return;
      requireOwnerPinAction(`Confirmar que recibiste $${Number(target.debtUsd || 0).toFixed(2)} de ${target.name}:`, () => {
        settleDriverDebt(userId);
        renderOwnerDashboard();
      });
    };

    window.protectedApproveReportedPayment = function (reportId) {
      const rep = state.paymentReports.find(r => r.id === reportId);
      if (!rep) return;
      requireOwnerPinAction(`Confirmar pago reportado de ${rep.driverName} (Ref: ${rep.ref} · $${Number(rep.amountUsd).toFixed(2)}):`, () => {
        rep.verified = true;
        settleDriverDebt(rep.driverId);
        renderOwnerDashboard();
      });
    };

    window.protectedRunMondayCutoff = function () {
      requireOwnerPinAction('Ejecutar Corte Semanal (Lunes) y bloquear deudores:', () => {
        runMondayCutoff();
        renderOwnerDashboard();
      });
    };

    window.renderOwnerDashboard = function () {
      const passengers = state.users.filter(u => u.role === 'passenger');
      const drivers = state.users.filter(u => u.role === 'driver');

      const pendingCollect = drivers.reduce((acc, d) => acc + (d.debtUsd || 0), 0);
      const netProfit = (state.ownerCollectedTotal || 0) + pendingCollect;

      document.getElementById('owner-net-profit').textContent = '$' + netProfit.toFixed(2);
      document.getElementById('owner-pending-collect').textContent = '$' + pendingCollect.toFixed(2);
      document.getElementById('owner-collected-total').textContent = '$' + (state.ownerCollectedTotal || 0).toFixed(2);

      document.getElementById('owner-pass-pending-badge').textContent =
        passengers.filter(p => p.status === 'pending').length + ' pendientes';
      document.getElementById('owner-drv-pending-badge').textContent =
        drivers.filter(d => d.status === 'pending').length + ' pendientes';

      const passList = document.getElementById('owner-passengers-list');
      passList.innerHTML = passengers.length ? passengers.map(u => buildOwnerUserCard(u)).join('')
        : `<p class="text-xs text-gray-400 text-center py-6">No hay pasajeros registrados.</p>`;

      const drvList = document.getElementById('owner-drivers-list');
      drvList.innerHTML = drivers.length ? drivers.map(u => buildOwnerUserCard(u)).join('')
        : `<p class="text-xs text-gray-400 text-center py-6">No hay conductores registrados.</p>`;

      const repBox = document.getElementById('owner-reported-payments-box');
      if (repBox) {
        const pendingReports = (state.paymentReports || []).filter(r => !r.verified);
        repBox.innerHTML = pendingReports.length ? `
          <p class="text-xs font-extrabold uppercase text-emerald-600">Pagos reportados por verificar (${pendingReports.length})</p>
          ${pendingReports.map(r => `
            <div class="card-surface rounded-2xl p-3 border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between gap-2">
              <div>
                <p class="text-xs font-extrabold">${r.driverName} · $${Number(r.amountUsd).toFixed(2)}</p>
                <p class="text-[11px] font-bold">Ref: ${r.ref}</p>
                <p class="text-[10px] text-gray-500">${r.note}</p>
              </div>
              <button type="button" onclick="protectedApproveReportedPayment('${r.id}')" class="px-3 py-2 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">Aprobar pago</button>
            </div>
          `).join('')}
        ` : '';
      }

      const ledgerList = document.getElementById('owner-ledger-list');
      ledgerList.innerHTML = (state.ledger || []).map(m => `
        <div class="card-surface rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p class="text-xs font-extrabold">${m.desc}</p>
            <p class="text-[10px] text-gray-400">${m.date} · Total: $${Number(m.totalFare || 0).toFixed(2)}</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-extrabold text-emerald-600">+$${Number(m.ownerCut || 0).toFixed(2)}</p>
            <p class="text-[9px] text-gray-400">10% Dueño</p>
          </div>
        </div>
      `).join('');

      setOwnerTab(activeOwnerTab);
    };

    function buildOwnerUserCard(u) {
      const statusBadge = u.status === 'approved'
        ? `<span class="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600">✓ Autorizado</span>`
        : u.status === 'blocked'
          ? `<span class="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-500/15 text-red-600">⛔ Bloqueado</span>`
          : `<span class="shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600">⏳ Pendiente</span>`;

      const subtitle = u.role === 'driver'
        ? `🏍️ Conductor · ${u.vehicleType || 'Moto Go'} (${u.plate || 'S/P'})`
        : `🧍 Pasajero`;

      const debtInfo = u.role === 'driver'
        ? `<p class="text-[11px] font-bold text-amber-600 mt-0.5">Deuda 10%: $${Number(u.debtUsd || 0).toFixed(2)} ${u.debtUsd > 0 ? `<button type="button" onclick="protectedSettleDriverDebt('${u.id}')" class="ml-1 underline text-emerald-600 font-extrabold">Saldar</button>` : ''}</p>`
        : '';

      return `
        <div class="card-surface rounded-2xl p-3.5 space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-extrabold">${u.name}</p>
              <p class="text-[11px] font-bold text-gray-600 dark:text-gray-300">${subtitle}</p>
              <p class="text-[11px] text-gray-400">CI: ${u.cedula || 'S/C'} · Tel: ${u.phone || 'S/T'}</p>
              <p class="text-[11px] text-gray-400">Dir: ${u.address || 'Ciudad Ojeda'}</p>
              ${debtInfo}
            </div>
            ${statusBadge}
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <button type="button" onclick="viewUserDocs('${u.id}')" class="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
              👁️ Ver fotos/docs
            </button>
            ${u.status !== 'approved' ? `<button type="button" onclick="protectedSetUserStatus('${u.id}', 'approved')" class="px-3 py-1.5 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">✓ Autorizar</button>` : ''}
            ${u.status !== 'blocked' ? `<button type="button" onclick="protectedSetUserStatus('${u.id}', 'blocked')" class="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 text-[11px] font-bold">Bloquear</button>` : ''}
            <button type="button" onclick="protectedDeleteUser('${u.id}')" class="px-3 py-1.5 rounded-xl bg-[#11131a] text-white text-[11px] font-extrabold">
              Eliminar
            </button>
          </div>
        </div>
      `;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOwnerModule);
  } else {
    initOwnerModule();
  }
})();
