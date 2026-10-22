// src/renderer/screens/ajustes.js
export async function renderAjustes(container) {
  const negocio = await window.emissary.getNegocio();
  const autoLaunch = await window.emissary.getAutoLaunch();
  const paused = await window.emissary.isGloballyPaused();

  container.innerHTML = `
    <h1>Ajustes</h1>
    <div class="card" style="max-width: 480px;">
      <label>Marca / tipo de negocio</label>
      <input id="a-marca" value="${negocio.marca || ''}" />
      <label>Nombre del negocio</label>
      <input id="a-negocio" value="${negocio.nombre_negocio || ''}" />
      <label>Tu nombre</label>
      <input id="a-asesor" value="${negocio.nombre_asesor || ''}" />
      <label>Cargo</label>
      <input id="a-cargo" value="${negocio.cargo || ''}" />
      <label>Teléfono (sin +)</label>
      <input id="a-telefono" value="${negocio.telefono || ''}" />
      <label>Horario</label>
      <input id="a-horario" value="${negocio.horario || ''}" />
      <label>Link de portafolio</label>
      <input id="a-portfolio" value="${negocio.portfolio_url || ''}" />

      <label>URL para actualizar precios (scraping)</label>
      <input id="a-scrape-url" value="${negocio.scrape_url || ''}" placeholder="https://tu-pagina.com/precios" />
      <label>Selector CSS de cada ítem</label>
      <input id="a-scrape-selector" value="${negocio.scrape_selector || ''}" placeholder="[data-item]" />

      <label><input type="checkbox" id="a-autolaunch" style="width:auto;" ${autoLaunch ? 'checked' : ''} /> Iniciar Emissary automáticamente con Windows</label>
      <label><input type="checkbox" id="a-paused" style="width:auto;" ${paused ? 'checked' : ''} /> Pausar el bot globalmente (nadie recibe respuestas)</label>

      <button id="a-save">Guardar cambios</button>
      <p id="a-ok" style="color:#0c6b3a;"></p>
    </div>
  `;

  container.querySelector('#a-save').onclick = async () => {
    await window.emissary.saveNegocio({
      marca: container.querySelector('#a-marca').value.trim(),
      nombre_negocio: container.querySelector('#a-negocio').value.trim(),
      nombre_asesor: container.querySelector('#a-asesor').value.trim(),
      cargo: container.querySelector('#a-cargo').value.trim(),
      telefono: container.querySelector('#a-telefono').value.trim(),
      horario: container.querySelector('#a-horario').value.trim(),
      portfolio_url: container.querySelector('#a-portfolio').value.trim(),
      scrape_url: container.querySelector('#a-scrape-url').value.trim(),
      scrape_selector: container.querySelector('#a-scrape-selector').value.trim(),
      auto_launch: container.querySelector('#a-autolaunch').checked ? 1 : 0,
    });
    await window.emissary.setAutoLaunch(container.querySelector('#a-autolaunch').checked);
    await window.emissary.setGlobalPause(container.querySelector('#a-paused').checked);
    container.querySelector('#a-ok').textContent = 'Guardado ✅';
  };
}
