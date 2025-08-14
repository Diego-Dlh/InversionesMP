'use strict';

import { fetchWithAuth } from './api.js';

const API_BASE = 'https://inversiones-api.onrender.com/api';

const SELECTORS = {
  // acciones
  logoutBtn: 'logout-btn',

  // filtros
  filtroMes: 'filtro-mes',
  buscarDeudor: 'buscar-deudor',
  buscarPrestamo: 'buscar-prestamo',
  filtroEstado: 'filtro-estado',

  // modales + forms
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

  // resumen (cards)
  deudoresCount: 'deudores-count',
  prestamosCount: 'prestamos-count',
  pagosCount: 'pagos-count',
  totalRecaudado: 'total-recaudado',

  // toasts
  toastError: 'toast-error',
  toastExito: 'toast-exito',

  // préstamo (inputs)
  selectPrestamoDeudor: 'prestamo-deudor',
  inputPrestamoMonto: 'prestamo-monto',
  inputPrestamoInteres: 'prestamo-interes',
  inputPrestamoMeses: 'prestamo-meses',
  inputPrestamoFecha: 'prestamo-fecha',

  // pago
  selectPagoPrestamo: 'pago-prestamo',
  inputPagoMonto: 'pago-monto',
  inputPagoFecha: 'pago-fecha',

  // deudor
  selectDeudorCobrador: 'deudor-cobrador',
  deudorNombre: 'deudor-nombre',
  deudorApellido: 'deudor-apellido',
  deudorIdentificacion: 'deudor-identificacion',
  deudorTelefono: 'deudor-telefono',
  deudorDireccion: 'deudor-direccion',
  deudorTipo: 'deudor-tipo',
};

/* ===========================================
 * Estado
 * ===========================================*/
let deudoresGlobal = [];
let prestamosGlobal = [];

const paging = {
  deudores: { page: 1, pageSize: 10, view: [] },
  prestamos: { page: 1, pageSize: 10, view: [] },
  pagos: { page: 1, pageSize: 10, view: [] }
};
const setView = (key, arr) => { paging[key].view = Array.isArray(arr) ? arr : []; paging[key].page = 1; };
const pageCount = (key) => Math.max(1, Math.ceil((paging[key].view.length || 0) / paging[key].pageSize));
const slicePage = (key) => {
  const { page, pageSize, view } = paging[key];
  const start = (page - 1) * pageSize;
  return view.slice(start, start + pageSize);
};

