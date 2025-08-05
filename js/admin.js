import { fetchWithAuth } from "./api.js";

let deudoresMap = new Map();
let usuariosMap = new Map();
let deudoresGlobal = [];
let prestamosGlobal = [];

document.addEventListener("DOMContentLoaded", async () => {
  const rol = localStorage.getItem("rol");
  if (rol !== "1") {
    mostrarToast("error", "Acceso no autorizado");
    window.location.href = "index.html";
    return;
  }

  try {
    const deudores = await fetchWithAuth("https://inversiones-api.onrender.com/api/deudores/");
    const usuarios = await fetchWithAuth("https://inversiones-api.onrender.com/api/usuarios/");
    const prestamos = await fetchWithAuth("https://inversiones-api.onrender.com/api/prestamos/");
    const pagos = await fetchWithAuth("https://inversiones-api.onrender.com/api/pagos");

    renderTablaCobradores(usuarios);
    cargarOpcionesCobradores(usuarios);


    deudoresGlobal = deudores;
    prestamosGlobal = prestamos;

    deudores.forEach((d) => {
      deudoresMap.set(d.id, `${d.nombre} ${d.apellido}`);
    });

    usuarios.forEach((u) => {
      usuariosMap.set(u.id, `${u.nombre} ${u.apellido}`);
      const option = document.createElement("option");
      option.value = u.id;
      option.textContent = `${u.nombre} ${u.apellido}`;
      document.getElementById("filtro-cobrador").appendChild(option);
    });

    document.getElementById("deudores-count").textContent = deudores.length;
    document.getElementById("prestamos-count").textContent = prestamos.length;
    document.getElementById("pagos-count").textContent = pagos.length;
    document.getElementById("usuarios-count").textContent = usuarios.length;

    const total = renderTablaDeudores(deudores);
    renderTablaPrestamos(prestamos);
    await cargarPagosFiltrados();
  } catch (error) {
    mostrarToast("error", "Error cargando datos");
    console.error(error);
  }

  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    window.location.href = "index.html";
  });

  document
    .getElementById("filtro-mes")
    .addEventListener("change", async (e) => {
      const mesSeleccionado = e.target.value;
      await cargarPagosFiltrados(mesSeleccionado);
    });

  document.getElementById("buscar-deudor").addEventListener("input", () => {
    const texto = document.getElementById("buscar-deudor").value.toLowerCase();

    const filtrados = deudoresGlobal.filter((d) => {
      const nombre = d.nombre?.toLowerCase() || "";
      const identificacion = d.identificacion?.toLowerCase?.() || "";
      return nombre.includes(texto) || identificacion.includes(texto);
    });

    renderTablaDeudores(filtrados);
  });

  document
    .getElementById("buscar-prestamo")
    .addEventListener("input", aplicarFiltrosPrestamos);
  document
    .getElementById("filtro-estado")
    .addEventListener("change", aplicarFiltrosPrestamos);
  document
    .getElementById("filtro-cobrador")
    .addEventListener("change", aplicarFiltrosPrestamos);

  const modal = document.getElementById("modal-cobrador");
  document.getElementById("btn-toggle-modal").addEventListener("click", () => {
    modal.classList.remove("hidden");
  });
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
    document.getElementById("form-cobrador").reset(); // limpia el formulario
  });

  // Modal de deudor
const modalDeudor = document.getElementById("modal-deudor");

document.getElementById("btn-toggle-modal-deudor").addEventListener("click", () => {
  modalDeudor.classList.remove("hidden");
});

document.getElementById("btn-close-modal-deudor").addEventListener("click", () => {
  modalDeudor.classList.add("hidden");
  document.getElementById("form-deudor").reset();
});

});

function renderTablaDeudores(deudores) {
  const tbody = document.getElementById("tabla-deudores-container");
  tbody.innerHTML = "";

  deudores.forEach((d) => {
    const fila = document.createElement("tr");
    let tipo = "";
    if( d.tipo == "1") {
      tipo = "normal";
    } else if (d.tipo == "2") {
      tipo = "especial";
    }
    fila.innerHTML = `
      <td class="p-2">${d.nombre}</td>
      <td class="p-2">${d.id}</td>
      <td class="p-2">${d.telefono}</td>
      <td class="p-2">${d.direccion}</td>
      <td class="p-2">${tipo}</td>
    `;
    tbody.appendChild(fila);
  });
}

function renderTablaPrestamos(prestamos) {
  const tbody = document.getElementById("tabla-prestamos-container");
  tbody.innerHTML = "";

  prestamos.forEach((p) => {
    const nombreDeudor = deudoresMap.get(p.deudor) || `ID: ${p.deudor}`;
    const nombreCobrador = usuariosMap.get(p.cobrador) || `ID: ${p.cobrador}`;
    let estadoTexto = "";
    let estadoClase = "";

    if (p.estado === 1) {
      estadoTexto = "Pendiente";
      estadoClase = "text-yellow-600 font-semibold";
    } else if (p.estado === 2) {
      estadoTexto = "Pagado";
      estadoClase = "text-green-600 font-semibold";
    } else if (p.estado === 3) {
      estadoTexto = "En mora";
      estadoClase = "text-red-600 font-semibold";
    } else {
      estadoTexto = "Desconocido";
      estadoClase = "text-gray-500";
    }

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="p-2">${nombreDeudor}</td>
      <td class="p-2">${Number(p.monto).toLocaleString("es-CO")}</td>
      <td class="p-2">${Number(p.saldo_pendiente).toLocaleString("es-CO")}</td>
      <td class="p-2">${p.meses}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
      <td class="p-2"><span class="${estadoClase}">${estadoTexto}</span></td>
      <td class="p-2">${nombreCobrador}</td>
    `;
    tbody.appendChild(fila);
  });
}

function aplicarFiltrosPrestamos() {
  const texto = document.getElementById("buscar-prestamo").value.toLowerCase();
  const estado = document.getElementById("filtro-estado").value;
  const cobrador = document.getElementById("filtro-cobrador").value;

  const filtrados = prestamosGlobal.filter((p) => {
    const nombreDeudor = (deudoresMap.get(p.deudor) || "").toLowerCase();
    const coincideNombre = nombreDeudor.includes(texto);
    const coincideEstado = !estado || String(p.estado) === estado;
    const coincideCobrador = !cobrador || String(p.cobrador) === cobrador;
    return coincideNombre && coincideEstado && coincideCobrador;
  });

  renderTablaPrestamos(filtrados);
}

function renderTablaPagos(pagos) {
  const tbody = document.getElementById("tabla-pagos-container");
  tbody.innerHTML = "";

  pagos.forEach((p) => {
    const nombreDeudor = getNombreDeudorDesdePago(p);
    const nombreCobrador = getNombreCobradorDesdePago(p);

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="p-2">${nombreDeudor}</td>
      <td class="p-2">${nombreCobrador}</td>
      <td class="p-2">${Number(p.monto_pagado).toLocaleString("es-CO")}</td>
      <td class="p-2">${formatearFecha(p.fecha)}</td>
    `;
    tbody.appendChild(fila);
  });
}

