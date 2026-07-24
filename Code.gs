/**
 * Sistem Pencatatan Kas & E-Statement
 * Platform : Google Apps Script (Web App) + Google Sheets
 *
 * Fitur utama:
 *  - Input transaksi (Masuk/Keluar) via web app -> disimpan ke Google Sheets
 *  - Saldo berjalan dihitung otomatis
 *  - Export e-Statement PDF (desain mirip referensi bank) multi-halaman
 *  - Pengaturan header dinamis + upload logo (bisa diganti-ganti)
 */

// ============================================================
//  KONFIGURASI
// ============================================================
var CFG = {
  SHEET_TRX: 'Transaksi',
  SHEET_SET: 'Pengaturan',
  // Paginasi berbasis tinggi (bukan jumlah baris tetap) supaya setiap halaman
  // selalu muat dalam satu lembar A4, berapa pun jumlah baris keterangan.
  // Anggaran tinggi area baris (px) untuk halaman pertama (ada ringkasan) dan
  // halaman berikutnya. Tinggi baris diperkirakan dari jumlah baris keterangan.
  PAGE1_ROW_BUDGET: 590,
  PAGEN_ROW_BUDGET: 760,
  ROW_BASE_H: 22,
  ROW_LINE_H: 17,
  LOGO_FOLDER: 'E-Statement Assets'
};

// Pengaturan default (dipakai saat pertama kali dijalankan).
var DEFAULT_SETTINGS = {
  nama: 'ADITYA RAMADHANI',
  cabang: 'KC Surabaya Pemuda',
  nomorRekening: '1420019825412',
  mataUang: 'IDR',
  jenisRekening: 'Tabungan Mandiri',
  alamat: 'Menara Mandiri 1 Jalan Jenderal Sudirman Kav. 54-55, Jakarta 12190, Indonesia',
  namaEntitas: 'e-Statement',
  saldoAwalAkun: '0',
  footerLeft: 'PT Bank Mandiri (Persero) Tbk. berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia (BI),\nserta merupakan peserta penjamin Lembaga Penjamin Simpanan (LPS)',
  footerRight: 'Mandiri Call 14000',
  logoFileId: ''
};

// ============================================================
//  WEB APP ENTRY POINT
// ============================================================
function doGet() {
  ensureSheets_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Pencatatan Kas & E-Statement')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Menyertakan file HTML lain ke dalam template. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
//  INISIALISASI SHEET
// ============================================================
function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var trx = ss.getSheetByName(CFG.SHEET_TRX);
  if (!trx) {
    trx = ss.insertSheet(CFG.SHEET_TRX);
    trx.getRange(1, 1, 1, 6)
      .setValues([['ID', 'Tanggal', 'Jenis', 'Nominal', 'Keterangan', 'Saldo']])
      .setFontWeight('bold');
    trx.setFrozenRows(1);
  }

  var set = ss.getSheetByName(CFG.SHEET_SET);
  if (!set) {
    set = ss.insertSheet(CFG.SHEET_SET);
    set.getRange(1, 1, 1, 2)
      .setValues([['Key', 'Value']])
      .setFontWeight('bold');
    set.setFrozenRows(1);
    var rows = Object.keys(DEFAULT_SETTINGS).map(function (k) {
      return [k, DEFAULT_SETTINGS[k]];
    });
    set.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  return ss;
}

// ============================================================
//  PENGATURAN (SETTINGS)
// ============================================================
function getSettings() {
  ensureSheets_();
  var set = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_SET);
  var data = set.getDataRange().getValues();
  var out = {};
  // Mulai dari default supaya key yang belum ada tetap terisi.
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    if (key) out[key] = data[i][1];
  }
  out.hasLogo = !!out.logoFileId;
  return out;
}