/* ===========================================
 * Bootstrap
 * ===========================================*/
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Guardia de rol
  const rol = localStorage.getItem('rol');
  if (rol !== '2') {
    mostrarToast('error', 'Acceso no autorizado');
    window.location.href = 'index.html';
    return;
  }

  ensureConfirmUI();
  ensureTableToolbars();

  try {
    const [deudores, prestamos, pagos] = await Promise.all([
      fetchWithAuth(`${API_BASE}/deudores/`),
      fetchWithAuth(`${API_BASE}/prestamos/`),
      fetchWithAuth(`${API_BASE}/pagos`)
    ]);

    deudoresGlobal = deudores;
    prestamosGlobal = prestamos;

    // Cards
    setText(SELECTORS.deudoresCount, deudores.length);
    setText(SELECTORS.prestamosCount, prestamos.length);
    setText(SELECTORS.pagosCount, pagos.length);

    // Render inicial
    renderTablaDeudores(deudoresGlobal);
    renderTablaPrestamos(prestamosGlobal);
    renderTablaPagos(pagos);

    // Total recaudado (mes)
    await cargarPagosFiltrados();
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error cargando datos');
  }

  // Eventos globales
  byId(SELECTORS.logoutBtn)?.addEventListener('click', () => {
    localStorage.removeItem('token'); localStorage.removeItem('rol');
    window.location.href = 'index.html';
  });
  byId(SELECTORS.filtroMes)?.addEventListener('change', async (e) => {
    await cargarPagosFiltrados(e.target.value);
  });
  byId(SELECTORS.buscarDeudor)?.addEventListener('input', onBuscarDeudor);
  byId(SELECTORS.buscarPrestamo)?.addEventListener('input', aplicarFiltrosPrestamos);
  byId(SELECTORS.filtroEstado)?.addEventListener('change', aplicarFiltrosPrestamos);

  // Modales
  const modalDeudor = byId(SELECTORS.modalDeudor);
  byId(SELECTORS.btnToggleModalDeudor)?.addEventListener('click', () => modalDeudor?.classList.remove('hidden'));
  byId(SELECTORS.btnCloseModalDeudor)?.addEventListener('click', () => { modalDeudor?.classList.add('hidden'); byId(SELECTORS.formDeudor)?.reset(); });

  const modalPrestamo = byId(SELECTORS.modalPrestamo);
  byId(SELECTORS.btnToggleModalPrestamo)?.addEventListener('click', () => { cargarSelectDeudores(); modalPrestamo?.classList.remove('hidden'); });
  byId(SELECTORS.btnCloseModalPrestamo)?.addEventListener('click', () => { modalPrestamo?.classList.add('hidden'); byId(SELECTORS.formPrestamo)?.reset(); });

  const modalPago = byId(SELECTORS.modalPago);
  byId(SELECTORS.btnToggleModalPago)?.addEventListener('click', () => { cargarSelectPrestamos(); modalPago?.classList.remove('hidden'); });
  byId(SELECTORS.btnCloseModalPago)?.addEventListener('click', () => { modalPago?.classList.add('hidden'); byId(SELECTORS.formPago)?.reset(); });

  // Eliminar deudor (delegación)
  byId(SELECTORS.tablaDeudores)?.addEventListener('click', onActionClick);

  // Validaciones de número
  attachNumericSanitizers([
    SELECTORS.inputPrestamoMonto,
    SELECTORS.inputPrestamoInteres,
    SELECTORS.inputPrestamoMeses,
    SELECTORS.inputPagoMonto,
    SELECTORS.deudorIdentificacion,
    SELECTORS.deudorTelefono
  ]);

  // Preselecciona cobrador propio (oculto) en modal de deudor
  const selCobrador = byId(SELECTORS.selectDeudorCobrador);
  const myId = getUserId();
  if (selCobrador && myId) {
    selCobrador.innerHTML = `<option value="${myId}" selected>${myId}</option>`;
  }
}

/* ===========================================
 * Render tablas
 * ===========================================*/
