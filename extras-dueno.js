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
