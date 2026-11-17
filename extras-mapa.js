// =========================================================
// TAXIGO · EXTRAS-MAPA.JS v3.0 (INTERCEPTOR DIRECTO DE TESELAS OSM + RUTA MUNDIAL)
// =========================================================
(function () {
  // 1. Interceptar L.tileLayer a nivel global para bloquear cualquier URL de Carto
  function patchLeafletTileLayer() {
    if (typeof L === 'undefined' || !L.tileLayer || L.tileLayer._taxiGoPatched) return;

    const origTileLayer = L.tileLayer;
    L.tileLayer = function (urlTemplate, options) {
      if (typeof urlTemplate === 'string' && urlTemplate.includes('cartocdn')) {
        urlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        options = Object.assign({}, options, {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        });
      }
      return origTileLayer.call(this, urlTemplate, options);
    };
    L.tileLayer._taxiGoPatched = true;
  }

  patchLeafletTileLayer();

  function initGlobalMapModule() {
    patchLeafletTileLayer();

    const passMapEl = document.getElementById('map-passenger');
    const drvMapEl = document.getElementById('map-driver');
    if (!passMapEl || typeof L === 'undefined') {
      setTimeout(initGlobalMapModule, 100);
      return;
    }

    // Reemplazar cualquier imagen de mosaico (tile) de Carto que ya se haya pintado en el DOM
    function swapExistingCartoImages() {
      document.querySelectorAll('img.leaflet-tile').forEach(img => {
        if (img.src && img.src.includes('cartocdn')) {
          const match = img.src.match(/\/(\d+)\/(\d+)\/(\d+)(?:@2x)?\.png/);
          if (match) {
            img.src = `https://tile.openstreetmap.org/${match[1]}/${match[2]}/${match[3]}.png`;
          }
        }
      });
    }

    swapExistingCartoImages();
    setInterval(swapExistingCartoImages, 800);

    // 2. Obtener instancia real de Leaflet o crear una limpia si es necesario
    let activePassMap = null;
    try {
      // Buscar instancia interna de Leaflet en el contenedor DOM
      if (passMapEl._leaflet_id && L.Map) {
        // Si ya existe en el scope global como mapPassenger (por si fue var/window)
        if (window.mapPassenger) activePassMap = window.mapPassenger;
      }
    } catch (e) {}

    let originCoords = [10.2016, -71.3148];
    let destCoords = null;
    let routeLayer = null;
    let searchTimer = null;

    // 3. Ubicación GPS real del usuario
    window.locateUserGlobal = function () {
      if (!navigator.geolocation) {
        if (typeof showToast === 'function') showToast('Tu navegador no soporta GPS');
        return;
      }
      if (typeof showToast === 'function') showToast('Obteniendo ubicación GPS...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          originCoords = [pos.coords.latitude, pos.coords.longitude];
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${originCoords[0]}&lon=${originCoords[1]}`);
            const data = await res.json();
            if (data && data.display_name) {
              const shortName = data.display_name.split(',').slice(0, 3).join(',');
              const origInput = document.getElementById('input-origin');
              if (origInput) origInput.value = shortName;
            }
          } catch (e) {}
          if (typeof showToast === 'function') showToast('Ubicación actualizada');
        },
        () => {
          if (typeof showToast === 'function') showToast('Activa el GPS del teléfono');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    const gpsBtn = document.querySelector('#screen-passenger button[onclick*="centerPassengerMap"]');
    if (gpsBtn) gpsBtn.setAttribute('onclick', 'locateUserGlobal()');

    // 4. Buscador mundial de direcciones (cualquier ciudad, estado o país)
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
            drop.innerHTML = `<p class="p-3 text-xs text-gray-400">Buscando "${q}"...</p>`;
            drop.classList.remove('hidden');

            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
            const results = await res.json();

            if (!Array.isArray(results) || results.length === 0) {
              drop.innerHTML = `<p class="p-3 text-xs text-gray-400">No se encontraron lugares.</p>`;
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

    // 5. Calcular ruta real entre ciudades/estados con OSRM
    window.selectGlobalDestination = async function (lat, lon, label) {
      const drop = document.getElementById('global-places-dropdown');
      if (drop) drop.classList.add('hidden');

      destCoords = [parseFloat(lat), parseFloat(lon)];
      if (typeof state !== 'undefined') state.destinationText = label;
      if (destInput) destInput.value = label;

      let distKm = 0;
      let durMin = 0;

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=false`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data && data.routes && data.routes[0]) {
          distKm = Math.max(0.5, Number((data.routes[0].distance / 1000).toFixed(1)));
          durMin = Math.max(2, Math.round(data.routes[0].duration / 60));
        } else {
          throw new Error('Fallback');
        }
      } catch (err) {
        const R = 6371;
        const dLat = ((destCoords[0] - originCoords[0]) * Math.PI) / 180;
        const dLon = ((destCoords[1] - originCoords[1]) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((originCoords[0] * Math.PI) / 180) *
            Math.cos((destCoords[0] * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        distKm = Math.max(0.5, Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25).toFixed(1)));
        durMin = Math.max(2, Math.round(distKm * 1.5));
      }

      if (typeof state !== 'undefined') {
        state.distanceKm = distKm;
        state.durationMin = durMin;
      }

      document.getElementById('step-destination').classList.add('hidden');
      document.getElementById('step-vehicles').classList.remove('hidden');
      if (typeof renderVehicleOptions === 'function') {
        renderVehicleOptions();
      }
      if (typeof showToast === 'function') {
        showToast(`Ruta calculada: ${distKm} km · ~${durMin} min`);
      }
    };
  }

  window.addEventListener('load', initGlobalMapModule);
  setTimeout(initGlobalMapModule, 150);
})();