function renderTablaDeudores(deudores) {
  const ordenados = sortByNombre(deudores, d => `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim());
  setView('deudores', ordenados);
  renderTablaDeudoresPage();
  updateToolbar('deudores');
}
function renderTablaDeudoresPage() {
  const tbody = byId(SELECTORS.tablaDeudores); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('deudores').forEach(d => {
    const nombre = `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim();
    const tipo = d.tipo == '1' ? 'normal' : (d.tipo == '2' ? 'especial' : '');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombre)}</td>
      <td class="p-2">${escapeHTML(d.id)}</td>
      <td class="p-2">${escapeHTML(d.telefono ?? '')}</td>
      <td class="p-2">${escapeHTML(d.direccion ?? '')}</td>
      <td class="p-2">${tipo}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete" data-type="deudor" data-id="${String(d.id)}"
                aria-label="Eliminar deudor ${escapeHTML(nombre)}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderTablaPrestamos(prestamos) {
  const ordenados = sortByFechaDesc(prestamos, p => p.fecha);
  setView('prestamos', ordenados);
  renderTablaPrestamosPage();
  updateToolbar('prestamos');
}
function renderTablaPrestamosPage() {
  const tbody = byId(SELECTORS.tablaPrestamos); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('prestamos').forEach(p => {
    const deudor = (deudoresGlobal.find(d => d.id === p.deudor) || {});
    const nombreDeudor = `${deudor.nombre ?? ''} ${deudor.apellido ?? ''}`.trim() || `ID: ${p.deudor}`;
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
      <td class="p-2"><span class="${estadoClase}">${estadoTexto}</span></td>`;
    tbody.appendChild(tr);
  });
}

function renderTablaPagos(pagos) {
  const ordenados = sortByFechaDesc(pagos, p => p.fecha);
  setView('pagos', ordenados);
  renderTablaPagosPage();
  updateToolbar('pagos');
}
function renderTablaPagosPage() {
  const tbody = byId(SELECTORS.tablaPagos); if (!tbody) return;
  tbody.innerHTML = '';
  slicePage('pagos').forEach(p => {
    const prestamo = prestamosGlobal.find(pr => pr.id === p.prestamo);
    const deudor = prestamo ? deudoresGlobal.find(d => d.id === prestamo.deudor) : null;
    const nombreDeudor = deudor ? `${deudor.nombre} ${deudor.apellido}` : 'Deudor no encontrado';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${escapeHTML(nombreDeudor)}</td>
      <td class="p-2">${Number(p.monto_pagado).toLocaleString('es-CO')}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ===========================================
 * Filtros / Fetch
 * ===========================================*/
function onBuscarDeudor() {
  const q = byId(SELECTORS.buscarDeudor).value.toLowerCase();
  const filtrados = deudoresGlobal.filter(d => {
    const nombre = (`${d.nombre ?? ''} ${d.apellido ?? ''}`).toLowerCase();
    const identificacion = (d.identificacion || d.id || '').toString().toLowerCase();
    return nombre.includes(q) || identificacion.includes(q);
  });
  renderTablaDeudores(filtrados);
}

function aplicarFiltrosPrestamos() {
  const texto = (byId(SELECTORS.buscarPrestamo)?.value || '').toLowerCase();
  const estado = byId(SELECTORS.filtroEstado)?.value || '';

  const filtrados = (prestamosGlobal || []).filter(p => {
    const deudor = deudoresGlobal.find(d => d.id === p.deudor);
    const nombre = (deudor ? `${deudor.nombre} ${deudor.apellido}` : '').toLowerCase();
    const byNombre = nombre.includes(texto);
    const byEstado = !estado || String(p.estado) === estado;
    return byNombre && byEstado;
  });
  renderTablaPrestamos(filtrados);
}

async function cargarPagosFiltrados(mes = '') {
  const url = mes ? `${API_BASE}/pagos/?mes=${mes}` : `${API_BASE}/pagos/`;
  const pagos = await fetchWithAuth(url);
  renderTablaPagos(pagos);
  const totalMes = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);
  setText(SELECTORS.totalRecaudado, totalMes.toLocaleString('es-CO'));
}

/* ===========================================
 * Formularios
 * ===========================================*/
// Deudor: crear (asignar SIEMPRE al cobrador logueado)
byId(SELECTORS.formDeudor)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm([
    { id: SELECTORS.deudorNombre, type: 'text' },
    { id: SELECTORS.deudorApellido, type: 'text' },
    { id: SELECTORS.deudorIdentificacion, type: 'numberPositive' },
    { id: SELECTORS.deudorTelefono, type: 'numberPositive' },
    { id: SELECTORS.deudorDireccion, type: 'text' },
    { id: SELECTORS.deudorTipo, type: 'select' }
  ])) return;

  const myId = getUserId();
  if (!myId) { mostrarToast('error', 'No se pudo identificar al usuario'); return; }

  const data = {
    nombre: byId(SELECTORS.deudorNombre).value.trim(),
    apellido: byId(SELECTORS.deudorApellido).value.trim(),
    id: byId(SELECTORS.deudorIdentificacion).value.trim(),
    telefono: byId(SELECTORS.deudorTelefono).value.trim(),
    direccion: byId(SELECTORS.deudorDireccion).value.trim(),
    tipo: byId(SELECTORS.deudorTipo).value,
    cobrador_id: myId
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
    const nuevos = await fetchWithAuth(`${API_BASE}/deudores/`);
    deudoresGlobal = nuevos;
    setText(SELECTORS.deudoresCount, nuevos.length);
    renderTablaDeudores(nuevos);
    mostrarToast('exito', 'Deudor creado con éxito');
  } else {
    mostrarToast('error', 'Error al crear el deudor');
  }
});

// Préstamo: abrir selects
function cargarSelectDeudores() {
  const select = byId(SELECTORS.selectPrestamoDeudor);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Deudor</option>';
  deudoresGlobal.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.nombre} ${d.apellido}`;
    select.appendChild(opt);
  });
}

