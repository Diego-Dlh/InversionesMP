export async function fetchWithAuth(url) {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
}
