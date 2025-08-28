'use strict';

/* ============================================================================
 * Imports
 * ==========================================================================*/
import { fetchWithAuth } from './api.js';
import { API_BASE } from './config.js';


/* ============================================================================
 * Config / Selectores
 * ==========================================================================*/

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

  // resumen (cards)
  deudoresCount: 'deudores-count',
  prestamosCount: 'prestamos-count',
  pagosCount: 'pagos-count',
  usuariosCount: 'usuarios-count',
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

// --- MENÚ USUARIO / PASSWORD (nuevos selectores, sin alterar los existentes) ---
const SELECTORS_EXTRAS = {
  userMenuToggle: 'user-menu-toggle',
  userMenu: 'user-menu',
  changePasswordBtn: 'change-password-btn',
  modalPassword: 'modal-password',
  btnCloseModalPassword: 'btn-close-modal-password',
  btnCancelarPassword: 'btn-cancelar-password',
  formPassword: 'form-password',
  pwdActual: 'pwd-actual',
  pwdNueva: 'pwd-nueva',
  pwdConfirmar: 'pwd-confirmar',
  usuarioNombreHeader: 'usuario-nombre-header'
};

/* ============================================================================
 * Estado global
 * ==========================================================================*/
let deudoresMap = new Map();
let usuariosMap = new Map();

let deudoresGlobal = [];
let prestamosGlobal = [];
let usuariosGlobal = [];
let pendingDelete = null; // { tipo: 'deudor' | 'cobrador', id }

