# Kontrak API Nge-Kos (v1)

Base URL (lokal): `http://localhost:3000`
Format: JSON. Auth: header `Authorization: Bearer <token>` (token berlaku 7 hari).

## Konvensi respons

- Objek tunggal: `{ "data": { ... } }`
- Daftar: `{ "data": [ ... ], "total": 3 }`
- Auth: `{ "token": "...", "user": { ... } }`
- DELETE sukses: 204 tanpa body
- Error: `{ "error": { "code": "...", "message": "..." } }`

## Objek

User:

```json
{ "id": "1", "nama": "Budi", "email": "budi@mail.com", "role": "pencari" }
```

`role`: `pencari` | `pemilik`

Kost:

```json
{
  "id": "1",
  "nama": "Kost Melati Asri",
  "alamat": "Jl. Ketintang No. 12, Surabaya",
  "patokan": null,
  "mapsUrl": "https://maps.google.com/?q=-7.322,112.729",
  "kategoriPenyewa": "putri",
  "ukuranKamar": "3 x 4 m",
  "jumlahKamarTotal": 10,
  "jumlahKamarKosong": 6,
  "harga": 850000,
  "fasilitas": ["WiFi", "AC", "Kamar Mandi Dalam"],
  "imageUrl": "assets/images/kost_melati.jpg",
  "whatsappNumber": "6281234567890",
  "status": "tersedia"
}
```

- `kategoriPenyewa`: `putra` | `putri` | `campur`
- `status`: `tersedia` | `hampir_penuh` | `penuh`. Dihitung server, tidak boleh dikirim klien.
  Aturan: kosong = 0 → `penuh`; kosong ≤ 25% total → `hampir_penuh`; selain itu → `tersedia`.
- `patokan` dan `imageUrl` bisa `null`.

## Endpoint

| Method | Path             | Akses                   | Sukses                                        | Error                                         |
| ------ | ---------------- | ----------------------- | --------------------------------------------- | --------------------------------------------- |
| POST   | /auth/register   | publik                  | 201                                           | 400 VALIDATION_ERROR, 409 EMAIL_TAKEN         |
| POST   | /auth/login      | publik                  | 200                                           | 400 VALIDATION_ERROR, 401 INVALID_CREDENTIALS |
| GET    | /auth/me         | login                   | 200 `{data: User}`                            | 401 UNAUTHORIZED / INVALID_TOKEN              |
| GET    | /kost            | publik                  | 200                                           | 400 VALIDATION_ERROR                          |
| GET    | /kost/:id        | publik                  | 200                                           | 404 NOT_FOUND                                 |
| GET    | /owner/kost      | pemilik                 | 200                                           | 401, 403 FORBIDDEN                            |
| POST   | /kost            | pemilik                 | 201                                           | 400, 401, 403                                 |
| PUT    | /kost/:id        | pemilik pemilik listing | 200                                           | 400, 401, 403, 404                            |
| DELETE | /kost/:id        | pemilik pemilik listing | 204                                           | 401, 403, 404                                 |
| GET    | /favorit         | pencari                 | 200 `{data: [Kost], total}` (terbaru di atas) | 401, 403                                      |
| PUT    | /favorit/:kostId | pencari                 | 204 (idempoten)                               | 401, 403, 404                                 |
| DELETE | /favorit/:kostId | pencari                 | 204 (idempoten)                               | 401, 403, 404                                 |

Urutan pemeriksaan PUT/DELETE: token (401) → peran (403) → kost ada (404) → milik sendiri (403) → isi body (400, hanya PUT).

### POST /auth/register

Body: `nama`, `email`, `password` (8–72 karakter), `role`.

### POST /auth/login

Body: `email`, `password`.

### GET /kost

Semua query opsional:

- `q`: cocok sebagian di nama atau alamat
- `area`: cocok sebagian di alamat
- `hargaMin`, `hargaMax`: angka bulat
- `fasilitas`: dipisah koma; kost harus punya semuanya; huruf besar/kecil diabaikan
- `status`: `tersedia` | `hampir_penuh` | `penuh`
- `sort`: `harga_asc` | `harga_desc` (default: urutan id)

### POST /kost dan PUT /kost/:id

PUT **mengganti seluruh data**: field opsional yang tidak dikirim menjadi kosong.

- Wajib: `nama`, `alamat`, `mapsUrl`, `kategoriPenyewa`, `ukuranKamar`, `jumlahKamarTotal`, `jumlahKamarKosong`, `harga`, `whatsappNumber`
- Opsional: `patokan`, `imageUrl`, `fasilitas` (default `[]`)
- `jumlahKamarTotal` dan `jumlahKamarKosong` adalah angka JSON (bukan teks); total ≥ 1; 0 ≤ kosong ≤ total
- `harga`: angka bulat > 0
- `whatsappNumber`: hanya angka, diawali `62`
- `mapsUrl`: diawali `http://` atau `https://`
- `fasilitas` hanya boleh berisi: WiFi, AC, Kamar Mandi Dalam, Kamar Mandi Luar, Kasur, Lemari, Meja Belajar, Laundry, Parkir Motor, Dapur Bersama
- `owner_id` diambil dari token, tidak dari body

## Kode error

| HTTP | code                | Arti                                                   |
| ---- | ------------------- | ------------------------------------------------------ |
| 400  | VALIDATION_ERROR    | Input tidak valid (pesan menjelaskan field-nya)        |
| 401  | UNAUTHORIZED        | Header token tidak ada                                 |
| 401  | INVALID_TOKEN       | Token salah, kedaluwarsa, atau akunnya sudah tidak ada |
| 401  | INVALID_CREDENTIALS | Email atau kata sandi salah                            |
| 403  | FORBIDDEN           | Peran salah, atau kost milik orang lain                |
| 404  | NOT_FOUND           | Kost atau endpoint tidak ditemukan                     |
| 409  | EMAIL_TAKEN         | Email sudah terdaftar                                  |
| 500  | INTERNAL_ERROR      | Kesalahan server                                       |

## Di luar cakupan versi ini

Upload foto, pagination, refresh token, pembatasan percobaan login.
