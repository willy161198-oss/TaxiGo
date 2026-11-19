// =========================================================
// TAXIGO · EXTRAS-MAPA.JS v6.0 (GPS EXACTO + PIN CENTRAL + ROTACIÓN + TARIFA OCULTA $1.10 / $0.75)
// =========================================================
(function () {
  // 1. Forzar teselas OpenStreetMap gratuitas en todo Leaflet
  function forceOpenStreetMapCore() {
    if (typeof L === 'undefined' || !L.TileLayer) return false;

    if (!L.TileLayer.prototype._taxiGoOsmForced) {
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

    document.querySelectorAll('img.leaflet-tile').forEach(img => {
      if (img.src && (img.src.includes('cartocdn') || img.src.includes('basemaps'))) {
        const match = img.src.match(/\/(\d+)\/(\d+)\/(\d+)(?:@2x)?\.png/);
        if (match) {
          img.src = `https://tile.openstreetmap.org/${match[1]}/${match[2]}/${match[3]}.png`;
        }
      }
    });

    return true;
  }

  // 2. Interceptar líneas rectas de 2 puntos y doblarlas por calles reales (OSRM)
  function snapStraightLinesToRoads() {
    if (typeof L === 'undefined' || !L.Polyline || L.Polyline.prototype._taxiGoRoadSnapped) return;

    const origSetLatLngs = L.Polyline.prototype.setLatLngs;

    async function routeOverRoads(polylineInstance, pts) {
      if (!Array.isArray(pts) || pts.length !== 2) return;
      const p1 = L.latLng(pts[0]);
      const p2 = L.latLng(pts[1]);
      if (!p1 || !p2 || (p1.lat === p2.lat && p1.lng === p2.lng)) return;

      const routeKey = `${p1.lat.toFixed(5)},${p1.lng.toFixed(5)}->${p2.lat.toFixed(5)},${p2.lng.toFixed(5)}`;
      if (polylineInstance._lastRoutedKey === routeKey) return;
      polylineInstance._lastRoutedKey = routeKey;

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data && data.routes && data.routes[0]) {
          const r = data.routes[0];
          const roadCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
          polylineInstance._skipRoadSnap = true;
          origSetLatLngs.call(polylineInstance, roadCoords);
          polylineInstance._skipRoadSnap = false;

          const distKm = Math.max(0.3, Number((r.distance / 1000).toFixed(1)));
          const durMin = Math.max(2, Math.round(r.duration / 60));

          if (typeof state !== 'undefined') {
            state.distanceKm = distKm;
            state.durationMin = durMin;
          }

          document.querySelectorAll('#step-destination p, #step-destination span').forEach(el => {
            if (el.children.length === 0) {
              if (/^\d+(\.\d+)?\s*km$/i.test(el.textContent.trim())) {
                el.textContent = `${distKm} Km`;
              } else if (/^\d+\s*min$/i.test(el.textContent.trim())) {
                el.textContent = `${durMin} Min`;
              }
            }
          });

          if (typeof renderVehicleOptions === 'function') {
            renderVehicleOptions();
          }
        }
      } catch (e) {}
    }

    L.Polyline.prototype.setLatLngs = function (latlngs) {
      const res = origSetLatLngs.call(this, latlngs);
      if (!this._skipRoadSnap && Array.isArray(latlngs) && latlngs.length === 2) {
        routeOverRoads(this, latlngs);
      }
      return res;
    };

    const origPolylineFactory = L.polyline;
    L.polyline = function (latlngs, options) {
      const poly = origPolylineFactory.call(this, latlngs, options);
      if (Array.isArray(latlngs) && latlngs.length === 2) {
        routeOverRoads(poly, latlngs);
      }
      return poly;
    };

    L.Polyline.prototype._taxiGoRoadSnapped = true;
  }

  // Capturar la instancia real del mapa de Leaflet apenas se inicialice
  let capturedPassMap = null;
  if (typeof L !== 'undefined' && L.Map && !L.Map.prototype._taxiGoCaptured) {
    const origInit = L.Map.prototype.initialize;
    L.Map.prototype.initialize = function (id, options) {
      const res = origInit.call(this, id, options);
      if (id === 'map-passenger' || (id && id.id === 'map-passenger')) {
        capturedPassMap = this;
      }
      return res;
    };
    L.Map.prototype._taxiGoCaptured = true;
  }

  forceOpenStreetMapCore();
  snapStraightLinesToRoads();

  const bootWatcher = setInterval(() => {
    forceOpenStreetMapCore();
    snapStraightLinesToRoads();
  }, 250);
  setTimeout(() => clearInterval(bootWatcher), 10000);

  function initGlobalMapFeatures() {
    forceOpenStreetMapCore();
    snapStraightLinesToRoads();

    // 3. TARIFA OCULTA EN EL SISTEMA: Mínima $1.10 | Kilómetro $0.75 (sin mostrar fórmulas al público)
    window.calculateFares = function () {
      const km = Math.max(0.3, Number((typeof state !== 'undefined' && state.distanceKm) ? state.distanceKm : 1.0));
      const rate = (typeof state !== 'undefined' && state.bcvRate) ? Number(state.bcvRate) : 45.0;

      // Fórmula oculta: carrera mínima $1.10, costo por km $0.75
      const motoUsd = Math.max(1.10, Number((km * 0.75).toFixed(2)));
      const carroUsd = Math.max(1.80, Number((km * 1.15).toFixed(2)));
      const envioUsd = Math.max(1.10, Number((km * 0.75).toFixed(2)));

      return [
        {
          name: 'Moto Go',
          desc: 'Rápido · 1 pasajero',
          icon: '🏍️',
          eta: `${Math.max(2, Math.round(km * 1.4))} min`,
          usd: motoUsd,
          bs: (motoUsd * rate).toFixed(2)
        },
        {
          name: 'Carro Go',
          desc: 'Confort · A/A · 4 puestos',
          icon: '🚗',
          eta: `${Math.max(3, Math.round(km * 1.8))} min`,
          usd: carroUsd,
          bs: (carroUsd * rate).toFixed(2)
        },
        {
          name: 'Envío Express',
          desc: 'Paquetes y encomiendas',
          icon: '📦',
          eta: `${Math.max(2, Math.round(km * 1.4))} min`,
          usd: envioUsd,
          bs: (envioUsd * rate).toFixed(2)
        }
      ];
    };

    const destInput = document.getElementById('input-destination');
    const stepDest = document.getElementById('step-destination');
    const passScreen = document.getElementById('screen-passenger');
    if (!destInput || !stepDest || !passScreen) {
      setTimeout(initGlobalMapFeatures, 150);
      return;
    }

    let originCoords = [10.2016, -71.3148];
    let originMarker = null;
    let destMarker = null;
    let activePolyline = null;
    let isPinPickingMode = false;
    let mapRotationDeg = 0;
    let reverseTimer = null;
    let searchTimer = null;

    function getPassMap() {
      if (capturedPassMap) return capturedPassMap;
      if (typeof mapPassenger !== 'undefined' && mapPassenger) return mapPassenger;
      return null;
    }

    // 4. PIN FIJO EN EL CENTRO DEL MAPA AL MOVERLO ("Es aquí")
    if (!document.getElementById('center-pin-overlay')) {
      passScreen.insertAdjacentHTML('beforeend', `
        <div id="center-pin-overlay" class="hidden pointer-events-none absolute inset-0 z-[35] flex flex-col items-center justify-center pb-28">
          <div id="center-pin-label" class="mb-1.5 px-3 py-1 rounded-full bg-[#11131a] text-white text-[11px] font-extrabold shadow-lg max-w-[240px] truncate">
            Mueve el mapa para ubicar el pin
          </div>
          <div class="relative flex flex-col items-center">
            <div class="w-8 h-8 rounded-full bg-[#e51d2e] border-4 border-white shadow-xl flex items-center justify-center text-white text-xs font-extrabold">
              📍
            </div>
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

    // Enlazar botón "Buscar en el mapa" para activar el pin central movible
    const pickOnMapBtn = document.querySelector('#step-destination button[onclick*="enableMapPick"], #step-destination button.bg-\\[\\#11131a\\]');
    if (pickOnMapBtn) {
      pickOnMapBtn.setAttribute('onclick', 'startCenterPinPicker()');
    }

    window.startCenterPinPicker = function () {
      const m = getPassMap();
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
      const m = getPassMap();
      isPinPickingMode = false;
      if (m) m.off('moveend', onMapMoveForPin);
      document.getElementById('center-pin-overlay').classList.add('hidden');
      document.getElementById('center-pin-confirm-bar').classList.add('hidden');
      stepDest.classList.remove('hidden');
    };

    function onMapMoveForPin() {
      const m = getPassMap();
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
          const shortAddr = (data && data.display_name)
            ? data.display_name.split(',').slice(0, 3).join(',')
            : `Punto seleccionado (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
          if (lbl) lbl.textContent = shortAddr;
          if (addrTxt) addrTxt.textContent = shortAddr;
          window._lastPickedPin = { lat: latlng.lat, lng: latlng.lng, label: shortAddr };
        } catch (e) {
          const fallback = `Punto (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
          if (lbl) lbl.textContent = fallback;
          if (addrTxt) addrTxt.textContent = fallback;
          window._lastPickedPin = { lat: latlng.lat, lng: latlng.lng, label: fallback };
        }
      }, 300);
    }

    window.confirmCenterPinDestination = async function () {
      const m = getPassMap();
      const picked = window._lastPickedPin || (m ? { lat: m.getCenter().lat, lng: m.getCenter().lng, label: 'Destino marcado en mapa' } : null);
      if (!picked) return;

      cancelCenterPinPicker();
      await applyDestinationAndDrawStreetRoute(picked.lat, picked.lng, picked.label);
    };

    // 5. GPS REAL DE ALTA PRECISIÓN (Sincroniza tu punto exacto en el mapa)
    function updateOriginOnMap(lat, lng, updateAddressText) {
      originCoords = [lat, lng];
      const m = getPassMap();
      if (m) {
        m.setView(originCoords, 16);
        if (!originMarker) {
          originMarker = L.circleMarker(originCoords, {
            radius: 9,
            fillColor: '#00b14f',
            color: '#ffffff',
            weight: 3,
            fillOpacity: 1
          }).addTo(m);
        } else {
          originMarker.setLatLng(originCoords);
        }
      }

      if (updateAddressText) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.display_name) {
              const shortName = data.display_name.split(',').slice(0, 3).join(',');
              const origInput = document.getElementById('input-origin');
              if (origInput) origInput.value = shortName;
            }
          })
          .catch(() => {});
      }
    }

    window.locateUserGlobal = function () {
      if (!navigator.geolocation) {
        if (typeof showToast === 'function') showToast('Tu dispositivo no soporta GPS');
        return;
      }
      if (typeof showToast === 'function') showToast('Sincronizando tu GPS exacto...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateOriginOnMap(pos.coords.latitude, pos.coords.longitude, true);
          if (typeof showToast === 'function') showToast('Ubicación GPS sincronizada');
        },
        () => {
          if (typeof showToast === 'function') showToast('Activa la ubicación (GPS) del teléfono');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    // Sincronizar automáticamente apenas abre el mapa
    setTimeout(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => updateOriginOnMap(pos.coords.latitude, pos.coords.longitude, true),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }, 600);

    const gpsBtn = document.querySelector('#screen-passenger button[onclick*="centerPassengerMap"]');
    if (gpsBtn) gpsBtn.setAttribute('onclick', 'locateUserGlobal()');

    // 6. ROTACIÓN DEL MAPA CON DOS DEDOS
    const mapContainer = document.getElementById('map-passenger');
    if (mapContainer && !mapContainer._rotationEnabled) {
      let startAngle = 0;
      let baseRotation = 0;

      function getTouchAngle(t1, t2) {
        return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      }

      mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          startAngle = getTouchAngle(e.touches[0], e.touches[1]);
          baseRotation = mapRotationDeg;
        }
      }, { passive: true });

      mapContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
          mapRotationDeg = (baseRotation + (currentAngle - startAngle)) % 360;
          const pane = mapContainer.querySelector('.leaflet-map-pane');
          if (pane) {
            pane.style.transformOrigin = 'center center';
            pane.style.rotate = `${mapRotationDeg}deg`;
          }
        }
      }, { passive: true });

      mapContainer._rotationEnabled = true;
    }

    // 7. Buscador mundial de direcciones + trazado por calles
    if (!document.getElementById('global-places-dropdown')) {
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
              drop.innerHTML = `<p class="p-3 text-xs text-gray-400">No se encontraron lugares. Usa "Buscar en el mapa" para mover el pin.</p>`;
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

    window.selectGlobalDestination = async function (lat, lon, label) {
      const drop = document.getElementById('global-places-dropdown');
      if (drop) drop.classList.add('hidden');
      await applyDestinationAndDrawStreetRoute(lat, lon, label);
    };

    async function applyDestinationAndDrawStreetRoute(lat, lon, label) {
      const dLat = parseFloat(lat);
      const dLon = parseFloat(lon);
      if (typeof state !== 'undefined') state.destinationText = label;
      if (destInput) destInput.value = label;

      const m = getPassMap();
      let distKm = 0;
      let durMin = 0;
      let polyCoords = [originCoords, [dLat, dLon]];

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${dLon},${dLat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data && data.routes && data.routes[0]) {
          const r = data.routes[0];
          distKm = Math.max(0.3, Number((r.distance / 1000).toFixed(1)));
          durMin = Math.max(2, Math.round(r.duration / 60));
          polyCoords = r.geometry.coordinates.map(c => [c[1], c[0]]);
        } else {
          throw new Error('Fallback');
        }
      } catch (err) {
        const R = 6371;
        const dLatRad = ((dLat - originCoords[0]) * Math.PI) / 180;
        const dLonRad = ((dLon - originCoords[1]) * Math.PI) / 180;
        const a =
          Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
          Math.cos((originCoords[0] * Math.PI) / 180) *
            Math.cos((dLat * Math.PI) / 180) *
            Math.sin(dLonRad / 2) *
            Math.sin(dLonRad / 2);
        distKm = Math.max(0.3, Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25).toFixed(1)));
        durMin = Math.max(2, Math.round(distKm * 1.5));
      }

      if (typeof state !== 'undefined') {
        state.distanceKm = distKm;
        state.durationMin = durMin;
      }

      if (m) {
        if (activePolyline) m.removeLayer(activePolyline);
        if (destMarker) m.removeLayer(destMarker);

        destMarker = L.circleMarker([dLat, dLon], {
          radius: 9,
          fillColor: '#e51d2e',
          color: '#ffffff',
          weight: 3,
          fillOpacity: 1
        }).addTo(m);

        activePolyline = L.polyline(polyCoords, {
          color: '#11131a',
          weight: 5,
          opacity: 0.9
        }).addTo(m);

        m.fitBounds(activePolyline.getBounds(), { padding: [50, 50] });
      }

      stepDest.classList.add('hidden');
      document.getElementById('step-vehicles').classList.remove('hidden');
      if (typeof renderVehicleOptions === 'function') {
        renderVehicleOptions();
      }
      if (typeof showToast === 'function') {
        showToast(`Ruta lista: ${distKm} km · ~${durMin} min`);
      }
    }
  }

  window.addEventListener('load', initGlobalMapFeatures);
  setTimeout(initGlobalMapFeatures, 150);
})();
