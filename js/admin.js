'use strict';

// ============================================================================
// Imports
// ============================================================================
import { fetchWithAuth } from './api.js';

// ============================================================================
// Constantes / Configuración
// ============================================================================
const API_BASE = 'https://inversiones-api.onrender.com/api';
const SELECTORS = {
  logoutBtn: 'logout-btn',
  filtroMes: 'filtro-mes',
  buscarDeudor: 'buscar-deudor',
  buscarPrestamo: 'buscar-prestamo',
  filtroEstado: 'filtro-estado',
  filtroCobrador: 'filtro-cobrador',
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
  tablaDeudores: 'tabla-deudores-container',
  tablaPrestamos: 'tabla-prestamos-container',
  tablaPagos: 'tabla-pagos-container',
  tablaCobradores: 'tabla-cobradores-container',
  deudoresCount: 'deudores-count',
  prestamosCount: 'prestamos-count',
  pagosCount: 'pagos-count',
  usuariosCount: 'usuarios-count',
  totalRecaudado: 'total-recaudado',
  toastError: 'toast-error',
  toastExito: 'toast-exito',
  selectPrestamoDeudor: 'prestamo-deudor',
  inputPrestamoMonto: 'prestamo-monto',
  inputPrestamoInteres: 'prestamo-interes',
  inputPrestamoMeses: 'prestamo-meses',
  inputPrestamoFecha: 'prestamo-fecha',
  selectPagoPrestamo: 'pago-prestamo',
  inputPagoMonto: 'pago-monto',
  inputPagoFecha: 'pago-fecha',
  selectDeudorCobrador: 'deudor-cobrador',
  nuevoNombre: 'nuevo-nombre',
  nuevoApellido: 'nuevo-apellido',
  nuevoIdentificacion: 'nuevo-identificacion',
  nuevoTelefono: 'nuevo-telefono',
  deudorNombre: 'deudor-nombre',
  deudorApellido: 'deudor-apellido',
  deudorIdentificacion: 'deudor-identificacion',
  deudorTelefono: 'deudor-telefono',
  deudorDireccion: 'deudor-direccion',
  deudorTipo: 'deudor-tipo'
};

// ============================================================================
// Estado (Maps y arreglos globales)
// ============================================================================
let deudoresMap = new Map();
let usuariosMap = new Map();
let deudoresGlobal = [];
let prestamosGlobal = [];

// ============================================================================
// Bootstrap principal
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
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

    renderTablaCobradores(usuarios);
    cargarOpcionesCobradores(usuarios);

    deudoresGlobal = deudores;
    prestamosGlobal = prestamos;

    deudores.forEach((d) => {
      deudoresMap.set(d.id, `${d.nombre} ${d.apellido}`);
    });

    usuarios.forEach((u) => {
      usuariosMap.set(u.id, `${u.nombre} ${u.apellido}`);
      const option = document.createElement('option');
      option.value = u.id;
      option.textContent = `${u.nombre} ${u.apellido}`;
      document.getElementById(SELECTORS.filtroCobrador).appendChild(option);
    });

    document.getElementById(SELECTORS.deudoresCount).textContent = deudores.length;
    document.getElementById(SELECTORS.prestamosCount).textContent = prestamos.length;
    document.getElementById(SELECTORS.pagosCount).textContent = pagos.length;
    document.getElementById(SELECTORS.usuariosCount).textContent = usuarios.length;

    renderTablaDeudores(deudores);
    renderTablaPrestamos(prestamos);
    await cargarPagosFiltrados();
  } catch (error) {
    mostrarToast('error', 'Error cargando datos');
    console.error(error);
  }

  // ----------------------
  // Eventos generales
  // ----------------------
  document.getElementById(SELECTORS.logoutBtn).addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    window.location.href = 'index.html';
  });

  document.getElementById(SELECTORS.filtroMes).addEventListener('change', async (e) => {
    const mesSeleccionado = e.target.value;
    await cargarPagosFiltrados(mesSeleccionado);
  });

  document.getElementById(SELECTORS.buscarDeudor).addEventListener('input', () => {
    const texto = document.getElementById(SELECTORS.buscarDeudor).value.toLowerCase();

    const filtrados = deudoresGlobal.filter((d) => {
      const nombre = d.nombre?.toLowerCase() || '';
      const identificacion = d.identificacion?.toLowerCase?.() || '';
      return nombre.includes(texto) || identificacion.includes(texto);
    });

    renderTablaDeudores(filtrados);
  });

  document.getElementById(SELECTORS.buscarPrestamo).addEventListener('input', aplicarFiltrosPrestamos);
  document.getElementById(SELECTORS.filtroEstado).addEventListener('change', aplicarFiltrosPrestamos);
  document.getElementById(SELECTORS.filtroCobrador).addEventListener('change', aplicarFiltrosPrestamos);

  // ----------------------
  // Modal Cobrador
  // ----------------------
  const modalCobrador = document.getElementById(SELECTORS.modalCobrador);
  document.getElementById(SELECTORS.btnToggleModalCobrador).addEventListener('click', () => {
    modalCobrador.classList.remove('hidden');
  });
  document.getElementById(SELECTORS.btnCloseModalCobrador).addEventListener('click', () => {
    modalCobrador.classList.add('hidden');
    document.getElementById(SELECTORS.formCobrador).reset();
  });

  // ----------------------
  // Modal Deudor (apertura/cierre)
  // ----------------------
  const modalDeudorLocal = document.getElementById(SELECTORS.modalDeudor);
  document.getElementById(SELECTORS.btnToggleModalDeudor).addEventListener('click', () => {
    modalDeudorLocal.classList.remove('hidden');
  });
  document.getElementById(SELECTORS.btnCloseModalDeudor).addEventListener('click', () => {
    modalDeudorLocal.classList.add('hidden');
    document.getElementById(SELECTORS.formDeudor).reset();
  });
});

