
import { fetchWithAuth } from "./api.js";

let deudores = [];
let prestamos = [];
let pagos = [];

document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("rol") !== "2") {
    alert("Acceso no autorizado");
    window.location.href = "index.html";
    return;
  }

  try {
    [deudores, prestamos, pagos] = await Promise.all([
      fetchWithAuth("https://inversiones-api.onrender.com/api/deudores/"),
      fetchWithAuth("https://inversiones-api.onrender.com/api/prestamos/"),
      fetchWithAuth("https://inversiones-api.onrender.com/api/pagos/")
    ]);

    document.getElementById("deudores-count").textContent = deudores.length;
    document.getElementById("prestamos-count").textContent = prestamos.length;
    document.getElementById("pagos-count").textContent = pagos.length;

    const total = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);
    document.getElementById("total-recaudado").textContent = total.toLocaleString("es-CO");

    renderTablaDeudores();
    renderTablaPrestamos();
    renderTablaPagos();
  } catch (e) {
    alert("Error cargando datos");
    console.error(e);
  }

  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  document.getElementById("btn-toggle-modal-deudor")?.addEventListener("click", () => {
    // Abrir modal agregar cliente (pendiente crear modal HTML)
  });

  document.getElementById("btn-toggle-modal-prestamo")?.addEventListener("click", () => {
    // Abrir modal agregar préstamo (pendiente crear modal HTML)
  });

  document.getElementById("btn-toggle-modal-pago")?.addEventListener("click", () => {
    // Abrir modal registrar pago (pendiente crear modal HTML)
  });
});

function renderTablaDeudores() {
  const tbody = document.getElementById("tabla-deudores");
  tbody.innerHTML = "";
  deudores.forEach(d => {
    let tipo = d.tipo == 2 ? "Especial" : "Normal";
    const fila = `
      <tr>
        <td class="p-2">${d.nombre} ${d.apellido}</td>
        <td class="p-2">${d.id}</td>
        <td class="p-2">${d.telefono}</td>
        <td class="p-2">${d.direccion}</td>
        <td class="p-2">${tipo}</td>
      </tr>`;
    tbody.innerHTML += fila;
  });
}

function renderTablaPrestamos() {
  const tbody = document.getElementById("tabla-prestamos");
  tbody.innerHTML = "";
  prestamos.forEach(p => {
    const deudor = deudores.find(d => d.id === p.deudor);
    const nombreDeudor = deudor ? deudor.nombre + " " + deudor.apellido : "N/D";
    let estado = "Desconocido";
    if (p.estado === 1) estado = "Pendiente";
    if (p.estado === 2) estado = "Pagado";
    if (p.estado === 3) estado = "En mora";
    const fila = `
      <tr>
        <td class="p-2">${nombreDeudor}</td>
        <td class="p-2">${Number(p.monto).toLocaleString("es-CO")}</td>
        <td class="p-2">${Number(p.saldo_pendiente).toLocaleString("es-CO")}</td>
        <td class="p-2">${p.meses}</td>
        <td class="p-2">${formatearFecha(p.fecha)}</td>
        <td class="p-2">${estado}</td>
      </tr>`;
    tbody.innerHTML += fila;
  });
}

function renderTablaPagos() {
  const tbody = document.getElementById("tabla-pagos");
  tbody.innerHTML = "";
  pagos.forEach(p => {
    const prestamo = prestamos.find(pr => pr.id === p.prestamo);
    const deudor = deudores.find(d => d.id === prestamo?.deudor);
    const nombreDeudor = deudor ? deudor.nombre + " " + deudor.apellido : "N/D";
    const fila = `
      <tr>
        <td class="p-2">${nombreDeudor}</td>
        <td class="p-2">${Number(p.monto_pagado).toLocaleString("es-CO")}</td>
        <td class="p-2">${formatearFecha(p.fecha)}</td>
      </tr>`;
    tbody.innerHTML += fila;
  });
}

function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