/* ----- Estado de paginación/vista por tabla ----- */
const paging = {
  deudores: { page: 1, pageSize: 10, view: [] },
  cobradores: { page: 1, pageSize: 10, view: [] },
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

/* ----- Estado de orden por tabla ----- */
const sortState = {
  deudores: 'fecha_desc',     // Por defecto: fecha de creación (recientes primero)
  prestamos: 'fecha_desc',    // Mantiene tu comportamiento actual
  pagos: 'fecha_desc',        // Mantiene tu comportamiento actual
  cobradores: 'nombre_asc'    // Mantiene tu comportamiento actual
};

function applySort(tableKey, data) {
  const key = sortState[tableKey];
  const arr = [...(data || [])];

  if (tableKey === 'deudores') {
    switch (key) {
      case 'fecha_desc': return arr.sort((a,b) => toTime(b.fecha_creacion) - toTime(a.fecha_creacion));
      case 'fecha_asc':  return arr.sort((a,b) => toTime(a.fecha_creacion) - toTime(b.fecha_creacion));
      case 'nombre_asc': return arr.sort((a,b) => cmpText(`${a.nombre} ${a.apellido}`, `${b.nombre} ${b.apellido}`));
      case 'nombre_desc':return arr.sort((a,b) => cmpText(`${b.nombre} ${b.apellido}`, `${a.nombre} ${a.apellido}`));
      case 'id_asc':     return arr.sort((a,b) => (a.id??0) - (b.id??0));
      case 'id_desc':    return arr.sort((a,b) => (b.id??0) - (a.id??0));
      case 'tipo_asc':   return arr.sort((a,b) => (a.tipo??0) - (b.tipo??0));
      case 'tipo_desc':  return arr.sort((a,b) => (b.tipo??0) - (a.tipo??0));
      default: return arr;
    }
  }

  if (tableKey === 'prestamos') {
    switch (key) {
      case 'fecha_desc': return arr.sort((a,b) => toTime(b.fecha) - toTime(a.fecha));
      case 'fecha_asc':  return arr.sort((a,b) => toTime(a.fecha) - toTime(b.fecha));
      case 'monto_desc': return arr.sort((a,b) => (b.monto??0) - (a.monto??0));
      case 'monto_asc':  return arr.sort((a,b) => (a.monto??0) - (b.monto??0));
      case 'saldo_desc': return arr.sort((a,b) => (b.saldo_pendiente??0) - (a.saldo_pendiente??0));
      case 'saldo_asc':  return arr.sort((a,b) => (a.saldo_pendiente??0) - (b.saldo_pendiente??0));
      case 'meses_desc': return arr.sort((a,b) => (b.meses??0) - (a.meses??0));
      case 'meses_asc':  return arr.sort((a,b) => (a.meses??0) - (b.meses??0));
      case 'estado_asc': return arr.sort((a,b) => (a.estado??0) - (b.estado??0));
      case 'estado_desc':return arr.sort((a,b) => (b.estado??0) - (a.estado??0));
      case 'deudor_asc': return arr.sort((a,b) => cmpText(deudoresMap.get(String(a.deudor)),'') - cmpText(deudoresMap.get(String(b.deudor)),''));
      case 'deudor_desc':return arr.sort((a,b) => cmpText(deudoresMap.get(String(b.deudor)),'') - cmpText(deudoresMap.get(String(a.deudor)),''));
      case 'cobrador_asc': return arr.sort((a,b) => cmpText(usuariosMap.get(String(a.cobrador)),'') - cmpText(usuariosMap.get(String(b.cobrador)),''));
      case 'cobrador_desc':return arr.sort((a,b) => cmpText(usuariosMap.get(String(b.cobrador)),'') - cmpText(usuariosMap.get(String(a.cobrador)),''));
      default: return arr;
    }
  }

  if (tableKey === 'pagos') {
    switch (key) {
      case 'fecha_desc': return arr.sort((a,b) => toTime(b.fecha) - toTime(a.fecha));
      case 'fecha_asc':  return arr.sort((a,b) => toTime(a.fecha) - toTime(b.fecha));
      case 'monto_desc': return arr.sort((a,b) => (b.monto_pagado??0) - (a.monto_pagado??0));
      case 'monto_asc':  return arr.sort((a,b) => (a.monto_pagado??0) - (b.monto_pagado??0));
      case 'deudor_asc': return arr.sort((a,b) => cmpText(getNombreDeudorDesdePago(a), getNombreDeudorDesdePago(b)));
      case 'deudor_desc':return arr.sort((a,b) => cmpText(getNombreDeudorDesdePago(b), getNombreDeudorDesdePago(a)));
      case 'cobrador_asc': return arr.sort((a,b) => cmpText(getNombreCobradorDesdePago(a), getNombreCobradorDesdePago(b)));
      case 'cobrador_desc':return arr.sort((a,b) => cmpText(getNombreCobradorDesdePago(b), getNombreCobradorDesdePago(a)));
      default: return arr;
    }
  }

  if (tableKey === 'cobradores') {
    switch (key) {
      case 'nombre_asc': return arr.sort((a,b) => cmpText(`${a.nombre} ${a.apellido}`, `${b.nombre} ${b.apellido}`));
      case 'nombre_desc':return arr.sort((a,b) => cmpText(`${b.nombre} ${b.apellido}`, `${a.nombre} ${a.apellido}`));
      case 'ident_asc':  return arr.sort((a,b) => (a.identificacion??0) - (b.identificacion??0));
      case 'ident_desc': return arr.sort((a,b) => (b.identificacion??0) - (a.identificacion??0));
      case 'tel_asc':    return arr.sort((a,b) => cmpText(a.telefono, b.telefono));
      case 'tel_desc':   return arr.sort((a,b) => cmpText(b.telefono, a.telefono));
      default: return arr;
    }
  }

  return arr;
}

function getSortOptions(tableKey) {
  if (tableKey === 'deudores') {
    return [
      ['fecha_desc','Fecha creación (recientes)'],
      ['fecha_asc','Fecha creación (antiguos)'],
      ['nombre_asc','Nombre (A→Z)'],
      ['nombre_desc','Nombre (Z→A)'],
      ['id_asc','Identificación (↑)'],
      ['id_desc','Identificación (↓)'],
      ['tipo_asc','Tipo (↑)'],
      ['tipo_desc','Tipo (↓)'],
    ];
  }
  if (tableKey === 'prestamos') {
    return [
      ['fecha_desc','Fecha (recientes)'],
      ['fecha_asc','Fecha (antiguos)'],
      ['monto_desc','Monto (↓)'],
      ['monto_asc','Monto (↑)'],
      ['saldo_desc','Saldo (↓)'],
      ['saldo_asc','Saldo (↑)'],
      ['meses_desc','Meses (↓)'],
      ['meses_asc','Meses (↑)'],
      ['estado_asc','Estado (↑)'],
      ['estado_desc','Estado (↓)'],
      ['deudor_asc','Deudor (A→Z)'],
      ['deudor_desc','Deudor (Z→A)'],
      ['cobrador_asc','Cobrador (A→Z)'],
      ['cobrador_desc','Cobrador (Z→A)'],
    ];
  }
  if (tableKey === 'pagos') {
    return [
      ['fecha_desc','Fecha (recientes)'],
      ['fecha_asc','Fecha (antiguos)'],
      ['monto_desc','Monto (↓)'],
      ['monto_asc','Monto (↑)'],
      ['deudor_asc','Deudor (A→Z)'],
      ['deudor_desc','Deudor (Z→A)'],
      ['cobrador_asc','Cobrador (A→Z)'],
      ['cobrador_desc','Cobrador (Z→A)'],
    ];
  }
  if (tableKey === 'cobradores') {
    return [
      ['nombre_asc','Nombre (A→Z)'],
      ['nombre_desc','Nombre (Z→A)'],
      ['ident_asc','Identificación (↑)'],
      ['ident_desc','Identificación (↓)'],
      ['tel_asc','Teléfono (A→Z)'],
      ['tel_desc','Teléfono (Z→A)'],
    ];
  }
  return [];
}


/* ============================================================================
 * Bootstrap
 * ==========================================================================*/
document.addEventListener('DOMContentLoaded', async () => {
  ensureConfirmUI();      // modal confirmar (eliminar)
  ensureTableToolbars();  // paginación + export

  // Header: muestra nombre (si lo guardaste en login)
  const headerName = document.getElementById(SELECTORS_EXTRAS.usuarioNombreHeader);
  const lsNombre = localStorage.getItem('nombre');
  if (headerName && lsNombre) {
    headerName.textContent = lsNombre;
    headerName.classList.remove('hidden');
  }

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

    deudoresGlobal = deudores;
    prestamosGlobal = prestamos;
    usuariosGlobal = usuarios;

    deudores.forEach(d => deudoresMap.set(String(d.id), `${d.nombre} ${d.apellido ?? ''}`.trim()));
    usuarios.forEach(u => usuariosMap.set(String(u.id), `${u.nombre} ${u.apellido ?? ''}`.trim()));

    // cards (solo cobradores activos: rol=2)
    setText(SELECTORS.deudoresCount, deudores.length);
    setText(SELECTORS.prestamosCount, prestamos.length);
    setText(SELECTORS.pagosCount, pagos.length);
    setText(SELECTORS.usuariosCount, usuarios.filter(u => Number(u.rol) === 2).length);

    // render inicial
    renderTablaDeudores(deudoresGlobal);
    renderTablaPrestamos(prestamosGlobal);
    renderTablaCobradores(usuariosGlobal);
    cargarOpcionesCobradores(usuariosGlobal);
    poblarFiltroCobrador(usuariosGlobal);

    await cargarPagosFiltrados(); // total recaudado del mes
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error cargando datos');
  }

  // eventos globales
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
    renderTablaDeudores(filtrados);
  });

  byId(SELECTORS.buscarPrestamo)?.addEventListener('input', aplicarFiltrosPrestamos);
  byId(SELECTORS.filtroEstado)?.addEventListener('change', aplicarFiltrosPrestamos);
  byId(SELECTORS.filtroCobrador)?.addEventListener('change', aplicarFiltrosPrestamos);

  // Delegación: Eliminar (deudores y cobradores)
  byId(SELECTORS.tablaDeudores)?.addEventListener('click', onActionClick);
  byId(SELECTORS.tablaCobradores)?.addEventListener('click', onActionClick);
  byId(SELECTORS.tablaPrestamos)?.addEventListener('click', onActionClick);

  // Modales: abrir/cerrar
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

  // Confirmación (Eliminar)
  byId('mp-confirm-cancel')?.addEventListener('click', () => { pendingDelete = null; hideConfirmModal(); });
  byId('mp-confirm-ok')?.addEventListener('click', () => {
    if (!pendingDelete) return;
    const { tipo, id } = pendingDelete;
    pendingDelete = null; hideConfirmModal(); handleDelete(tipo, id);
  });

  // Validaciones en tiempo real (solo dígitos)
  attachNumericSanitizers([
    SELECTORS.inputPrestamoMonto,
    SELECTORS.inputPrestamoInteres,
    SELECTORS.inputPrestamoMeses,
    SELECTORS.inputPagoMonto,
    SELECTORS.deudorIdentificacion,
    SELECTORS.nuevoIdentificacion,
    SELECTORS.deudorTelefono,
    SELECTORS.nuevoTelefono
  ]);
