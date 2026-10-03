const app = document.querySelector("#app");
const state = {
  user: null,
  view: "beranda",
  kelas: [],
  error: "",
  sheet: null,
  identitas: {},
};

const savedTheme = localStorage.getItem("sdit-theme");
document.documentElement.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

const MARK = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="21.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <path d="M24 3.2 28.8 19.2 44.8 24 28.8 28.8 24 44.8 19.2 28.8 3.2 24 19.2 19.2Z"/>
  <circle class="mark-core" cx="24" cy="24" r="3.2"/>
</svg>`;

const ICONS = {
  beranda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.6 12 4.2l7.5 6.4V19a1 1 0 0 1-1 1h-4.2v-5.2H9.7V20H5.5a1 1 0 0 1-1-1z"/></svg>`,
  siswa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.1"/><path d="M5.2 19.2c1.1-2.9 3.5-4.4 6.8-4.4s5.7 1.5 6.8 4.4"/></svg>`,
  absensi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.6v3M16 3.6v3M8.2 12.6l2.1 2.1 4.3-4.3"/></svg>`,
  spp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10.2h17"/></svg>`,
  kelas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 18.5V9.2L12 5.2l7.5 4v9.3"/><path d="M9.2 18.5v-4.2h5.6v4.2"/></svg>`,
  guru: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="2.7"/><path d="M3.8 18.4c.8-2.4 2.6-3.6 5.2-3.6s4.4 1.2 5.2 3.6"/><path d="M16.2 7.2a2.3 2.3 0 0 1 0 4.4M16.6 14.8c1.5.4 2.6 1.4 3.2 3.6"/></svg>`,
  nilai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 4.5 19.5 9.8 9.2 20.1 4 20.9l.8-5.2z"/><path d="M12.6 6.1 17.9 11.4"/></svg>`,
  rapor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 3.8h7.2L19 8.6V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1z"/><path d="M14 3.8V8.8h5M8.5 13h7M8.5 16.5h5"/></svg>`,
  jadwal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12.2" r="7.4"/><path d="M12 8.4v4.1l2.7 1.7"/></svg>`,
  rekap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19V5.5M5 19h14"/><path d="M8.5 15.5v-4M12 15.5V8.5M15.5 15.5v-2.2"/></svg>`,
  ekskul: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.8 14.2 9l5.5.5-4.2 3.6 1.3 5.3L12 15.6 7.2 18.4 8.5 13.1 4.3 9.5 9.8 9z"/></svg>`,
  hafalan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.2c-1.8-1.4-4.2-1.8-7-1.4v13.2c2.8-.4 5.2 0 7 1.4 1.8-1.4 4.2-1.8 7-1.4V4.8c-2.8-.4-5.2 0-7 1.4z"/><path d="M12 6.2v13.2"/></svg>`,
  kartu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.2" y="6" width="17.6" height="12" rx="2"/><circle cx="8.2" cy="12" r="1.7"/><path d="M12 10.4h5.2M12 13.6h3.6"/></svg>`,
  pengumuman: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 9.2h2.2l6.2-3.2v12l-6.2-3.2H6.2a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1z"/><path d="M8.4 14.8v2.6a1.6 1.6 0 0 0 1.6 1.6h.4M16.6 9.4a3.2 3.2 0 0 1 0 5.2"/></svg>`,
  profil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5h16M6 19.5V9.2L12 4.6l6 4.6v10.3"/><path d="M10 19.5v-4.2h4v4.2"/></svg>`,
  sandi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.2" cy="12.2" r="3.4"/><path d="M11.2 12.2H20M17.2 12.2v2.3M14.4 12.2v1.6"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`,
};

function logoSrc() {
  return `/logo.png?v=${state.identitas?.logo_rev || 0}`;
}

function contactLine(profil) {
  return [profil?.telepon, profil?.instagram].filter(Boolean).join(" · ");
}

async function loadIdentitas() {
  try {
    const data = await api("/api/identitas");
    state.identitas = data.identitas || {};
    if (state.identitas.nama) document.title = state.identitas.nama;
  } catch {
    state.identitas = state.identitas || {};
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(n || 0);
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthISO() {
  return todayISO().slice(0, 7);
}

function bulanLabel(periode) {
  const [y, m] = periode.split("-");
  const nama = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${nama[Number(m) - 1]} ${y}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Permintaan gagal");
  return data;
}

const MENU_VIEWS = new Set(["menu", "guru", "kelas", "nilai", "jadwal", "pengumuman", "profil", "sandi", "rekap", "ekskul", "catatan", "rapor", "hafalan", "kartu"]);

function fotoUrl(siswa) {
  return siswa?.foto ? `/api/siswa/${siswa.id}/foto` : "";
}

function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 720;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto tidak bisa dibaca"));
    };
    img.src = url;
  });
}

async function uploadFoto(id, file) {
  const foto = await fileToJpeg(file);
  await api(`/api/siswa/${id}/foto`, { method: "POST", body: JSON.stringify({ foto }) });
}

function shell(title, subtitle, body, back) {
  const groups = [
    ["Harian", [
      ["beranda", "Beranda"],
      ["siswa", "Siswa"],
      ["absensi", "Absensi"],
      ["spp", "SPP"],
    ]],
    ["Akademik", [
      ["kelas", "Kelas"],
      ["guru", "Guru"],
      ["nilai", "Nilai"],
      ["rapor", "Rapor"],
      ["jadwal", "Jadwal"],
      ["rekap", "Rekap hadir"],
      ["ekskul", "Ekskul"],
      ["hafalan", "Hafalan"],
      ["kartu", "Kartu pelajar"],
    ]],
    ["Sekolah", [
      ["pengumuman", "Pengumuman"],
      ["profil", "Profil sekolah"],
      ["sandi", "Kata sandi"],
    ]],
  ];
  const nav = groups.map(([label, items]) => `
    <p class="nav-label">${label}</p>
    ${items.map(([id, text]) => `<button type="button" data-nav="${id}" class="${state.view === id ? "active" : ""}">${ICONS[id] || ""}<span>${text}</span></button>`).join("")}
  `).join("");
  const backBtn = back
    ? `<button class="btn ghost small" type="button" id="back-menu">Menu</button>`
    : "";
  const sekolah = state.identitas || {};
  return `<div class="shell">
    <button class="nav-backdrop" type="button" aria-label="Tutup menu"></button>
    <nav class="nav">
      <div class="brand side-brand">
        <img class="logo" src="${logoSrc()}" alt="">
        <div>
          <div class="brand-name">${esc(sekolah.nama || "Sekolah")}</div>
          <small>Admin sekolah</small>
        </div>
      </div>
      <div class="nav-scroll">${nav}</div>
      <div class="nav-foot">
        <span>${esc(state.user?.nama || "Admin")}</span>
        <button type="button" data-logout>Keluar</button>
      </div>
    </nav>
    <header class="topbar">
      <div class="topbar-start">
        <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Buka menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14M5 12h14M5 16.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="brand topbar-brand">
          <img class="logo" src="${logoSrc()}" alt="">
          <div>
            <div class="brand-name">${esc(sekolah.nama || "Sekolah")}</div>
            <small>Admin sekolah</small>
          </div>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="who">${esc(state.user?.nama || "")}</span>
        <button class="btn ghost small" type="button" id="theme-toggle">${document.documentElement.dataset.theme === "dark" ? "Terang" : "Gelap"}</button>
      </div>
    </header>
    <main class="main">
      <div class="page-head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        ${backBtn}
      </div>
      ${body}
    </main>
  </div>`;
}

