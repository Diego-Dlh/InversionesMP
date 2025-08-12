'use strict';

/* ============================================================================
 * Imports
 * ==========================================================================*/
import { fetchWithAuth } from './api.js';

/* ============================================================================
 * Config / Selectores
 * ==========================================================================*/
const API_BASE = 'https://inversiones-api.onrender.com/api';
const SELECTORS = {
  // acciones generales
  logoutBtn: 'logout-btn',

  // filtros / búsquedas
  filtroMes: 'filtro-mes',
  buscarDeudor: 'buscar-deudor',
  buscarPrestamo: 'buscar-prestamo',
  filtroEstado: 'filtro-estado',
  filtroCobrador: 'filtro-cobrador',

  // modales + forms
  modalCobrador: 'modal-cobrador',
  btnToggleModalCobrador: 'btn-toggle-modal',
  btnCloseModalCobrador: 'btn-close-modal',
  formCobrador: 'form-cobrador',

  modalDeudor: 'modal-deudor',
  btnToggleModalDeudor: 'btn-toggle-modal-deudor',
  btnCloseModalDeudor: 'btn-close-modal-deudor',
  formDeudor: 'form-deudor',

  modalPrestamo: 'modal-prestamo',
  btnToggleModalPrestamo: 'btn-toggle-modal-prestamo',
  btnCloseModalPrestamo: 'cerrar-modal-prestamo',
  formPrestamo: 'form-prestamo',

  modalPago: 'modal-pago',
  btnToggleModalPago: 'btn-toggle-modal-pago',
  btnCloseModalPago: 'btn-close-modal-pago',
  formPago: 'form-pago',

  // tablas (TBODY)
  tablaDeudores: 'tabla-deudores-container',
  tablaPrestamos: 'tabla-prestamos-container',
  tablaPagos: 'tabla-pagos-container',
  tablaCobradores: 'tabla-cobradores-container',

  // resumen
  deudoresCount: 'deudores-count',
  prestamosCount: 'prestamos-count',
  pagosCount: 'pagos-count',
  usuariosCount: 'usuarios-count',
  totalRecaudado: 'total-recaudado',

  // toasts
  toastError: 'toast-error',
  toastExito: 'toast-exito',

  // préstamo (selects/inputs)
  selectPrestamoDeudor: 'prestamo-deudor',
  inputPrestamoMonto: 'prestamo-monto',
  inputPrestamoInteres: 'prestamo-interes',
  inputPrestamoMeses: 'prestamo-meses',
  inputPrestamoFecha: 'prestamo-fecha',

  // pago
  selectPagoPrestamo: 'pago-prestamo',
  inputPagoMonto: 'pago-monto',
  inputPagoFecha: 'pago-fecha',

  // deudor modal
  selectDeudorCobrador: 'deudor-cobrador',
  deudorNombre: 'deudor-nombre',
  deudorApellido: 'deudor-apellido',
  deudorIdentificacion: 'deudor-identificacion',
  deudorTelefono: 'deudor-telefono',
  deudorDireccion: 'deudor-direccion',
  deudorTipo: 'deudor-tipo',

  // cobrador modal
  nuevoNombre: 'nuevo-nombre',
  nuevoApellido: 'nuevo-apellido',
  nuevoIdentificacion: 'nuevo-identificacion',
  nuevoTelefono: 'nuevo-telefono'
};

/* ============================================================================
 * Estado global
 * ==========================================================================*/
let deudoresMap = new Map();
let usuariosMap = new Map();

let deudoresGlobal = [];
let prestamosGlobal = [];
let usuariosGlobal = [];
let pendingDelete = null; // { tipo: 'deudor' | 'cobrador', id: string|number }

/* ----- Estado de paginación/vista por tabla ----- */
const paging = {
  deudores: { page: 1, pageSize: 10, view: [] },
  cobradores: { page: 1, pageSize: 10, view: [] },
  prestamos: { page: 1, pageSize: 10, view: [] },
  pagos: { page: 1, pageSize: 10, view: [] }
};

/* Helpers paginación */
const setView = (key, arr) => { paging[key].view = Array.isArray(arr) ? arr : []; paging[key].page = 1; };
const pageCount = (key) => Math.max(1, Math.ceil((paging[key].view.length || 0) / paging[key].pageSize));
const slicePage = (key) => {
  const { page, pageSize, view } = paging[key];
  const start = (page - 1) * pageSize;
  return view.slice(start, start + pageSize);
};