function saveSettings(obj) {
  ensureSheets_();
  var set = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_SET);
  var data = set.getDataRange().getValues();
  var rowByKey = {};
  for (var i = 1; i < data.length; i++) {
    rowByKey[String(data[i][0]).trim()] = i + 1; // nomor baris di sheet
  }
  Object.keys(obj).forEach(function (key) {
    if (key === 'hasLogo') return;
    var val = obj[key];
    if (rowByKey[key]) {
      set.getRange(rowByKey[key], 2).setValue(val);
    } else {
      set.appendRow([key, val]);
      rowByKey[key] = set.getLastRow();
    }
  });
  return getSettings();
}

// ============================================================
//  UPLOAD / HAPUS LOGO
// ============================================================
function getLogoFolder_() {
  var it = DriveApp.getFoldersByName(CFG.LOGO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CFG.LOGO_FOLDER);
}

/**
 * Simpan logo dari web app.
 * @param {string} base64 - data base64 (tanpa prefix data URI)
 * @param {string} mimeType - mis. image/png
 * @param {string} filename - nama file
 */
function uploadLogo(base64, mimeType, filename) {
  var folder = getLogoFolder_();
  var settings = getSettings();

  // Hapus logo lama bila ada.
  if (settings.logoFileId) {
    try { DriveApp.getFileById(settings.logoFileId).setTrashed(true); } catch (e) {}
  }

  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename || 'logo');
  var file = folder.createFile(blob);
  // Konverter PDF Google tidak bisa merender gambar data-URI, jadi file logo
  // dibuat dapat diakses via URL publik (view-only) agar bisa disematkan ke PDF.
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}
  saveSettings({ logoFileId: file.getId() });
  return getSettings();
}

function hapusLogo() {
  var settings = getSettings();
  if (settings.logoFileId) {
    try { DriveApp.getFileById(settings.logoFileId).setTrashed(true); } catch (e) {}
  }
  saveSettings({ logoFileId: '' });
  return getSettings();
}

/** Wrapper publik untuk preview logo di web app. */
function getLogoPreview() {
  return getLogoDataUri_(getSettings());
}

function getLogoDataUri_(settings) {
  if (!settings || !settings.logoFileId) return '';
  try {
    var file = DriveApp.getFileById(settings.logoFileId);
    var blob = file.getBlob();
    return 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}

/**
 * URL gambar logo untuk disematkan ke PDF. Konverter HTML->PDF Google tidak
 * merender data-URI, jadi dipakai URL publik langsung dari Google Drive.
 * File dipastikan berbagi publik (view) supaya bisa diambil konverter.
 */
function getLogoUrl_(settings) {
  if (!settings || !settings.logoFileId) return '';
  try {
    var file = DriveApp.getFileById(settings.logoFileId);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return 'https://lh3.googleusercontent.com/d/' + settings.logoFileId + '=w400';
  } catch (e) {
    return '';
  }
}

// ============================================================
//  TRANSAKSI
// ============================================================
/**
 * Simpan transaksi baru.
 * @param {{tanggal:string, jenis:string, nominal:number|string, keterangan:string}} data
 */
function simpanTransaksi(data) {
  ensureSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trx = ss.getSheetByName(CFG.SHEET_TRX);

  var jenis = (String(data.jenis).toLowerCase() === 'masuk') ? 'Masuk' : 'Keluar';
  var nominal = Math.abs(Number(data.nominal) || 0);
  var tanggal = data.tanggal ? new Date(data.tanggal) : new Date();
  var keterangan = String(data.keterangan || '').trim();

  var saldoSebelumnya = getSaldoTerakhir_(trx);
  var signed = (jenis === 'Masuk') ? nominal : -nominal;
  var saldoBaru = saldoSebelumnya + signed;

  var id = 'TRX' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') +
    Math.floor(Math.random() * 900 + 100);

  trx.appendRow([id, tanggal, jenis, nominal, keterangan, saldoBaru]);
  return { ok: true, id: id, saldo: saldoBaru };
}

function getSaldoTerakhir_(trx) {
  var last = trx.getLastRow();
  if (last < 2) {
    var s = getSettings();
    return Number(s.saldoAwalAkun) || 0;
  }
  var val = trx.getRange(last, 6).getValue();
  return Number(val) || 0;
}

/** Ambil daftar transaksi untuk ditampilkan di web app (terbaru di atas). */
function getTransaksi(limit) {
  ensureSheets_();
  var trx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_TRX);
  var last = trx.getLastRow();
  if (last < 2) return [];
  var data = trx.getRange(2, 1, last - 1, 6).getValues();
  var out = data.map(function (r) {
    return {
      id: r[0],
      tanggal: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
      tanggalLabel: r[1] instanceof Date ? formatTanggal_(r[1]) + ' ' + formatJam_(r[1]) : String(r[1]),
      jenis: r[2],
      nominal: Number(r[3]) || 0,
      nominalLabel: formatIDR_(Number(r[3]) || 0),
      keterangan: r[4],
      saldo: Number(r[5]) || 0,
      saldoLabel: formatIDR_(Number(r[5]) || 0)
    };
  });
  out.reverse();
  if (limit && out.length > limit) out = out.slice(0, limit);
  return out;
}

