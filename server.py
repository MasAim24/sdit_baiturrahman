#!/usr/bin/env python3
"""Administrasi SDIT Baiturrahman — local server for the Cloudflare tunnel."""

import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from qr import svg as qr_svg

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "sdit.db"
FOTO_DIR = ROOT / "data" / "foto"
LOGO_FILE = ROOT / "data" / "logo.jpg"
STATIC = ROOT / "static"
HOST = "127.0.0.1"
PORT = 5432
PBKDF2_ROUNDS = 120_000

SPP_DEFAULT = 175_000


def spp_nominal(conn):
    row = conn.execute("SELECT spp_nominal FROM profil WHERE id = 1").fetchone()
    if not row or row["spp_nominal"] is None:
        return SPP_DEFAULT
    return int(row["spp_nominal"])


def kelas_label(alias="k"):
    return (
        f"CASE WHEN TRIM(COALESCE({alias}.julukan, '')) = '' "
        f"THEN {alias}.nama ELSE {alias}.nama || ' · ' || {alias}.julukan END"
    )


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ROUNDS
    ).hex()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            nama TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS guru (
            id INTEGER PRIMARY KEY,
            nama TEXT NOT NULL,
            mapel TEXT NOT NULL,
            jabatan TEXT NOT NULL,
            hp TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS kelas (
            id INTEGER PRIMARY KEY,
            nama TEXT UNIQUE NOT NULL,
            tingkat INTEGER NOT NULL,
            wali_id INTEGER REFERENCES guru(id)
        );
        CREATE TABLE IF NOT EXISTS siswa (
            id INTEGER PRIMARY KEY,
            nis TEXT UNIQUE NOT NULL,
            nama TEXT NOT NULL,
            jk TEXT NOT NULL CHECK (jk IN ('L', 'P')),
            kelas_id INTEGER NOT NULL REFERENCES kelas(id),
            nama_wali TEXT NOT NULL DEFAULT '',
            hp_wali TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'aktif'
        );
        CREATE TABLE IF NOT EXISTS absensi (
            id INTEGER PRIMARY KEY,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            tanggal TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alfa')),
            UNIQUE (siswa_id, tanggal)
        );
        CREATE TABLE IF NOT EXISTS spp (
            id INTEGER PRIMARY KEY,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            periode TEXT NOT NULL,
            nominal INTEGER NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('lunas', 'tunggak')),
            dibayar_pada TEXT,
            UNIQUE (siswa_id, periode)
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS profil (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            nama TEXT NOT NULL,
            npsn TEXT NOT NULL DEFAULT '',
            alamat TEXT NOT NULL DEFAULT '',
            kepala TEXT NOT NULL DEFAULT '',
            telepon TEXT NOT NULL DEFAULT '',
            tahun_ajaran TEXT NOT NULL DEFAULT '2026/2027'
        );
        CREATE TABLE IF NOT EXISTS pengumuman (
            id INTEGER PRIMARY KEY,
            judul TEXT NOT NULL,
            isi TEXT NOT NULL,
            tanggal TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS jadwal (
            id INTEGER PRIMARY KEY,
            kelas_id INTEGER NOT NULL REFERENCES kelas(id),
            hari TEXT NOT NULL,
            jam TEXT NOT NULL,
            mapel TEXT NOT NULL,
            guru_id INTEGER REFERENCES guru(id)
        );
        CREATE TABLE IF NOT EXISTS nilai (
            id INTEGER PRIMARY KEY,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            mapel TEXT NOT NULL,
            semester TEXT NOT NULL,
            skor INTEGER NOT NULL CHECK (skor BETWEEN 0 AND 100),
            UNIQUE (siswa_id, mapel, semester)
        );
        CREATE TABLE IF NOT EXISTS hafalan (
            id INTEGER PRIMARY KEY,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            surat TEXT NOT NULL,
            ayat TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK (status IN ('setor', 'ulang', 'lulus')),
            tanggal TEXT NOT NULL,
            catatan TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS catatan (
            id INTEGER PRIMARY KEY,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            tanggal TEXT NOT NULL,
            isi TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ekskul (
            id INTEGER PRIMARY KEY,
            nama TEXT UNIQUE NOT NULL,
            pembina TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS ekskul_anggota (
            ekskul_id INTEGER NOT NULL REFERENCES ekskul(id) ON DELETE CASCADE,
            siswa_id INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
            PRIMARY KEY (ekskul_id, siswa_id)
        );
        """
    )
    if conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"] == 0:
        seed(conn)
    if conn.execute("SELECT COUNT(*) c FROM profil").fetchone()["c"] == 0:
        seed_menu(conn)
    if conn.execute("SELECT COUNT(*) c FROM ekskul").fetchone()["c"] == 0:
        seed_kegiatan(conn)
    kelas_cols = {row[1] for row in conn.execute("PRAGMA table_info(kelas)")}
    if "ruang" not in kelas_cols:
        conn.execute("ALTER TABLE kelas ADD COLUMN ruang TEXT NOT NULL DEFAULT ''")
    if "kapasitas" not in kelas_cols:
        conn.execute("ALTER TABLE kelas ADD COLUMN kapasitas INTEGER NOT NULL DEFAULT 28")
    conn.execute(
        """UPDATE kelas SET ruang = 'Ruang ' || tingkat
           WHERE ruang IS NULL OR ruang = ''"""
    )
    if "julukan" not in kelas_cols:
        conn.execute("ALTER TABLE kelas ADD COLUMN julukan TEXT NOT NULL DEFAULT ''")
    for kode, julukan in (
        ("1A", "Imam Syafii"),
        ("2A", "Imam Hanafi"),
        ("3A", "Imam Maliki"),
        ("4A", "Imam Hambali"),
        ("5A", "Imam Nawawi"),
        ("6A", "Imam Ghazali"),
    ):
        conn.execute(
            "UPDATE kelas SET julukan = ? WHERE nama = ? AND TRIM(COALESCE(julukan, '')) = ''",
            (julukan, kode),
        )
    profil_cols = {row[1] for row in conn.execute("PRAGMA table_info(profil)")}
    if "ketua_yayasan" not in profil_cols:
        conn.execute("ALTER TABLE profil ADD COLUMN ketua_yayasan TEXT NOT NULL DEFAULT ''")
    if "spp_nominal" not in profil_cols:
        conn.execute(
            "ALTER TABLE profil ADD COLUMN spp_nominal INTEGER NOT NULL DEFAULT 175000"
        )
    if "yayasan" not in profil_cols:
        conn.execute("ALTER TABLE profil ADD COLUMN yayasan TEXT NOT NULL DEFAULT ''")
    if "instagram" not in profil_cols:
        conn.execute("ALTER TABLE profil ADD COLUMN instagram TEXT NOT NULL DEFAULT ''")
    if "logo_rev" not in profil_cols:
        conn.execute("ALTER TABLE profil ADD COLUMN logo_rev INTEGER NOT NULL DEFAULT 0")
    conn.execute(
        """UPDATE profil SET yayasan = 'Yayasan Pendidikan Baiturrahman'
           WHERE id = 1 AND TRIM(COALESCE(yayasan, '')) = ''"""
    )
    conn.execute(
        """UPDATE profil SET instagram = '@sditbaiturrahmankandis'
           WHERE id = 1 AND TRIM(COALESCE(instagram, '')) = ''"""
    )
    siswa_cols = {row[1] for row in conn.execute("PRAGMA table_info(siswa)")}
    if "foto" not in siswa_cols:
        conn.execute("ALTER TABLE siswa ADD COLUMN foto TEXT NOT NULL DEFAULT ''")
    if conn.execute("SELECT COUNT(*) c FROM hafalan").fetchone()["c"] == 0:
        today = date.today().isoformat()
        conn.executemany(
            """INSERT INTO hafalan (siswa_id, surat, ayat, status, tanggal, catatan)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                (1, "Al-Fatihah", "1–7", "lulus", today, "Tajwid sudah rapi."),
                (1, "An-Nas", "1–6", "setor", today, ""),
                (2, "Al-Fatihah", "1–7", "ulang", today, "Makhraj masih perlu dilatih."),
            ],
        )
    conn.commit()
    conn.close()


def seed(conn):
    salt = secrets.token_hex(16)
    conn.execute(
        "INSERT INTO users (username, salt, password_hash, nama) VALUES (?, ?, ?, ?)",
        ("admin", salt, hash_password("baiturrahman", salt), "Admin Sekolah"),
    )
    gurus = [
        ("Ust. Ahmad Fauzi", "PAI", "Kepala Sekolah", "081234560001"),
        ("Ustazah Aisyah Rahma", "PAI", "Wali Kelas", "081234560002"),
        ("Ust. Yusuf Hidayat", "Matematika", "Wali Kelas", "081234560003"),
        ("Ustazah Nurul Huda", "Bahasa Indonesia", "Wali Kelas", "081234560004"),
        ("Ust. Ridwan Hakim", "IPAS", "Wali Kelas", "081234560005"),
        ("Ustazah Siti Maryam", "Bahasa Arab", "Wali Kelas", "081234560006"),
        ("Ust. Farhan Maulana", "PJOK", "Wali Kelas", "081234560007"),
        ("Ibu Dewi Lestari", "Administrasi", "Tata Usaha", "081234560008"),
    ]
    for g in gurus:
        conn.execute(
            "INSERT INTO guru (nama, mapel, jabatan, hp) VALUES (?, ?, ?, ?)", g
        )
    for tingkat, wali in ((1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7)):
        conn.execute(
            "INSERT INTO kelas (nama, tingkat, wali_id) VALUES (?, ?, ?)",
            (f"{tingkat}A", tingkat, wali),
        )
    siswa = [
        ("261001", "Muhammad Zaki Ramadhan", "L", 1, "Bapak Hasan", "081210000011"),
        ("261002", "Aisyah Putri Nabila", "P", 1, "Ibu Rina", "081210000012"),
        ("261003", "Abdullah Faqih", "L", 1, "Bapak Dedi", "081210000013"),
        ("261004", "Fatimah Az-Zahra", "P", 1, "Ibu Sari", "081210000014"),
        ("262001", "Umar Faruq", "L", 2, "Bapak Joko", "081210000021"),
        ("262002", "Khadijah Amina", "P", 2, "Ibu Lina", "081210000022"),
        ("262003", "Hamzah Ali", "L", 2, "Bapak Agus", "081210000023"),
        ("262004", "Maryam Salma", "P", 2, "Ibu Wati", "081210000024"),
        ("263001", "Ibrahim Yusuf", "L", 3, "Bapak Toni", "081210000031"),
        ("263002", "Hafshah Nur", "P", 3, "Ibu Endang", "081210000032"),
        ("263003", "Salman Alfarizi", "L", 3, "Bapak Rudi", "081210000033"),
        ("263004", "Amina Khairunnisa", "P", 3, "Ibu Yanti", "081210000034"),
        ("264001", "Usman Hakim", "L", 4, "Bapak Bambang", "081210000041"),
        ("264002", "Ruqayyah Zahra", "P", 4, "Ibu Fitri", "081210000042"),
        ("264003", "Bilal Ramadhan", "L", 4, "Bapak Eko", "081210000043"),
        ("264004", "Sumayyah Aulia", "P", 4, "Ibu Ningsih", "081210000044"),
        ("265001", "Ali Imran", "L", 5, "Bapak Wahyu", "081210000051"),
        ("265002", "Hajar Aswad", "P", 5, "Ibu Diana", "081210000052"),
        ("265003", "Zaid bin Harits", "L", 5, "Bapak Irfan", "081210000053"),
        ("265004", "Safiya Rahma", "P", 5, "Ibu Maya", "081210000054"),
        ("266001", "Musa Al-Kautsar", "L", 6, "Bapak Hendra", "081210000061"),
        ("266002", "Asma binti Abu Bakar", "P", 6, "Ibu Lilis", "081210000062"),
        ("266003", "Thalhah Firdaus", "L", 6, "Bapak Andi", "081210000063"),
        ("266004", "Lubna Maharani", "P", 6, "Ibu Ratih", "081210000064"),
    ]
    for s in siswa:
        conn.execute(
            """INSERT INTO siswa (nis, nama, jk, kelas_id, nama_wali, hp_wali)
               VALUES (?, ?, ?, ?, ?, ?)""",
            s,
        )
    today = date.today().isoformat()
    periode = today[:7]
    statuses = ["hadir", "hadir", "hadir", "izin", "hadir", "sakit", "hadir", "alfa"]
    rows = conn.execute("SELECT id FROM siswa ORDER BY id").fetchall()
    for i, row in enumerate(rows):
        conn.execute(
            "INSERT INTO absensi (siswa_id, tanggal, status) VALUES (?, ?, ?)",
            (row["id"], today, statuses[i % len(statuses)]),
        )
        lunas = i % 3 != 0
        conn.execute(
            """INSERT INTO spp (siswa_id, periode, nominal, status, dibayar_pada)
               VALUES (?, ?, ?, ?, ?)""",
            (
                row["id"],
                periode,
                SPP_DEFAULT,
                "lunas" if lunas else "tunggak",
                today if lunas else None,
            ),
        )


MAPEL = (
    "PAI",
    "Bahasa Arab",
    "Bahasa Indonesia",
    "Matematika",
    "IPAS",
    "PJOK",
    "Seni",
)
HARI = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat")
SEMESTER = "2026/2027 Ganjil"


def seed_menu(conn):
    conn.execute(
        """INSERT INTO profil (id, nama, npsn, alamat, kepala, telepon, tahun_ajaran)
           VALUES (1, ?, '', 'Jl. Penghulu Mudo, Kelurahan Telaga Sam-Sam, Kecamatan Kandis, Kabupaten Siak, Riau 28686', 'Ust. Ahmad Fauzi', '081320212275', '2026/2027')""",
        ("SDIT Baiturrahman Kandis",),
    )
    today = date.today().isoformat()
    conn.executemany(
        "INSERT INTO pengumuman (judul, isi, tanggal) VALUES (?, ?, ?)",
        [
            (
                "Awal tahun ajaran 2026/2027",
                "Masuk sekolah dimulai pukul 07.15. Orang tua mengantar sampai gerbang.",
                today,
            ),
            (
                "Iuran SPP Oktober",
                "SPP bulan Oktober sebesar Rp175.000 dapat dicatat lunas di menu SPP.",
                today,
            ),
        ],
    )
    slots = (
        ("07.30", "PAI", 2),
        ("08.30", "Matematika", 3),
        ("09.30", "Bahasa Indonesia", 4),
        ("10.30", "IPAS", 5),
    )
    for kelas_id in range(1, 7):
        for jam, mapel, guru_id in slots:
            conn.execute(
                """INSERT INTO jadwal (kelas_id, hari, jam, mapel, guru_id)
                   VALUES (?, 'Senin', ?, ?, ?)""",
                (kelas_id, jam, mapel, guru_id),
            )
    siswa = conn.execute("SELECT id FROM siswa").fetchall()
    for row in siswa:
        for mapel, base in (("PAI", 78), ("Matematika", 74)):
            skor = min(100, base + (row["id"] * 3) % 18)
            conn.execute(
                """INSERT INTO nilai (siswa_id, mapel, semester, skor)
                   VALUES (?, ?, ?, ?)""",
                (row["id"], mapel, SEMESTER, skor),
            )


def seed_kegiatan(conn):
    kegiatan = (
        ("Tahfidz", "Ustazah Siti Maryam"),
        ("Pramuka", "Ust. Farhan Maulana"),
        ("Kaligrafi", "Ustazah Aisyah Rahma"),
        ("Futsal", "Ust. Yusuf Hidayat"),
    )
    for nama, pembina in kegiatan:
        conn.execute("INSERT INTO ekskul (nama, pembina) VALUES (?, ?)", (nama, pembina))
    for ekskul_id, siswa_ids in ((1, range(1, 9)), (2, range(5, 13)), (3, range(9, 15)), (4, (3, 7, 11, 15, 19, 23))):
        for siswa_id in siswa_ids:
            conn.execute(
                "INSERT INTO ekskul_anggota (ekskul_id, siswa_id) VALUES (?, ?)",
                (ekskul_id, siswa_id),
            )
    today = date.today().isoformat()
    conn.executemany(
        "INSERT INTO catatan (siswa_id, tanggal, isi) VALUES (?, ?, ?)",
        [
            (1, today, "Sudah hafal An-Nas sampai Al-Ikhlas. Perlu pengulangan di rumah."),
            (2, today, "Aktif di kelas. Mohon didampingi saat membaca iqra."),
        ],
    )


def json_bytes(payload, status=200):
    body = json.dumps(payload, ensure_ascii=False).encode()
    return status, body


class App(BaseHTTPRequestHandler):
    server_version = "SDITBaiturrahman/1.0"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if extra_headers:
            for k, v in extra_headers:
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 2_500_000:
            raise ValueError("payload terlalu besar")
        raw = self.rfile.read(length) if length else b"{}"
        data = json.loads(raw.decode() or "{}")
        if not isinstance(data, dict):
            raise ValueError("JSON harus berupa objek")
        return data

    def origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        return urlparse(origin).netloc == host

    def cookie_token(self):
        raw = self.headers.get("Cookie") or ""
        for part in raw.split(";"):
            name, _, value = part.strip().partition("=")
            if name == "sdit_session":
                return value
        return None

    def current_user(self, conn):
        token = self.cookie_token()
        if not token:
            return None
        row = conn.execute(
            """SELECT u.id, u.username, u.nama
               FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.token = ?""",
            (token,),
        ).fetchone()
        return dict(row) if row else None

    def require_user(self, conn):
        user = self.current_user(conn)
        if not user:
            self.send_json(401, {"error": "Silakan masuk terlebih dahulu"})
            return None
        return user

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("GET", parsed)
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_json(404, {"error": "Tidak ditemukan"})
            return
        if not self.origin_ok():
            self.send_json(403, {"error": "Origin ditolak"})
            return
        self.handle_api("POST", parsed)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not self.origin_ok():
            self.send_json(403, {"error": "Origin ditolak"})
            return
        self.handle_api("DELETE", parsed)

    def serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        if path == "/logo.png" and LOGO_FILE.is_file():
            data = LOGO_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("CDN-Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
            return
        rel = path.lstrip("/")
        if ".." in rel.split("/"):
            self.send_error(403)
            return
        file = (STATIC / rel).resolve()
        if not str(file).startswith(str(STATIC.resolve())) or not file.is_file():
            file = STATIC / "index.html"
        kind = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".png": "image/png",
            ".woff2": "font/woff2",
            ".webmanifest": "application/manifest+json",
        }.get(file.suffix, "application/octet-stream")
        data = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        if file.suffix in (".html", ".css", ".js", ".webmanifest"):
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("CDN-Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self, method, parsed):
        parts = [p for p in parsed.path.split("/") if p]
        qs = parse_qs(parsed.query)
        conn = db()
        try:
            if parts == ["api", "login"] and method == "POST":
                self.login(conn)
                return
            if parts == ["api", "logout"] and method == "POST":
                self.logout(conn)
                return
            if parts == ["api", "identitas"] and method == "GET":
                self.identitas(conn)
                return
            user = self.require_user(conn)
            if not user:
                return
            if parts == ["api", "me"] and method == "GET":
                self.send_json(200, {"user": user})
            elif parts == ["api", "dashboard"] and method == "GET":
                self.dashboard(conn)
            elif parts == ["api", "siswa"] and method == "GET":
                self.list_siswa(conn, qs)
            elif parts == ["api", "siswa"] and method == "POST":
                self.save_siswa(conn, None)
            elif len(parts) == 3 and parts[:2] == ["api", "siswa"] and method == "POST":
                self.save_siswa(conn, int(parts[2]))
            elif len(parts) == 3 and parts[:2] == ["api", "siswa"] and method == "DELETE":
                self.delete_siswa(conn, int(parts[2]))
            elif parts == ["api", "guru"] and method == "GET":
                self.list_guru(conn)
            elif parts == ["api", "guru"] and method == "POST":
                self.save_guru(conn, None)
            elif len(parts) == 3 and parts[:2] == ["api", "guru"] and method == "POST":
                self.save_guru(conn, int(parts[2]))
            elif len(parts) == 3 and parts[:2] == ["api", "guru"] and method == "DELETE":
                self.delete_guru(conn, int(parts[2]))
            elif parts == ["api", "kelas"] and method == "GET":
                self.list_kelas(conn)
            elif parts == ["api", "absensi"] and method == "GET":
                self.get_absensi(conn, qs)
            elif parts == ["api", "absensi"] and method == "POST":
                self.save_absensi(conn)
            elif parts == ["api", "spp", "pengaturan"] and method == "POST":
                self.save_spp_pengaturan(conn)
            elif parts == ["api", "spp"] and method == "GET":
                self.get_spp(conn, qs)
            elif parts == ["api", "spp"] and method == "POST":
                self.save_spp(conn)
            elif parts == ["api", "kelas"] and method == "POST":
                self.save_kelas(conn, None)
            elif len(parts) == 3 and parts[:2] == ["api", "kelas"] and method == "POST":
                self.save_kelas(conn, int(parts[2]))
            elif len(parts) == 3 and parts[:2] == ["api", "kelas"] and method == "DELETE":
                self.delete_kelas(conn, int(parts[2]))
            elif parts == ["api", "profil", "logo"] and method == "POST":
                self.save_logo(conn)
            elif parts == ["api", "profil", "logo"] and method == "DELETE":
                self.delete_logo(conn)
            elif parts == ["api", "profil"] and method == "GET":
                self.get_profil(conn)
            elif parts == ["api", "profil"] and method == "POST":
                self.save_profil(conn)
            elif parts == ["api", "pengumuman"] and method == "GET":
                self.list_pengumuman(conn)
            elif parts == ["api", "pengumuman"] and method == "POST":
                self.save_pengumuman(conn)
            elif len(parts) == 3 and parts[:2] == ["api", "pengumuman"] and method == "DELETE":
                self.delete_pengumuman(conn, int(parts[2]))
            elif parts == ["api", "jadwal"] and method == "GET":
                self.list_jadwal(conn, qs)
            elif parts == ["api", "jadwal"] and method == "POST":
                self.save_jadwal(conn, None)
            elif len(parts) == 3 and parts[:2] == ["api", "jadwal"] and method == "DELETE":
                self.delete_jadwal(conn, int(parts[2]))
            elif parts == ["api", "nilai"] and method == "GET":
                self.get_nilai(conn, qs)
            elif parts == ["api", "nilai"] and method == "POST":
                self.save_nilai(conn)
            elif parts == ["api", "sandi"] and method == "POST":
                self.change_password(conn, user)
            elif parts == ["api", "rekap"] and method == "GET":
                self.get_rekap(conn, qs)
            elif parts == ["api", "hafalan"] and method == "GET":
                self.list_hafalan(conn, qs)
            elif parts == ["api", "hafalan"] and method == "POST":
                self.save_hafalan(conn)
            elif len(parts) == 3 and parts[:2] == ["api", "hafalan"] and method == "DELETE":
                self.delete_hafalan(conn, int(parts[2]))
            elif parts == ["api", "ekskul"] and method == "GET":
                self.list_ekskul(conn)
            elif parts == ["api", "ekskul"] and method == "POST":
                self.save_ekskul(conn)
            elif len(parts) == 3 and parts[:2] == ["api", "ekskul"] and method == "DELETE":
                self.delete_ekskul(conn, int(parts[2]))
            elif parts == ["api", "ekskul", "anggota"] and method == "POST":
                self.toggle_anggota(conn)
            elif len(parts) == 4 and parts[0] == "api" and parts[1] == "siswa" and parts[3] == "foto":
                sid = int(parts[2])
                if method == "GET":
                    self.get_foto(conn, sid)
                elif method == "POST":
                    self.save_foto(conn, sid)
                elif method == "DELETE":
                    self.delete_foto(conn, sid)
                else:
                    self.send_json(404, {"error": "Tidak ditemukan"})
            elif len(parts) == 4 and parts[0] == "api" and parts[1] == "siswa" and parts[3] == "catatan" and method == "GET":
                self.list_catatan(conn, int(parts[2]))
            elif len(parts) == 4 and parts[0] == "api" and parts[1] == "siswa" and parts[3] == "rapor" and method == "GET":
                self.get_rapor(conn, int(parts[2]))
            elif parts == ["api", "catatan"] and method == "POST":
                self.save_catatan(conn)
            elif len(parts) == 3 and parts[:2] == ["api", "catatan"] and method == "DELETE":
                self.delete_catatan(conn, int(parts[2]))
            else:
                self.send_json(404, {"error": "Tidak ditemukan"})
        except (ValueError, sqlite3.IntegrityError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc) or "Data tidak valid"})
        finally:
            conn.close()

    def login(self, conn):
        data = self.read_json()
        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        ok = row and hmac.compare_digest(
            row["password_hash"], hash_password(password, row["salt"])
        )
        if not ok:
            self.send_json(401, {"error": "Nama pengguna atau kata sandi salah"})
            return
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, row["id"], datetime.now().isoformat(timespec="seconds")),
        )
        conn.commit()
        self.send_json(
            200,
            {"user": {"id": row["id"], "username": row["username"], "nama": row["nama"]}},
            [("Set-Cookie", f"sdit_session={token}; HttpOnly; SameSite=Lax; Path=/")],
        )

    def logout(self, conn):
        token = self.cookie_token()
        if token:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        self.send_json(
            200,
            {"ok": True},
            [("Set-Cookie", "sdit_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")],
        )

    def dashboard(self, conn):
        today = date.today().isoformat()
        periode = today[:7]
        siswa = conn.execute(
            "SELECT COUNT(*) c FROM siswa WHERE status = 'aktif'"
        ).fetchone()["c"]
        guru = conn.execute("SELECT COUNT(*) c FROM guru").fetchone()["c"]
        kelas = conn.execute("SELECT COUNT(*) c FROM kelas").fetchone()["c"]
        absensi = conn.execute(
            """SELECT status, COUNT(*) c FROM absensi
               WHERE tanggal = ? GROUP BY status""",
            (today,),
        ).fetchall()
        by_status = {r["status"]: r["c"] for r in absensi}
        spp = conn.execute(
            """SELECT status, COUNT(*) c, COALESCE(SUM(nominal), 0) nominal
               FROM spp WHERE periode = ? GROUP BY status""",
            (periode,),
        ).fetchall()
        spp_map = {r["status"]: dict(r) for r in spp}
        per_kelas = conn.execute(
            f"""SELECT {kelas_label()} nama, COUNT(s.id) jumlah
               FROM kelas k LEFT JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
               GROUP BY k.id ORDER BY k.tingkat"""
        ).fetchall()
        self.send_json(
            200,
            {
                "tanggal": today,
                "periode": periode,
                "siswa": siswa,
                "guru": guru,
                "kelas": kelas,
                "absensi": {
                    "hadir": by_status.get("hadir", 0),
                    "izin": by_status.get("izin", 0),
                    "sakit": by_status.get("sakit", 0),
                    "alfa": by_status.get("alfa", 0),
                },
                "spp": {
                    "lunas": (spp_map.get("lunas") or {}).get("c", 0),
                    "tunggak": (spp_map.get("tunggak") or {}).get("c", 0),
                    "nominal": spp_nominal(conn),
                    "terkumpul": (spp_map.get("lunas") or {}).get("nominal", 0),
                },
                "per_kelas": [dict(r) for r in per_kelas],
            },
        )

    def list_siswa(self, conn, qs):
        q = (qs.get("q") or [""])[0].strip()
        kelas_id = (qs.get("kelas_id") or [""])[0]
        sql = f"""SELECT s.*, {kelas_label()} kelas
                 FROM siswa s JOIN kelas k ON k.id = s.kelas_id
                 WHERE 1=1"""
        args = []
        if q:
            sql += " AND (s.nama LIKE ? OR s.nis LIKE ?)"
            args.extend([f"%{q}%", f"%{q}%"])
        if kelas_id:
            sql += " AND s.kelas_id = ?"
            args.append(int(kelas_id))
        sql += " ORDER BY k.tingkat, s.nama"
        rows = conn.execute(sql, args).fetchall()
        siswa = []
        for row in rows:
            item = dict(row)
            item["qr"] = qr_svg(item["nis"])
            siswa.append(item)
        self.send_json(200, {"siswa": siswa})

    def save_siswa(self, conn, sid):
        data = self.read_json()
        fields = {
            "nis": str(data.get("nis") or "").strip(),
            "nama": str(data.get("nama") or "").strip(),
            "jk": str(data.get("jk") or "").strip(),
            "kelas_id": int(data.get("kelas_id") or 0),
            "nama_wali": str(data.get("nama_wali") or "").strip(),
            "hp_wali": str(data.get("hp_wali") or "").strip(),
        }
        if not fields["nis"] or not fields["nama"]:
            raise ValueError("NIS dan nama wajib diisi")
        if fields["jk"] not in ("L", "P"):
            raise ValueError("Jenis kelamin harus L atau P")
        if sid:
            conn.execute(
                """UPDATE siswa SET nis=?, nama=?, jk=?, kelas_id=?, nama_wali=?, hp_wali=?
                   WHERE id=?""",
                (*fields.values(), sid),
            )
            saved_id = sid
        else:
            cur = conn.execute(
                """INSERT INTO siswa (nis, nama, jk, kelas_id, nama_wali, hp_wali)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                tuple(fields.values()),
            )
            saved_id = cur.lastrowid
        conn.commit()
        self.send_json(200, {"ok": True, "id": saved_id})

    def delete_siswa(self, conn, sid):
        self.remove_foto_file(sid)
        conn.execute("DELETE FROM siswa WHERE id = ?", (sid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def remove_foto_file(self, sid):
        path = FOTO_DIR / f"{int(sid)}.jpg"
        if path.is_file():
            path.unlink()

    def get_foto(self, conn, sid):
        row = conn.execute("SELECT foto FROM siswa WHERE id = ?", (sid,)).fetchone()
        path = FOTO_DIR / f"{sid}.jpg"
        if not row or not row["foto"] or not path.is_file():
            self.send_json(404, {"error": "Foto belum diunggah"})
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("CDN-Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def save_foto(self, conn, sid):
        row = conn.execute("SELECT id FROM siswa WHERE id = ?", (sid,)).fetchone()
        if not row:
            raise ValueError("Siswa tidak ditemukan")
        raw = str(self.read_json().get("foto") or "")
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            blob = base64.b64decode(raw, validate=True)
        except Exception as exc:
            raise ValueError("Foto tidak valid") from exc
        if len(blob) > 800_000 or not blob.startswith(b"\xff\xd8\xff"):
            raise ValueError("Foto harus berupa JPEG dan tidak lebih dari 800 KB")
        FOTO_DIR.mkdir(parents=True, exist_ok=True)
        name = f"{sid}.jpg"
        (FOTO_DIR / name).write_bytes(blob)
        conn.execute("UPDATE siswa SET foto = ? WHERE id = ?", (name, sid))
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_foto(self, conn, sid):
        self.remove_foto_file(sid)
        conn.execute("UPDATE siswa SET foto = '' WHERE id = ?", (sid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def list_guru(self, conn):
        rows = conn.execute(
            f"""SELECT g.*, {kelas_label()} wali_kelas
               FROM guru g LEFT JOIN kelas k ON k.wali_id = g.id
               ORDER BY g.id"""
        ).fetchall()
        self.send_json(200, {"guru": [dict(r) for r in rows]})

    def save_guru(self, conn, gid):
        data = self.read_json()
        fields = (
            str(data.get("nama") or "").strip(),
            str(data.get("mapel") or "").strip(),
            str(data.get("jabatan") or "").strip(),
            str(data.get("hp") or "").strip(),
        )
        if not fields[0] or not fields[1] or not fields[2]:
            raise ValueError("Nama, mapel, dan jabatan wajib diisi")
        if gid:
            conn.execute(
                "UPDATE guru SET nama=?, mapel=?, jabatan=?, hp=? WHERE id=?",
                (*fields, gid),
            )
        else:
            conn.execute(
                "INSERT INTO guru (nama, mapel, jabatan, hp) VALUES (?, ?, ?, ?)",
                fields,
            )
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_guru(self, conn, gid):
        used = conn.execute(
            "SELECT COUNT(*) c FROM kelas WHERE wali_id = ?", (gid,)
        ).fetchone()["c"]
        if used:
            raise ValueError("Guru ini masih menjadi wali kelas")
        conn.execute("DELETE FROM guru WHERE id = ?", (gid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def list_kelas(self, conn):
        rows = conn.execute(
            """SELECT k.id, k.nama, k.julukan, k.tingkat, k.wali_id, g.nama wali,
                      k.ruang, k.kapasitas,
                      (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id) jumlah
               FROM kelas k LEFT JOIN guru g ON g.id = k.wali_id
               ORDER BY k.tingkat, k.nama"""
        ).fetchall()
        payload = []
        for row in rows:
            item = dict(row)
            julukan = (item.get("julukan") or "").strip()
            item["label"] = f"{item['nama']} · {julukan}" if julukan else item["nama"]
            payload.append(item)
        self.send_json(200, {"kelas": payload})

    def get_absensi(self, conn, qs):
        tanggal = (qs.get("tanggal") or [date.today().isoformat()])[0]
        kelas_id = int((qs.get("kelas_id") or ["1"])[0])
        rows = conn.execute(
            """SELECT s.id, s.nis, s.nama, s.jk,
                      COALESCE(a.status, 'hadir') status
               FROM siswa s
               LEFT JOIN absensi a ON a.siswa_id = s.id AND a.tanggal = ?
               WHERE s.kelas_id = ? AND s.status = 'aktif'
               ORDER BY s.nama""",
            (tanggal, kelas_id),
        ).fetchall()
        self.send_json(200, {"tanggal": tanggal, "siswa": [dict(r) for r in rows]})

    def save_absensi(self, conn):
        data = self.read_json()
        tanggal = str(data.get("tanggal") or "")
        items = data.get("items") or []
        if not tanggal or not isinstance(items, list):
            raise ValueError("Data absensi tidak lengkap")
        for item in items:
            status = item.get("status")
            if status not in ("hadir", "izin", "sakit", "alfa"):
                raise ValueError("Status absensi tidak dikenal")
            conn.execute(
                """INSERT INTO absensi (siswa_id, tanggal, status) VALUES (?, ?, ?)
                   ON CONFLICT(siswa_id, tanggal) DO UPDATE SET status = excluded.status""",
                (int(item["siswa_id"]), tanggal, status),
            )
        conn.commit()
        self.send_json(200, {"ok": True})

    def get_spp(self, conn, qs):
        periode = (qs.get("periode") or [date.today().strftime("%Y-%m")])[0]
        nominal = spp_nominal(conn)
        rows = conn.execute(
            f"""SELECT s.id siswa_id, s.nis, s.nama, {kelas_label()} kelas,
                      COALESCE(p.status, 'tunggak') status,
                      COALESCE(p.nominal, ?) nominal,
                      p.dibayar_pada
               FROM siswa s
               JOIN kelas k ON k.id = s.kelas_id
               LEFT JOIN spp p ON p.siswa_id = s.id AND p.periode = ?
               WHERE s.status = 'aktif'
               ORDER BY k.tingkat, s.nama""",
            (nominal, periode),
        ).fetchall()
        self.send_json(
            200, {"periode": periode, "nominal": nominal, "tagihan": [dict(r) for r in rows]}
        )

    def save_spp_pengaturan(self, conn):
        data = self.read_json()
        nominal = int(data.get("nominal"))
        if nominal < 1_000 or nominal > 5_000_000:
            raise ValueError("Nominal SPP antara Rp1.000 dan Rp5.000.000")
        conn.execute("UPDATE profil SET spp_nominal = ? WHERE id = 1", (nominal,))
        conn.execute(
            "UPDATE spp SET nominal = ? WHERE status = 'tunggak'",
            (nominal,),
        )
        conn.commit()
        self.send_json(200, {"ok": True, "nominal": nominal})

    def save_spp(self, conn):
        data = self.read_json()
        siswa_id = int(data.get("siswa_id"))
        periode = str(data.get("periode") or "")
        status = str(data.get("status") or "")
        if status not in ("lunas", "tunggak") or len(periode) != 7:
            raise ValueError("Data pembayaran tidak valid")
        nominal = spp_nominal(conn)
        dibayar = date.today().isoformat() if status == "lunas" else None
        conn.execute(
            """INSERT INTO spp (siswa_id, periode, nominal, status, dibayar_pada)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(siswa_id, periode) DO UPDATE SET
                 status = excluded.status,
                 nominal = CASE WHEN excluded.status = 'lunas' AND spp.status = 'lunas'
                                THEN spp.nominal ELSE excluded.nominal END,
                 dibayar_pada = excluded.dibayar_pada""",
            (siswa_id, periode, nominal, status, dibayar),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def save_kelas(self, conn, kid):
        data = self.read_json()
        tingkat = int(data.get("tingkat") or 0)
        rombel = str(data.get("rombel") or "").strip().upper()
        if tingkat not in range(1, 7):
            raise ValueError("Tingkat harus 1 sampai 6")
        if not rombel or len(rombel) > 2 or not rombel.isalnum():
            raise ValueError("Rombel diisi 1–2 huruf, misalnya A")
        nama = f"{tingkat}{rombel}"
        kapasitas = int(data.get("kapasitas") or 28)
        if kapasitas < 1 or kapasitas > 40:
            raise ValueError("Kapasitas antara 1 dan 40 siswa")
        ruang = str(data.get("ruang") or "").strip()
        julukan = str(data.get("julukan") or "").strip()
        if len(julukan) > 40:
            raise ValueError("Nama rombel terlalu panjang")
        wali_raw = str(data.get("wali_id") or "").strip()
        wali_id = int(wali_raw) if wali_raw else None
        if wali_id:
            guru = conn.execute("SELECT id FROM guru WHERE id = ?", (wali_id,)).fetchone()
            if not guru:
                raise ValueError("Wali kelas tidak ditemukan")
            bentrok = conn.execute(
                "SELECT nama FROM kelas WHERE wali_id = ? AND id != ?",
                (wali_id, kid or 0),
            ).fetchone()
            if bentrok:
                raise ValueError(f"Guru ini sudah wali kelas {bentrok['nama']}")
        try:
            if kid:
                conn.execute(
                    """UPDATE kelas SET nama=?, julukan=?, tingkat=?, wali_id=?, ruang=?, kapasitas=?
                       WHERE id=?""",
                    (nama, julukan, tingkat, wali_id, ruang, kapasitas, kid),
                )
            else:
                conn.execute(
                    """INSERT INTO kelas (nama, julukan, tingkat, wali_id, ruang, kapasitas)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (nama, julukan, tingkat, wali_id, ruang, kapasitas),
                )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"Kelas {nama} sudah ada")
        self.send_json(200, {"ok": True})

    def delete_kelas(self, conn, kid):
        siswa = conn.execute(
            "SELECT COUNT(*) c FROM siswa WHERE kelas_id = ?", (kid,)
        ).fetchone()["c"]
        if siswa:
            raise ValueError("Rombel masih memiliki siswa")
        jadwal = conn.execute(
            "SELECT COUNT(*) c FROM jadwal WHERE kelas_id = ?", (kid,)
        ).fetchone()["c"]
        if jadwal:
            raise ValueError("Hapus jadwal rombel ini terlebih dahulu")
        conn.execute("DELETE FROM kelas WHERE id = ?", (kid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def list_hafalan(self, conn, qs):
        kelas_id = (qs.get("kelas_id") or [""])[0]
        where = ""
        args = []
        if kelas_id:
            where = "WHERE s.kelas_id = ?"
            args.append(int(kelas_id))
        rows = conn.execute(
            f"""SELECT h.id, h.siswa_id, h.surat, h.ayat, h.status, h.tanggal, h.catatan,
                      s.nama siswa, {kelas_label()} kelas
               FROM hafalan h
               JOIN siswa s ON s.id = h.siswa_id
               JOIN kelas k ON k.id = s.kelas_id
               {where}
               ORDER BY h.tanggal DESC, h.id DESC""",
            args,
        ).fetchall()
        siswa = conn.execute(
            f"""SELECT s.id, s.nama, {kelas_label()} kelas
               FROM siswa s JOIN kelas k ON k.id = s.kelas_id
               WHERE s.status = 'aktif' {('AND s.kelas_id = ?' if kelas_id else '')}
               ORDER BY k.tingkat, s.nama""",
            args,
        ).fetchall()
        self.send_json(200, {"hafalan": [dict(r) for r in rows], "siswa": [dict(r) for r in siswa]})

    def save_hafalan(self, conn):
        data = self.read_json()
        siswa_id = int(data.get("siswa_id") or 0)
        surat = str(data.get("surat") or "").strip()
        ayat = str(data.get("ayat") or "").strip()
        status = str(data.get("status") or "")
        catatan = str(data.get("catatan") or "").strip()
        if not surat:
            raise ValueError("Nama surat wajib diisi")
        if status not in ("setor", "ulang", "lulus"):
            raise ValueError("Status hafalan tidak dikenal")
        ada = conn.execute("SELECT id FROM siswa WHERE id = ?", (siswa_id,)).fetchone()
        if not ada:
            raise ValueError("Siswa tidak ditemukan")
        conn.execute(
            """INSERT INTO hafalan (siswa_id, surat, ayat, status, tanggal, catatan)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (siswa_id, surat, ayat, status, date.today().isoformat(), catatan),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_hafalan(self, conn, hid):
        conn.execute("DELETE FROM hafalan WHERE id = ?", (hid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def identitas(self, conn):
        row = conn.execute(
            """SELECT nama, yayasan, alamat, telepon, instagram, tahun_ajaran, logo_rev
               FROM profil WHERE id = 1"""
        ).fetchone()
        data = dict(row) if row else {}
        data["punya_logo"] = LOGO_FILE.is_file()
        self.send_json(200, {"identitas": data})

    def get_profil(self, conn):
        self.send_json(200, {"profil": self.profil_dict(conn)})

    def profil_dict(self, conn):
        row = conn.execute("SELECT * FROM profil WHERE id = 1").fetchone()
        data = dict(row) if row else {}
        data["punya_logo"] = LOGO_FILE.is_file()
        return data

    def save_profil(self, conn):
        data = self.read_json()
        nama = str(data.get("nama") or "").strip()
        tahun = str(data.get("tahun_ajaran") or "").strip()
        yayasan = str(data.get("yayasan") or "").strip()
        instagram = str(data.get("instagram") or "").strip()
        if not nama or not tahun:
            raise ValueError("Nama sekolah dan tahun ajaran wajib diisi")
        if len(yayasan) > 80:
            raise ValueError("Nama yayasan terlalu panjang")
        if len(instagram) > 40:
            raise ValueError("Instagram terlalu panjang")
        conn.execute(
            """UPDATE profil SET nama=?, npsn=?, alamat=?, kepala=?, ketua_yayasan=?, telepon=?,
               tahun_ajaran=?, yayasan=?, instagram=?
               WHERE id=1""",
            (
                nama,
                str(data.get("npsn") or "").strip(),
                str(data.get("alamat") or "").strip(),
                str(data.get("kepala") or "").strip(),
                str(data.get("ketua_yayasan") or "").strip(),
                str(data.get("telepon") or "").strip(),
                tahun,
                yayasan,
                instagram,
            ),
        )
        conn.commit()
        self.send_json(200, {"ok": True, "profil": self.profil_dict(conn)})

    def save_logo(self, conn):
        raw = str(self.read_json().get("logo") or "")
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            blob = base64.b64decode(raw, validate=True)
        except Exception as exc:
            raise ValueError("Logo tidak valid") from exc
        if len(blob) > 800_000 or not blob.startswith(b"\xff\xd8\xff"):
            raise ValueError("Logo harus berupa JPEG dan tidak lebih dari 800 KB")
        LOGO_FILE.parent.mkdir(parents=True, exist_ok=True)
        LOGO_FILE.write_bytes(blob)
        conn.execute("UPDATE profil SET logo_rev = logo_rev + 1 WHERE id = 1")
        conn.commit()
        self.send_json(200, {"ok": True, "profil": self.profil_dict(conn)})

    def delete_logo(self, conn):
        if LOGO_FILE.is_file():
            LOGO_FILE.unlink()
        conn.execute("UPDATE profil SET logo_rev = logo_rev + 1 WHERE id = 1")
        conn.commit()
        self.send_json(200, {"ok": True, "profil": self.profil_dict(conn)})

    def list_pengumuman(self, conn):
        rows = conn.execute(
            "SELECT * FROM pengumuman ORDER BY tanggal DESC, id DESC"
        ).fetchall()
        self.send_json(200, {"pengumuman": [dict(r) for r in rows]})

    def save_pengumuman(self, conn):
        data = self.read_json()
        judul = str(data.get("judul") or "").strip()
        isi = str(data.get("isi") or "").strip()
        if not judul or not isi:
            raise ValueError("Judul dan isi pengumuman wajib diisi")
        conn.execute(
            "INSERT INTO pengumuman (judul, isi, tanggal) VALUES (?, ?, ?)",
            (judul, isi, date.today().isoformat()),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_pengumuman(self, conn, pid):
        conn.execute("DELETE FROM pengumuman WHERE id = ?", (pid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def list_jadwal(self, conn, qs):
        kelas_id = int((qs.get("kelas_id") or ["1"])[0])
        rows = conn.execute(
            """SELECT j.*, g.nama guru
               FROM jadwal j LEFT JOIN guru g ON g.id = j.guru_id
               WHERE j.kelas_id = ?
               ORDER BY CASE j.hari
                 WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3
                 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END, j.jam""",
            (kelas_id,),
        ).fetchall()
        self.send_json(200, {"jadwal": [dict(r) for r in rows], "mapel": list(MAPEL), "hari": list(HARI)})

    def save_jadwal(self, conn, _jid):
        data = self.read_json()
        kelas_id = int(data.get("kelas_id") or 0)
        hari = str(data.get("hari") or "")
        jam = str(data.get("jam") or "").strip()
        mapel = str(data.get("mapel") or "").strip()
        guru_id = int(data.get("guru_id") or 0)
        if hari not in HARI or mapel not in MAPEL or not jam:
            raise ValueError("Hari, jam, dan mapel wajib diisi")
        conn.execute(
            """INSERT INTO jadwal (kelas_id, hari, jam, mapel, guru_id)
               VALUES (?, ?, ?, ?, ?)""",
            (kelas_id, hari, jam, mapel, guru_id),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_jadwal(self, conn, jid):
        conn.execute("DELETE FROM jadwal WHERE id = ?", (jid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def get_nilai(self, conn, qs):
        kelas_id = int((qs.get("kelas_id") or ["1"])[0])
        mapel = (qs.get("mapel") or ["PAI"])[0]
        if mapel not in MAPEL:
            raise ValueError("Mapel tidak dikenal")
        rows = conn.execute(
            """SELECT s.id siswa_id, s.nama, s.nis, n.skor
               FROM siswa s
               LEFT JOIN nilai n
                 ON n.siswa_id = s.id AND n.mapel = ? AND n.semester = ?
               WHERE s.kelas_id = ? AND s.status = 'aktif'
               ORDER BY s.nama""",
            (mapel, SEMESTER, kelas_id),
        ).fetchall()
        self.send_json(
            200,
            {
                "semester": SEMESTER,
                "mapel": list(MAPEL),
                "nilai": [dict(r) for r in rows],
            },
        )

    def save_nilai(self, conn):
        data = self.read_json()
        mapel = str(data.get("mapel") or "")
        if mapel not in MAPEL:
            raise ValueError("Mapel tidak dikenal")
        items = data.get("items") or []
        if not isinstance(items, list) or not items:
            raise ValueError("Nilai kosong")
        for item in items:
            skor = int(item.get("skor"))
            if skor < 0 or skor > 100:
                raise ValueError("Nilai harus di antara 0 dan 100")
            conn.execute(
                """INSERT INTO nilai (siswa_id, mapel, semester, skor)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(siswa_id, mapel, semester)
                   DO UPDATE SET skor = excluded.skor""",
                (int(item["siswa_id"]), mapel, SEMESTER, skor),
            )
        conn.commit()
        self.send_json(200, {"ok": True})

    def change_password(self, conn, user):
        data = self.read_json()
        lama = str(data.get("lama") or "")
        baru = str(data.get("baru") or "")
        if len(baru) < 6:
            raise ValueError("Kata sandi baru minimal 6 karakter")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        if not hmac.compare_digest(row["password_hash"], hash_password(lama, row["salt"])):
            raise ValueError("Kata sandi lama salah")
        salt = secrets.token_hex(16)
        conn.execute(
            "UPDATE users SET salt = ?, password_hash = ? WHERE id = ?",
            (salt, hash_password(baru, salt), user["id"]),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def get_rekap(self, conn, qs):
        periode = (qs.get("periode") or [date.today().strftime("%Y-%m")])[0]
        kelas_id = int((qs.get("kelas_id") or ["1"])[0])
        if len(periode) != 7:
            raise ValueError("Periode tidak valid")
        rows = conn.execute(
            """SELECT s.id, s.nama, s.nis,
                      SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) hadir,
                      SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) izin,
                      SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) sakit,
                      SUM(CASE WHEN a.status = 'alfa' THEN 1 ELSE 0 END) alfa
               FROM siswa s
               LEFT JOIN absensi a
                 ON a.siswa_id = s.id AND substr(a.tanggal, 1, 7) = ?
               WHERE s.kelas_id = ? AND s.status = 'aktif'
               GROUP BY s.id
               ORDER BY s.nama""",
            (periode, kelas_id),
        ).fetchall()
        self.send_json(200, {"periode": periode, "rekap": [dict(r) for r in rows]})

    def list_ekskul(self, conn):
        groups = conn.execute("SELECT * FROM ekskul ORDER BY nama").fetchall()
        anggota = conn.execute(
            f"""SELECT a.ekskul_id, s.id siswa_id, s.nama, {kelas_label()} kelas
               FROM ekskul_anggota a
               JOIN siswa s ON s.id = a.siswa_id
               JOIN kelas k ON k.id = s.kelas_id
               ORDER BY k.tingkat, s.nama"""
        ).fetchall()
        by_group = {}
        for row in anggota:
            by_group.setdefault(row["ekskul_id"], []).append(dict(row))
        payload = []
        for group in groups:
            item = dict(group)
            item["anggota"] = by_group.get(group["id"], [])
            payload.append(item)
        siswa = conn.execute(
            f"""SELECT s.id, s.nama, {kelas_label()} kelas
               FROM siswa s JOIN kelas k ON k.id = s.kelas_id
               WHERE s.status = 'aktif' ORDER BY k.tingkat, s.nama"""
        ).fetchall()
        self.send_json(200, {"ekskul": payload, "siswa": [dict(r) for r in siswa]})

    def save_ekskul(self, conn):
        data = self.read_json()
        nama = str(data.get("nama") or "").strip()
        pembina = str(data.get("pembina") or "").strip()
        if not nama:
            raise ValueError("Nama ekskul wajib diisi")
        conn.execute("INSERT INTO ekskul (nama, pembina) VALUES (?, ?)", (nama, pembina))
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_ekskul(self, conn, eid):
        conn.execute("DELETE FROM ekskul WHERE id = ?", (eid,))
        conn.commit()
        self.send_json(200, {"ok": True})

    def toggle_anggota(self, conn):
        data = self.read_json()
        ekskul_id = int(data.get("ekskul_id"))
        siswa_id = int(data.get("siswa_id"))
        existing = conn.execute(
            "SELECT 1 FROM ekskul_anggota WHERE ekskul_id = ? AND siswa_id = ?",
            (ekskul_id, siswa_id),
        ).fetchone()
        if existing:
            conn.execute(
                "DELETE FROM ekskul_anggota WHERE ekskul_id = ? AND siswa_id = ?",
                (ekskul_id, siswa_id),
            )
        else:
            conn.execute(
                "INSERT INTO ekskul_anggota (ekskul_id, siswa_id) VALUES (?, ?)",
                (ekskul_id, siswa_id),
            )
        conn.commit()
        self.send_json(200, {"ikut": not existing})

    def get_rapor(self, conn, sid):
        siswa = conn.execute(
            f"""SELECT s.id, s.nis, s.nama, s.jk, s.nama_wali, s.hp_wali,
                      {kelas_label()} kelas, g.nama wali_kelas
               FROM siswa s
               JOIN kelas k ON k.id = s.kelas_id
               LEFT JOIN guru g ON g.id = k.wali_id
               WHERE s.id = ?""",
            (sid,),
        ).fetchone()
        if not siswa:
            self.send_json(404, {"error": "Siswa tidak ditemukan"})
            return
        profil = conn.execute("SELECT * FROM profil WHERE id = 1").fetchone()
        tersimpan = {
            row["mapel"]: row["skor"]
            for row in conn.execute(
                "SELECT mapel, skor FROM nilai WHERE siswa_id = ? AND semester = ?",
                (sid, SEMESTER),
            )
        }
        nilai = [{"mapel": mapel, "skor": tersimpan.get(mapel)} for mapel in MAPEL]
        angka = [item["skor"] for item in nilai if item["skor"] is not None]
        hadir = {row["status"]: row["c"] for row in conn.execute(
            "SELECT status, COUNT(*) c FROM absensi WHERE siswa_id = ? GROUP BY status",
            (sid,),
        )}
        catatan = conn.execute(
            "SELECT tanggal, isi FROM catatan WHERE siswa_id = ? ORDER BY tanggal DESC, id DESC",
            (sid,),
        ).fetchall()
        ekskul = conn.execute(
            """SELECT e.nama, e.pembina
               FROM ekskul e JOIN ekskul_anggota a ON a.ekskul_id = e.id
               WHERE a.siswa_id = ? ORDER BY e.nama""",
            (sid,),
        ).fetchall()
        self.send_json(200, {
            "semester": SEMESTER,
            "profil": dict(profil) if profil else {},
            "siswa": dict(siswa),
            "nilai": nilai,
            "rata": round(sum(angka) / len(angka), 1) if angka else None,
            "absensi": {
                "hadir": hadir.get("hadir", 0),
                "izin": hadir.get("izin", 0),
                "sakit": hadir.get("sakit", 0),
                "alfa": hadir.get("alfa", 0),
            },
            "catatan": [dict(row) for row in catatan],
            "ekskul": [dict(row) for row in ekskul],
            "hafalan": [dict(row) for row in conn.execute(
                """SELECT surat, ayat, status, tanggal, catatan
                   FROM hafalan WHERE siswa_id = ? ORDER BY tanggal DESC, id DESC LIMIT 8""",
                (sid,),
            )],
        })

    def list_catatan(self, conn, sid):
        siswa = conn.execute(
            f"""SELECT s.*, {kelas_label()} kelas FROM siswa s
               JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?""",
            (sid,),
        ).fetchone()
        if not siswa:
            self.send_json(404, {"error": "Siswa tidak ditemukan"})
            return
        notes = conn.execute(
            "SELECT * FROM catatan WHERE siswa_id = ? ORDER BY tanggal DESC, id DESC",
            (sid,),
        ).fetchall()
        self.send_json(200, {"siswa": dict(siswa), "catatan": [dict(r) for r in notes]})

    def save_catatan(self, conn):
        data = self.read_json()
        siswa_id = int(data.get("siswa_id"))
        isi = str(data.get("isi") or "").strip()
        if not isi:
            raise ValueError("Catatan tidak boleh kosong")
        conn.execute(
            "INSERT INTO catatan (siswa_id, tanggal, isi) VALUES (?, ?, ?)",
            (siswa_id, date.today().isoformat(), isi),
        )
        conn.commit()
        self.send_json(200, {"ok": True})

    def delete_catatan(self, conn, cid):
        conn.execute("DELETE FROM catatan WHERE id = ?", (cid,))
        conn.commit()
        self.send_json(200, {"ok": True})


def main():
    init_db()
    httpd = ThreadingHTTPServer((HOST, PORT), App)
    print(f"SDIT Baiturrahman siap di http://{HOST}:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
