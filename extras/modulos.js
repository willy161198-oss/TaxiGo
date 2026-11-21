// =========================================================
// MÓDULO DE EXTENSIONES EXTERNAS - TAXIGO (extras/modulos.js)
// =========================================================
(function () {
  if (window._taxigoExtrasLoaded) return;
  window._taxigoExtrasLoaded = true;

  let declinedTripIds = new Set();
  let activeIncomingTripId = null;
  let incomingTimerInterval = null;
  let incomingSecondsLeft = 25;
  let incomingRingInterval = null;
  let lastChatSoundTs = 0;
  let ratedTripIds = new Set();
  let lastKnownTripStates = {};

  try {
    const savedDeclined = JSON.parse(sessionStorage.getItem('taxigo_declined_trips') || '[]');
    savedDeclined.forEach(id => declinedTripIds.add(id));
  } catch (e) {}

  try {
    const savedRated = JSON.parse(localStorage.getItem('taxigo_rated_trips') || '[]');
    savedRated.forEach(id => ratedTripIds.add(id));
  } catch (e) {}

  function addDeclinedTrip(tripId) {
    if (!tripId) return;
    declinedTripIds.add(tripId);
    try {
      sessionStorage.setItem('taxigo_declined_trips', JSON.stringify(Array.from(declinedTripIds)));
    } catch (e) {}
  }

  function markTripAsRated(tripId) {
    ratedTripIds.add(tripId);
    try {
      localStorage.setItem('taxigo_rated_trips', JSON.stringify(Array.from(ratedTripIds)));
    } catch (e) {}
  }

  // =========================================================
  // MOTOR DE SONIDO Y VIBRACIÓN
  // =========================================================
  function playAlertTone(type) {
    try {
      if (navigator.vibrate) {
        if (type === 'ride') navigator.vibrate([350, 150, 350, 150, 450]);
        else if (type === 'chat') navigator.vibrate([120, 80, 120]);
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'ride') {
        [587.33, 880, 1174.66].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.14);
          gain.gain.setValueAtTime(0.25, now + i * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.14);
          osc.stop(now + i * 0.14 + 0.36);
        });
      } else if (type === 'chat') {
        [784, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.18, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.23);
        });
      }
    } catch (e) {}
  }

  function calcHaversineKm(c1, c2) {
    if (!c1 || !c2 || c1.length < 2 || c2.length < 2) return 1.2;
    const toRad = d => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(c2[0] - c1[0]);
    const dLon = toRad(c2[1] - c1[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(c1[0])) * Math.cos(toRad(c2[0])) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25;
    return Math.max(0.2, Number(km.toFixed(1)));
  }

  function getUserRatingDisplay(userId) {
    try {
      const u = (appState.users || []).find(x => x.id === userId);
      if (!u || !u.ratingCount) return '5,0';
      return Number(u.ratingAvg || 5.0).toFixed(1).replace('.', ',');
    } catch (e) {
      return '5,0';
    }
  }

  // =========================================================
  // FILTRAR CARRERAS DECLINADAS EN EL PANEL INFERIOR DEL CONDUCTOR
  // =========================================================
  function cleanDeclinedCardsInDom() {
    try {
      const reqList = document.getElementById('drv-requests-list');
      if (!reqList) return;

      const u = typeof getActiveUser === 'function' ? getActiveUser() : null;
      const isOnline = u ? (u.online !== false && (typeof driverManualOffline === 'undefined' || !driverManualOffline)) : true;
      if (!isOnline) return;

      const activeVeh = (u && typeof getDriverActiveVehicle === 'function') ? getDriverActiveVehicle(u) : { type: 'Moto', plate: '' };
      const allowedServices = activeVeh.type === 'Carro' ? ['Carro Go', 'Envío Express'] : ['Moto Go', 'Envío Express'];
      const validTrips = (typeof appState !== 'undefined' && Array.isArray(appState.trips))
        ? appState.trips.filter(t => t && t.status === 'searching' && allowedServices.includes(t.service) && !declinedTripIds.has(t.id))
        : [];

      if (validTrips.length === 0) {
        reqList.innerHTML = '<p class="text-center text-xs text-gray-400 font-bold py-1">Esperando solicitudes (' + activeVeh.type + ' · ' + activeVeh.plate + ')...</p>';
        return;
      }

      const cards = Array.from(reqList.children);
      cards.forEach(card => {
        const htmlStr = card.innerHTML || '';
        declinedTripIds.forEach(declinedId => {
          if (htmlStr.indexOf(declinedId) !== -1) {
            card.remove();
          }
        });
      });

      if (reqList.children.length === 0) {
        reqList.innerHTML = '<p class="text-center text-xs text-gray-400 font-bold py-1">Esperando solicitudes (' + activeVeh.type + ' · ' + activeVeh.plate + ')...</p>';
      }
    } catch (e) {}
  }

  const origRenderDriverDashboard = window.renderDriverDashboard;
  if (typeof origRenderDriverDashboard === 'function') {
    window.renderDriverDashboard = function () {
      origRenderDriverDashboard.apply(this, arguments);
      cleanDeclinedCardsInDom();
    };
  }

  // =========================================================
  // 1. PANTALLA ENTRANTE DE CARRERA CON TEMPORIZADOR Y SONIDO
  // =========================================================
  function ensureIncomingRideModal() {
    if (document.getElementById('incoming-ride-overlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div id="incoming-ride-overlay" class="hidden fixed inset-0 z-[95] bg-white flex flex-col justify-between p-6 text-[#11131a] overflow-y-auto">' +
        '<div class="pt-4 text-center space-y-2">' +
          '<div id="inc-pass-initials" class="w-20 h-20 rounded-full bg-rose-300/80 text-white text-2xl font-black flex items-center justify-center mx-auto shadow">TG</div>' +
          '<p id="inc-pass-rating" class="text-xs font-extrabold text-gray-500">★ 5,0</p>' +
          '<h2 id="inc-pass-name" class="text-lg font-black">Pasajero</h2>' +
          '<div class="pt-2">' +
            '<p id="inc-pay-method" class="text-xl font-black">Efectivo USD</p>' +
            '<p id="inc-price-usd" class="text-3xl font-black tracking-tight mt-0.5">$1,10</p>' +
            '<p id="inc-price-bs" class="text-xs font-bold text-gray-400">Bs. 49.50</p>' +
          '</div>' +
          '<div class="pt-3 space-y-1.5">' +
            '<p class="text-xs font-bold text-gray-500">Tiempo para aceptar</p>' +
            '<div class="w-20 h-20 rounded-full border-4 border-[#00b14f] flex flex-col items-center justify-center mx-auto shadow-sm">' +
              '<span id="inc-timer-sec" class="text-xl font-black leading-none">25</span>' +
              '<span class="text-[10px] font-bold text-gray-500">seg</span>' +
            '</div>' +
          '</div>' +
          '<div class="pt-3 text-xs space-y-1 text-gray-700">' +
            '<p id="inc-pickup-dist">Buscar a <b>1,0 km</b> (3 min)</p>' +
            '<p id="inc-trip-dist">Luego llevar a <b>2,5 km</b> (6 min)</p>' +
          '</div>' +
        '</div>' +
        '<div class="my-4 py-3 border-t border-b border-dashed border-gray-300 space-y-2.5 text-xs">' +
          '<div class="flex items-start gap-2.5"><span class="w-3 h-3 rounded-full bg-[#00b14f] mt-0.5 shrink-0"></span><div><p class="text-[10px] font-bold text-gray-400">Desde</p><p id="inc-origin-txt" class="font-extrabold">Origen</p></div></div>' +
          '<div class="flex items-start gap-2.5"><span class="w-3 h-3 rounded-full bg-blue-900 mt-0.5 shrink-0"></span><div><p class="text-[10px] font-bold text-gray-400">Hasta</p><p id="inc-dest-txt" class="font-extrabold">Destino</p></div></div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3 pb-2">' +
          '<button type="button" id="inc-btn-decline" class="py-4 rounded-2xl bg-gray-100 text-gray-700 text-sm font-black active:scale-95 transition">Declinar</button>' +
          '<button type="button" id="inc-btn-accept" class="py-4 rounded-2xl bg-[#166534] text-white text-sm font-black shadow-lg active:scale-95 transition">Aceptar</button>' +
        '</div>' +
      '</div>'
    );
  }

  function closeIncomingRideModal(declineId) {
    if (declineId) {
      addDeclinedTrip(declineId);
    }
    activeIncomingTripId = null;
    clearInterval(incomingTimerInterval);
    clearInterval(incomingRingInterval);
    const modal = document.getElementById('incoming-ride-overlay');
    if (modal) modal.classList.add('hidden');
    cleanDeclinedCardsInDom();
  }

  function openIncomingRideModal(trip, driverUser) {
    ensureIncomingRideModal();
    activeIncomingTripId = trip.id;
    incomingSecondsLeft = 25;

    const parts = (trip.passengerName || 'Usuario').trim().split(/\s+/);
    const initials = ((parts[0] || 'U')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    const ratingStr = getUserRatingDisplay(trip.passengerId);

    const drvCoords = (driverUser && driverUser.lat && driverUser.lng)
      ? [driverUser.lat, driverUser.lng]
      : trip.originCoords;
    const pickupKm = calcHaversineKm(drvCoords, trip.originCoords);
    const pickupMin = Math.max(1, Math.round(pickupKm * 2.2));
    const tripKm = Number(trip.distanceKm || 1.0);
    const tripMin = Math.max(2, Math.round(tripKm * 2.2));

    document.getElementById('inc-pass-initials').textContent = initials;
    document.getElementById('inc-pass-rating').textContent = '★ ' + ratingStr;
    document.getElementById('inc-pass-name').textContent = trip.passengerName || 'Pasajero';
    document.getElementById('inc-pay-method').textContent = trip.paymentMethod || 'Efectivo USD';
    document.getElementById('inc-price-usd').textContent = '$' + Number(trip.priceUsd || 0).toFixed(2).replace('.', ',');
    document.getElementById('inc-price-bs').textContent = 'Bs. ' + (trip.priceBs || '0.00');
    document.getElementById('inc-timer-sec').textContent = String(incomingSecondsLeft);
    document.getElementById('inc-pickup-dist').innerHTML = 'Buscar a <b>' + String(pickupKm).replace('.', ',') + ' km</b> (' + pickupMin + ' min)';
    document.getElementById('inc-trip-dist').innerHTML = 'Luego llevar a <b>' + String(tripKm).replace('.', ',') + ' km</b> (' + tripMin + ' min)';
    document.getElementById('inc-origin-txt').textContent = trip.originText || 'Ubicación del pasajero';
    document.getElementById('inc-dest-txt').textContent = trip.destinationText || 'Destino marcado';

    document.getElementById('inc-btn-decline').onclick = function () {
      closeIncomingRideModal(trip.id);
      if (typeof showToast === 'function') showToast('Solicitud declinada');
    };

    document.getElementById('inc-btn-accept').onclick = async function () {
      const idToAccept = trip.id;
      closeIncomingRideModal(null);
      if (typeof acceptTripDriver === 'function') {
        await acceptTripDriver(idToAccept);
      }
    };

    document.getElementById('incoming-ride-overlay').classList.remove('hidden');

    playAlertTone('ride');
    clearInterval(incomingRingInterval);
    incomingRingInterval = setInterval(() => {
      if (activeIncomingTripId === trip.id) playAlertTone('ride');
    }, 3500);

    clearInterval(incomingTimerInterval);
    incomingTimerInterval = setInterval(() => {
      incomingSecondsLeft--;
      const secEl = document.getElementById('inc-timer-sec');
      if (secEl) secEl.textContent = String(Math.max(0, incomingSecondsLeft));
      if (incomingSecondsLeft <= 0) {
        closeIncomingRideModal(trip.id);
      }
    }, 1000);
  }

  // =========================================================
  // 2. LIMPIEZA TOTAL DEL MAPA AL FINALIZAR O CANCELAR
  // =========================================================
  function resetPassengerMapClean() {
    try {
      const destInput = document.getElementById('input-destination');
      if (destInput) destInput.value = '';
      if (typeof clearDestination === 'function') clearDestination();
      if (typeof passMap !== 'undefined' && passMap) {
        passMap.eachLayer(function (layer) {
          if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
            passMap.removeLayer(layer);
          }
        });
        if (typeof syncPassengerGps === 'function') syncPassengerGps(true);
      }
    } catch (e) {}
  }

  function resetDriverMapClean() {
    try {
      if (typeof drvMap !== 'undefined' && drvMap) {
        drvMap.eachLayer(function (layer) {
          if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
            drvMap.removeLayer(layer);
          }
        });
        if (typeof centerDriverOwnMap === 'function') centerDriverOwnMap();
      }
    } catch (e) {}
  }

  const origConfirmCancel = window.confirmTripCancellationWithReason;
  if (typeof origConfirmCancel === 'function') {
    window.confirmTripCancellationWithReason = async function () {
      const role = typeof pendingCancelByRole !== 'undefined' ? pendingCancelByRole : null;
      await origConfirmCancel.apply(this, arguments);
      if (role === 'passenger') resetPassengerMapClean();
      if (role === 'driver') resetDriverMapClean();
    };
  }

  const origCompleteTrip = window.completeTripDriver;
  if (typeof origCompleteTrip === 'function') {
    window.completeTripDriver = async function (tripId) {
      await origCompleteTrip.apply(this, arguments);
      resetDriverMapClean();
    };
  }

  // =========================================================
  // 3. CALIFICACIÓN CON ESTRELLAS AL FINALIZAR
  // =========================================================
  function openStarRatingModal(trip, raterRole) {
    if (!trip || ratedTripIds.has(trip.id)) return;
    if (document.getElementById('star-rating-modal')) return;

    const targetName = raterRole === 'passenger'
      ? (trip.driverName || 'tu Conductor')
      : (trip.passengerName || 'tu Pasajero');
    const targetUserId = raterRole === 'passenger' ? trip.driverId : trip.passengerId;
    let selectedStars = 5;

    document.body.insertAdjacentHTML('beforeend',
      '<div id="star-rating-modal" class="fixed inset-0 z-[98] bg-black/80 flex items-center justify-center p-4">' +
        '<div class="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">' +
          '<div class="w-14 h-14 rounded-full bg-[#00b14f]/15 text-[#00b14f] flex items-center justify-center text-3xl mx-auto">⭐</div>' +
          '<div><p class="text-[10px] font-extrabold uppercase text-[#00b14f]">Viaje Finalizado</p><h3 class="text-base font-black mt-0.5">Califica a ' + targetName + '</h3><p class="text-xs text-gray-500 mt-1">Servicio: ' + trip.service + ' · $' + Number(trip.priceUsd || 0).toFixed(2) + '</p></div>' +
          '<div id="star-buttons-row" class="flex justify-center gap-2 text-3xl py-1">' +
            [1, 2, 3, 4, 5].map(n => '<button type="button" data-star="' + n + '" class="star-pick-btn text-amber-400 transition transform active:scale-125">★</button>').join('') +
          '</div>' +
          '<input type="text" id="rating-comment-input" placeholder="Comentario opcional (ej: Excelente servicio)" class="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs" />' +
          '<button type="button" id="btn-submit-rating" class="w-full py-3.5 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow-lg">Enviar Calificación</button>' +
        '</div>' +
      '</div>'
    );

    const btns = document.querySelectorAll('.star-pick-btn');
    btns.forEach(btn => {
      btn.onclick = function () {
        selectedStars = Number(btn.getAttribute('data-star'));
        btns.forEach(b => {
          const val = Number(b.getAttribute('data-star'));
          b.className = val <= selectedStars
            ? 'star-pick-btn text-amber-400 transition transform active:scale-125'
            : 'star-pick-btn text-gray-300 transition transform active:scale-125';
        });
      };
    });

    document.getElementById('btn-submit-rating').onclick = async function () {
      markTripAsRated(trip.id);
      document.getElementById('star-rating-modal')?.remove();

      if (targetUserId && typeof appState !== 'undefined') {
        const targetUser = (appState.users || []).find(u => u.id === targetUserId);
        if (targetUser) {
          const prevCount = Number(targetUser.ratingCount || 0);
          const prevAvg = Number(targetUser.ratingAvg || 5.0);
          const newCount = prevCount + 1;
          const newAvg = Number((((prevAvg * prevCount) + selectedStars) / newCount).toFixed(2));
          targetUser.ratingCount = newCount;
          targetUser.ratingAvg = newAvg;
          if (typeof cloudPatch === 'function') {
            await cloudPatch('users/' + targetUserId, { ratingCount: newCount, ratingAvg: newAvg });
          }
        }
      }
      if (raterRole === 'passenger') resetPassengerMapClean();
      if (typeof showToast === 'function') showToast('¡Gracias por tu calificación de ' + selectedStars + ' ⭐!');
    };
  }

  // =========================================================
  // VIGILANTE EN TIEMPO REAL
  // =========================================================
  setInterval(() => {
    try {
      cleanDeclinedCardsInDom();
      if (typeof getActiveUser !== 'function' || typeof appState === 'undefined') return;
      const u = getActiveUser();
      if (!u) return;
      const role = typeof getEffectiveRole === 'function' ? getEffectiveRole(u) : u.role;

      const activeTrip = (appState.trips || []).find(t =>
        (t.passengerId === u.id || t.driverId === u.id) &&
        ['accepted', 'heading_pickup', 'arrived_pickup', 'in_progress'].includes(t.status)
      );
      if (activeTrip && activeTrip.messages) {
        const msgs = Object.values(activeTrip.messages).filter(m => m && m.senderId !== u.id);
        if (msgs.length > 0) {
          const newest = msgs.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
          if (newest && newest.ts && newest.ts > lastChatSoundTs) {
            if (lastChatSoundTs !== 0) playAlertTone('chat');
            lastChatSoundTs = newest.ts;
          }
        }
      }

      const isDriverOnline = u.online !== false && (typeof driverManualOffline === 'undefined' || !driverManualOffline);
      if (role === 'driver' && u.approved && isDriverOnline) {
        const hasOngoing = (appState.trips || []).some(t =>
          t.driverId === u.id && ['accepted', 'heading_pickup', 'arrived_pickup', 'in_progress'].includes(t.status)
        );
        if (!hasOngoing) {
          const activeVeh = typeof getDriverActiveVehicle === 'function' ? getDriverActiveVehicle(u) : { type: 'Moto' };
          const allowed = activeVeh.type === 'Carro' ? ['Carro Go', 'Envío Express'] : ['Moto Go', 'Envío Express'];
          const nextReq = (appState.trips || []).find(t =>
            t.status === 'searching' &&
            allowed.includes(t.service) &&
            !declinedTripIds.has(t.id)
          );

          if (nextReq && activeIncomingTripId !== nextReq.id) {
            openIncomingRideModal(nextReq, u);
          } else if (!nextReq && activeIncomingTripId) {
            closeIncomingRideModal(null);
          }
        } else if (activeIncomingTripId) {
          closeIncomingRideModal(null);
        }
      }

      (appState.trips || []).forEach(t => {
        if (t.passengerId !== u.id && t.driverId !== u.id) return;
        const prevStatus = lastKnownTripStates[t.id];
        lastKnownTripStates[t.id] = t.status;

        if (prevStatus && prevStatus !== t.status) {
          if (t.status === 'cancelled') {
            if (t.passengerId === u.id) resetPassengerMapClean();
            if (t.driverId === u.id) resetDriverMapClean();
          }
          if (t.status === 'completed' && !ratedTripIds.has(t.id)) {
            const raterRole = t.passengerId === u.id ? 'passenger' : 'driver';
            openStarRatingModal(t, raterRole);
          }
        }
      });
    } catch (e) {}
  }, 1000);
})();
