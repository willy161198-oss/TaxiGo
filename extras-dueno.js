// =========================================================
// TAXIGO · EXTRAS-DUENO.JS · VERSIÓN DE LANZAMIENTO (PIN 2026)
// =========================================================
(function () {
  const OWNER_PIN = '2026';

  function requireOwnerPin(actionLabel) {
    const entered = prompt(`🔐 Seguridad TaxiGo\nIngresa el PIN de Dueño para ${actionLabel}:`);
    if (entered !== OWNER_PIN) {
      if (typeof showToast === 'function') showToast('PIN incorrecto. Acción denegada.');
      return false;
    }
    return true;
  }

  function initOwnerLaunchModule() {
    if (typeof state === 'undefined') {
      setTimeout(initOwnerLaunchModule, 150);
      return;
    }

    // 1. Autorizar o rechazar nuevos integrantes (conductores con sus 6 documentos y pasajeros)
    window.approveNewMember = function (userId) {
      if (!requireOwnerPin('autorizar el ingreso de este integrante')) return;
      const target = (state.users || []).find(u => u.id === userId);
      if (!target) return;
      target.approved = true;
      target.blocked = false;
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast(`✅ ${target.name} autorizado correctamente`);
      renderOwnerPendingApprovals();
      if (typeof updateAllUI === 'function') updateAllUI();
    };

    window.rejectOrDeleteMember = function (userId) {
      if (!requireOwnerPin('eliminar este registro')) return;
      state.users = (state.users || []).filter(u => u.id !== userId);
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast('Registro eliminado');
      renderOwnerPendingApprovals();
      if (typeof updateAllUI === 'function') updateAllUI();
    };

    // 2. Renderizar bandeja de solicitudes pendientes de autorización en el Panel de Dueño
    function renderOwnerPendingApprovals() {
      const ownerScreen = document.getElementById('screen-owner');
      if (!ownerScreen) return;

      let box = document.getElementById('txg-owner-approvals-box');
      if (!box) {
        const container = ownerScreen.querySelector('.space-y-4, .p-4') || ownerScreen;
        container.insertAdjacentHTML('afterbegin', `<div id="txg-owner-approvals-box" class="mb-4"></div>`);
        box = document.getElementById('txg-owner-approvals-box');
      }

      const pendingUsers = (state.users || []).filter(u => u.role !== 'owner' && u.id !== 'usr-owner' && u.approved === false);

      if (pendingUsers.length === 0) {
        box.innerHTML = `
          <div class="p-3.5 rounded-2xl bg-white dark:bg-[#1e2233] border border-gray-200 dark:border-gray-700">
            <p class="text-xs font-extrabold text-[#00b14f]">✓ Sin solicitudes pendientes de autorización</p>
          </div>
        `;
        return;
      }

      box.innerHTML = `
        <div class="p-4 rounded-3xl bg-white dark:bg-[#1e2233] border-2 border-amber-400/60 space-y-3 shadow-lg">
          <p class="text-xs font-extrabold uppercase text-amber-500">⏳ Nuevos Integrantes por Autorizar (${pendingUsers.length})</p>
          ${pendingUsers.map(u => `
            <div class="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/70 space-y-2">
              <div class="flex justify-between items-start">
                <div>
                  <p class="text-xs font-extrabold">${u.name || 'Sin nombre'} (${u.role === 'driver' ? 'Conductor' : 'Pasajero'})</p>
                  <p class="text-[11px] text-gray-500">📞 ${u.phone || 'Sin teléfono'}</p>
                  ${u.role === 'driver' ? `<p class="text-[10px] text-[#00b14f] font-bold mt-0.5">📄 Docs: C.I., Carnet, Licencia, Carta Médica y RCV cargados</p>` : ''}
                </div>
              </div>
              <div class="flex gap-2">
                <button type="button" onclick="approveNewMember('${u.id}')" class="flex-1 py-2 rounded-xl bg-[#00b14f] text-white text-xs font-extrabold">
                  ✓ Autorizar
                </button>
                <button type="button" onclick="rejectOrDeleteMember('${u.id}')" class="px-3 py-2 rounded-xl bg-red-500/15 text-red-500 text-xs font-extrabold">
                  Eliminar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 3. Proteger con PIN 2026 todas las acciones críticas del dueño
    ['approveCommissionPayment', 'clearDriverDebt', 'toggleBlockUser', 'deleteUser', 'saveOwnerPaymentSettings'].forEach(fnName => {
      if (typeof window[fnName] === 'function' && !window[fnName]._pinProtected) {
        const origFn = window[fnName];
        window[fnName] = function (...args) {
          if (!requireOwnerPin('ejecutar esta acción administrativa')) return;
          return origFn.apply(this, args);
        };
        window[fnName]._pinProtected = true;
      }
    });

    setInterval(renderOwnerPendingApprovals, 3000);
    renderOwnerPendingApprovals();
  }

  window.addEventListener('load', initOwnerLaunchModule);
  setTimeout(initOwnerLaunchModule, 200);
})();
// =========================================================
// EXTENSIÓN PAGO MÓVIL DEL DUEÑO (PIN 2026)
// =========================================================
(function () {
  const OWNER_PIN = '2026';

  function initOwnerPagoMovilExtension() {
    if (typeof state === 'undefined') {
      setTimeout(initOwnerPagoMovilExtension, 150);
      return;
    }

    if (!state.ownerPayment) {
      try {
        const saved = localStorage.getItem('taxigo_owner_payment');
        state.ownerPayment = saved ? JSON.parse(saved) : {
          bank: 'Banco de Venezuela (0102)',
          phone: '',
          ci: '',
          name: 'Administración TaxiGo'
        };
      } catch (e) {
        state.ownerPayment = { bank: 'Banco de Venezuela (0102)', phone: '', ci: '', name: 'Administración TaxiGo' };
      }
    }

    window.saveOwnerPagoMovilForm = function () {
      const pin = prompt('🔐 Seguridad TaxiGo\nIngresa el PIN de Dueño para guardar tu Pago Móvil:');
      if (pin !== OWNER_PIN) {
        if (typeof showToast === 'function') showToast('PIN incorrecto');
        return;
      }

      const bank = (document.getElementById('txg-owner-bank')?.value || '').trim();
      const phone = (document.getElementById('txg-owner-phone')?.value || '').trim();
      const ci = (document.getElementById('txg-owner-ci')?.value || '').trim();
      const name = (document.getElementById('txg-owner-name')?.value || '').trim();

      if (!bank || !phone || !ci) {
        if (typeof showToast === 'function') showToast('Completa Banco, Teléfono y Cédula/RIF');
        return;
      }

      state.ownerPayment = { bank, phone, ci, name: name || 'Administración TaxiGo' };
      localStorage.setItem('taxigo_owner_payment', JSON.stringify(state.ownerPayment));
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast('✅ Pago Móvil guardado correctamente');
    };

    function injectPagoMovilCard() {
      const ownerScreen = document.getElementById('screen-owner');
      if (!ownerScreen || document.getElementById('txg-owner-pagomovil-card')) return;

      const pay = state.ownerPayment || {};
      const target = document.getElementById('txg-owner-approvals-box') || ownerScreen.querySelector('.space-y-4, .p-4') || ownerScreen;

      target.insertAdjacentHTML('afterend', `
        <div id="txg-owner-pagomovil-card" class="p-4 rounded-3xl bg-white dark:bg-[#1e2233] border border-gray-200 dark:border-gray-700 space-y-3 shadow-md mb-4">
          <div class="flex items-center justify-between">
            <p class="text-xs font-extrabold uppercase text-[#00b14f]">📲 Mi Pago Móvil (Comisiones 10%)</p>
            <span class="text-[10px] text-gray-400 font-bold">Solo visible a conductores</span>
          </div>
          <div class="space-y-2">
            <input type="text" id="txg-owner-bank" value="${pay.bank || ''}" placeholder="Banco (ej. Banco de Venezuela 0102)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="tel" id="txg-owner-phone" value="${pay.phone || ''}" placeholder="Teléfono Pago Móvil (ej. 0412-1234567)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="text" id="txg-owner-ci" value="${pay.ci || ''}" placeholder="Cédula o RIF (ej. V-27123456)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="text" id="txg-owner-name" value="${pay.name || ''}" placeholder="Nombre del Titular" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
          </div>
          <button type="button" onclick="saveOwnerPagoMovilForm()" class="w-full py-3 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold shadow active:scale-95 transition">
            💾 Guardar Pago Móvil (PIN 2026)
          </button>
        </div>
      `);
    }

    setInterval(injectPagoMovilCard, 1500);
    injectPagoMovilCard();
  }

  window.addEventListener('load', initOwnerPagoMovilExtension);
  setTimeout(initOwnerPagoMovilExtension, 250);
})();
// =========================================================
// EXTENSIÓN COMPACTA: BOTÓN + VENTANA FLOTANTE PAGO MÓVIL
// =========================================================
(function () {
  function compactOwnerPagoMovilUI() {
    const oldBigCard = document.getElementById('txg-owner-pagomovil-card');
    if (oldBigCard) oldBigCard.remove();

    const ownerScreen = document.getElementById('screen-owner');
    if (!ownerScreen) return;

    // 1. Insertar botón compacto en lugar de la pantalla grande
    if (!document.getElementById('txg-btn-open-pagomovil')) {
      const anchor = document.getElementById('txg-owner-approvals-box') || ownerScreen.querySelector('.space-y-4, .p-4') || ownerScreen;
      anchor.insertAdjacentHTML('afterend', `
        <button id="txg-btn-open-pagomovil" type="button" onclick="openOwnerPagoMovilModal()" class="w-full mb-3 px-4 py-3 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold flex items-center justify-between shadow-md active:scale-95 transition">
          <span>📲 Configurar Mi Pago Móvil</span>
          <span class="text-[10px] text-[#00b14f]">PIN 2026</span>
        </button>
      `);
    }
  }

  // 2. Abrir ventana flotante limpia al tocar el botón
  window.openOwnerPagoMovilModal = function () {
    document.getElementById('txg-pagomovil-modal')?.remove();
    const pay = (typeof state !== 'undefined' && state.ownerPayment) ? state.ownerPayment : {};

    document.body.insertAdjacentHTML('beforeend', `
      <div id="txg-pagomovil-modal" class="fixed inset-0 z-[9995] bg-black/70 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-[#1e2233] rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold">📲 Mi Pago Móvil (Comisiones 10%)</h3>
            <button type="button" onclick="document.getElementById('txg-pagomovil-modal').remove()" class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
          </div>
          <p class="text-[10px] text-gray-400">Solo los conductores verán estos datos al reportar su comisión.</p>
          <div class="space-y-2">
            <input type="text" id="txg-owner-bank" value="${pay.bank || ''}" placeholder="Banco (ej. Banco de Venezuela 0102)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="tel" id="txg-owner-phone" value="${pay.phone || ''}" placeholder="Teléfono Pago Móvil (ej. 0412-1234567)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="text" id="txg-owner-ci" value="${pay.ci || ''}" placeholder="Cédula o RIF (ej. V-27123456)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <input type="text" id="txg-owner-name" value="${pay.name || ''}" placeholder="Nombre del Titular" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
          </div>
          <button type="button" onclick="saveOwnerPagoMovilForm(); document.getElementById('txg-pagomovil-modal')?.remove();" class="w-full py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow">
            💾 Guardar Pago Móvil (PIN 2026)
          </button>
        </div>
      </div>
    `);
  };

  setInterval(compactOwnerPagoMovilUI, 800);
  compactOwnerPagoMovilUI();
})();
// =========================================================
// EXTENSIÓN: BOTÓN CERRAR SESIÓN EN PANEL DE DUEÑO
// =========================================================
(function () {
  window.logoutOwnerSession = function () {
    if (typeof state !== 'undefined') {
      state.activeUserId = null;
      state.currentRole = 'passenger';
      if (typeof saveState === 'function') saveState();
    }

    if (typeof switchRole === 'function') {
      switchRole('passenger');
    } else {
      document.querySelectorAll('[id^="screen-"]').forEach(s => s.classList.add('hidden'));
      const passScreen = document.getElementById('screen-passenger');
      if (passScreen) passScreen.classList.remove('hidden');
    }

    if (typeof updateAllUI === 'function') updateAllUI();
    if (typeof showToast === 'function') showToast('Sesión de Dueño cerrada');
  };

  function injectOwnerLogoutBtn() {
    const ownerScreen = document.getElementById('screen-owner');
    if (!ownerScreen || document.getElementById('txg-btn-owner-logout')) return;

    const anchor = document.getElementById('txg-btn-open-pagomovil') || document.getElementById('txg-owner-approvals-box') || ownerScreen.querySelector('.space-y-4, .p-4') || ownerScreen;

    anchor.insertAdjacentHTML('afterend', `
      <button id="txg-btn-owner-logout" type="button" onclick="logoutOwnerSession()" class="w-full mb-4 px-4 py-3 rounded-2xl bg-red-500/15 text-red-500 border border-red-500/30 text-xs font-extrabold flex items-center justify-center gap-2 active:scale-95 transition">
        <span>🚪 Cerrar Sesión de Dueño</span>
      </button>
    `);
  }

  setInterval(injectOwnerLogoutBtn, 1000);
  injectOwnerLogoutBtn();
})();
