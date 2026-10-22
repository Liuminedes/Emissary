// src/renderer/screens/mensajes.js
// Pasos del flujo que el asesor puede personalizar (deben coincidir con las
// llamadas a render(stepKey, ...) en conversation.flow.js)
const EDITABLE_STEPS = [
  { key: 'welcome', label: 'Bienvenida' },
  { key: 'menu', label: 'Menú principal' },
  { key: 'askInterest', label: 'Preguntar interés' },
  { key: 'askBudget', label: 'Preguntar presupuesto' },
  { key: 'askEmployment', label: 'Preguntar situación laboral' },
  { key: 'askIncome', label: 'Preguntar ingresos' },
  { key: 'askLeadName', label: 'Pedir nombre' },
  { key: 'askLeadPhone', label: 'Pedir teléfono' },
  { key: 'handoff', label: 'Transferir a asesor humano' },
];

export async function renderMensajes(container) {
  container.innerHTML = `
    <h1>Mensajes del bot</h1>
    <p>Personaliza el texto de cada paso. Deja vacío y restablece para volver al mensaje por defecto.</p>
    <div id="m-list"></div>
  `;

  const saved = await window.emissary.listMensajes();
  const savedMap = Object.fromEntries(saved.map((s) => [s.step_key, s.contenido]));

  const list = container.querySelector('#m-list');
  list.innerHTML = EDITABLE_STEPS.map((s) => `
    <div class="card">
      <label>${s.label}</label>
      <textarea id="m-${s.key}" rows="3" placeholder="(usando el mensaje por defecto)">${savedMap[s.key] || ''}</textarea>
      <button data-save="${s.key}">Guardar</button>
      <button class="secondary" data-reset="${s.key}">Restablecer por defecto</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-save]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.save;
      const value = container.querySelector(`#m-${key}`).value;
      await window.emissary.saveMensaje(key, value);
    };
  });

  list.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.reset;
      await window.emissary.resetMensaje(key);
      container.querySelector(`#m-${key}`).value = '';
    };
  });
}