/* ============================================================================
 * Bootstrap
 * ==========================================================================*/
document.addEventListener('DOMContentLoaded', async () => {
  ensureConfirmUI(); // modal confirmar (eliminar)
  ensureTableToolbars(); // toolbars (paginación + export) por tabla

  const rol = localStorage.getItem('rol');
  if (rol !== '1') {
    mostrarToast('error', 'Acceso no autorizado');
    window.location.href = 'index.html';
    return;
  }

  try {
    const [deudores, usuarios, prestamos, pagos] = await Promise.all([
      fetchWithAuth(`${API_BASE}/deudores/`),
      fetchWithAuth(`${API_BASE}/usuarios/`),
      fetchWithAuth(`${API_BASE}/prestamos/`),
      fetchWithAuth(`${API_BASE}/pagos`)
    ]);

    // estado
    deudoresGlobal = deudores;
    prestamosGlobal = prestamos;
    usuariosGlobal = usuarios;

    // maps
    deudores.forEach(d => deudoresMap.set(String(d.id), `${d.nombre} ${d.apellido ?? ''}`.trim()));
    usuarios.forEach(u => usuariosMap.set(String(u.id), `${u.nombre} ${u.apellido ?? ''}`.trim()));

    // resumen
    setText(SELECTORS.deudoresCount, deudores.length);
    setText(SELECTORS.prestamosCount, prestamos.length);
    setText(SELECTORS.pagosCount, pagos.length);
    setText(SELECTORS.usuariosCount, usuarios.length);

    // render inicial (con paginación)
    renderTablaDeudores(deudoresGlobal);
    renderTablaPrestamos(prestamosGlobal);
    renderTablaCobradores(usuariosGlobal);
    cargarOpcionesCobradores(usuariosGlobal);
    poblarFiltroCobrador(usuariosGlobal);

    await cargarPagosFiltrados();
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error cargando datos');
  }

  /* -------------------------
   * Eventos globales
   * -----------------------*/
  byId(SELECTORS.logoutBtn)?.addEventListener('click', () => {
    localStorage.removeItem('token'); localStorage.removeItem('rol');
    window.location.href = 'index.html';
  });

  byId(SELECTORS.filtroMes)?.addEventListener('change', async (e) => {
    await cargarPagosFiltrados(e.target.value);
  });

  byId(SELECTORS.buscarDeudor)?.addEventListener('input', () => {
    const q = byId(SELECTORS.buscarDeudor).value.toLowerCase();
    const filtrados = deudoresGlobal.filter(d => {
      const nombre = (`${d.nombre ?? ''} ${d.apellido ?? ''}`).toLowerCase();
      const identificacion = (d.identificacion || d.id || '').toString().toLowerCase();
      return nombre.includes(q) || identificacion.includes(q);
    });
    renderTablaDeudores(filtrados); // mantiene paginación
  });

  byId(SELECTORS.buscarPrestamo)?.addEventListener('input', aplicarFiltrosPrestamos);
  byId(SELECTORS.filtroEstado)?.addEventListener('change', aplicarFiltrosPrestamos);
  byId(SELECTORS.filtroCobrador)?.addEventListener('change', aplicarFiltrosPrestamos);

  // Delegación: Eliminar (deudores y cobradores)
  byId(SELECTORS.tablaDeudores)?.addEventListener('click', onActionClick);
  byId(SELECTORS.tablaCobradores)?.addEventListener('click', onActionClick);

  /* -------------------------
   * Modales: abrir/cerrar
   * -----------------------*/
  const modalCobrador = byId(SELECTORS.modalCobrador);
  byId(SELECTORS.btnToggleModalCobrador)?.addEventListener('click', () => modalCobrador?.classList.remove('hidden'));
  byId(SELECTORS.btnCloseModalCobrador)?.addEventListener('click', () => { modalCobrador?.classList.add('hidden'); byId(SELECTORS.formCobrador)?.reset(); });

  const modalDeudor = byId(SELECTORS.modalDeudor);
  byId(SELECTORS.btnToggleModalDeudor)?.addEventListener('click', () => modalDeudor?.classList.remove('hidden'));
  byId(SELECTORS.btnCloseModalDeudor)?.addEventListener('click', () => { modalDeudor?.classList.add('hidden'); byId(SELECTORS.formDeudor)?.reset(); });

  const modalPrestamo = byId(SELECTORS.modalPrestamo);
  byId(SELECTORS.btnToggleModalPrestamo)?.addEventListener('click', () => { cargarSelectDeudores(); modalPrestamo?.classList.remove('hidden'); });
  byId(SELECTORS.btnCloseModalPrestamo)?.addEventListener('click', () => { modalPrestamo?.classList.add('hidden'); byId(SELECTORS.formPrestamo)?.reset(); });

  const modalPago = byId(SELECTORS.modalPago);
  byId(SELECTORS.btnToggleModalPago)?.addEventListener('click', () => { cargarSelectPrestamos(); modalPago?.classList.remove('hidden'); });
  byId(SELECTORS.btnCloseModalPago)?.addEventListener('click', () => { modalPago?.classList.add('hidden'); byId(SELECTORS.formPago)?.reset(); });

  // Modal Confirmación (Eliminar)
  byId('mp-confirm-cancel')?.addEventListener('click', () => { pendingDelete = null; hideConfirmModal(); });
  byId('mp-confirm-ok')?.addEventListener('click', () => {
    if (!pendingDelete) return;
    const { tipo, id } = pendingDelete;
    pendingDelete = null; hideConfirmModal(); handleDelete(tipo, id);
  });
});