function loginView() {
  const sekolah = state.identitas || {};
  app.innerHTML = `<section class="login">
    <div class="login-card">
      <img class="logo logo-lg" src="${logoSrc()}" alt="">
      ${sekolah.yayasan ? `<div class="eyebrow">${esc(sekolah.yayasan)}</div>` : ""}
      <h1>${esc(sekolah.nama || "Administrasi sekolah")}</h1>
      <p class="lede">${esc(sekolah.alamat || contactLine(sekolah) || "Masuk untuk mengelola sekolah")}</p>
      <button class="btn ghost small" type="button" id="theme-toggle" style="justify-self:center">${document.documentElement.dataset.theme === "dark" ? "Mode terang" : "Mode gelap"}</button>
      ${state.error ? `<div class="error">${esc(state.error)}</div>` : ""}
      <form id="login-form">
        <label>Nama pengguna<input name="username" autocomplete="username" required value="admin"></label>
        <label>Kata sandi<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Masuk</button>
      </form>
    </div>
  </section>`;
  const themeBtn = app.querySelector("#theme-toggle");
  themeBtn.onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("sdit-theme", next);
    themeBtn.textContent = next === "dark" ? "Mode terang" : "Mode gelap";
  };
  app.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    state.error = "";
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: fd.get("username"),
          password: fd.get("password"),
        }),
      });
      state.user = data.user;
      state.view = "beranda";
      await render();
    } catch (err) {
      state.error = err.message;
      loginView();
    }
  });
}

async function ensureKelas() {
  if (!state.kelas.length) {
    const data = await api("/api/kelas");
    state.kelas = data.kelas;
  }
}

async function renderBeranda() {
  const [data, news] = await Promise.all([api("/api/dashboard"), api("/api/pengumuman"), loadIdentitas()]);
  const sekolah = state.identitas || {};
  const kontak = contactLine(sekolah);
  const max = Math.max(...data.per_kelas.map((k) => k.jumlah), 1);
  const body = `
    <div class="home">
      <section class="stats">
        <article class="stat"><span>Siswa aktif</span><strong>${data.siswa}</strong></article>
        <article class="stat"><span>Guru</span><strong>${data.guru}</strong></article>
        <article class="stat"><span>Rombel</span><strong>${data.kelas}</strong></article>
        <article class="stat"><span>SPP terkumpul</span><strong>${esc(rupiah(data.spp.terkumpul))}</strong></article>
      </section>
      <article class="identity">
        <img src="${logoSrc()}" alt="">
        <div>
          ${sekolah.yayasan ? `<div class="eyebrow">${esc(sekolah.yayasan)}</div>` : ""}
          <h3>${esc(sekolah.nama || "Sekolah")}</h3>
          ${sekolah.alamat ? `<p>${esc(sekolah.alamat)}</p>` : ""}
          ${kontak ? `<p>${esc(kontak)}</p>` : ""}
        </div>
      </article>
      <div class="home-grid">
        <section class="panel">
          <h3 class="section-title">Pengumuman</h3>
          <div class="list">
            ${news.pengumuman.slice(0, 2).map((p) => `<article class="notice"><div class="meta">${esc(p.tanggal)}</div><h3>${esc(p.judul)}</h3><p>${esc(p.isi)}</p></article>`).join("") || `<p class="lede">Belum ada pengumuman.</p>`}
          </div>
        </section>
        <div class="stack">
          <section class="panel">
            <h3 class="section-title">Kehadiran hari ini</h3>
            <div class="metric-row cols-4">
              <div class="metric"><b>${data.absensi.hadir}</b><span>Hadir</span></div>
              <div class="metric"><b>${data.absensi.izin}</b><span>Izin</span></div>
              <div class="metric"><b>${data.absensi.sakit}</b><span>Sakit</span></div>
              <div class="metric"><b>${data.absensi.alfa}</b><span>Alfa</span></div>
            </div>
          </section>
          <section class="panel">
            <h3 class="section-title">SPP ${esc(bulanLabel(data.periode))}</h3>
            <div class="metric-row cols-3">
              <div class="metric"><b>${data.spp.lunas}</b><span>Lunas</span></div>
              <div class="metric"><b>${data.spp.tunggak}</b><span>Tunggak</span></div>
              <div class="metric"><b>${esc(rupiah(data.spp.nominal))}</b><span>Iuran</span></div>
            </div>
          </section>
        </div>
        <section class="panel">
          <h3 class="section-title">Siswa per kelas</h3>
          <div class="bars">
            ${data.per_kelas.map((k) => `<div class="bar-row"><span>${esc(k.nama)}</span><div class="track"><i style="width:${Math.max(8, Math.round((k.jumlah / max) * 100))}%"></i></div><strong>${k.jumlah}</strong></div>`).join("")}
          </div>
        </section>
      </div>
    </div>`;
  app.innerHTML = shell("Beranda", "Tahun ajaran 2026/2027", body);
  bindNav();
}

