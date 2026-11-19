// =========================================================
// TAXIGO · EXTRAS-DUENO.JS · ESTABLE (SIN BUCLES + PIN 2026)
// =========================================================
(function () {
  const OWNER_PIN = '2026';

  function requireOwnerPin(actionLabel) {
    const entered = prompt(`🔐 Seguridad TaxiGo\nIngresa el PIN de Dueño para ${actionLabel}:`);
    if (entered !== OWNER_PIN) {
      if (typeof showToast === 'function') showToast('PIN incorrecto.');
      return false;
    }
    return true;
  }

  function initOwnerStable() {
    if (typeof state === 'undefined') {
      setTimeout(initOwnerStable, 150);
      return;
    }

    // Cargar Pago Móvil guardado
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

    // Guardar Pago Móvil con PIN 2026
    window.saveOwnerPagoMovilForm = function () {
      if (!requireOwnerPin('guardar tus datos de Pago Móvil')) return;
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
      document.getElementById('txg-pagomovil-modal')?.remove();
      if (typeof showToast === 'function') showToast('✅ Pago Móvil guardado');
    };

    // Modal flotante limpio para configurar Pago Móvil (solo se abre al tocar el botón)
    window.openOwnerPagoMovilModal = function () {
      document.getElementById('txg-pagomovil-modal')?.remove();
      const pay = state.ownerPayment || {};
      document.body.insertAdjacentHTML('beforeend', `
        <div id="txg-pagomovil-modal" class="fixed inset-0 z-[9995] bg-black/75 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-[#1e2233] rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-extrabold">📲 Mi Pago Móvil (Comisiones 10%)</h3>
              <button type="button" onclick="document.getElementById('txg-pagomovil-modal').remove()" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <p class="text-[11px] text-gray-400">Solo los conductores verán estos datos al reportar su comisión.</p>
            <div class="space-y-2">
              <input type="text" id="txg-owner-bank" value="${pay.bank || ''}" placeholder="Banco (ej. Banco de Venezuela 0102)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
              <input type="tel" id="txg-owner-phone" value="${pay.phone || ''}" placeholder="Teléfono Pago Móvil (ej. 0412-1234567)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
              <input type="text" id="txg-owner-ci" value="${pay.ci || ''}" placeholder="Cédula o RIF (ej. V-27123456)" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
              <input type="text" id="txg-owner-name" value="${pay.name || ''}" placeholder="Nombre del Titular" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            </div>
            <button type="button" onclick="saveOwnerPagoMovilForm()" class="w-full py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow">
              💾 Guardar Pago Móvil (PIN 2026)
            </button>
          </div>
        </div>
      `);
    };

    // Autorizar / Eliminar nuevos integrantes
    window.approveNewMember = function (userId) {
      if (!requireOwnerPin('autorizar el ingreso de este integrante')) return;
      const target = (state.users || []).find(u => u.id === userId);
      if (!target) return;
      target.approved = true;
      target.blocked = false;
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast(`✅ ${target.name} autorizado`);
      renderOwnerHeaderOnce();
      if (typeof updateAllUI === 'function') updateAllUI();
    };

    window.rejectOrDeleteMember = function (userId) {
      if (!requireOwnerPin('eliminar este registro')) return;
      state.users = (state.users || []).filter(u => u.id !== userId);
      if (typeof saveState === 'function') saveState();
      if (typeof showToast === 'function') showToast('Registro eliminado');
      renderOwnerHeaderOnce();
      if (typeof updateAllUI === 'function') updateAllUI();
    };

    // Pintar una sola vez (SIN bucles de auto-presión) los controles del Dueño
    function renderOwnerHeaderOnce() {
      const ownerScreen = document.getElementById('screen-owner');
      if (!ownerScreen) return;

      let bar = document.getElementById('txg-owner-static-bar');
      if (!bar) {
        ownerScreen.insertAdjacentHTML('afterbegin', `<div id="txg-owner-static-bar" class="p-4 pb-0 space-y-2.5"></div>`);
        bar = document.getElementById('txg-owner-static-bar');
      }

      const pendingUsers = (state.users || []).filter(u => u.role !== 'owner' && u.id !== 'usr-owner' && u.approved === false);

      const pendingHtml = pendingUsers.length > 0 ? `
        <div class="p-3.5 rounded-2xl bg-white dark:bg-[#1e2233] border-2 border-amber-400/70 space-y-2">
          <p class="text-xs font-extrabold uppercase text-amber-500">⏳ Nuevos Integrantes por Autorizar (${pendingUsers.length})</p>
          ${pendingUsers.map(u => `
            <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/70 flex items-center justify-between gap-2">
              <div>
                <p class="text-xs font-extrabold">${u.name || 'Usuario'} (${u.role === 'driver' ? 'Conductor' : 'Pasajero'})</p>
                <p class="text-[10px] text-gray-500">📞 ${u.phone || 'Sin teléfono'}</p>
              </div>
              <div class="flex gap-1.5">
                <button type="button" onclick="approveNewMember('${u.id}')" class="px-3 py-1.5 rounded-lg bg-[#00b14f] text-white text-[11px] font-extrabold">Autorizar</button>
                <button type="button" onclick="rejectOrDeleteMember('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-500 text-[11px] font-extrabold">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '';

      bar.innerHTML = `
        <div class="flex gap-2">
          <button type="button" onclick="openOwnerPagoMovilModal()" class="flex-1 py-3 px-3 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold shadow">
            📲 Mi Pago Móvil
          </button>
          <button type="button" onclick="if(typeof logoutGlobalTaxiGo==='function'){logoutGlobalTaxiGo();}else{state.activeUserId=null;location.reload();}" class="py-3 px-4 rounded-2xl bg-red-500 text-white text-xs font-extrabold shadow">
            🚪 Salir
          </button>
        </div>
        ${pendingHtml}
      `;
    }

    // Proteger acciones críticas con PIN 2026
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

    renderOwnerHeaderOnce();
  }

  window.addEventListener('load', initOwnerStable);
  setTimeout(initOwnerStable, 200);
})();