/* ============================================================================
 * Renderizadores + paginación
 * ==========================================================================*/
function renderTablaDeudores(deudores) {
  setView('deudores', deudores);
  renderTablaDeudoresPage();
  updateToolbar('deudores');
}
function renderTablaDeudoresPage() {
  const tbody = byId(SELECTORS.tablaDeudores); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('deudores').forEach(d => {
    const nombreCompleto = `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim();
    const tipo = d.tipo == '1' ? 'normal' : (d.tipo == '2' ? 'especial' : '');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombreCompleto)}</td>
      <td class="p-2">${escapeHTML(d.id)}</td>
      <td class="p-2">${escapeHTML(d.telefono)}</td>
      <td class="p-2">${escapeHTML(d.direccion)}</td>
      <td class="p-2">${tipo}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete" data-type="deudor" data-id="${String(d.id)}"
                aria-label="Eliminar deudor ${escapeHTML(nombreCompleto)}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderTablaPrestamos(prestamos) {
  setView('prestamos', prestamos);
  renderTablaPrestamosPage();
  updateToolbar('prestamos');
}
function renderTablaPrestamosPage() {
  const tbody = byId(SELECTORS.tablaPrestamos); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('prestamos').forEach(p => {
    const nombreDeudor = deudoresMap.get(String(p.deudor)) || `ID: ${p.deudor}`;
    const nombreCobrador = usuariosMap.get(String(p.cobrador)) || `ID: ${p.cobrador}`;
    let estadoTexto = 'Desconocido', estadoClase = 'text-gray-500';
    if (p.estado === 1) { estadoTexto = 'Pendiente'; estadoClase = 'text-yellow-600 font-semibold'; }
    else if (p.estado === 2) { estadoTexto = 'Pagado'; estadoClase = 'text-green-600 font-semibold'; }
    else if (p.estado === 3) { estadoTexto = 'En mora'; estadoClase = 'text-red-600 font-semibold'; }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombreDeudor)}</td>
      <td class="p-2">${Number(p.monto).toLocaleString('es-CO')}</td>
      <td class="p-2">${Number(p.saldo_pendiente).toLocaleString('es-CO')}</td>
      <td class="p-2">${p.meses}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
      <td class="p-2"><span class="${estadoClase}">${estadoTexto}</span></td>
      <td class="p-2">${escapeHTML(nombreCobrador)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderTablaPagos(pagos) {
  setView('pagos', pagos);
  renderTablaPagosPage();
  updateToolbar('pagos');
}
function renderTablaPagosPage() {
  const tbody = byId(SELECTORS.tablaPagos); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('pagos').forEach(p => {
    const nombreDeudor = getNombreDeudorDesdePago(p);
    const nombreCobrador = getNombreCobradorDesdePago(p);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombreDeudor)}</td>
      <td class="p-2">${escapeHTML(nombreCobrador)}</td>
      <td class="p-2">${Number(p.monto_pagado).toLocaleString('es-CO')}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderTablaCobradores(cobradores) {
  setView('cobradores', cobradores);
  renderTablaCobradoresPage();
  updateToolbar('cobradores');
}
function renderTablaCobradoresPage() {
  const tbody = byId(SELECTORS.tablaCobradores); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('cobradores').forEach(c => {
    const nombreCompleto = `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombreCompleto)}</td>
      <td class="p-2">${escapeHTML(c.identificacion)}</td>
      <td class="p-2">${escapeHTML(c.telefono)}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete" data-type="cobrador" data-id="${String(c.id)}"
                aria-label="Eliminar cobrador ${escapeHTML(nombreCompleto)}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ============================================================================
 * Filtros / Búsqueda
 * ==========================================================================*/
function aplicarFiltrosPrestamos() {
  const texto = (byId(SELECTORS.buscarPrestamo)?.value || '').toLowerCase();
  const estado = byId(SELECTORS.filtroEstado)?.value || '';
  const cobrador = byId(SELECTORS.filtroCobrador)?.value || '';

  const filtrados = prestamosGlobal.filter(p => {
    const nombreDeudor = (deudoresMap.get(String(p.deudor)) || '').toLowerCase();
    const coincideNombre = nombreDeudor.includes(texto);
    const coincideEstado = !estado || String(p.estado) === estado;
    const coincideCobrador = !cobrador || String(p.cobrador) === cobrador;
    return coincideNombre && coincideEstado && coincideCobrador;
  });

  renderTablaPrestamos(filtrados);
}

/* ============================================================================
 * Fetch / Cálculos
 * ==========================================================================*/
async function cargarPagosFiltrados(mes = '') {
  const url = mes ? `${API_BASE}/pagos/?mes=${mes}` : `${API_BASE}/pagos/`;
  const pagos = await fetchWithAuth(url);
  renderTablaPagos(pagos);

  const totalMes = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);
  setText(SELECTORS.totalRecaudado, totalMes.toLocaleString('es-CO'));
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getNombreDeudorDesdePago(pago) {
  const prestamo = prestamosGlobal.find(pr => pr.id === pago.prestamo);
  if (!prestamo) return 'Prestamo no encontrado';
  const deudor = deudoresGlobal.find(d => d.id === prestamo.deudor);
  return deudor ? `${deudor.nombre} ${deudor.apellido}` : 'Deudor no encontrado';
}

function getNombreCobradorDesdePago(pago) {
  const prestamo = prestamosGlobal.find(pr => pr.id === pago.prestamo);
  if (!prestamo) return 'Préstamo no encontrado';
  const cobrador = usuariosMap.get(String(prestamo.cobrador));
  return cobrador || 'Cobrador no encontrado';
}

/* ============================================================================
 * Formularios (sin cambios funcionales)
 * ==========================================================================*/
// Cobrador: crear
byId(SELECTORS.formCobrador)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    nombre: byId(SELECTORS.nuevoNombre).value,
    apellido: byId(SELECTORS.nuevoApellido).value,
    identificacion: byId(SELECTORS.nuevoIdentificacion).value,
    telefono: byId(SELECTORS.nuevoTelefono).value,
    contraseña: '123456789',
    rol: 2
  };
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}/usuarios/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    mostrarToast('exito', 'Cobrador creado con éxito');
    location.reload();
  } else {
    mostrarToast('error', 'Error al crear cobrador');
  }
});

