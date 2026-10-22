// src/renderer/screens/leads.js
const ETAPAS = ['nuevo', 'cotizando', 'negociacion', 'cerrado', 'perdido'];

export async function renderLeads(container) {
  container.innerHTML = `
    <h1>Leads</h1>
    <div class="card">
      <table>
        <thead>
          <tr><th>Nombre</th><th>Teléfono</th><th>Interés</th><th>Presupuesto</th><th>Etapa</th></tr>
        </thead>
        <tbody id="l-tbody"></tbody>
      </table>
    </div>
  `;

  const leads = await window.emissary.listLeads();
  const tbody = container.querySelector('#l-tbody');
  tbody.innerHTML = leads.map((l) => `
    <tr>
      <td>${l.nombre}</td>
      <td>${l.telefono}</td>
      <td>${l.interes}</td>
      <td>${l.presupuesto}</td>
      <td>
        <select data-etapa="${l.id}">
          ${ETAPAS.map((e) => `<option value="${e}" ${e === l.etapa ? 'selected' : ''}>${e}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Todavía no hay leads capturados.</td></tr>';

  tbody.querySelectorAll('[data-etapa]').forEach((sel) => {
    sel.onchange = () => window.emissary.updateLeadEtapa(Number(sel.dataset.etapa), sel.value);
  });
}