// ============================================================================
// Renderizadores (SIN cambios de lógica)
// ============================================================================
function renderTablaDeudores(deudores) {
  const tbody = document.getElementById(SELECTORS.tablaDeudores);
  tbody.innerHTML = '';

  deudores.forEach((d) => {
    const fila = document.createElement('tr');
    let tipo = '';
    if (d.tipo == '1') {
      tipo = 'normal';
    } else if (d.tipo == '2') {
      tipo = 'especial';
    }
    let nombrecompleto = `${d.nombre} ${d.apellido}`

    fila.innerHTML = `
      <td class="p-2">${nombrecompleto}</td>
      <td class="p-2">${d.id}</td>
      <td class="p-2">${d.telefono}</td>
      <td class="p-2">${d.direccion}</td>
      <td class="p-2">${tipo}</td>
    `;
    tbody.appendChild(fila);
  });
}

function renderTablaPrestamos(prestamos) {
  const tbody = document.getElementById(SELECTORS.tablaPrestamos);
  tbody.innerHTML = '';

  prestamos.forEach((p) => {
    const nombreDeudor = deudoresMap.get(p.deudor) || `ID: ${p.deudor}`;
    const nombreCobrador = usuariosMap.get(p.cobrador) || `ID: ${p.cobrador}`;
    let estadoTexto = '';
    let estadoClase = '';

    if (p.estado === 1) {
      estadoTexto = 'Pendiente';
      estadoClase = 'text-yellow-600 font-semibold';
    } else if (p.estado === 2) {
      estadoTexto = 'Pagado';
      estadoClase = 'text-green-600 font-semibold';
    } else if (p.estado === 3) {
      estadoTexto = 'En mora';
      estadoClase = 'text-red-600 font-semibold';
    } else {
      estadoTexto = 'Desconocido';
      estadoClase = 'text-gray-500';
    }

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${nombreDeudor}</td>
      <td class="p-2">${Number(p.monto).toLocaleString('es-CO')}</td>
      <td class="p-2">${Number(p.saldo_pendiente).toLocaleString('es-CO')}</td>
      <td class="p-2">${p.meses}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
      <td class="p-2"><span class="${estadoClase}">${estadoTexto}</span></td>
      <td class="p-2">${nombreCobrador}</td>
    `;
    tbody.appendChild(fila);
  });
}

function aplicarFiltrosPrestamos() {
  const texto = document.getElementById(SELECTORS.buscarPrestamo).value.toLowerCase();
  const estado = document.getElementById(SELECTORS.filtroEstado).value;
  const cobrador = document.getElementById(SELECTORS.filtroCobrador).value;

  const filtrados = prestamosGlobal.filter((p) => {
    const nombreDeudor = (deudoresMap.get(p.deudor) || '').toLowerCase();
    const coincideNombre = nombreDeudor.includes(texto);
    const coincideEstado = !estado || String(p.estado) === estado;
    const coincideCobrador = !cobrador || String(p.cobrador) === cobrador;
    return coincideNombre && coincideEstado && coincideCobrador;
  });

  renderTablaPrestamos(filtrados);
}

function renderTablaPagos(pagos) {
  const tbody = document.getElementById(SELECTORS.tablaPagos);
  tbody.innerHTML = '';

  pagos.forEach((p) => {
    const nombreDeudor = getNombreDeudorDesdePago(p);
    const nombreCobrador = getNombreCobradorDesdePago(p);

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${nombreDeudor}</td>
      <td class="p-2">${nombreCobrador}</td>
      <td class="p-2">${Number(p.monto_pagado).toLocaleString('es-CO')}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
    `;
    tbody.appendChild(fila);
  });
}

