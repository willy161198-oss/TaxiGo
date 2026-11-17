// =========================================================
// TAXIGO · EXTRAS.JS v2.2 (CANCELACIÓN INMEDIATA + PIN 2026 + DATOS EN BLANCO)
// =========================================================
(function () {
  function bootTaxiGoExtras() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(bootTaxiGoExtras, 80);
      return;
    }

    // 1. Garantizar que el PIN de dueño (2026) siempre funcione sin fallos
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

    // 2. Estructuras limpias SIN inventar datos bancarios ni teléfonos
    if (!state.ownerPagoMovil || state.ownerPagoMovil.banco === 'Banesco (0134)') {
      state.ownerPagoMovil = {
        banco: '',
        cedula: '',
        telefono: '',
        titular: ''
      };
    }
    if (!Array.isArray(state.openRequests)) state.openRequests = [];
    if (!Array.isArray(state.paymentReports)) state.paymentReports = [];
    if (!Array.isArray(state.cancellations)) state.cancellations = [];
    if (!Array.isArray(state.ledger)) state.ledger = [];
    if (typeof state.isLoggedIn === 'undefined') state.isLoggedIn = false;

    state.users.forEach(u => {
      if (u.role === 'driver') {
        if (!u.pagoMovil || u.pagoMovil.banco === 'Banco de Venezuela (0102)') {
          u.pagoMovil = { banco: '', cedula: '', telefono: '' };
        }
      }
    });
    saveState();

    const appShell = document.getElementById('app-shell');

    // =========================================================
    // 3. PANTALLA REAL DE INICIO / LOGIN / CREAR CUENTA
    // =========================================================
    if (!document.getElementById('screen-auth')) {
      const authScreenHTML = `
        <section id="screen-auth" class="screen" style="background: linear-gradient(165deg, #11131a 0%, #1b2030 65%, #2a1218 100%); color: #fff;">
          <div class="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
            <div class="flex items-center justify-between pt-1">
              <div onclick="handleLogoTap()" class="taxigo-logo-trigger text-2xl font-extrabold tracking-tight select-none">
                Taxi<span class="text-[#e51d2e]">Go</span>
              </div>
              <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-white/10 text-gray-200">Ciudad Ojeda</span>
            </div>

            <div class="my-4">
              <span class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">Plataforma de Movilidad</span>
              <h1 class="text-2xl font-extrabold leading-tight mt-1">Inicia sesión o regístrate</h1>
              <p class="text-xs text-gray-300 mt-1">Cada pasajero y conductor opera con su propia sesión independiente.</p>
            </div>

            <!-- INICIAR SESIÓN -->
            <div class="rounded-3xl p-4 bg-white text-[#11131a] shadow-xl space-y-3 mb-4">
              <p class="text-xs font-extrabold uppercase tracking-wider text-gray-500">Ya tengo una cuenta</p>
              <input id="login-identifier" type="text" placeholder="Ingresa tu teléfono o Cédula" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none" />
              <button type="button" onclick="loginWithAccount()" class="w-full py-3.5 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold shadow active:scale-95 transition">
                Iniciar sesión
              </button>
            </div>

            <!-- CREAR CUENTA NUEVA -->
            <div class="rounded-3xl p-4 bg-white/10 border border-white/15 backdrop-blur-md text-white space-y-3">
              <p class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">¿Eres nuevo en TaxiGo? Crea tu cuenta</p>
              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" onclick="goCreateAccount('passenger')" class="py-3.5 px-3 rounded-2xl bg-white text-[#11131a] text-xs font-extrabold flex flex-col items-center gap-1 shadow active:scale-95 transition">
                  <span class="text-xl">🧍</span>
                  <span>Registrarme como Pasajero</span>
                </button>
                <button type="button" onclick="goCreateAccount('driver')" class="py-3.5 px-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold flex flex-col items-center gap-1 shadow active:scale-95 transition">
                  <span class="text-xl">🏍️</span>
                  <span>Registrarme como Conductor</span>
                </button>
              </div>
            </div>

            <p class="text-center text-[11px] text-gray-400 pt-4">© 2026 TaxiGo · Todos los derechos reservados</p>
          </div>
        </section>
      `;
      appShell.insertAdjacentHTML('beforeend', authScreenHTML);
    }

    const regBackBtn = document.querySelector('#screen-register button[onclick*="switchScreen"]');
    if (regBackBtn) {
      regBackBtn.setAttribute('onclick', 'handleRegisterBack()');
    }
    window.handleRegisterBack = function () {
      if (state.isLoggedIn) {
        switchScreen(state.mode === 'driver' ? 'screen-driver' : 'screen-passenger');
      } else {
        switchScreen('screen-auth');
      }
    };

    window.goCreateAccount = function (role) {
      ['reg-name', 'reg-cedula', 'reg-phone', 'reg-address', 'reg-plate', 'reg-model', 'reg-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      switchScreen('screen-register');
      if (typeof setRegRole === 'function') setRegRole(role);
    };

    window.loginWithAccount = function () {
      const query = (document.getElementById('login-identifier').value || '').trim().toLowerCase();
      if (!query) {
        showToast('Escribe tu número de teléfono o cédula');
        return;
      }
      const user = state.users.find(u =>
        (u.phone && u.phone.toLowerCase().includes(query)) ||
        (u.cedula && u.cedula.toLowerCase().includes(query))
      );

      if (!user) {
        showToast('Usuario no encontrado. Regístrate abajo');
        return;
      }

      state.activeUserId = user.id;
      state.mode = user.role;
      state.isLoggedIn = true;
      saveState();

      switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast(`Bienvenido, ${user.name}`);
    };

    const origSubmitReg = window.submitRegistration;
    window.submitRegistration = function () {
      origSubmitReg();
      const user = getActiveUser();
      if (user) {
        if (user.role === 'driver' && !user.pagoMovil) {
          user.pagoMovil = { banco: '', cedula: '', telefono: '' };
        }
        state.isLoggedIn = true;
        state.mode = user.role;
        saveState();
        switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
        updateAllUI();
      }
    };

    // =========================================================
    // 4. BOTÓN CERRAR SESIÓN EN EL MENÚ LATERAL
    // =========================================================
    const drawerFooter = document.querySelector('#side-drawer .p-4.border-t');
    if (drawerFooter) {
      drawerFooter.innerHTML = `
        <button type="button" onclick="closeDrawer(); logoutUser()" class="w-full py-3.5 rounded-2xl bg-red-500/10 text-red-600 font-extrabold text-xs flex items-center justify-center gap-2 active:scale-95 transition">
          <span>🚪</span> Cerrar sesión
        </button>
      `;
    }

    const profileSwitchBanner = document.querySelector('#screen-account div[onclick="switchToDriverMode()"]');
    if (profileSwitchBanner) {
      profileSwitchBanner.classList.add('hidden');
    }

    window.logoutUser = function () {
      state.isLoggedIn = false;
      if (typeof driverOnline !== 'undefined' && driverOnline) {
        toggleDriverOnline();
      }
      saveState();
      switchScreen('screen-auth');
      showToast('Sesión cerrada');
    };

    if (!state.isLoggedIn) {
      switchScreen('screen-auth');
    } else {
      switchScreen(state.mode === 'driver' ? 'screen-driver' : 'screen-passenger');
    }

    // =========================================================
    // 5. FLUJO REAL PASAJERO <-> CONDUCTOR (SIN AUTO-ACEPTAR)
    // =========================================================
    let passengerPollInterval = null;

    window.startSearchingDriver = function () {
      const user = getActiveUser();
      const chosen = calculateFares().find(v => v.name === state.selectedVehicle) || calculateFares()[0];

      const newReq = {
        id: 'REQ-' + Date.now(),
        passengerId: user.id,
        passengerName: user.name,
        passengerPhone: user.phone,
        origin: document.getElementById('input-origin').value || 'Ciudad Ojeda',
        destination: state.destinationText || 'Casco Central, Ciudad Ojeda',
        vehicleType: state.selectedVehicle,
        paymentMethod: state.paymentMethod,
        fareUsd: chosen.usd,
        fareBs: chosen.bs,
        distanceKm: state.distanceKm || 2.4,
        durationMin: state.durationMin || 6,
        status: 'waiting',
        driverId: null,
        driverName: null,
        driverPlate: null,
        driverPagoMovil: null
      };

      if (!Array.isArray(state.openRequests)) state.openRequests = [];
      state.openRequests = state.openRequests.filter(r => r.passengerId !== user.id || r.status === 'completed');
      state.openRequests.unshift(newReq);
      saveState();

      document.getElementById('step-payment').classList.add('hidden');
      document.getElementById('step-searching').classList.remove('hidden');
      document.getElementById('searching-vehicle-icon').textContent = state.selectedVehicle === 'Moto Go' ? '🏍️' : '🚗';

      clearInterval(passengerPollInterval);
      passengerPollInterval = setInterval(() => {
        const fresh = loadStateSafe();
        const mine = (fresh.openRequests || []).find(r => r.id === newReq.id);
        if (mine && mine.status === 'accepted') {
          clearInterval(passengerPollInterval);
          state = fresh;
          showAcceptedRideToPassenger(mine);
        }
      }, 1500);
    };

    function showAcceptedRideToPassenger(req) {
      document.getElementById('step-searching').classList.add('hidden');
      document.getElementById('step-active-passenger').classList.remove('hidden');
      document.getElementById('active-ride-fare').textContent = '$' + Number(req.fareUsd).toFixed(2);
      document.getElementById('assigned-driver-name').textContent = req.driverName || 'Conductor asignado';
      document.getElementById('assigned-driver-vehicle').textContent = `${req.vehicleType} · Placa ${req.driverPlate || 'N/A'} · ★ 5.0`;

      const pmBox = document.getElementById('passenger-driver-pm-box');
      const pmText = document.getElementById('passenger-driver-pm-text');
      if (pmBox && pmText) {
        if (req.paymentMethod === 'Pago Móvil') {
          pmBox.classList.remove('hidden');
          const pm = req.driverPagoMovil || {};
          if (pm.banco && pm.telefono) {
            pmText.textContent = `${pm.banco} · CI: ${pm.cedula} · Tel: ${pm.telefono}`;
          } else {
            pmText.textContent = 'El conductor aún no ha cargado sus datos de Pago Móvil en su perfil.';
          }
        } else {
          pmBox.classList.add('hidden');
        }
      }
      showToast(`¡${req.driverName} aceptó tu viaje!`);
    }

    const driverBottomSheet = document.querySelector('#screen-driver .bottom-sheet');
    if (driverBottomSheet && !document.getElementById('driver-real-requests-box')) {
      driverBottomSheet.insertAdjacentHTML('beforeend', `
        <div id="driver-real-requests-box" class="hidden mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 max-h-48 overflow-y-auto">
          <p class="text-xs font-extrabold uppercase text-gray-500">Solicitudes Cercanas Disponibles</p>
          <div id="driver-real-requests-list" class="space-y-2"></div>
        </div>
      `);
    }

    let driverPollInterval = null;
    const origToggleDriver = window.toggleDriverOnline;
    window.toggleDriverOnline = function () {
      const user = getActiveUser();
      if (user.status !== 'approved' || user.mondayBlocked) {
        origToggleDriver();
        return;
      }

      origToggleDriver();
      clearTimeout(requestTimeout);

      const reqBox = document.getElementById('driver-real-requests-box');
      if (driverOnline) {
        if (reqBox) reqBox.classList.remove('hidden');
        renderRealDriverRequests();
        driverPollInterval = setInterval(renderRealDriverRequests, 1500);
      } else {
        if (reqBox) reqBox.classList.add('hidden');
        clearInterval(driverPollInterval);
      }
    };

    function renderRealDriverRequests() {
      const fresh = loadStateSafe();
      state.openRequests = fresh.openRequests || [];
      const driver = getActiveUser();
      const listEl = document.getElementById('driver-real-requests-list');
      if (!listEl) return;

      const available = state.openRequests.filter(r =>
        r.status === 'waiting' &&
        r.passengerId !== driver.id &&
        (!driver.vehicleType || r.vehicleType === driver.vehicleType)
      );

      if (available.length === 0) {
        listEl.innerHTML = `<p class="text-[11px] text-gray-400 text-center py-2">No hay pasajeros solicitando ${driver.vehicleType || 'viajes'} en este momento.</p>`;
        return;
      }

      listEl.innerHTML = available.map(r => `
        <div class="card-surface rounded-2xl p-3 flex items-center justify-between gap-2">
          <div>
            <p class="text-xs font-extrabold">${r.vehicleType} (${r.distanceKm} km) · ${r.passengerName}</p>
            <p class="text-[11px] text-gray-500 truncate max-w-[200px]">📍 ${r.origin} → ${r.destination}</p>
            <p class="text-[10px] font-bold text-emerald-600 mt-0.5">Pago: ${r.paymentMethod}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-extrabold text-[#00b14f]">$${Number(r.fareUsd).toFixed(2)}</p>
            <button type="button" onclick="acceptRealPassengerRequest('${r.id}')" class="mt-1 px-3 py-1.5 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold shadow active:scale-95">
              Aceptar
            </button>
          </div>
        </div>
      `).join('');
    }

    window.acceptRealPassengerRequest = function (reqId) {
      const driver = getActiveUser();
      const req = (state.openRequests || []).find(r => r.id === reqId);
      if (!req || req.status !== 'waiting') {
        showToast('Esta solicitud ya no está disponible');
        return;
      }

      req.status = 'accepted';
      req.driverId = driver.id;
      req.driverName = driver.name;
      req.driverPlate = driver.plate || 'Sin placa';
      req.driverPagoMovil = driver.pagoMovil || { banco: '', cedula: '', telefono: '' };
      saveState();

      document.getElementById('active-trip-passenger').textContent = req.passengerName;
      document.getElementById('active-trip-address').textContent = req.origin;
      document.getElementById('active-trip-fare').textContent = `$${Number(req.fareUsd).toFixed(2)} / Bs. ${Number(req.fareBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
      document.getElementById('active-trip-method-badge').textContent = req.paymentMethod;
      document.getElementById('active-trip-stage-label').textContent = 'Recoge al pasajero';
      document.getElementById('btn-driver-trip-progress').textContent = 'He llegado';
      document.getElementById('driver-active-trip-sheet').classList.remove('hidden');
      showToast('Carrera aceptada');
    };

    // =========================================================
    // 6. MOTIVO OBLIGATORIO AL CANCELAR VIAJE (CORREGIDO)
    // =========================================================
    if (!document.getElementById('cancel-reason-modal')) {
      appShell.insertAdjacentHTML('beforeend', `
        <div id="cancel-reason-modal" class="hidden absolute inset-0 z-[125] bg-black/70 flex items-end">
          <div class="w-full bg-white dark:bg-[#1e2233] rounded-t-3xl p-5 shadow-2xl">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-base font-extrabold">Motivo de cancelación</h3>
              <button type="button" onclick="closeCancelModalSafe()" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <p class="text-xs text-gray-500 mb-3">Elige o escribe por qué deseas cancelar este viaje:</p>
            <div class="flex flex-wrap gap-1.5 mb-3">
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='Tarda demasiado en llegar'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Tarda demasiado</button>
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='Cambio de planes / dirección'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Cambio de planes</button>
              <button type="button" onclick="document.getElementById('cancel-reason-text').value='No responde mensajes'" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">No responde</button>
            </div>
            <textarea id="cancel-reason-text" rows="3" placeholder="Escribe aquí el motivo..." class="w-full input-surface rounded-2xl p-3 text-xs font-semibold focus:outline-none mb-3"></textarea>
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" onclick="closeCancelModalSafe()" class="py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold">Volver</button>
              <button type="button" onclick="confirmCancelWithReason()" class="py-3 rounded-2xl bg-[#e51d2e] text-white text-xs font-extrabold shadow">Confirmar cancelación</button>
            </div>
          </div>
        </div>
      `);
    }

    window.closeCancelModalSafe = function () {
      const m = document.getElementById('cancel-reason-modal');
      if (m) m.classList.add('hidden');
    };

    window.cancelSearchingDriver = function () {
      const txt = document.getElementById('cancel-reason-text');
      if (txt) txt.value = '';
      const m = document.getElementById('cancel-reason-modal');
      if (m) m.classList.remove('hidden');
    };

    window.cancelDriverActiveTrip = function () {
      const txt = document.getElementById('cancel-reason-text');
      if (txt) txt.value = '';
      const m = document.getElementById('cancel-reason-modal');
      if (m) m.classList.remove('hidden');
    };

    window.confirmCancelWithReason = function () {
      const txtEl = document.getElementById('cancel-reason-text');
      const reason = txtEl ? txtEl.value.trim() : '';
      if (!reason) {
        showToast('Por favor escribe o selecciona un motivo');
        return;
      }

      // 1. Cerrar modal y pantallas de viaje inmediatamente
      if (txtEl) txtEl.blur();
      closeCancelModalSafe();
      clearInterval(passengerPollInterval);

      ['step-searching', 'step-active-passenger', 'step-payment', 'step-vehicles'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const destStep = document.getElementById('step-destination');
      if (destStep) destStep.classList.remove('hidden');

      const drvSheet = document.getElementById('driver-active-trip-sheet');
      if (drvSheet) drvSheet.classList.add('hidden');

      // 2. Guardar registro de cancelación de forma segura
      try {
        const u = getActiveUser();
        if (Array.isArray(state.openRequests)) {
          state.openRequests.forEach(r => {
            if ((r.passengerId === u.id || r.driverId === u.id) && r.status !== 'completed') {
              r.status = 'cancelled';
            }
          });
        }
        if (!Array.isArray(state.ledger)) state.ledger = [];
        state.ledger.unshift({
          id: 'CAN-' + Math.floor(100 + Math.random() * 899),
          desc: `Cancelado por ${u ? u.name : 'Usuario'}: ${reason}`,
          totalFare: 0,
          ownerCut: 0,
          date: 'Ahora',
          type: 'cancel'
        });
        saveState();
      } catch (e) {}

      showToast('Viaje cancelado correctamente');
    };

    // =========================================================
    // 7. PAGO MÓVIL DEL CONDUCTOR Y DEL DUEÑO (100% EN BLANCO)
    // =========================================================
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

      if (!banco || !cedula || !telefono) {
        showToast('Completa Banco, Cédula y Teléfono');
        return;
      }
      u.pagoMovil = { banco, cedula, telefono };
      saveState();
      showToast('Tus datos de Pago Móvil fueron guardados');
    };

    const activePassStep = document.getElementById('step-active-passenger');
    if (activePassStep && !document.getElementById('passenger-driver-pm-box')) {
      const actionBtns = activePassStep.querySelector('.flex.gap-2');
      if (actionBtns) {
        actionBtns.insertAdjacentHTML('beforebegin', `
          <div id="passenger-driver-pm-box" class="hidden mb-3 rounded-2xl p-3 bg-blue-500/10 border border-blue-500/25 text-xs">
            <div class="flex items-center justify-between mb-1">
              <span class="font-extrabold text-blue-700 dark:text-blue-300">📱 Pago Móvil del Conductor</span>
              <button type="button" onclick="copyDriverPM()" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold">Copiar</button>
            </div>
            <p id="passenger-driver-pm-text" class="text-[11px] font-semibold text-gray-700 dark:text-gray-200"></p>
          </div>
        `);
      }
    }

    window.copyDriverPM = function () {
      const txt = document.getElementById('passenger-driver-pm-text').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      showToast('Datos copiados');
    };

    if (!document.getElementById('driver-report-pay-modal')) {
      appShell.insertAdjacentHTML('beforeend', `
        <div id="driver-report-pay-modal" class="hidden absolute inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-end">
          <div class="w-full bg-white dark:bg-[#1e2233] rounded-t-3xl p-5 shadow-2xl">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-base font-extrabold">Reportar pago de comisión (10%)</h3>
              <button type="button" onclick="document.getElementById('driver-report-pay-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <div class="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-500/30 mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">Pago Móvil del Dueño</span>
                <button type="button" onclick="copyOwnerPM()" class="px-2.5 py-1 rounded-lg bg-[#00b14f] text-white text-[10px] font-extrabold">Copiar</button>
              </div>
              <p id="modal-owner-pm-info" class="text-xs font-bold"></p>
              <p class="text-[11px] text-gray-500 mt-1">Saldo pendiente: <strong id="modal-driver-debt-amt">$0.00</strong></p>
            </div>
            <input id="rep-pay-ref" type="text" placeholder="Número de referencia bancaria *" class="w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none mb-2.5" />
            <textarea id="rep-pay-note" rows="2" placeholder="Monto transferido y comentario..." class="w-full input-surface rounded-xl p-3 text-xs font-semibold focus:outline-none mb-3"></textarea>
            <button type="button" onclick="submitDriverCommissionReport()" class="w-full py-3.5 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow-lg">Enviar reporte al dueño</button>
          </div>
        </div>
      `);
    }

    window.copyOwnerPM = function () {
      const o = state.ownerPagoMovil;
      if (!o || !o.banco || !o.telefono) {
        showToast('El dueño aún no ha cargado sus datos bancarios');
        return;
      }
      if (navigator.clipboard) navigator.clipboard.writeText(`${o.banco} · ${o.cedula} · ${o.telefono}`).catch(() => {});
      showToast('Datos del dueño copiados');
    };

    window.openDriverReportPaymentModal = function () {
      const u = getActiveUser();
      const o = state.ownerPagoMovil || {};
      const infoEl = document.getElementById('modal-owner-pm-info');
      if (o.banco && o.telefono) {
        infoEl.textContent = `${o.banco} · CI: ${o.cedula} · Tel: ${o.telefono} (${o.titular})`;
      } else {
        infoEl.textContent = 'El administrador aún no ha registrado sus datos de Pago Móvil.';
      }
      document.getElementById('modal-driver-debt-amt').textContent = '$' + (u.debtUsd || 0).toFixed(2);
      document.getElementById('driver-report-pay-modal').classList.remove('hidden');
    };

    window.submitDriverCommissionReport = function () {
      const ref = (document.getElementById('rep-pay-ref').value || '').trim();
      const note = (document.getElementById('rep-pay-note').value || '').trim();
      if (!ref) { showToast('Escribe la referencia del pago'); return; }
      const u = getActiveUser();
      state.paymentReports.unshift({
        id: 'REP-' + Date.now(),
        driverId: u.id,
        driverName: u.name,
        amountUsd: u.debtUsd || 0,
        ref,
        note: note || 'Liquidación comisión semanal',
        verified: false
      });
      saveState();
      document.getElementById('driver-report-pay-modal').classList.add('hidden');
      showToast('Reporte enviado al dueño');
    };

    const ownerSettlementsView = document.getElementById('owner-view-settlements');
    if (ownerSettlementsView && !document.getElementById('own-pm-bank')) {
      ownerSettlementsView.insertAdjacentHTML('afterbegin', `
        <div class="card-surface rounded-2xl p-3.5 space-y-2 mb-3">
          <p class="text-xs font-extrabold">📱 Mis datos de Pago Móvil (Para recibir comisiones)</p>
          <div class="grid grid-cols-2 gap-2">
            <input id="own-pm-bank" type="text" placeholder="Tu Banco" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
            <input id="own-pm-cedula" type="text" placeholder="Tu Cédula / RIF" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input id="own-pm-phone" type="tel" placeholder="Tu Teléfono" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
            <input id="own-pm-titular" type="text" placeholder="Nombre del Titular" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
          </div>
          <button type="button" onclick="saveOwnerPagoMovil()" class="w-full py-2.5 rounded-xl bg-[#11131a] text-white text-xs font-extrabold">Guardar mi Pago Móvil</button>
        </div>
        <div id="owner-reported-payments-box" class="space-y-2 mb-3"></div>
      `);
    }

    window.saveOwnerPagoMovil = function () {
      const banco = document.getElementById('own-pm-bank').value.trim();
      const cedula = document.getElementById('own-pm-cedula').value.trim();
      const telefono = document.getElementById('own-pm-phone').value.trim();
      const titular = document.getElementById('own-pm-titular').value.trim();

      if (!banco || !cedula || !telefono) {
        showToast('Completa Banco, Cédula y Teléfono');
        return;
      }
      state.ownerPagoMovil = { banco, cedula, telefono, titular };
      saveState();
      showToast('Tus datos de Pago Móvil han sido guardados');
    };

    const origRenderOwner = window.renderOwnerDashboard;
    window.renderOwnerDashboard = function () {
      origRenderOwner();
      const o = state.ownerPagoMovil || {};
      if (document.getElementById('own-pm-bank')) {
        document.getElementById('own-pm-bank').value = o.banco || '';
        document.getElementById('own-pm-cedula').value = o.cedula || '';
        document.getElementById('own-pm-phone').value = o.telefono || '';
        document.getElementById('own-pm-titular').value = o.titular || '';
      }
      const repBox = document.getElementById('owner-reported-payments-box');
      if (repBox) {
        const pendingReports = (state.paymentReports || []).filter(r => !r.verified);
        repBox.innerHTML = pendingReports.length ? `
          <p class="text-xs font-extrabold uppercase text-emerald-600">Pagos reportados (${pendingReports.length})</p>
          ${pendingReports.map(r => `
            <div class="card-surface rounded-2xl p-3 border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between gap-2">
              <div>
                <p class="text-xs font-extrabold">${r.driverName} · $${Number(r.amountUsd).toFixed(2)}</p>
                <p class="text-[11px] font-bold">Ref: ${r.ref}</p>
                <p class="text-[10px] text-gray-500">${r.note}</p>
              </div>
              <button type="button" onclick="approveReportedPayment('${r.id}')" class="px-3 py-2 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">Aprobar</button>
            </div>
          `).join('')}
        ` : '';
      }
    };

    window.approveReportedPayment = function (reportId) {
      const rep = state.paymentReports.find(r => r.id === reportId);
      if (!rep) return;
      rep.verified = true;
      settleDriverDebt(rep.driverId);
    };

    const origUpdateUI = window.updateAllUI;
    window.updateAllUI = function () {
      origUpdateUI();
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

    updateAllUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootTaxiGoExtras);
  } else {
    bootTaxiGoExtras();
  }
})();
