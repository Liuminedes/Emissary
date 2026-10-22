// src/renderer/app.js
import { renderSetup } from './screens/setup.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderCatalogo } from './screens/catalogo.js';
import { renderMensajes } from './screens/mensajes.js';
import { renderLeads } from './screens/leads.js';
import { renderAjustes } from './screens/ajustes.js';

const view = document.getElementById('view');
const navList = document.getElementById('nav-list');

const ROUTES = [
  { key: 'dashboard', label: 'Dashboard', render: renderDashboard },
  { key: 'catalogo', label: 'Catálogo', render: renderCatalogo },
  { key: 'mensajes', label: 'Mensajes', render: renderMensajes },
  { key: 'leads', label: 'Leads', render: renderLeads },
  { key: 'ajustes', label: 'Ajustes', render: renderAjustes },
];

function renderNav(activeKey) {
  navList.innerHTML = '';
  for (const r of ROUTES) {
    const li = document.createElement('li');
    li.textContent = r.label;
    li.className = r.key === activeKey ? 'active' : '';
    li.onclick = () => navigate(r.key);
    navList.appendChild(li);
  }
}

async function navigate(key) {
  const route = ROUTES.find((r) => r.key === key) || ROUTES[0];
  renderNav(route.key);
  view.innerHTML = '';
  await route.render(view);
}

async function boot() {
  const negocio = await window.emissary.getNegocio();
  if (!negocio.setup_completo) {
    document.getElementById('sidebar').style.display = 'none';
    await renderSetup(view, async () => {
      document.getElementById('sidebar').style.display = '';
      navigate('dashboard');
    });
  } else {
    navigate('dashboard');
  }
}

boot();
