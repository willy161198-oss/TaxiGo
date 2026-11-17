// =========================================================
// TAXIGO · EXTRAS.JS v4.1 (VALIDACIÓN ESTRICTA DE REGISTRO + PANEL DUEÑO)
// =========================================================
(function () {
  function initTaxiGoConsolidated() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initTaxiGoConsolidated, 60);
      return;
    }

    // 1. Limpieza segura sin inventar datos bancarios
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

    // =========================================================
    // 2. PIN DE DUEÑO (2026) GARANTIZADO TRAS 5 TOQUES AL LOGO
    // =========================================================
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

    // =========================================================
    // 3. PANTALLA DE INICIO SEPARADA (LOGIN Y REGISTRO)
    // =========================================================
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
              <p class="text-xs text-gray-300 mt-1">Cada pasajero y conductor opera con su propia sesión independiente.</p>
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

    const regBackBtn = document.querySelector('#screen-register button[onclick*="switchScreen"]');
    if (regBackBtn) regBackBtn.setAttribute('onclick', 'handleRegisterBack()');

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
      // Reiniciar las cajas de fotos al abrir un registro nuevo
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
      rebuildCleanDrawer();
      switchScreen(user.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast(`Bienvenido, ${user.name}`);
    };

    // VALIDACIÓN ESTRICTA DE REGISTRO (NO CREA NADA SI FALTAN DATOS O FOTOS)
    window.submitRegistration = function () {
      const name = (document.getElementById('reg-name').value || '').trim();
      const cedula = (document.getElementById('reg-cedula').value || '').trim();
      const phone = (document.getElementById('reg-phone').value || '').trim();
      const address = (document.getElementById('reg-address').value || '').trim();

      if (name.length < 3) {
        showToast('Escribe tu nombre y apellido completo');
        return;
      }
      if (cedula.length < 5) {
        showToast('Escribe tu número de cédula válido');
        return;
      }
      if (phone.length < 7) {
        showToast('Escribe tu número de teléfono');
        return;
      }
      if (address.length < 4) {
        showToast('Escribe tu dirección de residencia');
        return;
      }

      const docs = (typeof uploadedDocs !== 'undefined' && uploadedDocs) ? uploadedDocs : {};
      if (!docs.face) {
        showToast('Debes subir la foto de tu rostro (Selfie)');
        return;
      }
      if (!docs.cedula) {
        showToast('Debes subir la foto de tu Cédula');
        return;
      }

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

        if (!plate || !model || !color) {
          showToast('Completa placa, modelo y color del vehículo');
          return;
        }
        if (!docs.vehicle || !docs.license) {
          showToast('Sube las fotos del vehículo y licencia');
          return;
        }
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
      rebuildCleanDrawer();
      switchScreen(newUser.role === 'driver' ? 'screen-driver' : 'screen-passenger');
      updateAllUI();
      showToast('Registro enviado para aprobación del dueño');
    };

    // =========================================================
    // 4. PANEL DE DUEÑO (PASAJEROS | CONDUCTORES | MOVIMIENTOS)
    // =========================================================
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
              <button type="button" onclick="runMondayCutoff()" class="shrink-0 px-3 py-2 rounded-xl bg-[#e51d2e] text-white text-[11px] font-extrabold shadow active:scale-95">
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

      if (!banco || !cedula || !telefono) {
        showToast('Completa Banco, Cédula y Teléfono');
        return;
      }
      state.ownerPagoMovil = { banco, cedula, telefono, titular };
      saveState();
      document.getElementById('owner-pm-modal').classList.add('hidden');
      showToast('Pago Móvil del dueño guardado');
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

    window.deleteUserFromOwner = function (userId) {
      const target = state.users.find(u => u.id === userId);
      if (!target) return;
      state.users = state.users.filter(u => u.id !== userId);
      if (state.activeUserId === userId) {
        state.isLoggedIn = false;
        state.activeUserId = state.users[0] ? state.users[0].id : '';
      }
      saveState();
      renderOwnerDashboard();
      showToast(`Usuario "${target.name}" eliminado`);
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
              <button type="button" onclick="approveReportedPayment('${r.id}')" class="px-3 py-2 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">Aprobar pago</button>
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
        ? `<p class="text-[11px] font-bold text-amber-600 mt-0.5">Deuda 10%: $${Number(u.debtUsd || 0).toFixed(2)} ${u.debtUsd > 0 ? `<button type="button" onclick="settleDriverDebt('${u.id}')" class="ml-1 underline text-emerald-600 font-extrabold">Saldar</button>` : ''}</p>`
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
            ${u.status !== 'approved' ? `<button type="button" onclick="setUserStatus('${u.id}', 'approved')" class="px-3 py-1.5 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">✓ Autorizar</button>` : ''}
            ${u.status !== 'blocked' ? `<button type="button" onclick="setUserStatus('${u.id}', 'blocked')" class="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-600 text-[11px] font-bold">Bloquear</button>` : ''}
            <button type="button" onclick="deleteUserFromOwner('${u.id}')" class="px-3 py-1.5 rounded-xl bg-[#11131a] text-white text-[11px] font-extrabold">
              Eliminar
            </button>
          </div>
        </div>
      `;
    }

    window.approveReportedPayment = function (reportId) {
      const rep = state.paymentReports.find(r => r.id === reportId);
      if (!rep) return;
      rep.verified = true;
      settleDriverDebt(rep.driverId);
    };

    // =========================================================
    // 5. MENÚ LATERAL LIMPIO POR ROL CON BOTÓN DE CERRAR SESIÓN
    // =========================================================
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

    // =========================================================
    // 6. FLUJO REAL PASAJERO <-> CONDUCTOR + CANCELACIÓN CON MOTIVO + PAGO MÓVIL
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

      state.openRequests = (state.openRequests || []).filter(r => r.passengerId !== user.id || r.status === 'completed');
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
      document.getElementById('assigned-driver-vehicle').textContent = `${req.vehicleType} · Placa ${req.driverPlate || 'S/P'} · ★ 5.0`;

      const pmBox = document.getElementById('passenger-driver-pm-box');
      const pmText = document.getElementById('passenger-driver-pm-text');
      if (pmBox && pmText) {
        if (req.paymentMethod === 'Pago Móvil') {
          pmBox.classList.remove('hidden');
          const pm = req.driverPagoMovil || {};
          pmText.textContent = (pm.banco && pm.telefono)
            ? `${pm.banco} · CI: ${pm.cedula} · Tel: ${pm.telefono}`
            : 'El conductor aún no ha cargado sus datos de Pago Móvil.';
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
      if (!req || req.status !== 'waiting') { showToast('Esta solicitud ya no está disponible'); return; }

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
      clearInterval(passengerPollInterval);

      ['step-searching', 'step-active-passenger', 'step-payment', 'step-vehicles'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const destStep = document.getElementById('step-destination');
      if (destStep) destStep.classList.remove('hidden');
      const drvSheet = document.getElementById('driver-active-trip-sheet');
      if (drvSheet) drvSheet.classList.add('hidden');

      const u = getActiveUser();
      (state.openRequests || []).forEach(r => {
        if ((r.passengerId === u.id || r.driverId === u.id) && r.status !== 'completed') r.status = 'cancelled';
      });
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
      if (!o || !o.banco || !o.telefono) { showToast('El dueño aún no ha cargado sus datos bancarios'); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(`${o.banco} · ${o.cedula} · ${o.telefono}`).catch(() => {});
      showToast('Datos del dueño copiados');
    };

    window.openDriverReportPaymentModal = function () {
      const u = getActiveUser();
      const o = state.ownerPagoMovil || {};
      const infoEl = document.getElementById('modal-owner-pm-info');
      infoEl.textContent = (o.banco && o.telefono)
        ? `${o.banco} · CI: ${o.cedula} · Tel: ${o.telefono} (${o.titular})`
        : 'El administrador aún no ha registrado sus datos de Pago Móvil.';
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

    const origUpdateUI = window.updateAllUI;
    window.updateAllUI = function () {
      origUpdateUI();
      rebuildCleanDrawer();
      const u = getActiveUser();
      const pmCard = document.getElementById('driver-pm-settings-card');
      if (pmCard && u) {
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
    document.addEventListener('DOMContentLoaded', initTaxiGoConsolidated);
  } else {
    initTaxiGoConsolidated();
  }
})();