// Añadir sanitizadores para inputs de texto (evita que el mensaje "Este campo es obligatorio." quede pegado)
attachTextSanitizers([
  SELECTORS.deudorNombre,
  SELECTORS.deudorApellido,
  SELECTORS.deudorDireccion
]);

  /* =======================
   * Menú de usuario + Password (NUEVO)
   * =======================*/
  initUserMenuAndPassword();
  // === Formato CO (solo estético) ===
  setupColombiaMasks();
  installPreSubmitNormalizers();

});

/* ============================================================================
 * Renderizadores + paginación
 * ==========================================================================*/
// Deudores (orden por nombre)
function renderTablaDeudores(deudores) {
  // Orden por estado seleccionado (default: fecha_desc)
  const ordenados = applySort('deudores', deudores);
  setView('deudores', ordenados);
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

// Préstamos (orden por fecha desc)
function renderTablaPrestamos(prestamos) {
  const ordenados = applySort('prestamos', prestamos);
  setView('prestamos', ordenados);
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
      <td class="p-2">${escapeHTML(nombreCobrador)}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete" data-type="prestamo" data-id="${String(p.id)}"
                aria-label="Eliminar préstamo ${escapeHTML(nombreDeudor)}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Pagos (orden por fecha desc)
function renderTablaPagos(pagos) {
  const ordenados = applySort('pagos', pagos);
  setView('pagos', ordenados);
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

// Cobradores (oculta admin: rol 1)
function renderTablaCobradores(cobradores) {
  const soloCobradores = (cobradores || []).filter(u => Number(u.rol) === 2);
  const ordenados = applySort('cobradores', soloCobradores);
  setView('cobradores', ordenados);
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
  if (!prestamo) return 'Préstamo no encontrado';
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
 * Formularios + Validaciones y actualizaciones de cards
 * ==========================================================================*/
// Cobrador: crear
byId(SELECTORS.formCobrador)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm([
    { id: SELECTORS.nuevoNombre, type: 'text' },
    { id: SELECTORS.nuevoApellido, type: 'text' },
    { id: SELECTORS.nuevoIdentificacion, type: 'numberPositive' },
    { id: SELECTORS.nuevoTelefono, type: 'numberPositive' }
  ])) return;

  const data = {
    nombre: byId(SELECTORS.nuevoNombre).value.trim(),
    apellido: byId(SELECTORS.nuevoApellido).value.trim(),
    identificacion: byId(SELECTORS.nuevoIdentificacion).value.trim(),
    telefono: byId(SELECTORS.nuevoTelefono).value.trim(),
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
    usuariosGlobal = await fetchWithAuth(`${API_BASE}/usuarios/`);
    usuariosMap = new Map(usuariosGlobal.map(u => [String(u.id), `${u.nombre} ${u.apellido ?? ''}`.trim()]));
    setText(SELECTORS.usuariosCount, usuariosGlobal.filter(u => Number(u.rol) === 2).length);
    renderTablaCobradores(usuariosGlobal);
    poblarFiltroCobrador(usuariosGlobal);
    cargarOpcionesCobradores(usuariosGlobal);

    byId(SELECTORS.modalCobrador)?.classList.add('hidden');
    byId(SELECTORS.formCobrador)?.reset();
    mostrarToast('exito', 'Cobrador creado con éxito');
  } else {
    mostrarToast('error', 'Error al crear cobrador');
  }
});

// Deudor: crear
byId(SELECTORS.formDeudor)?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm([
    { id: SELECTORS.deudorNombre, type: 'text' },
    { id: SELECTORS.deudorApellido, type: 'text' },
    { id: SELECTORS.deudorIdentificacion, type: 'numberPositive' },
    { id: SELECTORS.deudorTelefono, type: 'numberPositive' },
    { id: SELECTORS.deudorDireccion, type: 'text' },
    { id: SELECTORS.deudorTipo, type: 'select' },
    { id: SELECTORS.selectDeudorCobrador, type: 'select' }
  ])) return;

  const data = {
    nombre: byId(SELECTORS.deudorNombre).value.trim(),
    apellido: byId(SELECTORS.deudorApellido).value.trim(),
    id: byId(SELECTORS.deudorIdentificacion).value.trim(),
    telefono: byId(SELECTORS.deudorTelefono).value.trim(),
    direccion: byId(SELECTORS.deudorDireccion).value.trim(),
    tipo: byId(SELECTORS.deudorTipo).value,
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
    deudoresMap = new Map(nuevosDeudores.map(d => [String(d.id), `${d.nombre} ${d.apellido}`]));
    setText(SELECTORS.deudoresCount, nuevosDeudores.length);
    renderTablaDeudores(nuevosDeudores);

    mostrarToast('exito', 'Deudor creado con éxito');
  } else {
    mostrarToast('error', 'Error al crear el deudor');
  }
});