async function renderSiswa() {
  await ensureKelas();
  const q = state.q || "";
  const kelasId = state.kelasId || "";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kelasId) params.set("kelas_id", kelasId);
  const data = await api("/api/siswa?" + params.toString());
  const options = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(kelasId) ? "selected" : ""}>${esc(k.nama)}</option>`).join("");
  const body = `
    <div class="filters">
      <input id="q" placeholder="Cari nama atau NIS" value="${esc(q)}">
      <select id="kelas">${`<option value="">Semua</option>` + options}</select>
    </div>
    <button class="btn" id="add-siswa" type="button">Tambah siswa</button>
    <div class="list" style="margin-top:0.75rem">
      ${data.siswa.map((s) => `<article class="person">
        <div class="avatar ${s.jk === "P" ? "p" : ""}">${s.foto ? `<img src="${fotoUrl(s)}" alt="">` : esc(s.nama.slice(0, 1))}</div>
        <div>
          <h3>${esc(s.nama)}</h3>
          <div class="meta">NIS ${esc(s.nis)} · Kelas ${esc(s.kelas)} · ${s.jk === "L" ? "Laki-laki" : "Perempuan"}</div>
          <div class="meta">${esc(s.nama_wali || "Wali belum diisi")} ${s.hp_wali ? "· " + esc(s.hp_wali) : ""}</div>
        </div>
        <div class="row-actions">
          <button class="btn ghost small" data-kartu="${s.id}" type="button">Kartu</button>
          <button class="btn ghost small" data-rapor="${s.id}" type="button">Rapor</button>
          <button class="btn ghost small" data-note="${s.id}" type="button">Catatan</button>
          <button class="btn ghost small" data-edit="${s.id}" type="button">Ubah</button>
        </div>
      </article>`).join("") || `<p class="lede">Belum ada siswa.</p>`}
    </div>`;
  app.innerHTML = shell("Siswa", `${data.siswa.length} data`, body);
  bindNav();
  const search = () => {
    state.q = app.querySelector("#q").value.trim();
    state.kelasId = app.querySelector("#kelas").value;
    renderSiswa();
  };
  app.querySelector("#kelas").addEventListener("change", search);
  app.querySelector("#q").addEventListener("change", search);
  app.querySelector("#add-siswa").addEventListener("click", () => openSiswaForm());
  app.querySelectorAll("[data-kartu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siswa = data.siswa.find((s) => String(s.id) === btn.dataset.kartu);
      state.kartuId = btn.dataset.kartu;
      state.kartuKelas = siswa ? String(siswa.kelas_id) : "";
      state.view = "kartu";
      render();
    });
  });
  app.querySelectorAll("[data-rapor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.siswaId = btn.dataset.rapor;
      state.view = "rapor";
      render();
    });
  });
  app.querySelectorAll("[data-note]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.siswaId = btn.dataset.note;
      state.view = "catatan";
      render();
    });
  });
  app.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siswa = data.siswa.find((s) => String(s.id) === btn.dataset.edit);
      openSiswaForm(siswa);
    });
  });
}

function openSiswaForm(siswa) {
  const options = state.kelas.map((k) => `<option value="${k.id}" ${siswa && siswa.kelas_id === k.id ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>${siswa ? "Ubah siswa" : "Siswa baru"}</h2>
    <form id="siswa-form">
      <label>NIS<input name="nis" required value="${esc(siswa?.nis || "")}"></label>
      <label>Nama<input name="nama" required value="${esc(siswa?.nama || "")}"></label>
      <label>Jenis kelamin
        <select name="jk">
          <option value="L" ${siswa?.jk === "P" ? "" : "selected"}>Laki-laki</option>
          <option value="P" ${siswa?.jk === "P" ? "selected" : ""}>Perempuan</option>
        </select>
      </label>
      <label>Kelas<select name="kelas_id">${options}</select></label>
      <label>Nama wali<input name="nama_wali" value="${esc(siswa?.nama_wali || "")}"></label>
      <label>HP wali<input name="hp_wali" value="${esc(siswa?.hp_wali || "")}"></label>
      <label class="foto-field">Foto siswa
        <span class="foto-slot" id="foto-slot">${siswa?.foto ? `<img src="${fotoUrl(siswa)}" alt="">` : "Foto"}</span>
        <input id="foto-file" type="file" accept="image/*">
      </label>
      <div id="form-error"></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" id="cancel">Batal</button>
        <button class="btn" type="submit">Simpan</button>
      </div>
      ${siswa ? `<button class="btn warn" style="margin-top:0.5rem" type="button" id="hapus">Hapus siswa</button>` : ""}
    </form>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#cancel").onclick = () => sheet.remove();
  sheet.addEventListener("click", (event) => { if (event.target === sheet) sheet.remove(); });
  const fotoInput = sheet.querySelector("#foto-file");
  fotoInput.addEventListener("change", () => {
    const file = fotoInput.files[0];
    if (!file) return;
    const slot = sheet.querySelector("#foto-slot");
    slot.innerHTML = `<img alt="" src="${URL.createObjectURL(file)}">`;
  });
  sheet.querySelector("#siswa-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      const saved = await api(siswa ? `/api/siswa/${siswa.id}` : "/api/siswa", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const file = sheet.querySelector("#foto-file").files[0];
      if (file) await uploadFoto(siswa?.id || saved.id, file);
      sheet.remove();
      renderSiswa();
    } catch (err) {
      sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
  const hapus = sheet.querySelector("#hapus");
  if (hapus) {
    hapus.onclick = async () => {
      if (!confirm("Hapus data siswa ini beserta absensi dan SPP-nya?")) return;
      await api(`/api/siswa/${siswa.id}`, { method: "DELETE" });
      sheet.remove();
      renderSiswa();
    };
  }
}

async function renderAbsensi() {
  await ensureKelas();
  state.tanggal = state.tanggal || todayISO();
  state.absenKelas = state.absenKelas || String(state.kelas[0]?.id || "");
  const data = await api(`/api/absensi?tanggal=${state.tanggal}&kelas_id=${state.absenKelas}`);
  const options = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.absenKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const body = `
    <div class="filters">
      <input id="tanggal" type="date" value="${esc(state.tanggal)}">
      <select id="absen-kelas">${options}</select>
    </div>
    <form id="absen-form">
      ${data.siswa.map((s) => `<div class="absen-row">
        <div>
          <strong>${esc(s.nama)}</strong>
          <div class="meta">NIS ${esc(s.nis)}</div>
        </div>
        <div class="seg" data-id="${s.id}">
          ${["hadir", "izin", "sakit", "alfa"].map((st) => `<button type="button" data-status="${st}" class="${s.status === st ? "on-" + st : ""}">${st}</button>`).join("")}
        </div>
      </div>`).join("") || `<p class="lede">Kelas ini belum memiliki siswa.</p>`}
      ${data.siswa.length ? `<button class="btn" style="margin-top:0.9rem" type="submit">Simpan absensi</button>` : ""}
    </form>`;
  app.innerHTML = shell("Absensi", "Sentuh status, lalu simpan", body);
  bindNav();
  const reload = () => {
    state.tanggal = app.querySelector("#tanggal").value;
    state.absenKelas = app.querySelector("#absen-kelas").value;
    renderAbsensi();
  };
  app.querySelector("#tanggal").addEventListener("change", reload);
  app.querySelector("#absen-kelas").addEventListener("change", reload);
  app.querySelectorAll(".seg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrap = btn.parentElement;
      wrap.querySelectorAll("button").forEach((b) => b.className = "");
      btn.className = "on-" + btn.dataset.status;
    });
  });
  const form = app.querySelector("#absen-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const items = [...form.querySelectorAll(".seg")].map((seg) => {
      const active = seg.querySelector("button[class^='on-']");
      return { siswa_id: Number(seg.dataset.id), status: active ? active.dataset.status : "hadir" };
    });
    await api("/api/absensi", {
      method: "POST",
      body: JSON.stringify({ tanggal: state.tanggal, items }),
    });
    const btn = form.querySelector("button[type=submit]");
    btn.textContent = "Tersimpan";
  });
}

async function renderSpp() {
  state.periode = state.periode || monthISO();
  const data = await api("/api/spp?periode=" + state.periode);
  const lunas = data.tagihan.filter((t) => t.status === "lunas").length;
  const body = `
    <form class="panel spp-setting" id="spp-setting">
      <div>
        <h3 class="section-title">Pengaturan iuran</h3>
        <p>Nominal ini dipakai untuk tagihan yang belum lunas. Pembayaran yang sudah lunas tetap memakai nominal saat dicatat.</p>
      </div>
      <div class="spp-setting-row">
        <label>Iuran per siswa
          <input id="spp-nominal" inputmode="numeric" min="1000" max="5000000" step="1000" type="number" value="${Number(data.nominal)}" required>
        </label>
        <button class="btn" type="submit">Simpan iuran</button>
      </div>
      <p class="spp-note" id="spp-note"></p>
    </form>
    <div class="filters">
      <input id="periode" type="month" value="${esc(state.periode)}">
      <span class="chip ok">${lunas}/${data.tagihan.length} lunas</span>
    </div>
    <div class="list">
      ${data.tagihan.map((t) => `<article class="bill">
        <div>
          <h3>${esc(t.nama)}</h3>
          <div class="meta">Kelas ${esc(t.kelas)} · ${esc(rupiah(t.nominal))}</div>
        </div>
        <span class="chip ${t.status === "lunas" ? "ok" : "bad"}">${t.status}</span>
        <button class="btn small ${t.status === "lunas" ? "ghost" : ""}" data-siswa="${t.siswa_id}" data-next="${t.status === "lunas" ? "tunggak" : "lunas"}" type="button">${t.status === "lunas" ? "Batalkan" : "Lunas"}</button>
      </article>`).join("")}
    </div>`;
  app.innerHTML = shell("Iuran SPP", bulanLabel(state.periode), body);
  bindNav();
  app.querySelector("#spp-setting").addEventListener("submit", async (event) => {
    event.preventDefault();
    const nominal = Number(app.querySelector("#spp-nominal").value);
    const note = app.querySelector("#spp-note");
    try {
      await api("/api/spp/pengaturan", {
        method: "POST",
        body: JSON.stringify({ nominal }),
      });
      renderSpp();
    } catch (err) {
      note.textContent = err.message;
    }
  });
  app.querySelector("#periode").addEventListener("change", (event) => {
    state.periode = event.target.value;
    renderSpp();
  });
  app.querySelectorAll("[data-siswa]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api("/api/spp", {
        method: "POST",
        body: JSON.stringify({
          siswa_id: Number(btn.dataset.siswa),
          periode: state.periode,
          status: btn.dataset.next,
        }),
      });
      renderSpp();
    });
  });
}

