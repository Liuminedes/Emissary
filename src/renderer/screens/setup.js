// src/renderer/screens/setup.js
export async function renderSetup(container, onDone) {
  container.innerHTML = `
    <h1>Bienvenido a Emissary 👋</h1>
    <p>Configura tu negocio antes de vincular WhatsApp. Esto solo se pide una vez en este equipo.</p>
    <div class="card" style="max-width: 480px;">
      <label>Marca / tipo de negocio</label>
      <input id="s-marca" placeholder="Ej: Volkswagen, Clínica Dental, Minimarket..." />

      <label>Nombre del negocio</label>
      <input id="s-negocio" placeholder="Ej: Motorwagen Cali" />

      <label>Tu nombre completo</label>
      <input id="s-asesor" placeholder="Ej: Natalia Escobar" />

      <label>Tu cargo</label>
      <input id="s-cargo" placeholder="Ej: Asesora comercial" />

      <label>Tu número de WhatsApp (con indicativo, sin +)</label>
      <input id="s-telefono" placeholder="Ej: 573001234567" />

      <label>Horario de atención</label>
      <input id="s-horario" placeholder="Ej: L-V 8am-6pm | S 8am-1pm" />

      <label>Link de tu página / portafolio (opcional)</label>
      <input id="s-portfolio" placeholder="https://..." />

      <button id="s-submit">Continuar y vincular WhatsApp →</button>
      <p id="s-error" style="color:#a32d2d;"></p>
    </div>
  `;

  container.querySelector('#s-submit').onclick = async () => {
    const data = {
      marca: container.querySelector('#s-marca').value.trim(),
      nombre_negocio: container.querySelector('#s-negocio').value.trim(),
      nombre_asesor: container.querySelector('#s-asesor').value.trim(),
      cargo: container.querySelector('#s-cargo').value.trim() || 'Asesor comercial',
      telefono: container.querySelector('#s-telefono').value.trim(),
      horario: container.querySelector('#s-horario').value.trim(),
      portfolio_url: container.querySelector('#s-portfolio').value.trim(),
      auto_launch: 1,
    };

    if (!data.nombre_asesor || !data.telefono) {
      container.querySelector('#s-error').textContent = 'Nombre y teléfono son obligatorios.';
      return;
    }

    await window.emissary.saveNegocio(data);
    await window.emissary.completeSetup();
    onDone();
  };
}