function hapusTransaksi(id) {
  ensureSheets_();
  var trx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_TRX);
  var last = trx.getLastRow();
  if (last < 2) return { ok: false };
  var ids = trx.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      trx.deleteRow(i + 2);
      hitungUlangSaldo_();
      return { ok: true };
    }
  }
  return { ok: false };
}

/** Hitung ulang seluruh kolom Saldo agar konsisten setelah edit/hapus. */
function hitungUlangSaldo_() {
  var trx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_TRX);
  var last = trx.getLastRow();
  if (last < 2) return;
  var range = trx.getRange(2, 3, last - 1, 2); // Jenis, Nominal
  var vals = range.getValues();
  var s = getSettings();
  var saldo = Number(s.saldoAwalAkun) || 0;
  var saldos = vals.map(function (r) {
    var nominal = Math.abs(Number(r[1]) || 0);
    saldo += (String(r[0]).toLowerCase() === 'masuk') ? nominal : -nominal;
    return [saldo];
  });
  trx.getRange(2, 6, saldos.length, 1).setValues(saldos);
}

// ============================================================
//  GENERATE PDF E-STATEMENT
// ============================================================
/**
 * @param {string} startDateStr - 'yyyy-MM-dd'
 * @param {string} endDateStr   - 'yyyy-MM-dd'
 * @return {{ok:boolean, base64:string, filename:string, mimeType:string}}
 */
function generatePDFStatement(startDateStr, endDateStr) {
  ensureSheets_();
  var model = buildStatementModel_(startDateStr, endDateStr);

  var tpl = HtmlService.createTemplateFromFile('Statement');
  tpl.model = model;
  var html = tpl.evaluate().getContent();

  var blob = Utilities.newBlob(html, 'text/html', 'statement.html').getAs('application/pdf');
  var fname = 'e-Statement_' + model.periodeFile + '.pdf';
  blob.setName(fname);

  return {
    ok: true,
    base64: Utilities.base64Encode(blob.getBytes()),
    filename: fname,
    mimeType: 'application/pdf'
  };
}

