// =========================================================
// TAXIGO · EXTRAS-PASAJERO.JS v2.1 (SIN NUEVO REGISTRO EN PERFIL + HISTORIAL LIMPIO)
// =========================================================
(function () {
  function initPassengerModule() {
    if (typeof state === 'undefined' || !document.getElementById('app-shell')) {
      setTimeout(initPassengerModule, 60);
      return;
    }

    const appShell = document.getElementById('app-shell');

    // 1. Limpiar historial de viajes inventados
    if (!Array.isArray(state.passengerHistory)) {
      state.passengerHistory = [];
    } else {
      state.passengerHistory = state.passengerHistory.filter(
        h => h && h.date !== '16 Nov 2026 · 07:38 PM' && h.date !== '14 Nov 2026 · 02:15 PM'
      );
    }
    saveState();

    // 2. Eliminar "Nuevo registro / Documentos" (sea div o button) y limpiar textos del historial
    function cleanPassengerAccountAndHistory() {
      const regElements = document.querySelectorAll('#screen-account [onclick*="screen-register"]');
      regElements.forEach(el => el.remove());

      // También buscar por texto exacto por si no tiene onclick inline
      document.querySelectorAll('#screen-account p').forEach(p => {
        if (p.textContent && p.textContent.includes('Nuevo registro / Documentos')) {
          const row = p.closest('div[onclick]') || p.parentElement?.parentElement;
          if (row) row.remove();
        }
      });

      const u = getActiveUser();
      const realTripsCount = (state.passengerHistory || []).filter(
        h => !h.passengerId || (u && h.passengerId === u.id)
      ).length;

      const tripsCounter = document.getElementById('profile-trips-count');
      if (tripsCounter && u && u.role === 'passenger') {
        tripsCounter.textContent = realTripsCount;
      }

      const historySub = document.getElementById('history-count-sub');
      if (historySub && u && u.role === 'passenger') {
        historySub.textContent = realTripsCount === 1 ? '1 viaje realizado' : `${realTripsCount} viajes realizados`;
      }

      // Limpiar cualquier encabezado o subtítulo en pantalla de historial que diga "movimientos"
      const histScreen = document.getElementById('screen-passenger-history');
      if (histScreen) {
        histScreen.querySelectorAll('p, span, h2').forEach(el => {
          if (el.children.length === 0 && /movimiento/i.test(el.textContent)) {
            el.textContent = 'Tus viajes realizados en TaxiGo';
          }
        });
      }
    }

    // Sobrescribir renderPassengerHistory para mostrar solo los viajes del pasajero
    window.renderPassengerHistory = function () {
      cleanPassengerAccountAndHistory();
      const u = getActiveUser();
      const listEl = document.getElementById('passenger-history-list');
      if (!listEl) return;

      const myTrips = (state.passengerHistory || []).filter(
        h => !h.passengerId || (u && h.passengerId === u.id)
      );

      if (myTrips.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">Aún no has realizado viajes.</p>`;
        return;
      }

      listEl.innerHTML = myTrips.map(h => `
        <div class="card-surface rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p class="text-xs font-extrabold">${h.route}</p>
            <p class="text-[11px] text-gray-500 mt-0.5">${h.date} · ${h.vehicle} · ${h.method}</p>
          </div>
          <p class="text-sm font-extrabold">${h.fare}</p>
        </div>
      `).join('');
    };

    const origCompletePass = window.completePassengerRide;
    window.completePassengerRide = function () {
      const u = getActiveUser();
      if (typeof origCompletePass === 'function') origCompletePass();
      if (state.passengerHistory && state.passengerHistory[0] && u) {
        state.passengerHistory[0].passengerId = u.id;
        saveState();
      }
      cleanPassengerAccountAndHistory();
    };

    const origUpdateUI = window.updateAllUI;
    window.updateAllUI = function () {
      if (typeof origUpdateUI === 'function') origUpdateUI();
      cleanPassengerAccountAndHistory();
    };

    cleanPassengerAccountAndHistory();
    setTimeout(cleanPassengerAccountAndHistory, 250);

    // 3. Cuadro de Pago Móvil del conductor dentro de viaje activo del pasajero
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

    // 4. Solicitud real hacia la cola de conductores (NO se auto-acepta)
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

    // 5. Modal de cancelación con motivo obligatorio
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

  window.addEventListener('load', initPassengerModule);
  setTimeout(initPassengerModule, 120);
})();
