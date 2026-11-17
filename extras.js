// =========================================================
// TAXIGO · EXTRAS.JS v3.0 (CORRECCIÓN EXACTA DEL MENÚ Y SESIONES)
// =========================================================
(function () {
  function runTaxiGoFix() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(runTaxiGoFix, 60);
      return;
    }

    // 1. Limpiar usuarios corruptos (como el usuario ".") y datos bancarios inventados
    state.users = (state.users || []).filter(u => u && u.name && u.name.trim().length > 1);
    if (!state.ownerPagoMovil || state.ownerPagoMovil.banco === 'Banesco (0134)') {
      state.ownerPagoMovil = { banco: '', cedula: '', telefono: '', titular: '' };
    }
    state.users.forEach(u => {
      if (u.role === 'driver' && (!u.pagoMovil || u.pagoMovil.banco === 'Banco de Venezuela (0102)')) {
        u.pagoMovil = { banco: '', cedula: '', telefono: '' };
      }
    });
    if (!Array.isArray(state.openRequests)) state.openRequests = [];
    if (!Array.isArray(state.paymentReports)) state.paymentReports = [];
    if (!Array.isArray(state.ledger)) state.ledger = [];
    if (typeof state.isLoggedIn === 'undefined') state.isLoggedIn = false;
    saveState();

    // 2. Garantizar PIN de dueño 2026 tras 5 toques al logo
    window.verifyOwnerPin = function () {
      const inp = document.getElementById('owner-pin-input');
      const val = inp ? String(inp.value).replace(/\s+/g, '').trim() : '';
      if (val === '2026') {
        if (typeof closeOwnerPinModal === 'function') closeOwnerPinModal();
        if (typeof closeDrawer === 'function') closeDrawer();
        if (typeof renderOwnerDashboard === 'function') renderOwnerDashboard();
        switchScreen('screen-owner');
        showToast('Panel de Dueño desbloqueado');
      } else {
        showToast('Clave incorrecta');
      }
    };

    const appShell = document.getElementById('app-shell');

    // 3. Pantalla de Inicio / Login / Registro separado
    if (!document.getElementById('screen-auth')) {
      appShell.insertAdjacentHTML('beforeend', `
        <section id="screen-auth" class="screen" style="background: linear-gradient(165deg, #11131a 0%, #1b2030 65%, #2a1218 100%); color: #fff;">
          <div class="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
            <div class="flex items-center justify-between pt-1">
              <div onclick="handleLogoTap()" class="taxigo-logo-trigger text-2xl font-extrabold tracking-tight select-none">
                Taxi<span class="text-[#e51d2e]">Go</span>
              </div>
              <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-white/10 text-gray-200">Ciudad Ojeda</span>
            </div>

            <div class="my-4">
              <span class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">Acceso independiente</span>
              <h1 class="text-2xl font-extrabold leading-tight mt-1">Inicia sesión o crea tu cuenta</h1>
              <p class="text-xs text-gray-300 mt-1">Pasajeros y conductores entran cada uno por separado.</p>
            </div>

            <div class="rounded-3xl p-4 bg-white text-[#11131a] shadow-xl space-y-3 mb-4">
              <p class="text-xs font-extrabold uppercase tracking-wider text-gray-500">Ya tengo cuenta</p>
              <input id="login-identifier" type="text" placeholder="Teléfono o Cédula" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none" />
              <button type="button" onclick="loginWithAccount()" class="w-full py-3.5 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold shadow active:scale-95 transition">
                Iniciar sesión
              </button>
            </div>

            <div class="rounded-3xl p-4 bg-white/10 border border-white/15 backdrop-blur-md text-white space-y-3">
              <p class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Crear cuenta nueva</p>
              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" onclick="goCreateAccount('passenger')" class="py-3.5 px-3 rounded-2xl bg-white text-[#11131a] text-xs font-extrabold flex flex-col items-center gap-1 shadow active:scale-95 transition">
                  <span class="text-xl">🧍</span>
                  <span>Soy Pasajero</span>
                </button>
                <button type="button" onclick="goCreateAccount('driver')" class="py-3.5 px-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold flex flex-col items-center gap-1 shadow active:scale-95 transition">
                  <span class="text-xl">🏍️</span>
                  <span>Soy Conductor</span>
                </button>
              </div>
            </div>

            <p class="text-center text-[11px] text-gray-400 pt-4">© 2026 TaxiGo · Todos los derechos reservados</p>
          </div>
        </section>
      `);
    }

    // 4. RECONSTRUIR EL MENÚ LATERAL EXACTAMENTE COMO PEDISTE (SIN CAMBIO DE MODO NI PANTALLA DE INICIO, SOLO CERRAR SESIÓN)
    function rebuildCleanDrawer() {
      const u = getActiveUser();
      const drawerMenu = document.querySelector('#side-drawer .flex-1');
      const drawerFooter = document.querySelector('#side-drawer .p-4.border-t');

      if (drawerMenu) {
        if (u && u.role === 'driver') {
          drawerMenu.innerHTML = `
            <button type="button" onclick="closeDrawer(); switchScreen('screen-driver')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🏍️</span> Panel de solicitudes
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-account')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>👤</span> Tu cuenta y perfil
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-driver-history')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🕒</span> Historial de carreras
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-settings')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>⚙️</span> Ajustes y Pago Móvil
            </button>
            <button type="button" onclick="closeDrawer(); openSupportModal()" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🎧</span> Soporte técnico
            </button>
          `;
        } else {
          drawerMenu.innerHTML = `
            <button type="button" onclick="closeDrawer(); switchScreen('screen-passenger')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🗺️</span> Pedir un viaje o envío
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-account')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>👤</span> Tu cuenta y perfil
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-passenger-history')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🕒</span> Historial de viajes
            </button>
            <button type="button" onclick="closeDrawer(); switchScreen('screen-settings')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>⚙️</span> Ajustes
            </button>
            <button type="button" onclick="closeDrawer(); openSupportModal()" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800">
              <span>🎧</span> Soporte técnico
            </button>
          `;
        }
      }

      if (drawerFooter) {
        drawerFooter.innerHTML = `
          <button type="button" onclick="closeDrawer(); logoutUser()" class="w-full py-3.5 rounded-2xl bg-[#e51d2e] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow active:scale-95 transition">
            <span>🚪</span> Cerrar sesión
          </button>
        `;
      }

      const profileSwitchBanner = document.querySelector('#screen-account div[onclick="switchToDriverMode()"]');
      if (profileSwitchBanner) profileSwitchBanner.classList.add('hidden');
    }

    window.logoutUser = function () {
      state.isLoggedIn = false;
      if (typeof driverOnline !== 'undefined' && driverOnline) toggleDriverOnline();
      saveState();
      switchScreen('screen-auth');
      showToast('Sesión cerrada');
    };

    window.goCreateAccount = function (role) {
      ['reg-name', 'reg-cedula', 'reg-phone', 'reg-address', 'reg-plate', 'reg-model', 'reg-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      switchScreen('screen-register');
      if (typeof setRegRole === 'function') setRegRole(role);
    };

    const regBackBtn = document.querySelector('#screen-register button[onclick*="switchScreen"]');
    if (regBackBtn) regBackBtn.setAttribute('onclick', 'handleRegisterBack()');
    window.handleRegisterBack = function () {
      if (state.isLoggedIn) {
        switchScreen(state.mode === 'driver' ? 'screen-driver' : 'screen-passenger');
      } else {
        switchScreen('screen-auth');
      }
    };

    window.loginWithAccount = function () {
      const query = (document.getElementById('login-identifier').value || '').trim().toLowerCase();
      if (!query) { showToast('Escribe tu teléfono o cédula'); return; }
      const user = state.users.find(u =>
        (u.phone && u.phone.toLowerCase().includes(query)) ||
        (u.cedula && u.cedula.toLowerCase().includes(query))
      );
      if (!user) { showToast('Cuenta no encontrada. Regístrate abajo'); return; }

      state.activeUserId = user.id;
      state.mode = user.role;
      state.isLoggedIn = true;
      saveState();
      rebuildCleanDrawer();
      switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast(`Bienvenido, ${user.name}`);
    };

    const origSubmitReg = window.submitRegistration;
    window.submitRegistration = function () {
      origSubmitReg();
      const user = getActiveUser();
      if (user) {
        if (user.role === 'driver' && !user.pagoMovil) user.pagoMovil = { banco: '', cedula: '', telefono: '' };
        state.isLoggedIn = true;
        state.mode = user.role;
        saveState();
        rebuildCleanDrawer();
        switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
        updateAllUI();
      }
    };

    // 5. Cancelación inmediata con motivo
    if (!document.getElementById('cancel-reason-modal')) {
      appShell.insertAdjacentHTML('beforeend', `
        <div id="cancel-reason-modal" class="hidden absolute inset-0 z-[125] bg-black/70 flex items-end">
          <div class="w-full bg-white dark:bg-[#1e2233] rounded-t-3xl p-5 shadow-2xl">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-base font-extrabold">Motivo de cancelación</h3>
              <button type="button" onclick="document.getElementById('cancel-reason-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <div class="flex flex-wrap gap-1.5 mb-3">
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='Tarda demasiado en llegar'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Tarda demasiado</button>
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='Cambio de planes / dirección'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Cambio de planes</button>
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='No responde mensajes'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">No responde</button>
            </div>
            <textarea id="cancel-reason-text" rows="3" placeholder="Escribe aquí el motivo..." class="w-full input-surface rounded-2xl p-3 text-xs font-semibold focus:outline-none mb-3"></textarea>
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" onclick="document.getElementById('cancel-reason-modal').classList.add('hidden')" class="py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold">Volver</button>
              <button type="button" onclick="confirmCancelWithReason()" class="py-3 rounded-2xl bg-[#e51d2e] text-white text-xs font-extrabold shadow">Confirmar cancelación</button>
            </div>
          </div>
        </div>
      `);
    }

    window.cancelSearchingDriver = function () {
      document.getElementById('cancel-reason-text').value = '';
      document.getElementById('cancel-reason-modal').classList.remove('hidden');
    };
    window.cancelDriverActiveTrip = function () {
      document.getElementById('cancel-reason-text').value = '';
      document.getElementById('cancel-reason-modal').classList.remove('hidden');
    };
    window.confirmCancelWithReason = function () {
      const txtEl = document.getElementById('cancel-reason-text');
      const reason = txtEl ? txtEl.value.trim() : '';
      if (!reason) { showToast('Escribe o selecciona el motivo'); return; }
      if (txtEl) txtEl.blur();
      document.getElementById('cancel-reason-modal').classList.add('hidden');
      ['step-searching', 'step-active-passenger', 'step-payment', 'step-vehicles'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const destStep = document.getElementById('step-destination');
      if (destStep) destStep.classList.remove('hidden');
      const drvSheet = document.getElementById('driver-active-trip-sheet');
      if (drvSheet) drvSheet.classList.add('hidden');

      const u = getActiveUser();
      state.ledger.unshift({
        id: 'CAN-' + Math.floor(100 + Math.random() * 899),
        desc: `Cancelado por ${u ? u.name : 'Usuario'}: ${reason}`,
        totalFare: 0,
        ownerCut: 0,
        date: 'Ahora',
        type: 'cancel'
      });
      saveState();
      showToast('Viaje cancelado');
    };

    // 6. Pago Móvil en blanco (Conductor y Dueño)
    const settingsScroll = document.querySelector('#screen-settings .scroll-area');
    if (settingsScroll && !document.getElementById('driver-pm-settings-card')) {
      const clearBtn = settingsScroll.querySelector('button[onclick="clearAppCache()"]');
      if (clearBtn) {
        clearBtn.insertAdjacentHTML('beforebegin', `
          <div id="driver-pm-settings-card" class="mb-5">
            <p class="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Mi Pago Móvil (Para recibir pagos de pasajeros)</p>
            <div class="card-surface rounded-2xl p-4 space-y-2.5">
              <input id="drv-pm-bank" type="text" placeholder="Escribe tu Banco" class="w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
              <div class="grid grid-cols-2 gap-2">
                <input id="drv-pm-cedula" type="text" placeholder="Tu Cédula" class="w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
                <input id="drv-pm-phone" type="tel" placeholder="Tu Teléfono" class="w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
              </div>
              <button type="button" onclick="saveDriverPagoMovil()" class="w-full py-2.5 rounded-xl bg-[#11131a] text-white text-xs font-extrabold">Guardar mi Pago Móvil</button>
            </div>
          </div>
        `);
      }
    }

    window.saveDriverPagoMovil = function () {
      const u = getActiveUser();
      const banco = document.getElementById('drv-pm-bank').value.trim();
      const cedula = document.getElementById('drv-pm-cedula').value.trim();
      const telefono = document.getElementById('drv-pm-phone').value.trim();
      if (!banco || !cedula || !telefono) { showToast('Completa Banco, Cédula y Teléfono'); return; }
      u.pagoMovil = { banco, cedula, telefono };
      saveState();
      showToast('Pago Móvil guardado');
    };

    const origUpdateUI = window.updateAllUI;
    window.updateAllUI = function () {
      origUpdateUI();
      rebuildCleanDrawer();
      const u = getActiveUser();
      const pmCard = document.getElementById('driver-pm-settings-card');
      if (pmCard) {
        pmCard.classList.toggle('hidden', u.role !== 'driver');
        if (u.role === 'driver') {
          const pm = u.pagoMovil || {};
          document.getElementById('drv-pm-bank').value = pm.banco || '';
          document.getElementById('drv-pm-cedula').value = pm.cedula || '';
          document.getElementById('drv-pm-phone').value = pm.telefono || '';
        }
      }
    };

    rebuildCleanDrawer();
    if (!state.isLoggedIn) {
      switchScreen('screen-auth');
    } else {
      switchScreen(state.mode === 'driver' ? 'screen-driver' : 'screen-passenger');
    }
    updateAllUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTaxiGoFix);
  } else {
    runTaxiGoFix();
  }
})();