// Deudor: crear
byId(SELECTORS.formDeudor)?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: byId(SELECTORS.deudorNombre).value,
    apellido: byId(SELECTORS.deudorApellido).value,
    id: byId(SELECTORS.deudorIdentificacion).value,
    telefono: byId(SELECTORS.deudorTelefono).value,
    direccion: byId(SELECTORS.deudorDireccion).value,
    tipo: byId(SELECTORS.deudorTipo).value,
    cobrador_id: byId(SELECTORS.selectDeudorCobrador).value
  };
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}/deudores/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    byId(SELECTORS.modalDeudor)?.classList.add('hidden');
    byId(SELECTORS.formDeudor)?.reset();

    const nuevosDeudores = await fetchWithAuth(`${API_BASE}/deudores/`);
    deudoresGlobal = nuevosDeudores;

    deudoresMap = new Map();
    deudoresGlobal.forEach(d => deudoresMap.set(String(d.id), `${d.nombre} ${d.apellido}`));
    setText(SELECTORS.deudoresCount, deudoresGlobal.length);
    renderTablaDeudores(nuevosDeudores);

    mostrarToast('exito', 'Deudor creado con éxito');
  } else {
    mostrarToast('error', 'Error al crear el deudor');
  }
});

// Préstamo: abrir select deudores
function cargarSelectDeudores() {
  const select = byId(SELECTORS.selectPrestamoDeudor);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Deudor</option>';
  deudoresGlobal.forEach(d => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = `${d.nombre} ${d.apellido}`;
    select.appendChild(option);
  });
}

