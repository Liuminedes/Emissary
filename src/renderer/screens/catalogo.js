// src/renderer/screens/catalogo.js
export async function renderCatalogo(container) {
  container.innerHTML = `
    <h1>Catálogo</h1>
    <div class="card">
      <div class="row">
        <div class="col"><label>Categoría</label><input id="c-categoria" /></div>
        <div class="col"><label>Nombre</label><input id="c-nombre" /></div>
        <div class="col"><label>Emoji</label><input id="c-emoji" placeholder="🚗" /></div>
      </div>
      <label>Descripción</label>
      <textarea id="c-descripcion" rows="2"></textarea>
      <label>Variantes (una por línea: version, precio, bono)</label>
      <textarea id="c-variantes" rows="3" placeholder="Comfortline, 88900000, 0"></textarea>
      <button id="c-add">Agregar / actualizar ítem</button>
    </div>
    <div class="card">
      <table id="c-table">
        <thead><tr><th>Ítem</th><th>Categoría</th><th>Desde</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  async function reload() {
    const items = await window.emissary.listCatalogo();
    const tbody = container.querySelector('#c-table tbody');
    tbody.innerHTML = items.map((it) => {
      const desde = it.variantes.length ? Math.min(...it.variantes.map((v) => v.precio)) : 0;
      return `
        <tr>
          <td>${it.emoji || ''} ${it.nombre}</td>
          <td>${it.categoria}</td>
          <td>${desde ? '$' + desde.toLocaleString('es-CO') : 'Consultar'}</td>
          <td><button class="secondary" data-del="${it.id}">Eliminar</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.onclick = async () => {
        await window.emissary.deleteCatalogoItem(Number(btn.dataset.del));
        reload();
      };
    });
  }

  container.querySelector('#c-add').onclick = async () => {
    const variantesLines = container.querySelector('#c-variantes').value
      .split('\n').map((l) => l.trim()).filter(Boolean);
    const variantes = variantesLines.map((line) => {
      const [version, precio, bono] = line.split(',').map((s) => s.trim());
      return { version, precio: parseFloat(precio) || 0, bono: parseFloat(bono) || 0 };
    });

    await window.emissary.upsertCatalogoItem({
      categoria: container.querySelector('#c-categoria').value.trim() || 'General',
      nombre: container.querySelector('#c-nombre').value.trim(),
      emoji: container.querySelector('#c-emoji').value.trim(),
      descripcion: container.querySelector('#c-descripcion').value.trim(),
      specs: {},
      variantes,
    });

    ['#c-categoria', '#c-nombre', '#c-emoji', '#c-descripcion', '#c-variantes'].forEach((sel) => {
      container.querySelector(sel).value = '';
    });
    reload();
  };

  reload();
}
