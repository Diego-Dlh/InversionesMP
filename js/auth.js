// js/auth.js
const form = document.getElementById("login-form");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const identificacion = document.getElementById("identificacion").value;
  const contraseña = document.getElementById("contraseña").value;

  try {
    const res = await fetch("http://31.97.138.41/api/login/", {

      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificacion, contraseña }),
    });

    if (!res.ok) throw new Error("Credenciales incorrectas");

    const data = await res.json();

    // Guardar token y datos del usuario
    localStorage.setItem("token", data.access);
    localStorage.setItem("usuario_id", data.usuario_id);
    localStorage.setItem("rol", data.rol);
    localStorage.setItem("nombre", data.nombre);

    // Redirigir según rol
  // Comparación que funciona para número o string
    if (data.rol == 1) {
    window.location.href = "admin.html";
    } else if (data.rol == 2) {
    window.location.href = "cobrador.html";
    } else {
    alert("Rol no autorizado");
    }


  } catch (error) {
    const toast = document.getElementById("toast-error");
    if (toast) {
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 3000);
    } else {
      alert("Error en login");
    }
  }
});