// Pago: abrir select préstamos
function cargarSelectPrestamos() {
  const select = byId(SELECTORS.selectPagoPrestamo);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Préstamo</option>';
  prestamosGlobal.forEach(p => {
    const nombre = deudoresMap.get(String(p.deudor)) || `ID: ${p.deudor}`;
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${nombre} - $${Number(p.monto).toLocaleString('es-CO')}`;
    select.appendChild(option);
  });
}

// Préstamo: submit
byId(SELECTORS.formPrestamo)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');

  const data = {
    deudor: parseInt(byId(SELECTORS.selectPrestamoDeudor).value),
    monto: parseInt(byId(SELECTORS.inputPrestamoMonto).value),
    interes: parseInt(byId(SELECTORS.inputPrestamoInteres).value),
    meses: parseInt(byId(SELECTORS.inputPrestamoMeses).value),
    fecha: byId(SELECTORS.inputPrestamoFecha).value,
    cobrador: '1'
  };

  const res = await fetch(`${API_BASE}/prestamos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    mostrarToast('exito', 'Préstamo registrado');
    byId(SELECTORS.modalPrestamo)?.classList.add('hidden');
    byId(SELECTORS.formPrestamo)?.reset();

    const nuevos = await fetchWithAuth(`${API_BASE}/prestamos/`);
    prestamosGlobal = nuevos;
    renderTablaPrestamos(nuevos);
  } else {
    mostrarToast('error', 'Error al registrar préstamo');
  }
});

