// =========================================================
// TAXIGO · EXTRAS-MAPA.JS v6.1 (DEFINITIVO - GPS, PIN CENTRAL Y TARIFA OCULTA)
// =========================================================
(function () {
  function initTaxiGoMapSystem() {
    if (typeof L === 'undefined' || !document.getElementById('map-passenger')) {
      setTimeout(initTaxiGoMapSystem, 150);
      return;
    }

    // 1. Forzar teselas OpenStreetMap gratuitas en Leaflet
    if (L.TileLayer && !L.TileLayer.prototype._taxiGoOsmForced) {
      const origGetTileUrl = L.TileLayer.prototype.getTileUrl;
      L.TileLayer.prototype.getTileUrl = function (coords) {
        let url = origGetTileUrl.call(this, coords);
        if (typeof url === 'string' && (url.includes('cartocdn') || url.includes('basemaps'))) {
          return `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
        }
        return url;
      };
      L.TileLayer.prototype._taxiGoOsmForced = true;
    }

    // 2. Tarifa oculta en el sistema ($1.10 mínima | $0.75 por km)
    window.calculateFares = function () {
      const km = Math.max(0.3, Number((typeof state !== 'undefined' && state.distanceKm) ? state.distanceKm : 1.0));
      const rate = (typeof state !== 'undefined' && state.bcvRate) ? Number(state.bcvRate) : 45.0;

      const motoUsd = Math.max(1.10, Number((km * 0.75).toFixed(2)));
      const carroUsd = Math.max(1.80, Number((km * 1.15).toFixed(2)));
      const envioUsd = Math.max(1.10, Number((km * 0.75).toFixed(2)));

      return [
        { name: 'Moto Go', desc: 'Rápido · 1 pasajero', icon: '🏍️', eta: `${Math.max(2, Math.round(km * 1.4))} min`, usd: motoUsd, bs: (motoUsd * rate).toFixed(2) },
        { name: 'Carro Go', desc: 'Confort · A/A · 4 puestos', icon: '🚗', eta: `${Math.max(3, Math.round(km * 1.8))} min`, usd: carroUsd, bs: (carroUsd * rate).toFixed(2) },
        { name: 'Envío Express', desc: 'Paquetes y encomiendas', icon: '📦', eta: `${Math.max(2, Math.round(km * 1.4))} min`, usd: envioUsd, bs: (envioUsd * rate).toFixed(2) }
      ];
    };

    const passScreen = document.getElementById('screen-passenger');
    const stepDest = document.getElementById('step-destination');
    const destInput = document.getElementById('input-destination');
    if (!passScreen || !stepDest || !destInput) return;

    let originCoords = [10.2016, -71.3148];
    let originMarker = null;
    let destMarker = null;
    let activePolyline = null;
    let isPinPickingMode = false;
    let reverseTimer = null;
    let searchTimer = null;

    // Obtener la instancia global del mapa pasajero
    function getActivePassMap() {
      if (typeof mapPassenger !== 'undefined' && mapPassenger) return mapPassenger;
      return null;
    }

    // 3. Interceptar rutas para que doblen por las calles reales (OSRM)
    if (L.Polyline && !L.Polyline.prototype._taxiGoRoadSnapped) {
      const origSetLatLngs = L.Polyline.prototype.setLatLngs;
      L.Polyline.prototype.setLatLngs = function (latlngs) {
        const res = origSetLatLngs.call(this, latlngs);
        if (!this._skipRoadSnap && Array.isArray(latlngs) && latlngs.length === 2) {
          const p1 = L.latLng(latlngs[0]);
          const p2 = L.latLng(latlngs[1]);
          const self = this;
          fetch(`https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`)
            .then(r => r.json())
            .then(data => {
              if (data && data.routes && data.routes[0]) {
                const r = data.routes[0];
                const roadCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
                self._skipRoadSnap = true;
                origSetLatLngs.call(self, roadCoords);
                self._skipRoadSnap = false;

                const distKm = Math.max(0.3, Number((r.distance / 1000).toFixed(1)));
                const durMin = Math.max(2, Math.round(r.duration / 60));
                if (typeof state !== 'undefined') {
                  state.distanceKm = distKm;
                  state.durationMin = durMin;
                }
              }
            }).catch(() => {});
        }
        return res;
      };
      L.Polyline.prototype._taxiGoRoadSnapped = true;
    }

    // 4. Interfaz del Pin Central al mover el mapa ("Buscar en el mapa")
    if (!document.getElementById('center-pin-overlay')) {
      passScreen.insertAdjacentHTML('beforeend', `
        <div id="center-pin-overlay" class="hidden pointer-events-none absolute inset-0 z-[35] flex flex-col items-center justify-center pb-28">
          <div id="center-pin-label" class="mb-1.5 px-3 py-1 rounded-full bg-[#11131a] text-white text-[11px] font-extrabold shadow-lg max-w-[240px] truncate">
            Mueve el mapa para ubicar el pin
          </div>
          <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 rounded-full bg-[#e51d2e] border-4 border-white shadow-xl flex items-center justify-center text-white text-xs font-extrabold">📍</div>
            <div class="w-1 h-3 bg-[#11131a] rounded-b-full"></div>
            <div class="w-3 h-1 rounded-full bg-black/35 mt-0.5"></div>
          </div>
        </div>

        <div id="center-pin-confirm-bar" class="hidden absolute bottom-4 left-4 right-4 z-[45] bg-white dark:bg-[#1e2233] rounded-3xl p-4 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[10px] font-extrabold uppercase text-[#00b14f]">Punto marcado con el pin</p>
              <p id="center-pin-address-text" class="text-xs font-extrabold truncate">Moviendo mapa...</p>
            </div>
            <button type="button" onclick="cancelCenterPinPicker()" class="shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">✕</button>
          </div>
          <button type="button" onclick="confirmCenterPinDestination()" class="w-full py-3.5 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold shadow-lg active:scale-95 transition">
            ✓ Confirmar este destino
          </button>
        </div>
      `);
    }

    const pickOnMapBtn = document.querySelector('#step-destination button[onclick*="enableMapPick"], #step-destination button.bg-\\[\\#11131a\\]');
    if (pickOnMapBtn) {
      pickOnMapBtn.setAttribute('onclick', 'startCenterPinPicker()');
    }

    window.startCenterPinPicker = function () {
      const m = getActivePassMap();
      isPinPickingMode = true;
      stepDest.classList.add('hidden');
      document.getElementById('center-pin-overlay').classList.remove('hidden');
      document.getElementById('center-pin-confirm-bar').classList.remove('hidden');

      if (m) {
        updateCenterPinAddress(m.getCenter());
        m.off('moveend', onMapMoveForPin);
        m.on('moveend', onMapMoveForPin);
      }
    };

    window.cancelCenterPinPicker = function () {
      const m = getActivePassMap();
      isPinPickingMode = false;
      if (m) m.off('moveend', onMapMoveForPin);
      document.getElementById('center-pin-overlay').classList.add('hidden');
      document.getElementById('center-pin-confirm-bar').classList.add('hidden');
      stepDest.classList.remove('hidden');
    };

    function onMapMoveForPin() {
      const m = getActivePassMap();
      if (!m || !isPinPickingMode) return;
      updateCenterPinAddress(m.getCenter());
    }

    function updateCenterPinAddress(latlng) {
      const lbl = document.getElementById('center-pin-label');
      const addrTxt = document.getElementById('center-pin-address-text');
      if (lbl) lbl.textContent = 'Ubicando calle...';
      clearTimeout(reverseTimer);
      reverseTimer = setTimeout(async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
          const data = await res.json();
          const shortAddr = (data && data.display_name) ? data.display_name.split(',').slice(0, 3).join(',') : `Punto (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
          if (lbl) lbl.textContent = shortAddr;
          if (addrTxt) addrTxt.textContent = shortAddr;
          window._lastPickedPin = { lat: latlng.lat, lng: latlng.lng, label: shortAddr };
        } catch (e) {
          window._lastPickedPin = { lat: latlng.lat, lng: latlng.lng, label: 'Destino en mapa' };
        }
      }, 300);
    }

    window.confirmCenterPinDestination = async function () {
      const m = getActivePassMap();
      const picked = window._lastPickedPin || (m ? { lat: m.getCenter().lat, lng: m.getCenter().lng, label: 'Destino marcado en mapa' } : null);
      if (!picked) return;
      cancelCenterPinPicker();
      await applyDestinationRoute(picked.lat, picked.lng, picked.label);
    };

    // 5. GPS de alta precisión
    function updateOriginGps(lat, lng) {
      originCoords = [lat, lng];
      const m = getActivePassMap();
      if (m) {
        m.setView(originCoords, 16);
        if (!originMarker) {
          originMarker = L.circleMarker(originCoords, { radius: 9, fillColor: '#00b14f', color: '#ffffff', weight: 3, fillOpacity: 1 }).addTo(m);
        } else {
          originMarker.setLatLng(originCoords);
        }
      }
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            const origInput = document.getElementById('input-origin');
            if (origInput) origInput.value = data.display_name.split(',').slice(0, 3).join(',');
          }
        }).catch(() => {});
    }

    window.locateUserGlobal = function () {
      if (!navigator.geolocation) return;
      if (typeof showToast === 'function') showToast('Sincronizando GPS exacto...');
      navigator.geolocation.getCurrentPosition(
        (pos) => updateOriginGps(pos.coords.latitude, pos.coords.longitude),
        () => { if (typeof showToast === 'function') showToast('Activa el GPS del teléfono'); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    setTimeout(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => updateOriginGps(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }, 500);

    const gpsBtn = document.querySelector('#screen-passenger button[onclick*="centerPassengerMap"]');
    if (gpsBtn) gpsBtn.setAttribute('onclick', 'locateUserGlobal()');

    // 6. Buscador mundial y aplicación de destino
    if (!document.getElementById('global-places-dropdown')) {
      destInput.insertAdjacentHTML('afterend', `
        <div id="global-places-dropdown" class="hidden mt-1.5 rounded-2xl bg-white dark:bg-[#1e2233] border border-gray-200 dark:border-gray-700 shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 z-50"></div>
      `);

      destInput.addEventListener('input', function () {
        const q = destInput.value.trim();
        const drop = document.getElementById('global-places-dropdown');
        clearTimeout(searchTimer);
        if (q.length < 3) { drop.classList.add('hidden'); return; }

        searchTimer = setTimeout(async () => {
          try {
            drop.innerHTML = `<p class="p-3 text-xs text-gray-400">Buscando "${q}"...</p>`;
            drop.classList.remove('hidden');
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
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
          } catch (e) { drop.classList.add('hidden'); }
        }, 450);
      });
    }

    window.selectGlobalDestination = async function (lat, lon, label) {
      const drop = document.getElementById('global-places-dropdown');
      if (drop) drop.classList.add('hidden');
      await applyDestinationRoute(lat, lon, label);
    };

    async function applyDestinationRoute(lat, lon, label) {
      const dLat = parseFloat(lat);
      const dLon = parseFloat(lon);
      if (typeof state !== 'undefined') state.destinationText = label;
      if (destInput) destInput.value = label;

      const m = getActivePassMap();
      let distKm = 1.0;
      let durMin = 3;
      let polyCoords = [originCoords, [dLat, dLon]];

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${dLon},${dLat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data && data.routes && data.routes[0]) {
          const r = data.routes[0];
          distKm = Math.max(0.3, Number((r.distance / 1000).toFixed(1)));
          durMin = Math.max(2, Math.round(r.duration / 60));
          polyCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
        }
      } catch (e) {}

      if (typeof state !== 'undefined') {
        state.distanceKm = distKm;
        state.durationMin = durMin;
      }

      if (m) {
        if (activePolyline) m.removeLayer(activePolyline);
        if (destMarker) m.removeLayer(destMarker);
        destMarker = L.circleMarker([dLat, dLon], { radius: 9, fillColor: '#e51d2e', color: '#ffffff', weight: 3, fillOpacity: 1 }).addTo(m);
        activePolyline = L.polyline(polyCoords, { color: '#11131a', weight: 5, opacity: 0.9 }).addTo(m);
        m.fitBounds(activePolyline.getBounds(), { padding: [50, 50] });
      }

      stepDest.classList.add('hidden');
      document.getElementById('step-vehicles').classList.remove('hidden');
      if (typeof renderVehicleOptions === 'function') renderVehicleOptions();
    }
  }

  window.addEventListener('load', initTaxiGoMapSystem);
  setTimeout(initTaxiGoMapSystem, 250);
})();