// ============================================================================
// Data fetching / cálculos
// ============================================================================
async function cargarPagosFiltrados(mes = '') {
  // If no month specified, get current month
  const currentDate = new Date();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  
  // Use current month if no month specified
  const monthToUse = mes || currentMonth;
  const url = `${API_BASE}/pagos/?mes=${monthToUse}`;
  
  const pagos = await fetchWithAuth(url);
  renderTablaPagos(pagos);

  const totalMes = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);
  document.getElementById(SELECTORS.totalRecaudado).textContent = totalMes.toLocaleString('es-CO');
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getNombreDeudorDesdePago(pago) {
  const prestamo = prestamosGlobal.find((pr) => pr.id === pago.prestamo);
  if (!prestamo) return 'Prestamo no encontrado';

  const deudor = deudoresGlobal.find((d) => d.id === prestamo.deudor);
  return deudor ? `${deudor.nombre} ${deudor.apellido}` : 'Deudor no encontrado';
}

function getNombreCobradorDesdePago(pago) {
  const prestamo = prestamosGlobal.find((pr) => pr.id === pago.prestamo);
  if (!prestamo) return 'Préstamo no encontrado';

  const cobrador = usuariosMap.get(prestamo.cobrador);
  return cobrador || 'Cobrador no encontrado';
}

function renderTablaCobradores(cobradores) {
  const tbody = document.getElementById(SELECTORS.tablaCobradores);
  tbody.innerHTML = '';

  cobradores.forEach((c) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="p-2">${c.nombre} ${c.apellido}</td>
      <td class="p-2">${c.identificacion}</td>
      <td class="p-2">${c.telefono}</td>
    `;
    tbody.appendChild(fila);
  });
}

// ============================================================================
// Formularios (listeners fuera de DOMContentLoaded, manteniendo comportamiento)
// ============================================================================
document.getElementById(SELECTORS.formCobrador).addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: document.getElementById(SELECTORS.nuevoNombre).value,
    apellido: document.getElementById(SELECTORS.nuevoApellido).value,
    identificacion: document.getElementById(SELECTORS.nuevoIdentificacion).value,
    telefono: document.getElementById(SELECTORS.nuevoTelefono).value,
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

// Definir fuera del submit para asegurar que esté disponible
const modalDeudor = document.getElementById(SELECTORS.modalDeudor);
document.getElementById(SELECTORS.formDeudor).addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: document.getElementById(SELECTORS.deudorNombre).value,
    apellido: document.getElementById(SELECTORS.deudorApellido).value,
    id: document.getElementById(SELECTORS.deudorIdentificacion).value,
    telefono: document.getElementById(SELECTORS.deudorTelefono).value,
    direccion: document.getElementById(SELECTORS.deudorDireccion).value,
    tipo: document.getElementById(SELECTORS.deudorTipo).value,
    cobrador_id: document.getElementById(SELECTORS.selectDeudorCobrador).value
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
    modalDeudor.classList.add('hidden');
    document.getElementById(SELECTORS.formDeudor).reset();

    const nuevosDeudores = await fetchWithAuth(`${API_BASE}/deudores/`);
    deudoresGlobal = nuevosDeudores;
    renderTablaDeudores(nuevosDeudores);

    const toast = document.getElementById(SELECTORS.toastExito);
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  } else {
    mostrarToast('error', 'Error al crear el deudor');
  }
});

function cargarOpcionesCobradores(usuarios) {
  const select = document.getElementById(SELECTORS.selectDeudorCobrador);
  select.innerHTML = '<option value="">Seleccionar Cobrador</option>';
  usuarios
    .filter((u) => u.rol === 2)
    .forEach((c) => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.nombre} ${c.apellido}`;
      select.appendChild(option);
    });
}