async function renderGuru() {
  const data = await api("/api/guru");
  const body = `
    <button class="btn" id="add-guru" type="button">Tambah guru</button>
    <div class="list" style="margin-top:0.75rem">
      ${data.guru.map((g) => `<article class="person">
        <div class="avatar">${esc(g.nama.replace(/^Ustazah |^Ust\. |^Ibu /, "").slice(0, 1))}</div>
        <div>
          <h3>${esc(g.nama)}</h3>
          <div class="meta">${esc(g.jabatan)} · ${esc(g.mapel)}</div>
          <div class="meta">${g.wali_kelas ? "Wali " + esc(g.wali_kelas) + " · " : ""}${esc(g.hp)}</div>
        </div>
        <button class="btn ghost small" data-edit="${g.id}" type="button">Ubah</button>
      </article>`).join("")}
    </div>`;
  app.innerHTML = shell("Guru", "Tenaga pendidik dan tata usaha", body, true);
  bindNav();
  app.querySelector("#add-guru").onclick = () => openGuruForm();
  app.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openGuruForm(data.guru.find((g) => String(g.id) === btn.dataset.edit));
  });
}

function openGuruForm(guru) {
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>${guru ? "Ubah guru" : "Guru baru"}</h2>
    <form id="guru-form">
      <label>Nama<input name="nama" required value="${esc(guru?.nama || "")}"></label>
      <label>Mapel<input name="mapel" required value="${esc(guru?.mapel || "")}"></label>
      <label>Jabatan<input name="jabatan" required value="${esc(guru?.jabatan || "")}"></label>
      <label>HP<input name="hp" value="${esc(guru?.hp || "")}"></label>
      <div id="form-error"></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" id="cancel">Batal</button>
        <button class="btn" type="submit">Simpan</button>
      </div>
      ${guru && !guru.wali_kelas ? `<button class="btn warn" style="margin-top:0.5rem" type="button" id="hapus">Hapus</button>` : ""}
    </form>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#cancel").onclick = () => sheet.remove();
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.remove(); });
  sheet.querySelector("#guru-form").onsubmit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api(guru ? `/api/guru/${guru.id}` : "/api/guru", { method: "POST", body: JSON.stringify(payload) });
      sheet.remove();
      renderGuru();
    } catch (err) {
      sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
  const hapus = sheet.querySelector("#hapus");
  if (hapus) {
    hapus.onclick = async () => {
      await api(`/api/guru/${guru.id}`, { method: "DELETE" });
      sheet.remove();
      renderGuru();
    };
  }
}

function menuButton(id, title, text) {
  return `<button type="button" class="menu-item" data-go="${id}"><strong>${title}</strong><span>${text}</span></button>`;
}

async function renderMenu() {
  const profil = await api("/api/profil");
  const p = profil.profil || {};
  const body = `
    <article class="stat menu-school">
      <span>${esc(p.tahun_ajaran || "Tahun ajaran")}</span>
      <strong>${esc(p.nama || "Sekolah")}</strong>
      <p>${esc(p.alamat || "Alamat belum diisi")}</p>
    </article>
    <h3 class="section-title">Akademik</h3>
    <div class="menu-grid">
      ${menuButton("guru", "Guru", "Tenaga pendidik dan tata usaha")}
      ${menuButton("kelas", "Pengaturan kelas", "Tingkat, rombel, ruang, dan wali")}
      ${menuButton("nilai", "Nilai", "Nilai semester per mapel")}
      ${menuButton("rapor", "Rapor", "Ringkasan untuk orang tua")}
      ${menuButton("kartu", "Kartu pelajar", "Cetak kartu, QR, dan foto")}
      ${menuButton("rekap", "Rekap hadir", "Ringkasan absensi sebulan")}
      ${menuButton("jadwal", "Jadwal", "Jam pelajaran tiap rombel")}
      ${menuButton("ekskul", "Ekskul", "Tahfidz, pramuka, dan lainnya")}
      ${menuButton("hafalan", "Setoran hafalan", "Surat, ayat, dan status setor")}
    </div>
    <h3 class="section-title">Sekolah</h3>
    <div class="menu-grid">
      ${menuButton("pengumuman", "Pengumuman", "Info untuk guru dan orang tua")}
      ${menuButton("profil", "Profil sekolah", "Nama, logo, alamat, dan kontak")}
    </div>
    <h3 class="section-title">Akun</h3>
    <div class="menu-grid">
      ${menuButton("sandi", "Kata sandi", state.user.nama)}
      <button type="button" class="menu-item" id="logout"><strong>Keluar</strong><span>Akhiri sesi admin</span></button>
    </div>`;
  app.innerHTML = shell("Menu", "Pengaturan sekolah", body);
  bindNav();
  app.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => { state.view = btn.dataset.go; render(); };
  });
  app.querySelector("#logout").onclick = async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    state.user = null;
    loginView();
  };
}

async function renderKelas() {
  const data = await api("/api/kelas");
  state.kelas = data.kelas;
  const groups = [1, 2, 3, 4, 5, 6].map((tingkat) => {
    const items = data.kelas.filter((k) => k.tingkat === tingkat);
    if (!items.length) return "";
    return `<h3 class="section-title">Tingkat ${tingkat}</h3>
      <div class="list">${items.map((k) => {
        const lebar = Math.min(100, Math.round((k.jumlah / Math.max(k.kapasitas, 1)) * 100));
        return `<article class="person">
          <div class="avatar">${esc(k.nama)}</div>
          <div>
            <h3>${esc(k.label || k.nama)}</h3>
            <div class="meta">Wali ${esc(k.wali || "belum diatur")} · ${esc(k.ruang || "ruang belum diisi")}</div>
            <div class="meta">${k.jumlah}/${k.kapasitas} siswa</div>
            <div class="track"><i style="width:${lebar}%"></i></div>
          </div>
          <div class="row-actions">
            <button class="btn ghost small" type="button" data-edit="${k.id}">Ubah</button>
            <button class="btn ghost small" type="button" data-del="${k.id}">Hapus</button>
          </div>
        </article>`;
      }).join("")}</div>`;
  }).join("");
  const body = `<button class="btn" type="button" id="add-kelas">Tambah rombel</button>${groups || `<p class="lede">Belum ada rombel.</p>`}`;
  app.innerHTML = shell("Pengaturan kelas", "Rombel tahun ajaran 2026/2027", body, true);
  bindNav();
  app.querySelector("#add-kelas").onclick = () => openKelasForm(null, data.kelas);
  app.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openKelasForm(data.kelas.find((k) => String(k.id) === btn.dataset.edit), data.kelas);
  });
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      const kelas = data.kelas.find((k) => String(k.id) === btn.dataset.del);
      if (!confirm(`Hapus kelas ${kelas.nama}?`)) return;
      try {
        await api(`/api/kelas/${kelas.id}`, { method: "DELETE" });
        state.kelas = [];
        renderKelas();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

async function openKelasForm(kelas) {
  const guru = await api("/api/guru");
  const rombel = kelas ? kelas.nama.replace(String(kelas.tingkat), "") : "A";
  const tingkatOpt = [1, 2, 3, 4, 5, 6].map((t) => `<option value="${t}" ${kelas && kelas.tingkat === t ? "selected" : ""}>Tingkat ${t}</option>`).join("");
  const waliOpt = `<option value="">Belum diatur</option>` + guru.guru.map((g) => `<option value="${g.id}" ${kelas && g.id === kelas.wali_id ? "selected" : ""}>${esc(g.nama)}</option>`).join("");
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>${kelas ? "Ubah kelas " + esc(kelas.nama) : "Rombel baru"}</h2>
    <form id="kelas-form">
      <label>Tingkat<select name="tingkat">${tingkatOpt}</select></label>
      <label>Rombel<input name="rombel" required maxlength="2" value="${esc(rombel)}" placeholder="A"></label>
      <label>Nama rombel<input name="julukan" maxlength="40" value="${esc(kelas?.julukan || "")}" placeholder="Imam Syafii"></label>
      <label>Wali kelas<select name="wali_id">${waliOpt}</select></label>
      <label>Ruang<input name="ruang" value="${esc(kelas?.ruang || "")}" placeholder="Ruang 1"></label>
      <label>Kapasitas<input name="kapasitas" type="number" min="1" max="40" required value="${kelas?.kapasitas || 28}"></label>
      <div id="form-error"></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" id="cancel">Batal</button>
        <button class="btn" type="submit">Simpan</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#cancel").onclick = () => sheet.remove();
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.remove(); });
  sheet.querySelector("#kelas-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api(kelas ? `/api/kelas/${kelas.id}` : "/api/kelas", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())),
      });
      state.kelas = [];
      sheet.remove();
      renderKelas();
    } catch (err) {
      sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function renderNilai() {
  await ensureKelas();
  state.nilaiKelas = state.nilaiKelas || String(state.kelas[0]?.id || "");
  state.mapel = state.mapel || "PAI";
  const data = await api(`/api/nilai?kelas_id=${state.nilaiKelas}&mapel=${encodeURIComponent(state.mapel)}`);
  const kelasOpt = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.nilaiKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const mapelOpt = data.mapel.map((m) => `<option ${m === state.mapel ? "selected" : ""}>${esc(m)}</option>`).join("");
  const body = `
    <div class="filters">
      <select id="nilai-kelas">${kelasOpt}</select>
      <select id="nilai-mapel">${mapelOpt}</select>
    </div>
    <form id="nilai-form">
      ${data.nilai.map((n) => `<label class="score-row">${esc(n.nama)}<input name="skor" data-id="${n.siswa_id}" type="number" min="0" max="100" required value="${n.skor ?? ""}"></label>`).join("")}
      ${data.nilai.length ? `<button class="btn" type="submit">Simpan nilai</button>` : `<p class="lede">Kelas ini belum memiliki siswa.</p>`}
    </form>`;
  app.innerHTML = shell("Nilai", data.semester, body, true);
  bindNav();
  const reload = () => {
    state.nilaiKelas = app.querySelector("#nilai-kelas").value;
    state.mapel = app.querySelector("#nilai-mapel").value;
    renderNilai();
  };
  app.querySelector("#nilai-kelas").onchange = reload;
  app.querySelector("#nilai-mapel").onchange = reload;
  const form = app.querySelector("#nilai-form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const items = [...form.querySelectorAll("input[name=skor]")].map((input) => ({
      siswa_id: Number(input.dataset.id),
      skor: Number(input.value),
    }));
    try {
      await api("/api/nilai", { method: "POST", body: JSON.stringify({ mapel: state.mapel, items }) });
      form.querySelector("button").textContent = "Tersimpan";
    } catch (err) {
      form.insertAdjacentHTML("beforeend", `<div class="error">${esc(err.message)}</div>`);
    }
  };
}

