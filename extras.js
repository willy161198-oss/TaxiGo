// =========================================================
// TAXIGO · COMPLEMENTO EXTRAS.JS (SIN TOCAR INDEX.HTML)
// =========================================================
(function () {
  function initTaxiGoExtras() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initTaxiGoExtras, 100);
      return;
    }

    // 1. Inicializar propiedades nuevas en el estado de forma segura
    if (!state.ownerPagoMovil) {
      state.ownerPagoMovil = {
        banco: 'Banesco (0134)',
        cedula: 'V-27456890',
        telefono: '04121114357',
        titular: 'Administración TaxiGo'
      };
    }
    if (!state.paymentReports) {
      state.paymentReports = [];
    }
    if (!state.cancellations) {
      state.cancellations = [];
    }
    state.users.forEach(u => {
      if (u.role === 'driver' && !u.pagoMovil) {
        u.pagoMovil = {
          banco: 'Banco de Venezuela (0102)',
          cedula: u.cedula || 'V-27456890',
          telefono: u.phone || '04121114357'
        };
      }
    });
    saveState();

    const appShell = document.getElementById('app-shell');

    // =========================================================
    // 2. PANTALLA DE INICIO SEPARADA (BIENVENIDA / CREAR USUARIO)
    // =========================================================
    const welcomeHTML = `
      <section id="screen-welcome" class="screen" style="z-index: 65; background: linear-gradient(165deg, #11131a 0%, #1d2233 60%, #2a1218 100%); color: #fff;">
        <div class="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
          <div class="flex items-center justify-between pt-2">
            <div onclick="handleLogoTap()" class="taxigo-logo-trigger text-2xl font-extrabold tracking-tight select-none">
              Taxi<span class="text-[#e51d2e]">Go</span>
            </div>
            <span class="text-[11px] font-bold px-3 py-1 rounded-full bg-white/10 text-gray-200">Ciudad Ojeda</span>
          </div>

          <div class="my-6">
            <span class="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">Movilidad y Envíos</span>
            <h1 class="text-3xl font-extrabold leading-tight mt-1">¿Cómo deseas ingresar hoy?</h1>
            <p class="text-xs text-gray-300 mt-2 leading-relaxed">Cada usuario y conductor cuenta con su perfil independiente y verificación de documentos.</p>
          </div>

          <div class="space-y-3.5">
            <!-- Opción Pasajero -->
            <div class="rounded-3xl p-4 bg-white text-[#11131a] shadow-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 text-2xl flex items-center justify-center">🧍</div>
                <div>
                  <h2 class="text-base font-extrabold">Soy Pasajero</h2>
                  <p class="text-xs text-gray-500">Pide viajes en Moto Go, Automóvil o Envíos</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="openSeparateRegister('passenger')" class="py-3 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold active:scale-95 transition">
                  Crear cuenta
                </button>
                <button onclick="enterAsExistingRole('passenger')" class="py-3 rounded-2xl bg-gray-100 text-[#11131a] text-xs font-extrabold active:scale-95 transition">
                  Ya tengo cuenta
                </button>
              </div>
            </div>

            <!-- Opción Conductor -->
            <div class="rounded-3xl p-4 bg-white/10 border border-white/15 backdrop-blur-md text-white shadow-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-2xl bg-red-500/20 text-2xl flex items-center justify-center">🏍️</div>
                <div>
                  <h2 class="text-base font-extrabold">Soy Conductor</h2>
                  <p class="text-xs text-gray-300">Conéctate, recibe carreras y cobra directo</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="openSeparateRegister('driver')" class="py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold active:scale-95 transition">
                  Registrarme
                </button>
                <button onclick="enterAsExistingRole('driver')" class="py-3 rounded-2xl bg-white/15 text-white text-xs font-extrabold active:scale-95 transition">
                  Entrar a conducir
                </button>
              </div>
            </div>
          </div>

          <p class="text-center text-[11px] text-gray-400 pt-5">© 2026 TaxiGo · Costa Oriental del Lago</p>
        </div>
      </section>
    `;
    appShell.insertAdjacentHTML('beforeend', welcomeHTML);

    // Agregar botón en el menú lateral para volver a la pantalla de inicio / cambiar usuario
    const drawerMenu = document.querySelector('#side-drawer .flex-1');
    if (drawerMenu) {
      drawerMenu.insertAdjacentHTML('afterbegin', `
        <button onclick="closeDrawer(); switchScreen('screen-welcome')" class="w-full p-3 rounded-xl flex items-center gap-3 text-sm font-bold text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span>🚪</span> Pantalla de inicio / Cambiar perfil
        </button>
      `);
    }

    // Funciones globales para entrar separado como Pasajero o Conductor
    window.openSeparateRegister = function (role) {
      switchScreen('screen-register');
      if (typeof setRegRole === 'function') setRegRole(role);
    };

    window.enterAsExistingRole = function (role) {
      const found = state.users.find(u => u.role === role);
      if (found) {
        state.activeUserId = found.id;
      }
      state.mode = role;
      saveState();
      if (role === 'driver') {
        switchScreen('screen-driver');
      } else {
        switchScreen('screen-passenger');
      }
      updateAllUI();
    };

    // Mostrar la pantalla de inicio separada al abrir si no tiene sesión marcada en esta apertura
    if (!sessionStorage.getItem('taxigo_welcome_seen')) {
      sessionStorage.setItem('taxigo_welcome_seen', '1');
      switchScreen('screen-welcome');
    }

    // =========================================================
    // 3. MOTIVO OBLIGATORIO AL CANCELAR VIAJE (PASAJERO Y CONDUCTOR)
    // =========================================================
    const cancelModalHTML = `
      <div id="cancel-reason-modal" class="hidden absolute inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-end">
        <div class="w-full bg-white dark:bg-[#1e2233] rounded-t-3xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-base font-extrabold">Motivo de cancelación</h3>
            <button onclick="closeCancelReasonModal()" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
          </div>
          <p class="text-xs text-gray-500 mb-3">Por favor indícanos por qué cancelas este viaje:</p>

          <div class="flex flex-wrap gap-1.5 mb-3">
            <button type="button" onclick="setCancelQuickReason('El conductor/pasajero tarda mucho')" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Tarda mucho</button>
            <button type="button" onclick="setCancelQuickReason('Cambio de planes / dirección')" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Cambio de planes</button>
            <button type="button" onclick="setCancelQuickReason('No responde mensajes ni llamadas')" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">No responde</button>
            <button type="button" onclick="setCancelQuickReason('Inconveniente con el vehículo')" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">Problema con vehículo</button>
          </div>

          <textarea id="cancel-reason-text" rows="3" placeholder="Escribe aquí el motivo detallado..." class="w-full input-surface rounded-2xl p-3 text-xs font-semibold focus:outline-none mb-3"></textarea>

          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="closeCancelReasonModal()" class="py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold">Volver</button>
            <button onclick="confirmCancelWithReason()" class="py-3 rounded-2xl bg-[#e51d2e] text-white text-xs font-extrabold shadow">Enviar y cancelar</button>
          </div>
        </div>
      </div>
    `;
    appShell.insertAdjacentHTML('beforeend', cancelModalHTML);

    let pendingCancelSource = 'passenger'; // 'passenger' | 'driver'

    window.setCancelQuickReason = function (txt) {
      document.getElementById('cancel-reason-text').value = txt;
    };

    window.closeCancelReasonModal = function () {
      document.getElementById('cancel-reason-modal').classList.add('hidden');
    };

    // Interceptar botones de cancelar existentes
    window.cancelSearchingDriver = function () {
      pendingCancelSource = 'passenger';
      document.getElementById('cancel-reason-text').value = '';
      document.getElementById('cancel-reason-modal').classList.remove('hidden');
    };

    window.cancelDriverActiveTrip = function () {
      pendingCancelSource = 'driver';
      document.getElementById('cancel-reason-text').value = '';
      document.getElementById('cancel-reason-modal').classList.remove('hidden');
    };

    window.confirmCancelWithReason = function () {
      const reason = (document.getElementById('cancel-reason-text').value || '').trim();
      if (!reason) {
        showToast('Debes escribir o elegir un motivo para cancelar');
        return;
      }

      const user = getActiveUser();
      state.cancellations.unshift({
        by: `${user.name} (${pendingCancelSource === 'driver' ? 'Conductor' : 'Pasajero'})`,
        reason: reason,
        date: 'Hoy · Ahora'
      });
      state.ledger.unshift({
        id: 'CAN-' + Math.floor(100 + Math.random() * 899),
        desc: `Cancelación (${user.name}): ${reason}`,
        totalFare: 0,
        ownerCut: 0,
        date: 'Ahora',
        type: 'cancel'
      });
      saveState();

      closeCancelReasonModal();
      if (pendingCancelSource === 'passenger') {
        document.getElementById('step-searching').classList.add('hidden');
        document.getElementById('step-active-passenger').classList.add('hidden');
        document.getElementById('step-destination').classList.remove('hidden');
      } else {
        document.getElementById('driver-active-trip-sheet').classList.add('hidden');
      }
      showToast('Cancelación enviada con motivo');
    };

    // =========================================================
    // 4. PAGO MÓVIL DEL CONDUCTOR (PERFIL + VISIBLE AL PASAJERO)
    // =========================================================
    const settingsScroll = document.querySelector('#screen-settings .scroll-area');
    if (settingsScroll) {
      const driverPMHTML = `
        <div id="driver-pm-settings-card" class="mb-5">
          <p class="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Mi Pago Móvil (Para cobrar carreras)</p>
          <div class="card-surface rounded-2xl p-4 space-y-2.5">
            <div>
              <label class="text-[11px] font-bold text-gray-500">Banco</label>
              <input id="drv-pm-bank" type="text" placeholder="Ej. Banesco / Venezuela" class="mt-1 w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-bold text-gray-500">Cédula</label>
                <input id="drv-pm-cedula" type="text" placeholder="V-27456890" class="mt-1 w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
              </div>
              <div>
                <label class="text-[11px] font-bold text-gray-500">Teléfono Pago Móvil</label>
                <input id="drv-pm-phone" type="tel" placeholder="04121114357" class="mt-1 w-full input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
              </div>
            </div>
            <button onclick="saveDriverPagoMovil()" class="w-full py-2.5 rounded-xl bg-[#11131a] text-white text-xs font-extrabold active:scale-95 transition">
              Guardar datos de Pago Móvil
            </button>
          </div>
        </div>
      `;
      const clearBtn = settingsScroll.querySelector('button[onclick="clearAppCache()"]');
      if (clearBtn) {
        clearBtn.insertAdjacentHTML('beforebegin', driverPMHTML);
      }
    }

    window.saveDriverPagoMovil = function () {
      const user = getActiveUser();
      user.pagoMovil = {
        banco: document.getElementById('drv-pm-bank').value.trim() || 'Banco de Venezuela',
        cedula: document.getElementById('drv-pm-cedula').value.trim() || user.cedula,
        telefono: document.getElementById('drv-pm-phone').value.trim() || user.phone
      };
      saveState();
      showToast('Tus datos de Pago Móvil han sido guardados');
    };

    // Inyectar cuadro de Pago Móvil del conductor en la tarjeta de viaje activo del pasajero
    const activePassStep = document.getElementById('step-active-passenger');
    if (activePassStep) {
      const actionBtns = activePassStep.querySelector('.flex.gap-2');
      if (actionBtns) {
        actionBtns.insertAdjacentHTML('beforebegin', `
          <div id="passenger-driver-pm-box" class="hidden mb-3 rounded-2xl p-3 bg-blue-500/10 border border-blue-500/25 text-xs">
            <div class="flex items-center justify-between mb-1">
              <span class="font-extrabold text-blue-700 dark:text-blue-300">📱 Datos Pago Móvil del Conductor</span>
              <button onclick="copyDriverPM()" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-extrabold">Copiar</button>
            </div>
            <p id="passenger-driver-pm-text" class="text-[11px] font-semibold text-gray-700 dark:text-gray-200"></p>
          </div>
        `);
      }
    }

    window.copyDriverPM = function () {
      const txt = document.getElementById('passenger-driver-pm-text').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      showToast('Datos de Pago Móvil copiados');
    };

    // Envolver startSearchingDriver para mostrar el Pago Móvil del conductor si eligió Pago Móvil
    const origStartSearch = window.startSearchingDriver;
    window.startSearchingDriver = function () {
      origStartSearch();
      setTimeout(() => {
        const pmBox = document.getElementById('passenger-driver-pm-box');
        const pmText = document.getElementById('passenger-driver-pm-text');
        const driver = state.users.find(u => u.role === 'driver' && u.status === 'approved') || state.users[0];
        const pm = driver.pagoMovil || { banco: 'Venezuela', cedula: driver.cedula, telefono: driver.phone };

        if (pmBox && pmText) {
          if (state.paymentMethod === 'Pago Móvil') {
            pmBox.classList.remove('hidden');
            pmText.textContent = `${pm.banco} · CI: ${pm.cedula} · Tel: ${pm.telefono}`;
          } else {
            pmBox.classList.add('hidden');
          }
        }
      }, 2450);
    };

    // =========================================================
    // 5. PAGO MÓVIL DEL DUEÑO + REPORTE DE COMISIÓN DEL CONDUCTOR
    // =========================================================
    const reportModalHTML = `
      <div id="driver-report-pay-modal" class="hidden absolute inset-0 z-[120] bg-black/65 backdrop-blur-xs flex items-end">
        <div class="w-full bg-white dark:bg-[#1e2233] rounded-t-3xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-base font-extrabold">Reportar pago de comisión (10%)</h3>
            <button onclick="document.getElementById('driver-report-pay-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
          </div>

          <div class="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-500/30 mb-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">Pago Móvil del Administrador</span>
              <button onclick="copyOwnerPM()" class="px-2.5 py-1 rounded-lg bg-[#00b14f] text-white text-[10px] font-extrabold">Copiar datos</button>
            </div>
            <p id="modal-owner-pm-info" class="text-xs font-bold text-gray-800 dark:text-gray-100"></p>
            <p class="text-[11px] text-gray-500 mt-1">Monto pendiente a transferir: <strong id="modal-driver-debt-amt" class="text-gray-900 dark:text-white">$0.00</strong></p>
          </div>

          <div class="space-y-2.5 mb-3">
            <div>
              <label class="text-[11px] font-bold text-gray-500">Número de Referencia / Comprobante *</label>
              <input id="rep-pay-ref" type="text" placeholder="Ej. Ref #458921 · Banco Banesco" class="mt-1 w-full input-surface rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none" />
            </div>
            <div>
              <label class="text-[11px] font-bold text-gray-500">Monto transferido y nota *</label>
              <textarea id="rep-pay-note" rows="2" placeholder="Ej. Transferí Bs. 1.665,00 correspondientes al corte semanal" class="mt-1 w-full input-surface rounded-xl p-3 text-xs font-semibold focus:outline-none"></textarea>
            </div>
          </div>

          <button onclick="submitDriverCommissionReport()" class="w-full py-3.5 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow-lg active:scale-95 transition">
            Enviar reporte de pago al dueño
          </button>
        </div>
      </div>
    `;
    appShell.insertAdjacentHTML('beforeend', reportModalHTML);

    window.copyOwnerPM = function () {
      const o = state.ownerPagoMovil;
      const txt = `${o.banco} · ${o.cedula} · ${o.telefono}`;
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      showToast('Datos del dueño copiados');
    };

    window.openDriverReportPaymentModal = function () {
      const u = getActiveUser();
      const o = state.ownerPagoMovil;
      document.getElementById('modal-owner-pm-info').textContent = `${o.banco} · CI: ${o.cedula} · Tel: ${o.telefono} (${o.titular})`;
      document.getElementById('modal-driver-debt-amt').textContent = '$' + (u.debtUsd || 0).toFixed(2);
      document.getElementById('rep-pay-ref').value = '';
      document.getElementById('rep-pay-note').value = '';
      document.getElementById('driver-report-pay-modal').classList.remove('hidden');
    };

    window.submitDriverCommissionReport = function () {
      const ref = (document.getElementById('rep-pay-ref').value || '').trim();
      const note = (document.getElementById('rep-pay-note').value || '').trim();
      if (!ref) {
        showToast('Escribe el número de referencia del pago');
        return;
      }

      const u = getActiveUser();
      state.paymentReports.unshift({
        id: 'REP-' + Date.now(),
        driverId: u.id,
        driverName: u.name,
        amountUsd: u.debtUsd || 0,
        ref: ref,
        note: note || 'Pago de comisión semanal',
        date: 'Hoy · Ahora',
        verified: false
      });

      state.ledger.unshift({
        id: 'REP-' + Math.floor(100 + Math.random() * 899),
        desc: `Reporte de pago (${u.name}): Ref ${ref}`,
        totalFare: (u.debtUsd || 0) * 10,
        ownerCut: u.debtUsd || 0,
        date: 'Ahora',
        type: 'report'
      });

      saveState();
      document.getElementById('driver-report-pay-modal').classList.add('hidden');
      showToast('Reporte enviado al administrador para verificación');
    };

    // =========================================================
    // 6. PANEL DE DUEÑO: CONFIGURAR SU PAGO MÓVIL + VER REPORTES
    // =========================================================
    const ownerSettlementsView = document.getElementById('owner-view-settlements');
    if (ownerSettlementsView) {
      ownerSettlementsView.insertAdjacentHTML('afterbegin', `
        <div class="card-surface rounded-2xl p-3.5 space-y-2 mb-3">
          <p class="text-xs font-extrabold">📱 Mis datos de Pago Móvil (Para recibir comisiones)</p>
          <div class="grid grid-cols-2 gap-2">
            <input id="own-pm-bank" type="text" placeholder="Banco (Ej. Banesco)" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
            <input id="own-pm-cedula" type="text" placeholder="Cédula / RIF" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input id="own-pm-phone" type="tel" placeholder="Teléfono Pago Móvil" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
            <input id="own-pm-titular" type="text" placeholder="Nombre Titular" class="input-surface rounded-xl px-3 py-2 text-xs font-bold focus:outline-none" />
          </div>
          <button onclick="saveOwnerPagoMovil()" class="w-full py-2.5 rounded-xl bg-[#11131a] text-white text-xs font-extrabold active:scale-95">
            Guardar mi Pago Móvil
          </button>
        </div>

        <div id="owner-reported-payments-box" class="space-y-2 mb-3"></div>
      `);
    }

    window.saveOwnerPagoMovil = function () {
      state.ownerPagoMovil = {
        banco: document.getElementById('own-pm-bank').value.trim() || 'Banesco',
        cedula: document.getElementById('own-pm-cedula').value.trim() || 'V-27456890',
        telefono: document.getElementById('own-pm-phone').value.trim() || '04121114357',
        titular: document.getElementById('own-pm-titular').value.trim() || 'Administración TaxiGo'
      };
      saveState();
      showToast('Datos de Pago Móvil del dueño actualizados');
    };

    // Ampliar renderOwnerDashboard y updateAllUI sin romper los originales
    const origRenderOwner = window.renderOwnerDashboard;
    window.renderOwnerDashboard = function () {
      origRenderOwner();
      const o = state.ownerPagoMovil;
      if (document.getElementById('own-pm-bank')) {
        document.getElementById('own-pm-bank').value = o.banco || '';
        document.getElementById('own-pm-cedula').value = o.cedula || '';
        document.getElementById('own-pm-phone').value = o.telefono || '';
        document.getElementById('own-pm-titular').value = o.titular || '';
      }

      const repBox = document.getElementById('owner-reported-payments-box');
      if (repBox) {
        const pendingReports = (state.paymentReports || []).filter(r => !r.verified);
        if (pendingReports.length > 0) {
          repBox.innerHTML = `
            <p class="text-xs font-extrabold uppercase text-emerald-600">Comprobantes reportados por conductores (${pendingReports.length})</p>
            ${pendingReports.map(r => `
              <div class="card-surface rounded-2xl p-3 border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-extrabold">${r.driverName} · $${Number(r.amountUsd).toFixed(2)}</p>
                  <p class="text-[11px] font-bold text-gray-600 dark:text-gray-300">Ref: ${r.ref}</p>
                  <p class="text-[10px] text-gray-500">${r.note}</p>
                </div>
                <button onclick="approveReportedPayment('${r.id}')" class="shrink-0 px-3 py-2 rounded-xl bg-[#00b14f] text-white text-[11px] font-extrabold">
                  Aprobar pago
                </button>
              </div>
            `).join('')}
          `;
        } else {
          repBox.innerHTML = '';
        }
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
        if (u.role === 'driver' && u.pagoMovil) {
          document.getElementById('drv-pm-bank').value = u.pagoMovil.banco || '';
          document.getElementById('drv-pm-cedula').value = u.pagoMovil.cedula || '';
          document.getElementById('drv-pm-phone').value = u.pagoMovil.telefono || '';
        }
      }
    };

    updateAllUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaxiGoExtras);
  } else {
    initTaxiGoExtras();
  }
})();