// Pago: submit
byId(SELECTORS.formPago)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const data = {
    prestamo: byId(SELECTORS.selectPagoPrestamo).value,
    monto_pagado: byId(SELECTORS.inputPagoMonto).value,
    fecha: byId(SELECTORS.inputPagoFecha).value
  };

  const res = await fetch(`${API_BASE}/pagos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    byId(SELECTORS.modalPago)?.classList.add('hidden');
    byId(SELECTORS.formPago)?.reset();
    await cargarPagosFiltrados();
    mostrarToast('exito', 'Pago registrado con éxito');
  } else {
    mostrarToast('error', 'Error al registrar el pago');
  }
});

/* ============================================================================
 * Eliminar (delegación + modal confirmación)
 * ==========================================================================*/
function onActionClick(e) {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;

  const id = btn.dataset.id;
  const tipo = btn.dataset.type; // 'deudor' | 'cobrador'
  showConfirmModal(tipo, id, btn.getAttribute('aria-label') || '');
}

function showConfirmModal(tipo, id, label) {
  pendingDelete = { tipo, id };
  const overlay = byId('mp-confirm-overlay');
  const msg = byId('mp-confirm-message');
  if (msg) msg.textContent = label || `¿Eliminar ${tipo} ${id}?`;
  overlay?.classList.remove('hidden');
}
function hideConfirmModal() { byId('mp-confirm-overlay')?.classList.add('hidden'); }

async function handleDelete(tipo, id) {
  const token = localStorage.getItem('token');
  const endpoint = tipo === 'deudor' ? `${API_BASE}/deudores/${id}/` : `${API_BASE}/usuarios/${id}/`;

  try {
    const res = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    if (res.ok) {
      if (tipo === 'deudor') {
        deudoresGlobal = deudoresGlobal.filter(d => String(d.id) !== String(id));
        deudoresMap.delete(String(id));
        setText(SELECTORS.deudoresCount, deudoresGlobal.length);
        renderTablaDeudores(deudoresGlobal);
      } else {
        usuariosGlobal = usuariosGlobal.filter(u => String(u.id) !== String(id));
        usuariosMap.delete(String(id));
        setText(SELECTORS.usuariosCount, usuariosGlobal.length);
        renderTablaCobradores(usuariosGlobal);
        poblarFiltroCobrador(usuariosGlobal);
        cargarOpcionesCobradores(usuariosGlobal);
      }
      mostrarToast('exito', 'Eliminado correctamente');
    } else {
      let msg = 'No se pudo eliminar. Verifica que no tenga préstamos/pagos asociados.';
      try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
      mostrarToast('error', msg);
    }
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error de red al eliminar');
  }
}

/* ============================================================================
 * Toolbar por tabla: paginación + export
 * ==========================================================================*/
function ensureTableToolbars() {
  mountToolbar(SELECTORS.tablaDeudores,   'deudores',   'deudores');
  mountToolbar(SELECTORS.tablaCobradores, 'cobradores', 'cobradores');
  mountToolbar(SELECTORS.tablaPrestamos,  'prestamos',  'prestamos');
  mountToolbar(SELECTORS.tablaPagos,      'pagos',      'pagos');
}

function mountToolbar(tbodyId, key, fileBase) {
  const tbody = byId(tbodyId); if (!tbody) return;
  const scroll = tbody.closest('.table-scroll'); if (!scroll) return;

  // Toolbar (debajo de la tabla)
  const bar = document.createElement('div');
  bar.className = 'table-toolbar';
  bar.innerHTML = `
    <div class="left flex items-center gap-2">
      <button id="exp-${key}-xls" class="export-btn">Exportar Excel</button>
    </div>
    <div class="right pager">
      <label class="text-sm text-gray-600">Filas:
        <select id="pgs-${key}" class="page-size">
          <option>10</option><option>25</option><option>50</option><option>100</option>
        </select>
      </label>
      <button id="pg-${key}-prev" class="pager-btn" aria-label="Página anterior">«</button>
      <span id="pg-${key}-info" class="text-sm text-gray-700">1 / 1</span>
      <button id="pg-${key}-next" class="pager-btn" aria-label="Página siguiente">»</button>
    </div>`;
  scroll.insertAdjacentElement('afterend', bar);

  // Listeners export
  byId(`exp-${key}-xls`)?.addEventListener('click', () => exportTable(key, 'xls', fileBase));

  // Listeners paginación
  byId(`pgs-${key}`)?.addEventListener('change', (e) => {
    const n = parseInt(e.target.value, 10) || 10;
    paging[key].pageSize = n; paging[key].page = 1;
    rerenderPage(key);
  });
  byId(`pg-${key}-prev`)?.addEventListener('click', () => { paging[key].page = Math.max(1, paging[key].page - 1); rerenderPage(key); });
  byId(`pg-${key}-next`)?.addEventListener('click', () => { paging[key].page = Math.min(pageCount(key), paging[key].page + 1); rerenderPage(key); });

  // Inicializa selector
  byId(`pgs-${key}`).value = String(paging[key].pageSize);
}

function updateToolbar(key) {
  const info = byId(`pg-${key}-info`), prev = byId(`pg-${key}-prev`), next = byId(`pg-${key}-next`);
  if (!info || !prev || !next) return;
  const pc = pageCount(key);
  const p = Math.min(paging[key].page, pc);
  paging[key].page = p;
  info.textContent = `${p} / ${pc}`;
  prev.disabled = p <= 1;
  next.disabled = p >= pc;
}

function rerenderPage(key) {
  if (key === 'deudores') renderTablaDeudoresPage();
  else if (key === 'cobradores') renderTablaCobradoresPage();
  else if (key === 'prestamos') renderTablaPrestamosPage();
  else if (key === 'pagos') renderTablaPagosPage();
  updateToolbar(key);
}

/* ============================================================================
 * Export CSV / Excel
 * ==========================================================================*/
function exportTable(key, fmt = 'csv', fileBase = 'export') {
  const { headers, rows } = collectDataFor(key);
  if (!headers.length) return;

  if (fmt === 'csv') {
    const csv = toCSV([headers, ...rows]);
    downloadBlob(csv, `${fileBase}.csv`, 'text/csv;charset=utf-8;');
  } else {
    const html = toHTMLTable(headers, rows);
    downloadBlob(html, `${fileBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
  }
}