async function renderJadwal() {
  await ensureKelas();
  const guru = await api("/api/guru");
  state.jadwalKelas = state.jadwalKelas || String(state.kelas[0]?.id || "");
  const data = await api("/api/jadwal?kelas_id=" + state.jadwalKelas);
  const kelasOpt = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.jadwalKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const body = `
    <div class="filters">
      <select id="jadwal-kelas">${kelasOpt}</select>
      <button class="btn small" type="button" id="add-jadwal">Tambah</button>
    </div>
    <div class="list">
      ${data.jadwal.map((j) => `<article class="person">
        <div class="avatar">${esc(j.hari.slice(0, 2))}</div>
        <div>
          <h3>${esc(j.mapel)}</h3>
          <div class="meta">${esc(j.hari)} · ${esc(j.jam)} · ${esc(j.guru || "Guru belum diisi")}</div>
        </div>
        <button class="btn ghost small" type="button" data-del="${j.id}">Hapus</button>
      </article>`).join("") || `<p class="lede">Belum ada jadwal.</p>`}
    </div>`;
  app.innerHTML = shell("Jadwal", "Jam pelajaran", body, true);
  bindNav();
  app.querySelector("#jadwal-kelas").onchange = (event) => {
    state.jadwalKelas = event.target.value;
    renderJadwal();
  };
  app.querySelector("#add-jadwal").onclick = () => openJadwalForm(data, guru.guru);
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/jadwal/${btn.dataset.del}`, { method: "DELETE" });
      renderJadwal();
    };
  });
}

function openJadwalForm(data, guru) {
  const hari = data.hari.map((h) => `<option>${esc(h)}</option>`).join("");
  const mapel = data.mapel.map((m) => `<option>${esc(m)}</option>`).join("");
  const guruOpt = guru.map((g) => `<option value="${g.id}">${esc(g.nama)}</option>`).join("");
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>Jam pelajaran</h2>
    <form id="jadwal-form">
      <label>Hari<select name="hari">${hari}</select></label>
      <label>Jam<input name="jam" required placeholder="07.30" value="07.30"></label>
      <label>Mapel<select name="mapel">${mapel}</select></label>
      <label>Guru<select name="guru_id">${guruOpt}</select></label>
      <div id="form-error"></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" id="cancel">Batal</button>
        <button class="btn" type="submit">Simpan</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#cancel").onclick = () => sheet.remove();
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.remove(); });
  sheet.querySelector("#jadwal-form").onsubmit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());
    payload.kelas_id = state.jadwalKelas;
    try {
      await api("/api/jadwal", { method: "POST", body: JSON.stringify(payload) });
      sheet.remove();
      renderJadwal();
    } catch (err) {
      sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function renderPengumuman() {
  const data = await api("/api/pengumuman");
  const body = `
    <button class="btn" type="button" id="add-pengumuman">Tulis pengumuman</button>
    <div class="list" style="margin-top:0.75rem">
      ${data.pengumuman.map((p) => `<article class="card notice">
        <div class="meta">${esc(p.tanggal)}</div>
        <h3>${esc(p.judul)}</h3>
        <p>${esc(p.isi)}</p>
        <button class="btn ghost small" type="button" data-del="${p.id}">Hapus</button>
      </article>`).join("") || `<p class="lede">Belum ada pengumuman.</p>`}
    </div>`;
  app.innerHTML = shell("Pengumuman", "Papan informasi sekolah", body, true);
  bindNav();
  app.querySelector("#add-pengumuman").onclick = () => {
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.innerHTML = `<div class="sheet-card">
      <h2>Pengumuman baru</h2>
      <form id="pengumuman-form">
        <label>Judul<input name="judul" required></label>
        <label>Isi<textarea name="isi" required rows="4"></textarea></label>
        <div id="form-error"></div>
        <div class="sheet-actions">
          <button class="btn ghost" type="button" id="cancel">Batal</button>
          <button class="btn" type="submit">Terbitkan</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(sheet);
    sheet.querySelector("#cancel").onclick = () => sheet.remove();
    sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.remove(); });
    sheet.querySelector("#pengumuman-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api("/api/pengumuman", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())),
        });
        sheet.remove();
        renderPengumuman();
      } catch (err) {
        sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    };
  };
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/pengumuman/${btn.dataset.del}`, { method: "DELETE" });
      renderPengumuman();
    };
  });
}

async function renderProfil() {
  const data = await api("/api/profil");
  const p = data.profil;
  const body = `<form id="profil-form" class="card form-card">
    <div class="profil-logo-field">
      <img class="logo" src="${logoSrc()}" alt="">
      <label>Logo sekolah<input name="logo" type="file" accept="image/*"></label>
      ${p.punya_logo ? `<button class="btn ghost small" type="button" id="hapus-logo">Gunakan logo bawaan</button>` : ""}
    </div>
    <label>Nama sekolah<input name="nama" required value="${esc(p.nama)}"></label>
    <label>Yayasan<input name="yayasan" value="${esc(p.yayasan || "")}"></label>
    <label>NPSN<input name="npsn" value="${esc(p.npsn)}"></label>
    <label>Tahun ajaran<input name="tahun_ajaran" required value="${esc(p.tahun_ajaran)}"></label>
    <label>Kepala sekolah<input name="kepala" value="${esc(p.kepala)}"></label>
    <label>Ketua yayasan<input name="ketua_yayasan" value="${esc(p.ketua_yayasan || "")}"></label>
    <label>Telepon<input name="telepon" value="${esc(p.telepon)}"></label>
    <label>Instagram<input name="instagram" value="${esc(p.instagram || "")}" placeholder="@sekolah"></label>
    <label>Alamat<textarea name="alamat" rows="3">${esc(p.alamat)}</textarea></label>
    <p class="spp-note" id="profil-note"></p>
    <button class="btn" type="submit">Simpan profil</button>
  </form>`;
  app.innerHTML = shell("Profil sekolah", "Identitas yang tampil di beranda, rapor, dan kartu", body, true);
  bindNav();
  const hapus = app.querySelector("#hapus-logo");
  if (hapus) {
    hapus.onclick = async () => {
      const data = await api("/api/profil/logo", { method: "DELETE" });
      state.identitas = { ...state.identitas, ...data.profil };
      renderProfil();
    };
  }
  app.querySelector("#profil-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const note = app.querySelector("#profil-note");
    const fd = new FormData(form);
    const file = fd.get("logo");
    fd.delete("logo");
    try {
      const saved = await api("/api/profil", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(fd.entries())),
      });
      if (file && file.size) {
        const logo = await fileToJpeg(file);
        const uploaded = await api("/api/profil/logo", {
          method: "POST",
          body: JSON.stringify({ logo }),
        });
        state.identitas = { ...state.identitas, ...uploaded.profil };
      } else {
        state.identitas = { ...state.identitas, ...saved.profil };
      }
      if (state.identitas.nama) document.title = state.identitas.nama;
      renderProfil();
    } catch (err) {
      note.textContent = err.message;
    }
  };
}

async function renderSandi() {
  const body = `<form id="sandi-form" class="card form-card">
    <label>Kata sandi lama<input name="lama" type="password" required autocomplete="current-password"></label>
    <label>Kata sandi baru<input name="baru" type="password" required minlength="6" autocomplete="new-password"></label>
    <label>Ulangi kata sandi baru<input name="ulang" type="password" required minlength="6" autocomplete="new-password"></label>
    <div id="form-error"></div>
    <button class="btn" type="submit">Perbarui kata sandi</button>
  </form>`;
  app.innerHTML = shell("Kata sandi", state.user.nama, body, true);
  bindNav();
  app.querySelector("#sandi-form").onsubmit = async (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const box = app.querySelector("#form-error");
    if (fd.get("baru") !== fd.get("ulang")) {
      box.innerHTML = `<div class="error">Ulangan kata sandi tidak sama</div>`;
      return;
    }
    try {
      await api("/api/sandi", {
        method: "POST",
        body: JSON.stringify({ lama: fd.get("lama"), baru: fd.get("baru") }),
      });
      event.target.querySelector("button").textContent = "Kata sandi diperbarui";
      box.innerHTML = "";
    } catch (err) {
      box.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

async function renderRekap() {
  await ensureKelas();
  state.rekapPeriode = state.rekapPeriode || monthISO();
  state.rekapKelas = state.rekapKelas || String(state.kelas[0]?.id || "");
  const data = await api(`/api/rekap?periode=${state.rekapPeriode}&kelas_id=${state.rekapKelas}`);
  const kelasOpt = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.rekapKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const body = `
    <div class="filters">
      <input id="rekap-periode" type="month" value="${esc(state.rekapPeriode)}">
      <select id="rekap-kelas">${kelasOpt}</select>
    </div>
    <div class="list">
      ${data.rekap.map((r) => `<article class="card rekap">
        <div>
          <h3>${esc(r.nama)}</h3>
          <div class="meta">NIS ${esc(r.nis)}</div>
        </div>
        <div class="chips">
          <span class="chip ok">H ${r.hadir}</span>
          <span class="chip warn">I ${r.izin}</span>
          <span class="chip warn">S ${r.sakit}</span>
          <span class="chip bad">A ${r.alfa}</span>
        </div>
      </article>`).join("") || `<p class="lede">Belum ada siswa di kelas ini.</p>`}
    </div>`;
  app.innerHTML = shell("Rekap hadir", bulanLabel(state.rekapPeriode), body, true);
  bindNav();
  const reload = () => {
    state.rekapPeriode = app.querySelector("#rekap-periode").value;
    state.rekapKelas = app.querySelector("#rekap-kelas").value;
    renderRekap();
  };
  app.querySelector("#rekap-periode").onchange = reload;
  app.querySelector("#rekap-kelas").onchange = reload;
}

async function renderEkskul() {
  const data = await api("/api/ekskul");
  const body = `
    <button class="btn" type="button" id="add-ekskul">Tambah ekskul</button>
    <div class="list" style="margin-top:0.75rem">
      ${data.ekskul.map((e) => `<article class="card notice">
        <h3>${esc(e.nama)}</h3>
        <div class="meta">Pembina ${esc(e.pembina || "belum diisi")} · ${e.anggota.length} siswa</div>
        <div class="chips">${e.anggota.slice(0, 6).map((a) => `<span class="chip">${esc(a.nama.split(" ")[0])} ${esc(a.kelas)}</span>`).join("")}${e.anggota.length > 6 ? `<span class="chip">+${e.anggota.length - 6}</span>` : ""}</div>
        <div class="row-actions">
          <button class="btn ghost small" type="button" data-anggota="${e.id}">Anggota</button>
          <button class="btn ghost small" type="button" data-del="${e.id}">Hapus</button>
        </div>
      </article>`).join("")}
    </div>`;
  app.innerHTML = shell("Ekskul", "Kegiatan di luar jam kelas", body, true);
  bindNav();
  app.querySelector("#add-ekskul").onclick = () => openEkskulForm();
  app.querySelectorAll("[data-anggota]").forEach((btn) => {
    btn.onclick = () => openAnggotaForm(data, btn.dataset.anggota);
  });
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Hapus ekskul ini beserta anggotanya?")) return;
      await api(`/api/ekskul/${btn.dataset.del}`, { method: "DELETE" });
      renderEkskul();
    };
  });
}

function openEkskulForm() {
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>Ekskul baru</h2>
    <form id="ekskul-form">
      <label>Nama<input name="nama" required placeholder="Tahfidz"></label>
      <label>Pembina<input name="pembina" placeholder="Nama guru"></label>
      <div id="form-error"></div>
      <div class="sheet-actions">
        <button class="btn ghost" type="button" id="cancel">Batal</button>
        <button class="btn" type="submit">Simpan</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#cancel").onclick = () => sheet.remove();
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.remove(); });
  sheet.querySelector("#ekskul-form").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api("/api/ekskul", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) });
      sheet.remove();
      renderEkskul();
    } catch (err) {
      sheet.querySelector("#form-error").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  };
}

function openAnggotaForm(data, ekskulId) {
  const group = data.ekskul.find((e) => String(e.id) === String(ekskulId));
  const member = new Set(group.anggota.map((a) => a.siswa_id));
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-card">
    <h2>${esc(group.nama)}</h2>
    <div class="list">
      ${data.siswa.map((s) => `<button type="button" class="menu-item ${member.has(s.id) ? "on" : ""}" data-siswa="${s.id}">
        <strong>${esc(s.nama)}</strong><span>Kelas ${esc(s.kelas)} · ${member.has(s.id) ? "ikut" : "belum ikut"}</span>
      </button>`).join("")}
    </div>
    <button class="btn" type="button" id="tutup" style="margin-top:0.8rem">Selesai</button>
  </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector("#tutup").onclick = () => { sheet.remove(); renderEkskul(); };
  sheet.addEventListener("click", (e) => { if (e.target === sheet) { sheet.remove(); renderEkskul(); } });
  sheet.querySelectorAll("[data-siswa]").forEach((btn) => {
    btn.onclick = async () => {
      await api("/api/ekskul/anggota", {
        method: "POST",
        body: JSON.stringify({ ekskul_id: Number(ekskulId), siswa_id: Number(btn.dataset.siswa) }),
      });
      sheet.remove();
      const fresh = await api("/api/ekskul");
      openAnggotaForm(fresh, ekskulId);
    };
  });
}

async function renderCatatan() {
  const data = await api(`/api/siswa/${state.siswaId}/catatan`);
  const s = data.siswa;
  const body = `
    <article class="person">
      <div class="avatar ${s.jk === "P" ? "p" : ""}">${esc(s.nama.slice(0, 1))}</div>
      <div>
        <h3>${esc(s.nama)}</h3>
        <div class="meta">NIS ${esc(s.nis)} · Kelas ${esc(s.kelas)} · Wali ${esc(s.nama_wali || "-")}</div>
      </div>
    </article>
    <form id="catatan-form" class="card form-card">
      <label>Catatan wali<textarea name="isi" required rows="3" placeholder="Perkembangan hafalan, sikap, atau pesan untuk orang tua"></textarea></label>
      <button class="btn" type="submit">Simpan catatan</button>
    </form>
    <div class="list">
      ${data.catatan.map((c) => `<article class="card notice">
        <div class="meta">${esc(c.tanggal)}</div>
        <p>${esc(c.isi)}</p>
        <button class="btn ghost small" type="button" data-del="${c.id}">Hapus</button>
      </article>`).join("") || `<p class="lede">Belum ada catatan.</p>`}
    </div>`;
  app.innerHTML = shell("Catatan siswa", s.nama, body, true);
  bindNav();
  const back = app.querySelector("#back-menu");
  if (back) back.onclick = () => { state.view = "siswa"; render(); };
  app.querySelector("#catatan-form").onsubmit = async (event) => {
    event.preventDefault();
    const isi = new FormData(event.target).get("isi");
    await api("/api/catatan", { method: "POST", body: JSON.stringify({ siswa_id: state.siswaId, isi }) });
    renderCatatan();
  };
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/catatan/${btn.dataset.del}`, { method: "DELETE" });
      renderCatatan();
    };
  });
}