// Pago: abrir select préstamos
function cargarSelectPrestamos() {
  const select = byId(SELECTORS.selectPagoPrestamo);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Préstamo</option>';
  prestamosGlobal.forEach(p => {
    const deudor = deudoresGlobal.find(d => d.id === p.deudor);
    const nombre = deudor ? `${deudor.nombre} ${deudor.apellido}` : `ID: ${p.deudor}`;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${nombre} - $${Number(p.saldo_pendiente).toLocaleString('es-CO')}`;
    select.appendChild(opt);
  });
}

// Préstamo: submit (backend asigna cobrador=request.user)
byId(SELECTORS.formPrestamo)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm([
    { id: SELECTORS.selectPrestamoDeudor, type: 'select' },
    { id: SELECTORS.inputPrestamoMonto, type: 'numberPositive' },
    { id: SELECTORS.inputPrestamoInteres, type: 'numberRange', min: 1, max: 100 },
    { id: SELECTORS.inputPrestamoMeses, type: 'numberPositive' },
    { id: SELECTORS.inputPrestamoFecha, type: 'date' }
  ])) return;

  const token = localStorage.getItem('token');
  const data = {
    deudor: parseInt(byId(SELECTORS.selectPrestamoDeudor).value, 10),
    monto: parseInt(byId(SELECTORS.inputPrestamoMonto).value, 10),
    interes: parseInt(byId(SELECTORS.inputPrestamoInteres).value, 10),
    meses: parseInt(byId(SELECTORS.inputPrestamoMeses).value, 10),
    fecha: byId(SELECTORS.inputPrestamoFecha).value
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
    setText(SELECTORS.prestamosCount, nuevos.length);
    renderTablaPrestamos(nuevos);
    cargarSelectPrestamos();
  } else {
    mostrarToast('error', 'Error al registrar préstamo');
  }
});

// Pago: submit
byId(SELECTORS.formPago)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm([
    { id: SELECTORS.selectPagoPrestamo, type: 'select' },
    { id: SELECTORS.inputPagoMonto, type: 'numberPositive' },
    { id: SELECTORS.inputPagoFecha, type: 'date' }
  ])) return;

  // Validación: monto <= saldo
  const prestamoId = parseInt(byId(SELECTORS.selectPagoPrestamo).value, 10);
  const prestamo = prestamosGlobal.find(p => p.id === prestamoId);
  const monto = parseInt(byId(SELECTORS.inputPagoMonto).value, 10);
  if (prestamo && Number.isFinite(monto) && monto > prestamo.saldo_pendiente) {
    const el = byId(SELECTORS.inputPagoMonto);
    el.setCustomValidity(`El monto supera el saldo pendiente ($${Number(prestamo.saldo_pendiente).toLocaleString('es-CO')}).`);
    el.reportValidity();
    return;
  } else {
    byId(SELECTORS.inputPagoMonto).setCustomValidity('');
  }

  const token = localStorage.getItem('token');
  const data = { prestamo: prestamoId, monto_pagado: monto, fecha: byId(SELECTORS.inputPagoFecha).value };

  const res = await fetch(`${API_BASE}/pagos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    byId(SELECTORS.modalPago)?.classList.add('hidden');
    byId(SELECTORS.formPago)?.reset();

    // 1) Card de pagos y total del mes
    const pagosAll = await fetchWithAuth(`${API_BASE}/pagos`);
    setText(SELECTORS.pagosCount, pagosAll.length);
    await cargarPagosFiltrados(byId(SELECTORS.filtroMes)?.value || '');

    // 2) Refrescar préstamos (saldo/estado)
    const nuevosPrestamos = await fetchWithAuth(`${API_BASE}/prestamos/`);
    prestamosGlobal = nuevosPrestamos;
    renderTablaPrestamos(nuevosPrestamos);
    cargarSelectPrestamos();

    mostrarToast('exito', 'Pago registrado con éxito');
  } else {
    mostrarToast('error', 'Error al registrar el pago');
  }
});

