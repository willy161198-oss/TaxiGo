// =========================================================
// TAXIGO · EXTRAS-PASAJERO.JS (SOLICITUD REAL, PAGO MÓVIL Y CANCELACIÓN)
// =========================================================
(function () {
  function initPassengerModule() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initPassengerModule, 70);
      return;
    }

    const appShell = document.getElementById('app-shell');

    // Cuadro de Pago Móvil del conductor dentro de viaje activo del pasajero
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

    // Solicitud real hacia la cola de conductores (NO se auto-acepta)
    window.passengerPollInterval = null;

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

      clearInterval(window.passengerPollInterval);
      window.passengerPollInterval = setInterval(() => {
        const fresh = loadStateSafe();
        const mine = (fresh.openRequests || []).find(r => r.id === newReq.id);
        if (mine && mine.status === 'accepted') {
          clearInterval(window.passengerPollInterval);
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

    // Modal compartido de cancelación con motivo obligatorio
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

    window.confirmCancelWithReason = function () {
      const txtEl = document.getElementById('cancel-reason-text');
      const reason = txtEl ? txtEl.value.trim() : '';
      if (!reason) { showToast('Escribe o selecciona el motivo'); return; }
      if (txtEl) txtEl.blur();
      document.getElementById('cancel-reason-modal').classList.add('hidden');
      clearInterval(window.passengerPollInterval);

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPassengerModule);
  } else {
    initPassengerModule();
  }
})();