function predikat(skor) {
  if (skor === null || skor === undefined || skor === "") return "—";
  if (skor >= 90) return "Sangat baik";
  if (skor >= 80) return "Baik";
  if (skor >= 70) return "Cukup";
  return "Perlu bimbingan";
}

async function renderRapor() {
  if (!state.siswaId) {
    await ensureKelas();
    state.raporKelas = state.raporKelas || String(state.kelas[0]?.id || "");
    const siswa = await api("/api/siswa?kelas_id=" + state.raporKelas);
    const kelasOpt = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.raporKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
    const body = `
      <div class="filters"><select id="rapor-kelas">${kelasOpt}</select></div>
      <div class="list">
        ${siswa.siswa.map((s) => `<button type="button" class="menu-item" data-pilih="${s.id}"><strong>${esc(s.nama)}</strong><span>NIS ${esc(s.nis)} · Kelas ${esc(s.kelas)}</span></button>`).join("") || `<p class="lede">Kelas ini belum memiliki siswa.</p>`}
      </div>`;
    app.innerHTML = shell("Rapor", "Pilih siswa", body, true);
    bindNav();
    app.querySelector("#rapor-kelas").onchange = (event) => {
      state.raporKelas = event.target.value;
      renderRapor();
    };
    app.querySelectorAll("[data-pilih]").forEach((btn) => {
      btn.onclick = () => { state.siswaId = btn.dataset.pilih; renderRapor(); };
    });
    return;
  }
  const data = await api(`/api/siswa/${state.siswaId}/rapor`);
  const s = data.siswa;
  const p = data.profil;
  const a = data.absensi;
  const body = `
    <div class="no-print row-actions" style="margin-bottom:0.8rem">
      <button class="btn small" type="button" id="cetak">Cetak</button>
      <button class="btn ghost small" type="button" id="ganti">Ganti siswa</button>
    </div>
    <article class="card rapor" id="lembar">
      <header class="rapor-head">
        <img src="${logoSrc()}" alt="">
        <div>
          ${p.yayasan ? `<div class="eyebrow">${esc(p.yayasan)}</div>` : ""}
          <h3>${esc(p.nama || "Sekolah")}</h3>
          <p>${esc(p.alamat || "")}</p>
        </div>
      </header>
      <h2>Rapor Siswa</h2>
      <p class="meta">${esc(data.semester)}</p>
      <dl class="rapor-id">
        <div><dt>Nama</dt><dd>${esc(s.nama)}</dd></div>
        <div><dt>NIS</dt><dd>${esc(s.nis)}</dd></div>
        <div><dt>Kelas</dt><dd>${esc(s.kelas)}</dd></div>
        <div><dt>Wali kelas</dt><dd>${esc(s.wali_kelas || "—")}</dd></div>
        <div><dt>Orang tua</dt><dd>${esc(s.nama_wali || "—")}</dd></div>
      </dl>
      <h3 class="section-title">Nilai</h3>
      <table class="rapor-table">
        <thead><tr><th>Mapel</th><th>Nilai</th><th>Predikat</th></tr></thead>
        <tbody>
          ${data.nilai.map((n) => `<tr><td>${esc(n.mapel)}</td><td>${n.skor ?? "—"}</td><td>${esc(predikat(n.skor))}</td></tr>`).join("")}
        </tbody>
      </table>
      <p class="meta">Rata-rata ${data.rata ?? "—"} · ${esc(predikat(data.rata))}</p>
      <h3 class="section-title">Kehadiran tercatat</h3>
      <div class="chips">
        <span class="chip ok">Hadir ${a.hadir}</span>
        <span class="chip warn">Izin ${a.izin}</span>
        <span class="chip warn">Sakit ${a.sakit}</span>
        <span class="chip bad">Alfa ${a.alfa}</span>
      </div>
      <h3 class="section-title">Hafalan</h3>
      ${data.hafalan.length ? data.hafalan.map((h) => `<p class="rapor-note"><span>${esc(h.tanggal)} · ${esc(h.status)}</span>${esc(h.surat)}${h.ayat ? " ayat " + esc(h.ayat) : ""}${h.catatan ? " — " + esc(h.catatan) : ""}</p>`).join("") : `<p class="meta">Belum ada setoran.</p>`}
      <h3 class="section-title">Ekskul</h3>
      ${data.ekskul.length ? `<ul class="rapor-list">${data.ekskul.map((e) => `<li>${esc(e.nama)}${e.pembina ? " · " + esc(e.pembina) : ""}</li>`).join("")}</ul>` : `<p class="meta">Belum mengikuti ekskul.</p>`}
      <h3 class="section-title">Catatan wali</h3>
      ${data.catatan.length ? data.catatan.map((c) => `<p class="rapor-note"><span>${esc(c.tanggal)}</span> ${esc(c.isi)}</p>`).join("") : `<p class="meta">Belum ada catatan.</p>`}
      <div class="rapor-sign">
        <div><span>Orang tua</span><b>&nbsp;</b></div>
        <div><span>Wali kelas</span><b>${esc(s.wali_kelas || "")}</b></div>
        <div><span>Kepala sekolah</span><b>${esc(p.kepala || "")}</b></div>
        <div><span>Ketua yayasan</span><b>${esc(p.ketua_yayasan || "")}</b></div>
      </div>
    </article>`;
  app.innerHTML = shell("Rapor", s.nama, body, true);
  bindNav();
  app.querySelector("#cetak").onclick = () => window.print();
  app.querySelector("#ganti").onclick = () => { state.siswaId = null; renderRapor(); };
}

