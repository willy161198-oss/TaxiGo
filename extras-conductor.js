// =========================================================
// TAXIGO · EXTRAS-CONDUCTOR.JS · VERSIÓN DE LANZAMIENTO
// =========================================================
(function () {
  function initDriverLaunchModule() {
    if (typeof state === 'undefined') {
      setTimeout(initDriverLaunchModule, 150);
      return;
    }

    // 1. Transmitir ubicación GPS del conductor en tiempo real mientras esté conectado o en carrera
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        pos => {
          const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
          if (!u || u.role !== 'driver') return;
          u.lat = pos.coords.latitude;
          u.lng = pos.coords.longitude;

          (state.trips || []).forEach(t => {
            if (t.driverId === u.id && ['accepted', 'arriving', 'in_progress'].includes(t.status)) {
              t.driverLat = pos.coords.latitude;
              t.driverLng = pos.coords.longitude;
            }
          });
          if (typeof saveState === 'function') saveState();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2500 }
      );
    }

    // 2. Botón de navegación directa en Waze para el conductor durante la carrera activa
    function injectWazeNavigationForDriver() {
      const drvScreen = document.getElementById('screen-driver');
      if (!drvScreen) return;
      const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
      if (!u || u.role !== 'driver') return;

      const activeTrip = (state.trips || []).find(t =>
        t.driverId === u.id && ['accepted', 'arriving', 'in_progress'].includes(t.status)
      );

      let wazeBox = document.getElementById('txg-driver-waze-nav');
      if (!activeTrip) {
        if (wazeBox) wazeBox.remove();
        return;
      }

      const destLat = activeTrip.destLat || (window._taxiGoDest && window._taxiGoDest[0]) || 10.2016;
      const destLng = activeTrip.destLng || (window._taxiGoDest && window._taxiGoDest[1]) || -71.3148;
      const wazeUrl = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;

      if (!wazeBox) {
        drvScreen.insertAdjacentHTML('beforeend', `<div id="txg-driver-waze-nav" class="fixed bottom-4 left-4 right-4 z-[9980]"></div>`);
        wazeBox = document.getElementById('txg-driver-waze-nav');
      }

      wazeBox.innerHTML = `
        <div class="bg-[#11131a] text-white rounded-3xl p-3.5 shadow-2xl border border-white/15 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-extrabold uppercase text-[#00b14f]">Carrera Activa · Pasajero: ${activeTrip.passengerName || 'Cliente'}</p>
            <p class="text-xs font-bold truncate">${activeTrip.destination || 'Destino del viaje'}</p>
          </div>
          <a href="${wazeUrl}" target="_blank" rel="noopener" class="shrink-0 px-4 py-2.5 rounded-2xl bg-[#33ccff] text-[#11131a] text-xs font-extrabold shadow">
            🧭 Abrir Waze
          </a>
        </div>
      `;
    }

    // 3. Mostrar los datos bancarios / Pago Móvil del dueño ÚNICAMENTE dentro del modal de pagar comisión del conductor
    window.openDriverCommissionPayModal = function () {
      const ownerPay = state.ownerPayment || {
        bank: 'Banco de Venezuela (0102)',
        phone: '0412-0000000',
        ci: 'V-00000000',
        name: 'Administración TaxiGo'
      };

      const existing = document.getElementById('txg-driver-commission-modal');
      if (existing) existing.remove();

      document.body.insertAdjacentHTML('beforeend', `
        <div id="txg-driver-commission-modal" class="fixed inset-0 z-[9995] bg-black/70 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-[#1e2233] rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-extrabold">Pagar Comisión del 10%</h3>
              <button type="button" onclick="document.getElementById('txg-driver-commission-modal').remove()" class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/70 space-y-1 text-xs">
              <p class="text-[10px] font-extrabold uppercase text-[#00b14f]">Datos de Pago Móvil del Dueño</p>
              <p><b>Banco:</b> ${ownerPay.bank}</p>
              <p><b>Teléfono:</b> ${ownerPay.phone}</p>
              <p><b>Cédula / RIF:</b> ${ownerPay.ci}</p>
              <p><b>Titular:</b> ${ownerPay.name}</p>
            </div>
            <input type="text" id="txg-comm-ref" placeholder="Últimos 6 dígitos de referencia" class="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-xs">
            <button type="button" onclick="submitDriverCommissionReport()" class="w-full py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold">
              Reportar Pago de Comisión
            </button>
          </div>
        </div>
      `);
    };

    window.submitDriverCommissionReport = function () {
      const ref = (document.getElementById('txg-comm-ref')?.value || '').trim();
      if (!ref) {
        if (typeof showToast === 'function') showToast('Ingresa el número de referencia');
        return;
      }
      const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
      state.commissionReports = state.commissionReports || [];
      state.commissionReports.push({
        id: 'rep-' + Date.now(),
        driverId: u ? u.id : 'drv',
        driverName: u ? u.name : 'Conductor',
        reference: ref,
        status: 'pending',
        date: new Date().toLocaleString()
      });
      if (typeof saveState === 'function') saveState();
      document.getElementById('txg-driver-commission-modal')?.remove();
      if (typeof showToast === 'function') showToast('Reporte enviado al dueño para aprobación');
    };

    setInterval(injectWazeNavigationForDriver, 2500);
  }

  window.addEventListener('load', initDriverLaunchModule);
  setTimeout(initDriverLaunchModule, 200);
})();