function collectDataFor(key) {
  if (key === 'deudores') {
    const headers = ['Nombre', 'Identificación', 'Teléfono', 'Dirección', 'Tipo'];
    const rows = (paging.deudores.view || []).map(d => [
      `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim(),
      d.id ?? '',
      d.telefono ?? '',
      d.direccion ?? '',
      d.tipo == '1' ? 'normal' : (d.tipo == '2' ? 'especial' : '')
    ]);
    return { headers, rows };
  }
  if (key === 'cobradores') {
    const headers = ['Nombre', 'Identificación', 'Teléfono'];
    const rows = (paging.cobradores.view || []).map(c => [
      `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim(),
      c.identificacion ?? '',
      c.telefono ?? ''
    ]);
    return { headers, rows };
  }
  if (key === 'prestamos') {
    const headers = ['Deudor', 'Monto', 'Saldo Pendiente', 'Meses', 'Fecha', 'Estado', 'Cobrador'];
    const rows = (paging.prestamos.view || []).map(p => [
      deudoresMap.get(String(p.deudor)) || `ID: ${p.deudor}`,
      Number(p.monto) || 0,
      Number(p.saldo_pendiente) || 0,
      p.meses ?? '',
      formatearFecha(p.fecha),
      p.estado === 1 ? 'Pendiente' : (p.estado === 2 ? 'Pagado' : (p.estado === 3 ? 'En mora' : 'Desconocido')),
      usuariosMap.get(String(p.cobrador)) || `ID: ${p.cobrador}`
    ]);
    return { headers, rows };
  }
  if (key === 'pagos') {
    const headers = ['Deudor', 'Cobrador', 'Monto', 'Fecha'];
    const rows = (paging.pagos.view || []).map(p => [
      getNombreDeudorDesdePago(p),
      getNombreCobradorDesdePago(p),
      Number(p.monto_pagado) || 0,
      formatearFecha(p.fecha)
    ]);
    return { headers, rows };
  }
  return { headers: [], rows: [] };
}

function toCSV(matrix) {
  return matrix.map(row =>
    row.map(cell => {
      let v = cell ?? '';
      if (typeof v === 'number') v = String(v);
      v = String(v);
      if (/[",\n;]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(',')
  ).join('\n');
}

function toHTMLTable(headers, rows) {
  const h = `<tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr>`;
  const r = rows.map(cells => `<tr>${cells.map(c => `<td>${escapeHTML(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${h}${r}</table></body></html>`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ============================================================================
 * Utilidades UI
 * ==========================================================================*/
function cargarOpcionesCobradores(usuarios) {
  const select = byId(SELECTORS.selectDeudorCobrador);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Cobrador</option>';
  usuarios.filter(u => u.rol === 2).forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.nombre} ${c.apellido}`;
    select.appendChild(option);
  });
}

function poblarFiltroCobrador(usuarios) {
  const select = byId(SELECTORS.filtroCobrador);
  if (!select) return;
  select.innerHTML = '<option value="">Todos</option>';
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.nombre} ${u.apellido}`;
    select.appendChild(opt);
  });
}

function mostrarToast(tipo = 'exito', mensaje = '') {
  const id = tipo === 'error' ? SELECTORS.toastError : SELECTORS.toastExito;
  const toast = byId(id); if (!toast) return;
  toast.textContent = mensaje || (tipo === 'error' ? 'Ocurrió un error' : 'Acción exitosa');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// helpers
function byId(id) { return document.getElementById(id); }
function setText(id, value) { const el = byId(id); if (el) el.textContent = String(value); }
function escapeHTML(v) {
  if (v === null || v === undefined) return '';
  return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ============================================================================
 * Confirm UI (inyectado dinámicamente)
 * ==========================================================================*/
function ensureConfirmUI() {
  if (byId('mp-confirm-overlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'mp-confirm-overlay';
  wrap.className = 'fixed inset-0 z-[100] hidden bg-black/50 backdrop-blur-sm';
  wrap.innerHTML = `
    <div class="mx-auto mt-28 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
      <h3 class="text-lg font-semibold mb-2">Confirmar eliminación</h3>
      <p id="mp-confirm-message" class="text-sm text-gray-600">¿Eliminar?</p>
      <div class="mt-6 flex justify-end gap-2">
        <button id="mp-confirm-cancel" class="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Cancelar</button>
        <button id="mp-confirm-ok" class="rounded-xl bg-black px-4 py-2 text-white hover:bg-gray-900">Eliminar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}