async function renderHafalan() {
  await ensureKelas();
  state.hafalanKelas = state.hafalanKelas || String(state.kelas[0]?.id || "");
  const data = await api("/api/hafalan?kelas_id=" + state.hafalanKelas);
  const kelasOpt = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.hafalanKelas) ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const siswaOpt = data.siswa.map((s) => `<option value="${s.id}">${esc(s.nama)}</option>`).join("");
  const statusLabel = { setor: "Setor", ulang: "Ulang", lulus: "Lulus" };
  const body = `
    <div class="filters"><select id="hafalan-kelas">${kelasOpt}</select></div>
    <form id="hafalan-form" class="card form-card">
      <label>Siswa<select name="siswa_id">${siswaOpt}</select></label>
      <label>Surat<input name="surat" required placeholder="An-Nas"></label>
      <label>Ayat<input name="ayat" placeholder="1–6"></label>
      <label>Status
        <select name="status">
          <option value="setor">Setor</option>
          <option value="ulang">Ulang</option>
          <option value="lulus">Lulus</option>
        </select>
      </label>
      <label>Catatan<input name="catatan" placeholder="Tajwid, makhraj, atau kelancaran"></label>
      <button class="btn" type="submit">Catat setoran</button>
    </form>
    <div class="list" style="margin-top:0.8rem">
      ${data.hafalan.map((h) => `<article class="card notice">
        <div class="meta">${esc(h.tanggal)} · ${esc(h.kelas)}</div>
        <h3>${esc(h.siswa)} · ${esc(h.surat)}${h.ayat ? " " + esc(h.ayat) : ""}</h3>
        <span class="chip ${h.status === "lulus" ? "ok" : h.status === "ulang" ? "warn" : ""}">${statusLabel[h.status] || h.status}</span>
        ${h.catatan ? `<p>${esc(h.catatan)}</p>` : ""}
        <button class="btn ghost small" type="button" data-del="${h.id}">Hapus</button>
      </article>`).join("") || `<p class="lede">Belum ada setoran di kelas ini.</p>`}
    </div>`;
  app.innerHTML = shell("Setoran hafalan", "Tahsin dan tahfidz", body, true);
  bindNav();
  app.querySelector("#hafalan-kelas").onchange = (event) => {
    state.hafalanKelas = event.target.value;
    renderHafalan();
  };
  app.querySelector("#hafalan-form").onsubmit = async (event) => {
    event.preventDefault();
    const box = event.target;
    try {
      await api("/api/hafalan", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(box).entries())) });
      renderHafalan();
    } catch (err) {
      box.insertAdjacentHTML("beforeend", `<div class="error">${esc(err.message)}</div>`);
    }
  };
  app.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/hafalan/${btn.dataset.del}`, { method: "DELETE" });
      renderHafalan();
    };
  });
}

function bindNav() {
  const shellEl = app.querySelector(".shell");
  const toggle = app.querySelector("#nav-toggle");
  const closeNav = () => {
    shellEl?.classList.remove("nav-open");
    toggle?.setAttribute("aria-expanded", "false");
  };
  if (toggle && shellEl) {
    toggle.onclick = () => {
      const open = shellEl.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
  }
  app.querySelector(".nav-backdrop")?.addEventListener("click", closeNav);
  app.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeNav();
      state.view = btn.dataset.nav;
      render();
    });
  });
  const back = app.querySelector("#back-menu");
  if (back) back.onclick = () => { state.view = "menu"; render(); };
  app.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.onclick = async () => {
      await api("/api/logout", { method: "POST", body: "{}" });
      state.user = null;
      loginView();
    };
  });
  const themeBtn = app.querySelector("#theme-toggle");
  if (themeBtn) {
    themeBtn.onclick = () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("sdit-theme", next);
      themeBtn.textContent = next === "dark" ? "Terang" : "Gelap";
    };
  }
}

function studentCard(siswa, profil) {
  const sekolah = profil || {};
  const photo = siswa.foto
    ? `<img src="${fotoUrl(siswa)}" alt="">`
    : `<span>Foto</span>`;
  return `<article class="idcard">
    <div class="idcard-top">
      <img src="${logoSrc()}" alt="">
      <div>
        <strong>${esc(sekolah.nama || "Sekolah")}</strong>
        <span>Kartu Pelajar</span>
      </div>
    </div>
    <label class="idcard-photo">
      ${photo}
      <input class="no-print" type="file" accept="image/*" data-foto="${siswa.id}" aria-label="Unggah foto ${esc(siswa.nama)}">
    </label>
    <div class="idcard-body">
      <h3>${esc(siswa.nama)}</h3>
      <p>Kelas ${esc(siswa.kelas)}</p>
      <p>${esc(sekolah.tahun_ajaran || "")}</p>
      <b class="idcard-nis">${esc(siswa.nis)}</b>
    </div>
    ${siswa.qr || ""}
  </article>`;
}

async function renderKartu() {
  await ensureKelas();
  const profil = await api("/api/profil");
  state.identitas = { ...state.identitas, ...profil.profil };
  const params = new URLSearchParams();
  if (state.kartuKelas) params.set("kelas_id", state.kartuKelas);
  const data = await api("/api/siswa?" + params.toString());
  let siswa = data.siswa;
  if (state.kartuId) siswa = siswa.filter((s) => String(s.id) === String(state.kartuId));
  const options = state.kelas.map((k) => `<option value="${k.id}" ${String(k.id) === String(state.kartuKelas || "") ? "selected" : ""}>${esc(k.label || k.nama)}</option>`).join("");
  const body = `
    <div class="filters no-print">
      <select id="kartu-kelas"><option value="">Semua kelas</option>${options}</select>
      ${state.kartuId ? `<button class="btn ghost" id="kartu-semua" type="button">Satu kelas</button>` : ""}
      <button class="btn" id="cetak-kartu" type="button" ${siswa.length ? "" : "disabled"}>Cetak</button>
    </div>
    <p class="lede no-print">QR berisi NIS untuk dipindai saat belanja. Ketuk kotak foto untuk mengunggah.</p>
    <div class="card-sheet">
      ${siswa.map((s) => studentCard(s, profil.profil)).join("") || `<p class="lede">Belum ada siswa.</p>`}
    </div>`;
  app.innerHTML = shell("Kartu pelajar", `${siswa.length} kartu`, body, true);
  bindNav();
  app.querySelector("#kartu-kelas").addEventListener("change", (event) => {
    state.kartuKelas = event.target.value;
    state.kartuId = "";
    renderKartu();
  });
  const semua = app.querySelector("#kartu-semua");
  if (semua) {
    semua.onclick = () => {
      state.kartuId = "";
      renderKartu();
    };
  }
  const cetak = app.querySelector("#cetak-kartu");
  if (cetak) cetak.onclick = () => window.print();
  app.querySelectorAll("[data-foto]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await uploadFoto(input.dataset.foto, file);
        renderKartu();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function render() {
  if (!state.user) {
    loginView();
    return;
  }
  const views = {
    beranda: renderBeranda,
    siswa: renderSiswa,
    absensi: renderAbsensi,
    spp: renderSpp,
    menu: renderMenu,
    guru: renderGuru,
    kelas: renderKelas,
    nilai: renderNilai,
    rekap: renderRekap,
    rapor: renderRapor,
    kartu: renderKartu,
    hafalan: renderHafalan,
    ekskul: renderEkskul,
    catatan: renderCatatan,
    jadwal: renderJadwal,
    pengumuman: renderPengumuman,
    profil: renderProfil,
    sandi: renderSandi,
  };
  try {
    await views[state.view]();
  } catch (err) {
    if (String(err.message).includes("masuk")) {
      state.user = null;
      loginView();
      return;
    }
    app.innerHTML = shell("Gangguan", "", `<div class="error">${esc(err.message)}</div>`);
    bindNav();
  }
}

async function boot() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
  } catch {
    state.user = null;
  }
  await loadIdentitas();
  render();
}

boot();