// Préstamo: submit (backend asigna cobrador=request.user; NO enviamos 'cobrador')
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
    const msg = await explainBadRequest(res);
    mostrarToast('error', msg || 'Error al registrar préstamo');
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

  // Regla: monto <= saldo_pendiente
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

    // 1) card pagos y total del mes
    const pagosAll = await fetchWithAuth(`${API_BASE}/pagos`);
    setText(SELECTORS.pagosCount, pagosAll.length);
    await cargarPagosFiltrados(byId(SELECTORS.filtroMes)?.value || '');

    // 2) refrescar préstamos (saldo/estado)
    const nuevosPrestamos = await fetchWithAuth(`${API_BASE}/prestamos/`);
    prestamosGlobal = nuevosPrestamos;
    renderTablaPrestamos(nuevosPrestamos);
    cargarSelectPrestamos();

    mostrarToast('exito', 'Pago registrado con éxito');
  } else {
    const msg = await explainBadRequest(res);
    mostrarToast('error', msg || 'Error al registrar el pago');
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
  const endpoint =
    tipo === 'deudor'
      ? `${API_BASE}/deudores/${id}/`
      : (tipo === 'prestamo'
          ? `${API_BASE}/prestamos/${id}/`
          : `${API_BASE}/usuarios/${id}/`);


  try {
    const res = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });

    if (res.ok) {
      if (tipo === 'deudor') {
        deudoresGlobal = deudoresGlobal.filter(d => String(d.id) !== String(id));
        deudoresMap.delete(String(id));
        setText(SELECTORS.deudoresCount, deudoresGlobal.length);
        renderTablaDeudores(deudoresGlobal);
      } else if (tipo === 'prestamo') {
        prestamosGlobal = prestamosGlobal.filter(pr => String(pr.id) !== String(id));
        setText(SELECTORS.prestamosCount, prestamosGlobal.length);
        renderTablaPrestamos(prestamosGlobal);
        cargarSelectPrestamos();
      } else {

        usuariosMap.delete(String(id));
        setText(SELECTORS.usuariosCount, usuariosGlobal.filter(u => Number(u.rol) === 2).length);
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

  const bar = document.createElement('div');
  bar.className = 'table-toolbar';
  bar.innerHTML = `
    <div class="left flex items-center gap-2">
      <label class="text-sm text-gray-600">
        Ordenar:
        <select id="sort-${key}" class="page-size w-24 text-sm p-1" aria-label="Selector de orden"></select>
      </label>
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

  // Export
  byId(`exp-${key}-xls`)?.addEventListener('click', () => exportTable(key, 'xls', fileBase));

  // Paginación
  byId(`pgs-${key}`)?.addEventListener('change', (e) => {
    const n = parseInt(e.target.value, 10) || 10;
    paging[key].pageSize = n; paging[key].page = 1;
    rerenderPage(key);
  });
  byId(`pg-${key}-prev`)?.addEventListener('click', () => { paging[key].page = Math.max(1, paging[key].page - 1); rerenderPage(key); });
  byId(`pg-${key}-next`)?.addEventListener('click', () => { paging[key].page = Math.min(pageCount(key), paging[key].page + 1); rerenderPage(key); });

  byId(`pgs-${key}`).value = String(paging[key].pageSize);

  // --- Orden: poblar opciones y escuchar cambios ---
  const sortSel = byId(`sort-${key}`);
  const opts = getSortOptions(key);
  if (sortSel && opts.length) {
    sortSel.innerHTML = opts.map(([val, label]) => `<option value="${val}">${label}</option>`).join('');
    sortSel.value = sortState[key];
    sortSel.addEventListener('change', (e) => {
      sortState[key] = e.target.value;
      // re-aplicar orden sobre el dataset completo en memoria
      paging[key].view = applySort(key, paging[key].view);
      rerenderPage(key);
    });
  }
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
  usuarios.filter(u => Number(u.rol) === 2).forEach(c => {
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
  usuarios.filter(u => Number(u.rol) === 2).forEach(u => {
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

/* ============================================================================
 * Helpers básicos
 * ==========================================================================*/
function byId(id) { return document.getElementById(id); }
function setText(id, value) { const el = byId(id); if (el) el.textContent = String(value); }
function escapeHTML(v) {
  if (v === null || v === undefined) return '';
  return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ============================================================================
 * Validación helpers
 * ==========================================================================*/
function validateForm(specs) {
  let ok = true;
  for (const s of specs) {
    const el = byId(s.id);
    if (!el) continue;
    const v = (el.value ?? '').toString().trim();
    let err = '';

    if (s.type === 'text') {
      if (!v) err = 'Este campo es obligatorio.';
    } else if (s.type === 'select') {
      if (!v) err = 'Selecciona una opción.';
    } else if (s.type === 'numberPositive') {
      const n = parseInt(v, 10);
      if (!v || Number.isNaN(n) || n <= 0) err = 'Ingresa un número válido (> 0).';
    } else if (s.type === 'numberRange') {
      const n = parseInt(v, 10);
      if (!v || Number.isNaN(n)) err = 'Ingresa un número válido.';
      else {
        if (s.min != null && n < s.min) err = `Debe ser ≥ ${s.min}.`;
        if (!err && s.max != null && n > s.max) err = `Debe ser ≤ ${s.max}.`;
      }
    } else if (s.type === 'date') {
      if (!v || Number.isNaN(Date.parse(v))) err = 'Fecha inválida.';
    }

    el.setCustomValidity(err);
    if (err && ok) el.reportValidity();
    if (err) ok = false;
  }
  return ok;
}

function attachNumericSanitizers(ids = []) {
  ids.forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.setAttribute('inputmode', 'numeric');
    el.addEventListener('input', () => {
      const cur = el.value;
      const clean = cur.replace(/[^\d]/g, '');
      if (cur !== clean) el.value = clean;
      if (el.validity.customError) el.setCustomValidity('');
    });
  });
}
// --- pega justo después de attachNumericSanitizers (línea ~1089) ---
function attachTextSanitizers(ids = []) {
  ids.forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener('input', () => {
      // si hay un error personalizado, lo limpia al escribir
      if (el.validity && el.validity.customError) el.setCustomValidity('');
    });
  });
}

/* ============================================================================
 * Orden helpers
 * ==========================================================================*/
const norm = (s) => (s ?? '').toString().toLocaleLowerCase('es');
const cmpText = (a, b) => norm(a).localeCompare(norm(b), 'es', { sensitivity: 'base' });
const toTime = (v) => new Date(v).getTime() || 0;

const sortByNombre = (arr, getNombre) =>
  [...arr].sort((a, b) => cmpText(getNombre(a), getNombre(b)));

const sortByFechaDesc = (arr, getFecha) =>
  [...arr].sort((a, b) => toTime(getFecha(b)) - toTime(getFecha(a)));

/* ============================================================================
 * Helpers de error + JWT
 * ==========================================================================*/
async function explainBadRequest(res) {
  try {
    const txt = await res.clone().text();
    try {
      const j = JSON.parse(txt);
      if (j.detail) return j.detail;
      const keys = Object.keys(j || {});
      if (keys.length) {
        const k = keys[0];
        const val = Array.isArray(j[k]) ? j[k].join(', ') : String(j[k]);
        return `${k}: ${val}`;
      }
    } catch {}
    return txt || 'Solicitud inválida';
  } catch { return 'Solicitud inválida'; }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch { return {}; }
}

function toPositiveInt(x) {
  const n = parseInt(x, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getUserId() {
  const idFromLS = toPositiveInt(localStorage.getItem('usuario_id'));
  if (idFromLS) return idFromLS;
  const token = localStorage.getItem('token');
  if (!token) return null;
  const p = parseJwt(token);
  return toPositiveInt(p?.id ?? p?.user_id ?? p?.uid ?? p?.sub);
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

/* ============================================================================
 * Selects auxiliares
 * ==========================================================================*/
function cargarSelectDeudores() {
  const select = byId(SELECTORS.selectPrestamoDeudor);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Deudor</option>';
  (deudoresGlobal || []).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.nombre ?? ''} ${d.apellido ?? ''}`.trim();
    select.appendChild(opt);
  });
}