/* ===========================================
 * Toolbar (paginación + export)
 * ===========================================*/
function ensureTableToolbars() {
  mountToolbar(SELECTORS.tablaDeudores,   'deudores',   'deudores');
  mountToolbar(SELECTORS.tablaPrestamos,  'prestamos',  'prestamos');
  mountToolbar(SELECTORS.tablaPagos,      'pagos',      'pagos');
}
function mountToolbar(tbodyId, key, fileBase) {
  const tbody = byId(tbodyId); if (!tbody) return;
  const scroll = tbody.closest('.table-scroll'); if (!scroll) return;

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

  byId(`exp-${key}-xls`)?.addEventListener('click', () => exportTable(key, 'xls', fileBase));
  byId(`pgs-${key}`)?.addEventListener('change', (e) => { paging[key].pageSize = parseInt(e.target.value, 10) || 10; paging[key].page = 1; rerenderPage(key); });
  byId(`pg-${key}-prev`)?.addEventListener('click', () => { paging[key].page = Math.max(1, paging[key].page - 1); rerenderPage(key); });
  byId(`pg-${key}-next`)?.addEventListener('click', () => { paging[key].page = Math.min(pageCount(key), paging[key].page + 1); rerenderPage(key); });
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
  else if (key === 'prestamos') renderTablaPrestamosPage();
  else if (key === 'pagos') renderTablaPagosPage();
  updateToolbar(key);
}

