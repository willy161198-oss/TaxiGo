// =========================================================
// TAXIGO · EXTRAS-MAPA.JS (MAPA MUNDIAL, BÚSQUEDA Y RUTAS REALES)
// =========================================================
(function () {
  function initGlobalMapModule() {
    if (typeof state === 'undefined' || typeof mapPassenger === 'undefined' || !mapPassenger) {
      setTimeout(initGlobalMapModule, 120);
      return;
    }

    let originCoords = [10.2016, -71.3148]; // Punto de partida por defecto (se actualiza con GPS)
    let destCoords = null;
    let routeLayer = null;
    let searchTimer = null;

    // 1. Quitar cualquier límite geográfico del mapa para permitir navegar por todo el mundo
    mapPassenger.setMaxBounds(null);
    mapPassenger.setMinZoom(2);
    mapPassenger.setMaxZoom(19);

    if (typeof mapDriver !== 'undefined' && mapDriver) {
      mapDriver.setMaxBounds(null);
      mapDriver.setMinZoom(2);
      mapDriver.setMaxZoom(19);
    }

    // 2. Obtener ubicación GPS real del usuario si el teléfono la permite
    window.locateUserGlobal = function () {
      if (!navigator.geolocation) {
        showToast('Tu navegador no soporta GPS');
        return;
      }
      showToast('Obteniendo ubicación GPS...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          originCoords = [pos.coords.latitude, pos.coords.longitude];
          mapPassenger.setView(originCoords, 15);
          if (typeof markerOrigin !== 'undefined' && markerOrigin) {
            markerOrigin.setLatLng(originCoords);
          }
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${originCoords[0]}&lon=${originCoords[1]}`);
            const data = await res.json();
            if (data && data.display_name) {
              const shortName = data.display_name.split(',').slice(0, 3).join(',');
              const origInput = document.getElementById('input-origin');
              if (origInput) origInput.value = shortName;
            }
          } catch (e) {}
          showToast('Ubicación actualizada');
        },
        () => showToast('Activa el GPS del teléfono para ubicarte'),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    // Enlazar el botón de ubicación GPS del mapa pasajero
    const gpsBtn = document.querySelector('#screen-passenger button[onclick*="centerPassengerMap"]');
    if (gpsBtn) gpsBtn.setAttribute('onclick', 'locateUserGlobal()');

    // 3. Buscador global en vivo (cualquier calle, ciudad, estado o país)
    const destInput = document.getElementById('input-destination');
    const stepDest = document.getElementById('step-destination');

    if (destInput && stepDest && !document.getElementById('global-places-dropdown')) {
      destInput.insertAdjacentHTML('afterend', `
        <div id="global-places-dropdown" class="hidden mt-1.5 rounded-2xl bg-white dark:bg-[#1e2233] border border-gray-200 dark:border-gray-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 z-50"></div>
      `);

      destInput.addEventListener('input', function () {
        const q = destInput.value.trim();
        const drop = document.getElementById('global-places-dropdown');
        clearTimeout(searchTimer);

        if (q.length < 3) {
          drop.classList.add('hidden');
          return;
        }

        searchTimer = setTimeout(async () => {
          try {
            drop.innerHTML = `<p class="p-3 text-xs text-gray-400">Buscando "${q}" en el mundo...</p>`;
            drop.classList.remove('hidden');

            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
            const results = await res.json();

            if (!Array.isArray(results) || results.length === 0) {
              drop.innerHTML = `<p class="p-3 text-xs text-gray-400">No se encontraron lugares. Puedes tocar directamente el mapa.</p>`;
              return;
            }

            drop.innerHTML = results.map(item => {
              const title = item.display_name.split(',')[0];
              const sub = item.display_name.split(',').slice(1, 4).join(',');
              const safeLabel = item.display_name.split(',').slice(0, 3).join(',').replace(/'/g, "\\'");
              return `
                <button type="button" onclick="selectGlobalDestination(${item.lat}, ${item.lon}, '${safeLabel}')" class="w-full text-left px-3.5 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <p class="text-xs font-extrabold truncate">📍 ${title}</p>
                  <p class="text-[10px] text-gray-500 truncate">${sub}</p>
                </button>
              `;
            }).join('');
          } catch (e) {
            drop.classList.add('hidden');
          }
        }, 450);
      });
    }

    // 4. Seleccionar destino mundial y trazar ruta real por carretera (OSRM)
    window.selectGlobalDestination = async function (lat, lon, label) {
      const drop = document.getElementById('global-places-dropdown');
      if (drop) drop.classList.add('hidden');

      destCoords = [parseFloat(lat), parseFloat(lon)];
      state.destinationText = label;
      if (destInput) destInput.value = label;

      if (typeof markerDest !== 'undefined' && markerDest) {
        markerDest.setLatLng(destCoords).addTo(mapPassenger);
      }

      await calculateAndDrawGlobalRoute(originCoords, destCoords);
    };

    // Permitir también tocar cualquier punto del mapa mundial como destino
    mapPassenger.off('click');
    mapPassenger.on('click', async function (e) {
      const stepD = document.getElementById('step-destination');
      if (stepD && stepD.classList.contains('hidden')) return;

      destCoords = [e.latlng.lat, e.latlng.lng];
      if (typeof markerDest !== 'undefined' && markerDest) {
        markerDest.setLatLng(destCoords).addTo(mapPassenger);
      }

      let label = `Punto en mapa (${destCoords[0].toFixed(4)}, ${destCoords[1].toFixed(4)})`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${destCoords[0]}&lon=${destCoords[1]}`);
        const data = await res.json();
        if (data && data.display_name) {
          label = data.display_name.split(',').slice(0, 3).join(',');
        }
      } catch (err) {}

      state.destinationText = label;
      if (destInput) destInput.value = label;
      await calculateAndDrawGlobalRoute(originCoords, destCoords);
    });

    // 5. Cálculo real de kilómetros, tiempo y trazado de línea de ruta entre ciudades/estados
    async function calculateAndDrawGlobalRoute(start, end) {
      if (routeLayer) {
        mapPassenger.removeLayer(routeLayer);
        routeLayer = null;
      }

      let distKm = 0;
      let durMin = 0;
      let polyCoords = [start, end];

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data && data.routes && data.routes[0]) {
          const r = data.routes[0];
          distKm = Math.max(0.5, Number((r.distance / 1000).toFixed(1)));
          durMin = Math.max(2, Math.round(r.duration / 60));
          polyCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
        } else {
          throw new Error('Fallback distancia lineal');
        }
      } catch (err) {
        // Cálculo geodésico (Haversine) si no hay carretera directa
        const R = 6371;
        const dLat = ((end[0] - start[0]) * Math.PI) / 180;
        const dLon = ((end[1] - start[1]) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((start[0] * Math.PI) / 180) *
            Math.cos((end[0] * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        distKm = Math.max(0.5, Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25).toFixed(1)));
        durMin = Math.max(2, Math.round(distKm * 1.5));
      }

      state.distanceKm = distKm;
      state.durationMin = durMin;

      routeLayer = L.polyline(polyCoords, {
        color: '#00b14f',
        weight: 5,
        opacity: 0.9
      }).addTo(mapPassenger);

      mapPassenger.fitBounds(routeLayer.getBounds(), { padding: [45, 45] });

      // Avanzar automáticamente a la selección de vehículo con la tarifa calculada por km real
      document.getElementById('step-destination').classList.add('hidden');
      document.getElementById('step-vehicles').classList.remove('hidden');
      if (typeof renderVehicleOptions === 'function') {
        renderVehicleOptions();
      }
      showToast(`Ruta calculada: ${distKm} km · ~${durMin} min`);
    }
  }

  window.addEventListener('load', initGlobalMapModule);
  setTimeout(initGlobalMapModule, 200);
})();