/** Menyusun seluruh data yang dibutuhkan template PDF. */
function buildStatementModel_(startDateStr, endDateStr) {
  var settings = getSettings();
  var tz = 'Asia/Jakarta';

  var start = parseDateStart_(startDateStr);
  var end = parseDateEnd_(endDateStr);

  var trx = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_TRX);
  var last = trx.getLastRow();
  var all = (last >= 2) ? trx.getRange(2, 1, last - 1, 6).getValues() : [];

  // Urutkan berdasarkan tanggal (naik) agar saldo berjalan benar.
  all = all.filter(function (r) { return r[1] instanceof Date; });
  all.sort(function (a, b) { return a[1] - b[1]; });

  var saldoAwal = Number(settings.saldoAwalAkun) || 0;
  var running = saldoAwal;
  var saldoSebelumPeriode = saldoAwal;
  var danaMasuk = 0, danaKeluar = 0;
  var rows = [];

  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    var tgl = r[1];
    var jenis = String(r[2]);
    var nominal = Math.abs(Number(r[3]) || 0);
    var signed = (jenis.toLowerCase() === 'masuk') ? nominal : -nominal;

    if (tgl < start) {
      running += signed;
      saldoSebelumPeriode = running;
      continue;
    }
    if (tgl > end) break;

    running += signed;
    if (signed >= 0) danaMasuk += nominal; else danaKeluar += nominal;

    rows.push({
      no: rows.length + 1,
      tanggal: formatTanggal_(tgl),
      jam: formatJam_(tgl),
      keteranganLines: String(r[4] || '').split('\n'),
      nominalStr: (signed < 0 ? '-' : '+') + formatIDR_(nominal),
      isKeluar: signed < 0,
      saldoStr: formatIDR_(running)
    });
  }

  var saldoAkhir = running;

  // Bagi ke dalam halaman.
  var pages = paginate_(rows);
  var totalPages = pages.length || 1;

  var issuedOn = formatTanggal_(new Date());

  return {
    // header
    namaEntitas: settings.namaEntitas || 'e-Statement',
    alamat: settings.alamat || '',
    logoDataUri: getLogoUrl_(settings),
    // meta
    nama: settings.nama || '',
    cabang: settings.cabang || '',
    periode: formatTanggal_(start) + ' - ' + formatTanggal_(end),
    issuedOn: issuedOn,
    // ringkasan
    jenisRekening: settings.jenisRekening || '',
    nomorRekening: settings.nomorRekening || '',
    mataUang: settings.mataUang || 'IDR',
    saldoAwalStr: formatIDR_(saldoSebelumPeriode),
    danaMasukStr: '+ ' + formatIDR_(danaMasuk),
    danaKeluarStr: '- ' + formatIDR_(danaKeluar),
    saldoAkhirStr: formatIDR_(saldoAkhir),
    // footer (newline -> <br> agar bisa 2 baris)
    footerLeft: String(settings.footerLeft || '').replace(/\n/g, '<br>'),
    footerRight: settings.footerRight || '',
    // tabel
    pages: pages,
    totalPages: totalPages,
    adaTransaksi: rows.length > 0,
    periodeFile: Utilities.formatDate(start, tz, 'yyyyMMdd') + '-' +
      Utilities.formatDate(end, tz, 'yyyyMMdd')
  };
}

function rowHeight_(row) {
  var lines = (row.keteranganLines && row.keteranganLines.length) || 1;
  if (lines < 1) lines = 1;
  return CFG.ROW_BASE_H + lines * CFG.ROW_LINE_H;
}

function paginate_(rows) {
  if (rows.length === 0) {
    return [{ pageNo: 1, rows: [], showSummary: true }];
  }
  var pages = [];
  var i = 0, pageNo = 0;
  while (i < rows.length) {
    pageNo++;
    var budget = (pageNo === 1) ? CFG.PAGE1_ROW_BUDGET : CFG.PAGEN_ROW_BUDGET;
    var used = 0, chunk = [];
    while (i < rows.length) {
      var h = rowHeight_(rows[i]);
      if (chunk.length > 0 && used + h > budget) break;
      chunk.push(rows[i]);
      used += h;
      i++;
    }
    pages.push({ pageNo: pageNo, rows: chunk, showSummary: (pageNo === 1) });
  }
  return pages;
}

// ============================================================
//  HELPER FORMAT
// ============================================================
/** Format angka gaya Indonesia: 9.553.519,52 */
function formatIDR_(num) {
  var n = Number(num) || 0;
  var neg = n < 0;
  n = Math.abs(n);
  var parts = n.toFixed(2).split('.');
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var out = intPart + ',' + parts[1];
  return neg ? '-' + out : out;
}

function formatTanggal_(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd MMM yyyy');
}

function formatJam_(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'HH:mm:ss') + ' WIB';
}

function parseDateStart_(s) {
  if (!s) { var d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  var p = s.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
}

function parseDateEnd_(s) {
  if (!s) { var d = new Date(); d.setHours(23, 59, 59, 999); return d; }
  var p = s.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59, 999);
}
