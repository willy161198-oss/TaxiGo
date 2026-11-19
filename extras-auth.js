// =========================================================
// TAXIGO · EXTRAS-AUTH.JS · VERSIÓN DE LANZAMIENTO
// =========================================================
(function () {
  function initAuthLaunchModule() {
    if (typeof state === 'undefined') {
      setTimeout(initAuthLaunchModule, 120);
      return;
    }

    // 1. Limpiar historial falso para arrancar todos los usuarios en 0
    if (!localStorage.getItem('taxigo_clean_launch_v1')) {
      state.trips = [];
      state.history = [];
      if (Array.isArray(state.users)) {
        state.users.forEach(u => {
          u.trips = [];
          u.history = [];
          u.totalTrips = 0;
          u.earnings = 0;
          u.debt = 0;
        });
      }
      localStorage.setItem('taxigo_clean_launch_v1', '1');
      if (typeof saveState === 'function') saveState();
    }

    // 2. Formulario de Registro de Conductor con los 6 documentos obligatorios:
    // C.I., Carnet de Circulación, Licencia, Carta Médica y RCV (más fotos/archivo)
    const regForm = document.getElementById('register-driver-form') || document.querySelector('#modal-auth form');
    if (regForm && !document.getElementById('driver-docs-launch-box')) {
      const submitBtn = regForm.querySelector('button[type="submit"], button:last-of-type');
      const docsHtml = `
        <div id="driver-docs-launch-box" class="space-y-2.5 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p class="text-[11px] font-extrabold uppercase text-[#00b14f]">Documentos Obligatorios del Conductor</p>
          <div class="grid grid-cols-1 gap-2">
            <label class="block text-[11px] font-bold">1. Cédula de Identidad (C.I.) *
              <input type="file" id="doc-ci" accept="image/*,.pdf" required class="mt-1 block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#11131a] file:text-white">
            </label>
            <label class="block text-[11px] font-bold">2. Carnet de Circulación del Vehículo *
              <input type="file" id="doc-carnet" accept="image/*,.pdf" required class="mt-1 block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#11131a] file:text-white">
            </label>
            <label class="block text-[11px] font-bold">3. Licencia de Conducir Vigente *
              <input type="file" id="doc-licencia" accept="image/*,.pdf" required class="mt-1 block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#11131a] file:text-white">
            </label>
            <label class="block text-[11px] font-bold">4. Carta Médica Vial *
              <input type="file" id="doc-medica" accept="image/*,.pdf" required class="mt-1 block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#11131a] file:text-white">
            </label>
            <label class="block text-[11px] font-bold">5. Póliza RCV (Responsabilidad Civil) *
              <input type="file" id="doc-rcv" accept="image/*,.pdf" required class="mt-1 block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#11131a] file:text-white">
            </label>
          </div>
          <p class="text-[10px] text-gray-500">Tu cuenta quedará en estado <b>Pendiente de Autorización</b> hasta que el dueño verifique tus documentos.</p>
        </div>
      `;
      if (submitBtn) {
        submitBtn.insertAdjacentHTML('beforebegin', docsHtml);
      } else {
        regForm.insertAdjacentHTML('beforeend', docsHtml);
      }
    }

    // 3. Bloquear acceso a cuentas nuevas (conductores o pasajeros) hasta que el dueño las autorice
    const origGetActive = window.getActiveUser;
    if (typeof origGetActive === 'function' && !window._authApprovalWrapped) {
      window.getActiveUser = function () {
        const u = origGetActive();
        if (u && u.role !== 'owner' && u.id !== 'usr-owner' && u.approved === false) {
          showPendingApprovalOverlay(u);
        }
        return u;
      };
      window._authApprovalWrapped = true;
    }

    function showPendingApprovalOverlay(user) {
      if (document.getElementById('txg-pending-approval-screen')) return;
      document.body.insertAdjacentHTML('beforeend', `
        <div id="txg-pending-approval-screen" class="fixed inset-0 z-[9999] bg-[#11131a] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl">⏳</div>
          <h2 class="text-lg font-extrabold">Cuenta en Revisión</h2>
          <p class="text-xs text-gray-300 max-w-xs">
            Hola <b>${user.name || 'Usuario'}</b>, tu registro y documentos fueron recibidos. El administrador de <b>TaxiGo</b> debe autorizar tu ingreso antes de operar.
          </p>
          <button type="button" onclick="location.reload()" class="px-5 py-3 rounded-2xl bg-[#00b14f] text-white text-xs font-extrabold">
            Verificar si ya fui aprobado
          </button>
        </div>
      `);
    }

    // Asegurar que todo nuevo registro nazca con approved: false y historial en 0
    if (Array.isArray(state.users)) {
      state.users.forEach(u => {
        if (u.role !== 'owner' && u.id !== 'usr-owner' && typeof u.approved === 'undefined') {
          u.approved = false;
        }
      });
    }
  }

  window.addEventListener('load', initAuthLaunchModule);
  setTimeout(initAuthLaunchModule, 180);
})();
