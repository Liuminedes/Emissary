// src/renderer/screens/dashboard.js
const STATUS_LABEL = {
  connected: 'Conectado',
  connecting: 'Conectando…',
  qr: 'Esperando escaneo de QR',
  disconnected: 'Desconectado',
};

export async function renderDashboard(container) {
  const negocio = await window.emissary.getNegocio();

  container.innerHTML = `
    <h1>Dashboard</h1>
    <div class="row">
      <div class="col card">
        <div>Estado de conexión</div>
        <p><span id="status-badge" class="badge">…</span></p>
        <div id="qr-box" class="qr-box"></div>
        <button id="btn-relink" class="secondary">Cerrar sesión / re-vincular</button>
      </div>
      <div class="col card">
        <div><strong>${negocio.nombre_asesor || ''}</strong></div>
        <div>${negocio.cargo || ''}</div>
        <div>${negocio.nombre_negocio || ''} ${negocio.marca ? `· ${negocio.marca}` : ''}</div>
        <div>${negocio.horario || ''}</div>
        <div style="margin-top:12px;">
          <button id="btn-scrape">Actualizar precios ahora</button>
        </div>
        <p id="scrape-result"></p>
      </div>
    </div>
  `;

  const badge = container.querySelector('#status-badge');
  const qrBox = container.querySelector('#qr-box');

  function paint(status) {
    badge.textContent = STATUS_LABEL[status.status] || status.status;
    badge.className = `badge ${status.status}`;
    if (status.status === 'qr' && status.qrDataUrl) {
      qrBox.innerHTML = `<img src="${status.qrDataUrl}" width="220" height="220" alt="Código QR de WhatsApp" />`;
    } else {
      qrBox.innerHTML = '';
    }
  }

  paint(await window.emissary.getWaStatus());
  const unsubscribe = window.emissary.onWaStatus(paint);

  // Limpiar el listener al salir de la pantalla (cuando se reemplaza el contenido)
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) { unsubscribe(); observer.disconnect(); }
  });

  container.querySelector('#btn-relink').onclick = async () => {
    await window.emissary.logoutWa();
  };

  container.querySelector('#btn-scrape').onclick = async () => {
    const resultEl = container.querySelector('#scrape-result');
    resultEl.textContent = 'Actualizando…';
    const res = await window.emissary.scrapeCatalogo();
    resultEl.textContent = res.ok
      ? `Se encontraron ${res.count} ítems (revísalos en Catálogo).`
      : `Error: ${res.error}`;
  };
}
