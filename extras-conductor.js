// =========================================================
// TAXIGO · EXTRAS-CONDUCTOR.JS (SOLICITUDES, PAGO MÓVIL Y REPORTE 10%)
// =========================================================
(function () {
  function initDriverModule() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initDriverModule, 70);
      return;
    }

    const appShell = document.getElementById('app-shell');

    // Lista de solicitudes reales cercanas
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

    window.cancelDriverActiveTrip = function () {
      const txt = document.getElementById('cancel-reason-text');
      if (txt) txt.value = '';
      const m = document.getElementById('cancel-reason-modal');
      if (m) m.classList.remove('hidden');
    };

    // Pago Móvil propio del conductor en Ajustes (campos vacíos para que cada conductor ponga los suyos)
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

    // Reportar pago semanal (10%) al dueño
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDriverModule);
  } else {
    initDriverModule();
  }
})();