function cargarSelectPrestamos() {
  const select = byId(SELECTORS.selectPagoPrestamo);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Préstamo</option>';
  (prestamosGlobal || []).forEach(p => {
    if (p.saldo_pendiente <= 0) return;
    const nombre = deudoresMap.get(String(p.deudor)) || `ID: ${p.deudor}`;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${nombre} - $${Number(p.saldo_pendiente).toLocaleString('es-CO')}`;
    select.appendChild(opt);
  });
}

/* ============================================================================
 * Menú Usuario + Cambio de contraseña (NUEVO)
 * ==========================================================================*/
function initUserMenuAndPassword() {
  const btnMenu = document.getElementById(SELECTORS_EXTRAS.userMenuToggle);
  const menu = document.getElementById(SELECTORS_EXTRAS.userMenu);

  btnMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = btnMenu.getAttribute('aria-expanded') === 'true';
    btnMenu.setAttribute('aria-expanded', String(!expanded));
    menu?.classList.toggle('hidden');
  });

  // Cerrar menú al clicar fuera o con Escape
  document.addEventListener('click', (e) => {
    if (!menu || !btnMenu) return;
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btnMenu) {
      menu.classList.add('hidden'); btnMenu.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && !menu.classList.contains('hidden')) {
      menu.classList.add('hidden'); btnMenu?.setAttribute('aria-expanded', 'false');
    }
  });

  // Modal cambiar contraseña
  const openPwd = document.getElementById(SELECTORS_EXTRAS.changePasswordBtn);
  const modalPwd = document.getElementById(SELECTORS_EXTRAS.modalPassword);
  const closePwd = document.getElementById(SELECTORS_EXTRAS.btnCloseModalPassword);
  const cancelPwd = document.getElementById(SELECTORS_EXTRAS.btnCancelarPassword);

  openPwd?.addEventListener('click', () => { modalPwd?.classList.remove('hidden'); menu?.classList.add('hidden'); });
  closePwd?.addEventListener('click', () => { modalPwd?.classList.add('hidden'); resetPasswordForm(); });
  cancelPwd?.addEventListener('click', () => { modalPwd?.classList.add('hidden'); resetPasswordForm(); });

  document.getElementById(SELECTORS_EXTRAS.formPassword)?.addEventListener('submit', onSubmitChangePassword);
}

async function onSubmitChangePassword(e) {
  e.preventDefault();
  const actual = document.getElementById(SELECTORS_EXTRAS.pwdActual);
  const nueva = document.getElementById(SELECTORS_EXTRAS.pwdNueva);
  const confirmar = document.getElementById(SELECTORS_EXTRAS.pwdConfirmar);
  const modalPwd = document.getElementById(SELECTORS_EXTRAS.modalPassword);

  // Validaciones básicas
  if (!nueva.value || nueva.value.length < 8) {
    nueva.setCustomValidity('La nueva contraseña debe tener al menos 8 caracteres.');
    nueva.reportValidity();
    return;
  } else nueva.setCustomValidity('');

  if (nueva.value !== confirmar.value) {
    confirmar.setCustomValidity('La confirmación no coincide.');
    confirmar.reportValidity();
    return;
  } else confirmar.setCustomValidity('');

  if (actual.value && actual.value === nueva.value) {
    nueva.setCustomValidity('La nueva contraseña no puede ser igual a la actual.');
    nueva.reportValidity();
    return;
  } else nueva.setCustomValidity('');

  const userId = getUserId();
  if (!userId) {
    mostrarToast('error', 'No se pudo identificar al usuario.');
    return;
  }

  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/usuarios/${userId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 'contraseña': nueva.value })
    });

    if (res.ok) {
      mostrarToast('exito', 'Contraseña actualizada.');
      modalPwd?.classList.add('hidden');
      resetPasswordForm();
      // Opcional: forzar re-login por seguridad:
      // localStorage.clear(); window.location.href = 'index.html';
    } else {
      let msg = 'No se pudo cambiar la contraseña.';
      try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
      mostrarToast('error', msg);
    }
  } catch (err) {
    console.error(err);
    mostrarToast('error', 'Error de red al cambiar contraseña.');
  }
}

function resetPasswordForm() {
  document.getElementById(SELECTORS_EXTRAS.formPassword)?.reset();
  document.getElementById(SELECTORS_EXTRAS.pwdNueva)?.setCustomValidity('');
  document.getElementById(SELECTORS_EXTRAS.pwdConfirmar)?.setCustomValidity('');
}

/* ============================================================================
 * Máscaras y formato Colombia (solo estético, sin romper lógica existente)
 * ==========================================================================*/

// Deja solo dígitos
function unformatDigits(s) {
  return (s || '').replace(/\D+/g, '');
}

// CC: 1.234.567.890
function formatCC(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Teléfono CO: 300 123 4567 / 601 234 5678 / +57 ...
function formatPhoneCO(digits) {
  if (!digits) return '';
  // Country code: +57
  if (digits.startsWith('57')) {
    const rest = digits.slice(2);
    return rest ? `+57 ${formatPhoneCO(rest)}` : '+57';
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6)}`;
  if (digits.length <= 13) return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,10)} ${digits.slice(10)}`;
  return digits;
}

// COP: 150.000 (sin decimales)
function formatCOP(digitsOrString) {
  const n = Number(unformatDigits(digitsOrString)) || 0;
  return n.toLocaleString('es-CO');
}

// Aplica una máscara manteniendo valor "raw" en data-attr.
// NOTA: corre DESPUÉS del sanitizer que ya tienes, por orden de registro.
function applyMask(id, formatter) {
  const el = byId(id);
  if (!el) return;

  const toRaw = () => {
    const raw = unformatDigits(el.value);
    el.value = raw;
    el.dataset.raw = raw;
  };

  const toMask = () => {
    const raw = unformatDigits(el.value);
    el.value = formatter(raw);
    el.dataset.raw = raw;
  };

  // Al enfocar, muestro dígitos para editar fácil; al escribir/blur, muestro máscara
  el.addEventListener('focus', toRaw);
  el.addEventListener('input', toMask);
  el.addEventListener('blur', toMask);

  // Inicial
  toMask();
}

// Instala máscaras en los campos solicitados
function setupColombiaMasks() {
  // CC
  applyMask(SELECTORS.nuevoIdentificacion, formatCC);
  applyMask(SELECTORS.deudorIdentificacion, formatCC);

  // Teléfonos
  applyMask(SELECTORS.nuevoTelefono, formatPhoneCO);
  applyMask(SELECTORS.deudorTelefono, formatPhoneCO);

  // Montos (Préstamo y Pago)
  applyMask(SELECTORS.inputPrestamoMonto, formatCOP);
  applyMask(SELECTORS.inputPagoMonto, formatCOP);
}

// Antes de que se dispare tu listener de submit, normalizamos los campos
// a dígitos (captura) para que validateForm y parseInt funcionen igual que siempre.
function installPreSubmitNormalizers() {
  const normalize = (ids) => {
    ids.forEach(id => {
      const el = byId(id);
      if (el) el.value = unformatDigits(el.value);
    });
  };

  // Importante: usamos capture:true para ejecutar antes de tus handlers de submit.
  byId(SELECTORS.formPrestamo)?.addEventListener('submit', () => {
    normalize([SELECTORS.inputPrestamoMonto]);
  }, { capture: true });

  byId(SELECTORS.formPago)?.addEventListener('submit', () => {
    normalize([SELECTORS.inputPagoMonto]);
  }, { capture: true });

  // Opcional: limpiar CC/teléfono al enviar (no afecta backend)
  byId(SELECTORS.formDeudor)?.addEventListener('submit', () => {
    normalize([SELECTORS.deudorIdentificacion, SELECTORS.deudorTelefono]);
  }, { capture: true });

  byId(SELECTORS.formCobrador)?.addEventListener('submit', () => {
    normalize([SELECTORS.nuevoIdentificacion, SELECTORS.nuevoTelefono]);
  }, { capture: true });
}