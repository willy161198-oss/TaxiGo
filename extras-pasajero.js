// =========================================================
// TAXIGO · EXTRAS-PASAJERO.JS · VERSIÓN DE LANZAMIENTO
// =========================================================
(function () {
  function initPassengerLaunchModule() {
    if (typeof state === 'undefined') {
      setTimeout(initPassengerLaunchModule, 150);
      return;
    }

    // 1. Ocultar cualquier dato bancario / Pago Móvil del dueño en la vista del pasajero
    function hideOwnerBankDataFromPassenger() {
      const passScreen = document.getElementById('screen-passenger');
      if (!passScreen) return;
      passScreen.querySelectorAll('[id*="owner-payment"], [id*="dueno-pago"], .owner-bank-box').forEach(el => {
        el.remove();
      });
    }

    // 2. Forzar historial del pasajero en 0 si no tiene viajes reales propios
    window.renderPassengerHistory = function () {
      const container = document.getElementById('passenger-history-list') || document.getElementById('history-list');
      if (!container) return;
      const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
      const realTrips = (state.trips || []).filter(t => u && t.passengerId === u.id && t.status === 'completed');

      if (realTrips.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700">
            <p class="text-xs font-extrabold text-gray-500">Sin viajes realizados (0)</p>
            <p class="text-[11px] text-gray-400 mt-1">Tus carreras completadas aparecerán aquí.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = realTrips.map(t => `
        <div class="p-3.5 rounded-2xl bg-white dark:bg-[#1e2233] border border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <p class="text-xs font-extrabold">${t.destination || 'Destino'}</p>
            <p class="text-[10px] text-gray-400">${t.date || ''} · Conductor: ${t.driverName || 'Asignado'}</p>
          </div>
          <span class="text-xs font-extrabold text-[#00b14f]">$${Number(t.priceUsd || 0).toFixed(2)}</span>
        </div>
      `).join('');
    };

    // 3. Mostrar ficha completa del conductor y su ubicación GPS en tiempo real cuando acepta la carrera
    let liveDriverMarker = null;

    function syncAssignedDriverLive() {
      hideOwnerBankDataFromPassenger();
      const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
      if (!u || u.role !== 'passenger') return;

      const activeTrip = (state.trips || []).find(t =>
        t.passengerId === u.id && ['accepted', 'arriving', 'in_progress'].includes(t.status)
      );

      const cardId = 'txg-live-driver-card';
      let card = document.getElementById(cardId);

      if (!activeTrip) {
        if (card) card.remove();
        if (liveDriverMarker && window.mapPassenger) {
          window.mapPassenger.removeLayer(liveDriverMarker);
          liveDriverMarker = null;
        }
        return;
      }

      const driver = (state.users || []).find(d => d.id === activeTrip.driverId) || {};
      const driverName = driver.name || activeTrip.driverName || 'Conductor TaxiGo';
      const driverPhone = driver.phone || activeTrip.driverPhone || 'Sin teléfono';
      const vehicleModel = driver.vehicle || activeTrip.vehicleModel || 'Vehículo registrado';
      const vehiclePlate = driver.plate || activeTrip.vehiclePlate || '---';

      if (!card) {
        const passScreen = document.getElementById('screen-passenger');
        if (passScreen) {
          passScreen.insertAdjacentHTML('beforeend', `<div id="${cardId}" class="fixed bottom-4 left-4 right-4 z-[9980]"></div>`);
          card = document.getElementById(cardId);
        }
      }

      if (card) {
        card.innerHTML = `
          <div class="bg-white dark:bg-[#1e2233] rounded-3xl p-4 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full bg-[#00b14f]/15 text-[#00b14f] text-[10px] font-extrabold uppercase">
                ● Conductor en camino en tiempo real
              </span>
              <span class="text-xs font-extrabold">$${Number(activeTrip.priceUsd || 1.10).toFixed(2)}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-extrabold">🧑🏻‍✈️ ${driverName}</p>
                <p class="text-xs text-gray-500">🚘 ${vehicleModel} · Placa: <b>${vehiclePlate}</b></p>
                <p class="text-[11px] text-gray-500">📞 ${driverPhone}</p>
              </div>
              <a href="tel:${driverPhone}" class="px-3.5 py-2.5 rounded-2xl bg-[#11131a] text-white text-xs font-extrabold">
                Llamar
              </a>
            </div>
          </div>
        `;
      }

      // Pintar posición GPS en vivo del conductor sobre el mapa del pasajero
      const dLat = driver.lat || activeTrip.driverLat;
      const dLng = driver.lng || activeTrip.driverLng;
      if (dLat && dLng && window.mapPassenger && typeof L !== 'undefined') {
        if (!liveDriverMarker) {
          const icon = L.divIcon({
            html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">🚖</div>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          liveDriverMarker = L.marker([dLat, dLng], { icon }).addTo(window.mapPassenger);
        } else {
          liveDriverMarker.setLatLng([dLat, dLng]);
        }
      }
    }

    setInterval(syncAssignedDriverLive, 2500);
    hideOwnerBankDataFromPassenger();
  }

  window.addEventListener('load', initPassengerLaunchModule);
  setTimeout(initPassengerLaunchModule, 200);
})();