/* ===========================================
 * Export helpers
 * ===========================================*/
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
  if (key === 'prestamos') {
    const headers = ['Deudor', 'Monto', 'Saldo Pendiente', 'Meses', 'Fecha', 'Estado'];
    const rows = (paging.prestamos.view || []).map(p => {
      const deudor = deudoresGlobal.find(d => d.id === p.deudor);
      const nombre = deudor ? `${deudor.nombre} ${deudor.apellido}` : `ID: ${p.deudor}`;
      return [
        nombre,
        Number(p.monto) || 0,
        Number(p.saldo_pendiente) || 0,
        p.meses ?? '',
        formatearFecha(p.fecha),
        p.estado === 1 ? 'Pendiente' : (p.estado === 2 ? 'Pagado' : (p.estado === 3 ? 'En mora' : 'Desconocido'))
      ];
    });
    return { headers, rows };
  }
  if (key === 'pagos') {
    const headers = ['Deudor', 'Monto', 'Fecha'];
    const rows = (paging.pagos.view || []).map(p => {
      const pr = prestamosGlobal.find(x => x.id === p.prestamo);
      const deudor = pr ? deudoresGlobal.find(d => d.id === pr.deudor) : null;
      const nombre = deudor ? `${deudor.nombre} ${deudor.apellido}` : 'Deudor no encontrado';
      return [nombre, Number(p.monto_pagado) || 0, formatearFecha(p.fecha)];
    });
    return { headers, rows };
  }
  return { headers: [], rows: [] };
}
function toCSV(matrix) {
  return matrix.map(row => row.map(cell => {
    let v = cell ?? '';
    if (typeof v === 'number') v = String(v);
    v = String(v);
    if (/[",\n;]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(',')).join('\n');
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

/* ===========================================
 * Helpers UI / Validaciones
 * ===========================================*/
function mostrarToast(tipo = 'exito', mensaje = '') {
  const id = tipo === 'error' ? SELECTORS.toastError : SELECTORS.toastExito;
  const toast = byId(id); if (!toast) return;
  toast.textContent = mensaje || (tipo === 'error' ? 'Ocurrió un error' : 'Acción exitosa');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
function validateForm(specs) {
  let ok = true;
  for (const s of specs) {
    const el = byId(s.id);
    if (!el) continue;
    const v = (el.value ?? '').toString().trim();
    let err = '';

    if (s.type === 'text') { if (!v) err = 'Este campo es obligatorio.'; }
    else if (s.type === 'select') { if (!v) err = 'Selecciona una opción.'; }
    else if (s.type === 'numberPositive') {
      const n = parseInt(v, 10);
      if (!v || Number.isNaN(n) || n <= 0) err = 'Ingresa un número válido (> 0).';
    } else if (s.type === 'numberRange') {
      const n = parseInt(v, 10);
      if (!v || Number.isNaN(n)) err = 'Ingresa un número válido.';
      else {
        if (s.min != null && n < s.min) err = `Debe ser ≥ ${s.min}.`;
        if (!err && s.max != null && n > s.max) err = `Debe ser ≤ ${s.max}.`;
      }
    } else if (s.type === 'date') { if (!v || Number.isNaN(Date.parse(v))) err = 'Fecha inválida.'; }

    el.setCustomValidity(err);
    if (err && ok) el.reportValidity();
    if (err) ok = false;
  }
  return ok;
}
function attachNumericSanitizers(ids = []) {
  ids.forEach(id => {
    const el = byId(id); if (!el) return;
    el.setAttribute('inputmode', 'numeric');
    el.addEventListener('input', () => {
      const cur = el.value;
      const clean = cur.replace(/[^\d]/g, '');
      if (cur !== clean) el.value = clean;
      if (el.validity.customError) el.setCustomValidity('');
    });
  });
}
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

/* ===========================================
 * Acciones (eliminar deudor)
 * ===========================================*/
function onActionClick(e) {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;
  const id = btn.dataset.id;
  showConfirmModal('deudor', id, btn.getAttribute('aria-label') || '');
}
function showConfirmModal(tipo, id, label) {
  window._pendingDelete = { tipo, id };
  const overlay = byId('mp-confirm-overlay');
  const msg = byId('mp-confirm-message');
  if (msg) msg.textContent = label || `¿Eliminar ${tipo} ${id}?`;
  overlay?.classList.remove('hidden');
}
function hideConfirmModal() { byId('mp-confirm-overlay')?.classList.add('hidden'); }
byId('mp-confirm-cancel')?.addEventListener('click', () => { window._pendingDelete = null; hideConfirmModal(); });
byId('mp-confirm-ok')?.addEventListener('click', async () => {
  const pending = window._pendingDelete; window._pendingDelete = null; hideConfirmModal();
  if (!pending) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/deudores/${pending.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      deudoresGlobal = deudoresGlobal.filter(d => String(d.id) !== String(pending.id));
      setText(SELECTORS.deudoresCount, deudoresGlobal.length);
      renderTablaDeudores(deudoresGlobal);
      mostrarToast('exito', 'Eliminado correctamente');
    } else {
      mostrarToast('error', 'No se pudo eliminar. Verifica que no tenga préstamos/pagos asociados.');
    }
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error de red al eliminar');
  }
});

/* ===========================================
 * Utilidades varias
 * ===========================================*/
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function byId(id) { return document.getElementById(id); }
function setText(id, value) { const el = byId(id); if (el) el.textContent = String(value); }
function escapeHTML(v) {
  if (v == null) return '';
  return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
const norm = (s) => (s ?? '').toString().toLocaleLowerCase('es');
const cmpText = (a, b) => norm(a).localeCompare(norm(b), 'es', { sensitivity: 'base' });
const toTime = (v) => new Date(v).getTime() || 0;
const sortByNombre = (arr, getNombre) => [...arr].sort((a, b) => cmpText(getNombre(a), getNombre(b)));
const sortByFechaDesc = (arr, getFecha) => [...arr].sort((a, b) => toTime(getFecha(b)) - toTime(getFecha(a)));

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch { return {}; }
}
function toPositiveInt(x) { const n = parseInt(x, 10); return Number.isInteger(n) && n > 0 ? n : null; }
function getUserId() {
  const idFromLS = toPositiveInt(localStorage.getItem('usuario_id'));
  if (idFromLS) return idFromLS;
  const token = localStorage.getItem('token'); if (!token) return null;
  const p = parseJwt(token);
  return toPositiveInt(p?.id ?? p?.user_id ?? p?.uid ?? p?.sub);
}
