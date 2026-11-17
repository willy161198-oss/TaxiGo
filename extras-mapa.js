// =========================================================
// TAXIGO · EXTRAS-MAPA.JS v7.0 (CORRECCIÓN DEFINITIVA DE CAPA Y CARTEL DE API KEY)
// =========================================================
(function () {
  function fixMapTilesAndApiKey() {
    if (typeof L === 'undefined') return;

    // 1. Eliminar cualquier capa de Carto activa en las instancias de mapas globales
    ['mapPassenger', 'mapDriver', 'map'].forEach(mapName => {
      if (window[mapName] && typeof window[mapName].eachLayer === 'function') {
        window[mapName].eachLayer(layer => {
          if (layer && layer._url && (layer._url.includes('cartocdn') || layer._url.includes('basemaps'))) {
            window[mapName].removeLayer(layer);
          }
        });
      }
    });

    // 2. Forzar que cualquier L.tileLayer nueva o existente use OpenStreetMap gratis
    if (L.TileLayer && !L.TileLayer.prototype._taxiGoFixed7) {
      const origInitialize = L.TileLayer.prototype.initialize;
      L.TileLayer.prototype.initialize = function (url, options) {
        if (typeof url === 'string' && (url.includes('cartocdn') || url.includes('basemaps'))) {
          url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        }
        return origInitialize.call(this, url, options);
      };
      L.TileLayer.prototype._taxiGoFixed7 = true;
    }

    // 3. Limpiar imágenes de mosaicos rotas en pantalla
    document.querySelectorAll('img.leaflet-tile').forEach(img => {
      if (img.src && (img.src.includes('cartocdn') || img.src.includes('basemaps'))) {
        const match = img.src.match(/\/(\d+)\/(\d+)\/(\d+)(?:@2x)?\.png/);
        if (match) {
          img.src = `https://tile.openstreetmap.org/${match[1]}/${match[2]}/${match[3]}.png`;
        } else {
          img.src = 'https://tile.openstreetmap.org/0/0/0.png';
        }
      }
    });
  }

  // Ejecutar de inmediato y mantener un ciclo corto de limpieza por si el DOM recarga
  fixMapTilesAndApiKey();
  const tileInterval = setInterval(fixMapTilesAndApiKey, 200);
  setTimeout(() => clearInterval(tileInterval), 8000);

  // Tarifa oculta en el sistema ($1.10 mínima | $0.75 por km)
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

  function initMapFeaturesExtra() {
    fixMapTilesAndApiKey();
    const destInput = document.getElementById('input-destination');
    const stepDest = document.getElementById('step-destination');
    if (!destInput || !stepDest) {
      setTimeout(initMapFeaturesExtra, 150);
      return;
    }

    let originCoords = [10.2016, -71.3148];
    let searchTimer = null;

    // GPS de alta precisión
    window.locateUserGlobal = function () {
      if (!navigator.geolocation) return;
      if (typeof showToast === 'function') showToast('Sincronizando GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          originCoords = [pos.coords.latitude, pos.coords.longitude];
          if (window.mapPassenger) {
            window.mapPassenger.setView(originCoords, 16);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    };

    setTimeout(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { originCoords = [pos.coords.latitude, pos.coords.longitude]; },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    }, 400);
  }

  window.addEventListener('load', initMapFeaturesExtra);
  setTimeout(initMapFeaturesExtra, 150);
})();