function mostrarToast(tipo = 'exito', mensaje = '') {
  const id = tipo === 'error' ? SELECTORS.toastError : SELECTORS.toastExito;
  const toast = document.getElementById(id);

  if (!toast) return;

  toast.textContent = mensaje || (tipo === 'error' ? 'Ocurrió un error' : 'Acción exitosa');
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ----------------------
// Modal Préstamo
// ----------------------
const modalPrestamo = document.getElementById(SELECTORS.modalPrestamo);
document.getElementById(SELECTORS.btnToggleModalPrestamo).addEventListener('click', () => {
  cargarSelectDeudores();
  modalPrestamo.classList.remove('hidden');
});
document.getElementById(SELECTORS.btnCloseModalPrestamo).addEventListener('click', () => {
  modalPrestamo.classList.add('hidden');
  document.getElementById(SELECTORS.formPrestamo).reset();
});

// ----------------------
// Modal Pago
// ----------------------
const modalPago = document.getElementById(SELECTORS.modalPago);
document.getElementById(SELECTORS.btnToggleModalPago).addEventListener('click', () => {
  cargarSelectPrestamos();
  modalPago.classList.remove('hidden');
});
document.getElementById(SELECTORS.btnCloseModalPago).addEventListener('click', () => {
  modalPago.classList.add('hidden');
  document.getElementById(SELECTORS.formPago).reset();
});

// ----------------------
// Selects auxiliares
// ----------------------
function cargarSelectDeudores() {
  const select = document.getElementById(SELECTORS.selectPrestamoDeudor);
  select.innerHTML = '<option value="">Seleccionar Deudor</option>';
  deudoresGlobal.forEach((d) => {
    const option = document.createElement('option');
    option.value = d.id;
    option.textContent = `${d.nombre} ${d.apellido}`;
    select.appendChild(option);
  });
}

function cargarSelectPrestamos() {
  const select = document.getElementById(SELECTORS.selectPagoPrestamo);
  select.innerHTML = '<option value="">Seleccionar Préstamo</option>';
  prestamosGlobal.forEach((p) => {
    const nombre = deudoresMap.get(p.deudor) || `ID: ${p.deudor}`;
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${nombre} - $${Number(p.saldo_pendiente).toLocaleString('es-CO')}`;
    select.appendChild(option);
  });
}

// ----------------------
// Submit Préstamo
// ----------------------
document.getElementById(SELECTORS.formPrestamo).addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');

  const data = {
    deudor: parseInt(document.getElementById(SELECTORS.selectPrestamoDeudor).value),
    monto: parseInt(document.getElementById(SELECTORS.inputPrestamoMonto).value),
    interes: parseInt(document.getElementById(SELECTORS.inputPrestamoInteres).value),
    meses: parseInt(document.getElementById(SELECTORS.inputPrestamoMeses).value),
    fecha: document.getElementById(SELECTORS.inputPrestamoFecha).value,
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
    document.getElementById(SELECTORS.modalPrestamo).classList.add('hidden');
    document.getElementById(SELECTORS.formPrestamo).reset();
    const nuevos = await fetchWithAuth(`${API_BASE}/prestamos/`);
    prestamosGlobal = nuevos;
    renderTablaPrestamos(nuevos);
  } else {
    mostrarToast('error', 'Error al registrar préstamo');
  }
});

// ----------------------
// Submit Pago
// ----------------------
document.getElementById(SELECTORS.formPago).addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const data = {
    prestamo: document.getElementById(SELECTORS.selectPagoPrestamo).value,
    monto_pagado: document.getElementById(SELECTORS.inputPagoMonto).value,
    fecha: document.getElementById(SELECTORS.inputPagoFecha).value
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
    modalPago.classList.add('hidden');
    document.getElementById(SELECTORS.formPago).reset();
    await cargarPagosFiltrados();
    mostrarToast('exito', 'Pago registrado con éxito');
  } else {
    mostrarToast('error', 'Error al registrar el pago');
  }
});
