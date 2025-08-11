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

  // tablas
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
let usuariosGlobal = []; // para refrescar cobradores/filtros al eliminar
let pendingDelete = null; // { tipo: 'deudor' | 'cobrador', id: string|number }

/* ============================================================================
 * Bootstrap
 * ==========================================================================*/
document.addEventListener('DOMContentLoaded', async () => {
  ensureConfirmUI(); // inyecta modal confirm si no existe

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
    deudores.forEach(d => deudoresMap.set(String(d.id), `${d.nombre} ${d.apellido}`));
    usuarios.forEach(u => usuariosMap.set(String(u.id), `${u.nombre} ${u.apellido}`));

    // resumen
    setText(SELECTORS.deudoresCount, deudores.length);
    setText(SELECTORS.prestamosCount, prestamos.length);
    setText(SELECTORS.pagosCount, pagos.length);
    setText(SELECTORS.usuariosCount, usuarios.length);

    // render inicial
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
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    window.location.href = 'index.html';
  });

  byId(SELECTORS.filtroMes)?.addEventListener('change', async (e) => {
    await cargarPagosFiltrados(e.target.value);
  });

  byId(SELECTORS.buscarDeudor)?.addEventListener('input', () => {
    const q = byId(SELECTORS.buscarDeudor).value.toLowerCase();
    const filtrados = deudoresGlobal.filter(d => {
      const nombre = (d.nombre || '').toLowerCase();
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

  /* -------------------------
   * Modales: abrir/cerrar
   * -----------------------*/
  const modalCobrador = byId(SELECTORS.modalCobrador);
  byId(SELECTORS.btnToggleModalCobrador)?.addEventListener('click', () => {
    modalCobrador?.classList.remove('hidden');
  });
  byId(SELECTORS.btnCloseModalCobrador)?.addEventListener('click', () => {
    modalCobrador?.classList.add('hidden');
    byId(SELECTORS.formCobrador)?.reset();
  });

  const modalDeudor = byId(SELECTORS.modalDeudor);
  byId(SELECTORS.btnToggleModalDeudor)?.addEventListener('click', () => {
    modalDeudor?.classList.remove('hidden');
  });
  byId(SELECTORS.btnCloseModalDeudor)?.addEventListener('click', () => {
    modalDeudor?.classList.add('hidden');
    byId(SELECTORS.formDeudor)?.reset();
  });

  const modalPrestamo = byId(SELECTORS.modalPrestamo);
  byId(SELECTORS.btnToggleModalPrestamo)?.addEventListener('click', () => {
    cargarSelectDeudores();
    modalPrestamo?.classList.remove('hidden');
  });
  byId(SELECTORS.btnCloseModalPrestamo)?.addEventListener('click', () => {
    modalPrestamo?.classList.add('hidden');
    byId(SELECTORS.formPrestamo)?.reset();
  });

  const modalPago = byId(SELECTORS.modalPago);
  byId(SELECTORS.btnToggleModalPago)?.addEventListener('click', () => {
    cargarSelectPrestamos();
    modalPago?.classList.remove('hidden');
  });
  byId(SELECTORS.btnCloseModalPago)?.addEventListener('click', () => {
    modalPago?.classList.add('hidden');
    byId(SELECTORS.formPago)?.reset();
  });

  // Modal Confirmación (Eliminar)
  byId('mp-confirm-cancel')?.addEventListener('click', () => {
    pendingDelete = null;
    hideConfirmModal();
  });
  byId('mp-confirm-ok')?.addEventListener('click', () => {
    if (!pendingDelete) return;
    const { tipo, id } = pendingDelete;
    pendingDelete = null;
    hideConfirmModal();
    handleDelete(tipo, id);
  });
});

/* ============================================================================
 * Renderizadores
 * ==========================================================================*/
function renderTablaDeudores(deudores) {
  const tbody = byId(SELECTORS.tablaDeudores);
  if (!tbody) return;
  tbody.innerHTML = '';

  deudores.forEach(d => {
    let nombreCompleto = d.nombre;
    if (d.apellido) {
      nombreCompleto += ` ${d.apellido}`;
    }

    const fila = document.createElement('tr');
    const tipo = d.tipo == '1' ? 'normal' : (d.tipo == '2' ? 'especial' : '');
    fila.innerHTML = `
      <td class="p-2">${escapeHTML(nombreCompleto)}</td>
      <td class="p-2">${escapeHTML(d.id)}</td>
      <td class="p-2">${escapeHTML(d.telefono)}</td>
      <td class="p-2">${escapeHTML(d.direccion)}</td>
      <td class="p-2">${tipo}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete"
                data-type="deudor"
                data-id="${String(d.id)}"
                aria-label="Eliminar deudor ${escapeHTML(d.nombre)}">
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(fila);
  });
}

function renderTablaPrestamos(prestamos) {
  const tbody = byId(SELECTORS.tablaPrestamos);
  if (!tbody) return;
  tbody.innerHTML = '';

  prestamos.forEach(p => {
    const nombreDeudor = deudoresMap.get(String(p.deudor)) || `ID: ${p.deudor}`;
    const nombreCobrador = usuariosMap.get(String(p.cobrador)) || `ID: ${p.cobrador}`;

    let estadoTexto = 'Desconocido';
    let estadoClase = 'text-gray-500';
    if (p.estado === 1) { estadoTexto = 'Pendiente'; estadoClase = 'text-yellow-600 font-semibold'; }
    else if (p.estado === 2) { estadoTexto = 'Pagado'; estadoClase = 'text-green-600 font-semibold'; }
    else if (p.estado === 3) { estadoTexto = 'En mora'; estadoClase = 'text-red-600 font-semibold'; }

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${escapeHTML(nombreDeudor)}</td>
      <td class="p-2">${Number(p.monto).toLocaleString('es-CO')}</td>
      <td class="p-2">${Number(p.saldo_pendiente).toLocaleString('es-CO')}</td>
      <td class="p-2">${p.meses}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
      <td class="p-2"><span class="${estadoClase}">${estadoTexto}</span></td>
      <td class="p-2">${escapeHTML(nombreCobrador)}</td>
    `;
    tbody.appendChild(fila);
  });
}

function renderTablaPagos(pagos) {
  const tbody = byId(SELECTORS.tablaPagos);
  if (!tbody) return;
  tbody.innerHTML = '';

  pagos.forEach(p => {
    const nombreDeudor = getNombreDeudorDesdePago(p);
    const nombreCobrador = getNombreCobradorDesdePago(p);

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${escapeHTML(nombreDeudor)}</td>
      <td class="p-2">${escapeHTML(nombreCobrador)}</td>
      <td class="p-2">${Number(p.monto_pagado).toLocaleString('es-CO')}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
    `;
    tbody.appendChild(fila);
  });
}

function renderTablaCobradores(cobradores) {
  const tbody = byId(SELECTORS.tablaCobradores);
  if (!tbody) return;
  tbody.innerHTML = '';

  cobradores.forEach(c => {
    let nombreCompleto = c.nombre;
    if (c.apellido) {
      nombreCompleto += ` ${c.apellido}`;
    }

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${escapeHTML(nombreCompleto)}</td>
      <td class="p-2">${escapeHTML(c.identificacion)}</td>
      <td class="p-2">${escapeHTML(c.telefono)}</td>
      <td class="p-2 w-28">
        <button class="inline-flex items-center justify-center rounded-lg border border-red-500 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-600 hover:text-white transition"
                data-action="delete"
                data-type="cobrador"
                data-id="${String(c.id)}"
                aria-label="Eliminar cobrador ${escapeHTML(c.nombre)}">
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(fila);
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
 * Formularios
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    byId(SELECTORS.modalDeudor)?.classList.add('hidden');
    byId(SELECTORS.formDeudor)?.reset();

    const nuevosDeudores = await fetchWithAuth(`${API_BASE}/deudores/`);
    deudoresGlobal = nuevosDeudores;

    // maps y UI
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
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

function hideConfirmModal() {
  byId('mp-confirm-overlay')?.classList.add('hidden');
}

async function handleDelete(tipo, id) {
  const token = localStorage.getItem('token');
  const endpoint = tipo === 'deudor'
    ? `${API_BASE}/deudores/${id}/`
    : `${API_BASE}/usuarios/${id}/`;

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

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
 * Utilidades UI
 * ==========================================================================*/
function cargarOpcionesCobradores(usuarios) {
  const select = byId(SELECTORS.selectDeudorCobrador);
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar Cobrador</option>';
  usuarios
    .filter(u => u.rol === 2)
    .forEach(c => {
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
  const toast = byId(id);
  if (!toast) return;
  toast.textContent = mensaje || (tipo === 'error' ? 'Ocurrió un error' : 'Acción exitosa');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// helpers
function byId(id) { return document.getElementById(id); }
function setText(id, value) { const el = byId(id); if (el) el.textContent = String(value); }
function escapeHTML(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
    </div>
  `;
  document.body.appendChild(wrap);
}
