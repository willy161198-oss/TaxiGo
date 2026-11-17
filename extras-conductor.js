// =========================================================
// TAXIGO · EXTRAS-AUTH.JS v2.0 (MENÚ BLINDADO + CERRAR SESIÓN REAL)
// =========================================================
(function () {
  function bootAuthModule() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(bootAuthModule, 60);
      return;
    }

    // 1. Limpieza segura de datos iniciales
    if (!Array.isArray(state.users)) state.users = [];
    if (!state.ownerPagoMovil || state.ownerPagoMovil.banco === 'Banesco (0134)') {
      state.ownerPagoMovil = { banco: '', cedula: '', telefono: '', titular: '' };
    }
    state.users.forEach(u => {
      if (u && u.role === 'driver' && (!u.pagoMovil || u.pagoMovil.banco === 'Banco de Venezuela (0102)')) {
        u.pagoMovil = { banco: '', cedula: '', telefono: '' };
      }
    });
    if (!Array.isArray(state.openRequests)) state.openRequests = [];
    if (!Array.isArray(state.paymentReports)) state.paymentReports = [];
    if (!Array.isArray(state.ledger)) state.ledger = [];
    if (typeof state.isLoggedIn === 'undefined') state.isLoggedIn = false;
    saveState();

    const appShell = document.getElementById('app-shell');

    // 2. Pantalla de Bienvenida / Login / Registro separado
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
              <span class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">Plataforma de Movilidad</span>
              <h1 class="text-2xl font-extrabold leading-tight mt-1">Inicia sesión o crea tu cuenta</h1>
              <p class="text-xs text-gray-300 mt-1">Pasajeros y conductores entran cada uno con su cuenta independiente.</p>
            </div>

            <div class="rounded-3xl p-4 bg-white text-[#11131a] shadow-xl space-y-3 mb-4">
              <p class="text-xs font-extrabold uppercase tracking-wider text-gray-500">Ya tengo cuenta</p>
              <input id="login-identifier" type="text" placeholder="Ingresa tu teléfono o Cédula" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none" />
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

    // 3. Blindar botón atrás en registro
    const regBackBtn = document.querySelector('#screen-register button[onclick*="switchScreen"]');
    if (regBackBtn) regBackBtn.setAttribute('onclick', 'handleRegisterBack()');

    window.handleRegisterBack = function () {
      if (state.isLoggedIn) {
        const u = getActiveUser();
        switchScreen(u && u.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      } else {
        switchScreen('screen-auth');
      }
    };

    window.goCreateAccount = function (role) {
      ['reg-name', 'reg-cedula', 'reg-phone', 'reg-address', 'reg-plate', 'reg-model', 'reg-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      uploadedDocs = { face: '', cedula: '', vehicle: '', license: '' };
      const labels = {
        face: '🤳 Toca para subir o tomar foto de tu cara',
        cedula: '🪪 Toca para subir foto de la cédula',
        vehicle: '🏍️ Toca para subir foto del vehículo',
        license: '📄 Toca para subir documentos del vehículo'
      };
      Object.keys(labels).forEach(k => {
        const box = document.getElementById('box-photo-' + k);
        const prev = document.getElementById('preview-photo-' + k);
        const inp = document.getElementById('file-photo-' + k);
        if (box) box.classList.remove('has-file');
        if (prev) prev.innerHTML = labels[k];
        if (inp) inp.value = '';
      });

      switchScreen('screen-register');
      if (typeof setRegRole === 'function') setRegRole(role);
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
      window.rebuildCleanDrawer();
      switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast(`Bienvenido, ${user.name}`);
    };

    window.submitRegistration = function () {
      const name = (document.getElementById('reg-name').value || '').trim();
      const cedula = (document.getElementById('reg-cedula').value || '').trim();
      const phone = (document.getElementById('reg-phone').value || '').trim();
      const address = (document.getElementById('reg-address').value || '').trim();

      if (name.length < 3) { showToast('Escribe tu nombre y apellido completo'); return; }
      if (cedula.length < 5) { showToast('Escribe tu cédula válida'); return; }
      if (phone.length < 7) { showToast('Escribe tu número de teléfono'); return; }
      if (address.length < 4) { showToast('Escribe tu dirección'); return; }

      const docs = (typeof uploadedDocs !== 'undefined' && uploadedDocs) ? uploadedDocs : {};
      if (!docs.face) { showToast('Sube la foto de tu rostro (Selfie)'); return; }
      if (!docs.cedula) { showToast('Sube la foto de tu Cédula'); return; }

      const currentRole = (typeof regRole !== 'undefined') ? regRole : 'passenger';
      const newUser = {
        id: 'usr-' + Date.now(),
        role: currentRole,
        name,
        cedula,
        phone,
        address,
        status: 'pending',
        debtUsd: 0,
        mondayBlocked: false,
        earnedToday: 0,
        tripsToday: 0,
        tripsTotal: 0,
        joined: 'Hoy',
        docs: { ...docs }
      };

      if (currentRole === 'driver') {
        const plate = (document.getElementById('reg-plate').value || '').trim().toUpperCase();
        const model = (document.getElementById('reg-model').value || '').trim();
        const color = (document.getElementById('reg-color').value || '').trim();

        if (!plate || !model || !color) { showToast('Completa placa, modelo y color'); return; }
        if (!docs.vehicle || !docs.license) { showToast('Sube fotos del vehículo y licencia'); return; }

        newUser.vehicleType = document.getElementById('reg-vehicle-type').value;
        newUser.plate = plate;
        newUser.model = model;
        newUser.color = color;
        newUser.pagoMovil = { banco: '', cedula: '', telefono: '' };
      }

      state.users.unshift(newUser);
      state.activeUserId = newUser.id;
      state.mode = newUser.role;
      state.isLoggedIn = true;
      saveState();

      uploadedDocs = { face: '', cedula: '', vehicle: '', license: '' };
      window.rebuildCleanDrawer();
      switchScreen(newUser.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast('Registro enviado para aprobación');
    };

    // 4. RECONSTRUCCIÓN BLINDADA DEL MENÚ LATERAL (SE EJECUTA CADA VEZ QUE SE ABRE EL MENÚ)
    window.rebuildCleanDrawer = function () {
      const u = getActiveUser();
      const isDriver = u && u.role === 'driver';
      const drawerMenu = document.querySelector('#side-drawer .flex-1');
      const drawerFooter = document.querySelector('#side-drawer .p-4.border-t');

      if (drawerMenu) {
        if (isDriver) {
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

      // Ocultar accesos cruzados dentro de "Tu cuenta"
      const profileSwitchBanner = document.querySelector('#screen-account div[onclick="switchToDriverMode()"]');
      if (profileSwitchBanner) profileSwitchBanner.classList.add('hidden');

      const regInAccountBtn = document.querySelector('#screen-account button[onclick="switchScreen(\'screen-register\')"]');
      if (regInAccountBtn) regInAccountBtn.classList.add('hidden');

      const accBackBtn = document.querySelector('#screen-account button[onclick*="switchScreen"]');
      if (accBackBtn) {
        accBackBtn.setAttribute('onclick', isDriver ? "switchScreen('screen-driver')" : "switchScreen('screen-passenger')");
      }
    };

    // Interceptar openDrawer para garantizar que SIEMPRE muestre el menú limpio
    const origOpenDrawer = window.openDrawer;
    window.openDrawer = function () {
      window.rebuildCleanDrawer();
      if (typeof origOpenDrawer === 'function') origOpenDrawer();
    };

    window.logoutUser = function () {
      state.isLoggedIn = false;
      if (typeof driverOnline !== 'undefined' && driverOnline) toggleDriverOnline();
      saveState();
      switchScreen('screen-auth');
      showToast('Sesión cerrada');
    };

    // Aplicar pantalla inicial correcta incluso después de que index.html cargue
    function enforceInitialScreen() {
      window.rebuildCleanDrawer();
      const u = getActiveUser();
      if (!state.isLoggedIn || !u) {
        switchScreen('screen-auth');
      } else {
        state.mode = u.role;
        switchScreen(u.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      }
    }

    enforceInitialScreen();
    setTimeout(enforceInitialScreen, 250);
  }

  window.addEventListener('load', bootAuthModule);
  setTimeout(bootAuthModule, 120);
})();