async function cargarPagosFiltrados(mes = "") {
  const url = mes
    ? `https://inversiones-api.onrender.com/api/pagos/?mes=${mes}`
    : `https://inversiones-api.onrender.com/api/pagos/`;
  const pagos = await fetchWithAuth(url);
  renderTablaPagos(pagos);

  // Calcular total del mes y actualizar resumen
  const totalMes = pagos.reduce(
    (sum, p) => sum + parseFloat(p.monto_pagado || 0),
    0
  );
  document.getElementById("total-recaudado").textContent =
    totalMes.toLocaleString("es-CO");
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNombreDeudorDesdePago(pago) {
  const prestamo = prestamosGlobal.find((pr) => pr.id === pago.prestamo);
  if (!prestamo) return "Prestamo no encontrado";

  const deudor = deudoresGlobal.find((d) => d.id === prestamo.deudor);
  return deudor
    ? `${deudor.nombre} ${deudor.apellido}`
    : "Deudor no encontrado";
}

function getNombreCobradorDesdePago(pago) {
  const prestamo = prestamosGlobal.find((pr) => pr.id === pago.prestamo);
  if (!prestamo) return "Préstamo no encontrado";

  const cobrador = usuariosMap.get(prestamo.cobrador);
  return cobrador || "Cobrador no encontrado";
}

function renderTablaCobradores(cobradores) {
  const tbody = document.getElementById("tabla-cobradores-container");
  tbody.innerHTML = "";

  cobradores.forEach((c) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="p-2">${c.nombre} ${c.apellido}</td>
      <td class="p-2">${c.identificacion}</td>
      <td class="p-2">${c.telefono}</td>
    `;
    tbody.appendChild(fila);
  });
}

document
  .getElementById("form-cobrador")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      nombre: document.getElementById("nuevo-nombre").value,
      apellido: document.getElementById("nuevo-apellido").value,
      identificacion: document.getElementById("nuevo-identificacion").value,
      telefono: document.getElementById("nuevo-telefono").value,
      contraseña: "123456789", // contraseña por defecto
      rol: 2, // asumiendo que rol 2 es cobrador
    };

    const token = localStorage.getItem("token");

    const res = await fetch("https://inversiones-api.onrender.com/api/usuarios/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      mostrarToast("exito", "Cobrador creado con éxito");
      location.reload(); // o volver a cargar la lista con fetch
    } else {
      mostrarToast("error", "Error al crear cobrador");
    }
  });

// Definir fuera del submit para asegurar que esté disponible
const modalDeudor = document.getElementById("modal-deudor");

document.getElementById("form-deudor").addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    nombre: document.getElementById("deudor-nombre").value,
    apellido: document.getElementById("deudor-apellido").value,
    id: document.getElementById("deudor-identificacion").value,
    telefono: document.getElementById("deudor-telefono").value,
    direccion: document.getElementById("deudor-direccion").value,
    tipo: document.getElementById("deudor-tipo").value,
    cobrador_id: document.getElementById("deudor-cobrador").value,
  };

  const token = localStorage.getItem("token");

  const res = await fetch("https://inversiones-api.onrender.com/api/deudores/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    // Cerrar modal
    modalDeudor.classList.add("hidden");

    // Limpiar formulario
    document.getElementById("form-deudor").reset();

    // Actualizar tabla
    const nuevosDeudores = await fetchWithAuth("https://inversiones-api.onrender.com/api/deudores/");
    deudoresGlobal = nuevosDeudores;
    renderTablaDeudores(nuevosDeudores);

    // Mostrar toast de éxito
    const toast = document.getElementById("toast-exito");
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
  } else {
    mostrarToast("error", "Error al crear el deudor");
  }
});


function cargarOpcionesCobradores(usuarios) {
  const select = document.getElementById("deudor-cobrador");
  select.innerHTML = '<option value="">Seleccionar Cobrador</option>';
  usuarios
    .filter(u => u.rol === 2) // solo rol cobrador
    .forEach(c => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = `${c.nombre} ${c.apellido}`;
      select.appendChild(option);
    });
}


function mostrarToast(tipo = "exito", mensaje = "") {
  const id = tipo === "error" ? "toast-error" : "toast-exito";
  const toast = document.getElementById(id);

  if (!toast) return;

  toast.textContent = mensaje || (tipo === "error" ? "Ocurrió un error" : "Acción exitosa");
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}
