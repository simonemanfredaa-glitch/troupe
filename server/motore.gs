/**
 * TROUPE · web app (fase 1: accesso, ricerca, scheda contatto, invita, aggiungi a mano)
 * Un solo file. La pagina è nella costante PAGINA in fondo.
 *
 * Dopo ogni aggiornamento importante: esegui "migra" dall'editor (una volta sola, non fa danni se ripetuta).
 * Accessi, registro e indice progetti stanno nel file "TROUPE · Sistema" (cartella App).
 * Ogni progetto ha la sua cartella in Progetti › In corso, con il suo Google Sheet.
 */

const SHEET_ID = '1eRKgqTvTlYJ93vGGjU3Ayb3PZuokjEtbXnb_YC2nC5E';   // database contatti: solo SUPPLIERS e CATEGORIES
const CARTELLA_APP = '15f7Iz06VO65aKXhDoPuC9HMRooGXgJXt';             // TROUPE › App
const CARTELLA_IN_CORSO = '1sS8sD0ZW6lOGNRO31HLVvDik1obtK5YQ';        // TROUPE › Progetti › In corso
// Incolla qui il link della tua Scheda collocamento (quello che finisce con /exec)
const LINK_SCHEDA = 'https://script.google.com/macros/s/AKfycbwJRlfp2wJc1iUXyUsogDX_XTs5rAlOqeXgy2ZrGatSlkEG9gRteOoWLoUCdcXZ9frxMg/exec';

// Link pubblico di Troupe (quello che finisce con /exec): serve per i link di conferma alla crew
const LINK_APP = 'https://script.google.com/macros/s/AKfycbxuOnDHJY_1vsG9MTow36k-aiQJkvr8yw09bHlwlm3A1Xo8_UHSjB_fqTtdJKW1XoKhHQ/exec';

const DURATA_SESSIONE = 21600; // 6 ore

// Indirizzo dell'app su GitHub: i link per la crew puntano qui
const LINK_PUBBLICO = 'https://simonemanfredaa-glitch.github.io/troupe/';

// ───────────────────────── API per la pagina su GitHub ─────────────────────────
const API_OK = ['versione', 'avvio', 'entra', 'esci', 'contatti', 'ruoli', 'sensibili', 'aggiungi', 'progetti', 'progetto', 'salvaProgetto', 'aggiungiCrew',
  'aggiornaCrew', 'togliCrew', 'chiediConferma', 'sblocca', 'sensibiliCrew', 'confermaLeggi', 'confermaInvia', 'datiPersona', 'confermaAdmin',
  'chiediCatering', 'catering', 'fileCatering', 'rilevamento', 'salvaMandato', 'mandato', 'chiudiProgetto', 'archivio', 'accessi',
  'creaProducer', 'cambiaAccesso', 'eliminaProgetto', 'aggiornaOra', 'catInvia', 'catCrea', 'catRiepilogo', 'catPdf', 'catModifica', 'catElimina', 'catElenco'];
function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    if (API_OK.indexOf(q.fn) === -1) throw new Error('Funzione non disponibile');
    out = { data: fnPerNome_(q.fn).apply(null, q.args || []) };
  } catch (err) {
    out = { err: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// trova una funzione per nome, anche quando il motore è caricato da GitHub dall'avviatore
function fnPerNome_(n) { return eval(n); }

// ───────────────────────── Pagina ─────────────────────────
function doGet(e) {
  // La pagina di Troupe ora sta su GitHub: il vecchio link porta lì (con l'eventuale invito)
  const p = (e && e.parameter) || {};
  const q = p.invito ? '?invito=' + encodeURIComponent(String(p.invito).replace(/[^a-z0-9-]/gi, '').slice(0, 60)) + (p.tipo === 'cat' ? '&tipo=cat' : '') : '';
  const url = LINK_PUBBLICO + q;
  return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_top">' +
    '<style>body{font-family:system-ui,sans-serif;background:#E9E8E4;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0}' +
    'a{background:#17181B;color:#fff;padding:16px 26px;border-radius:14px;text-decoration:none;font-weight:600;font-size:17px}</style></head>' +
    '<body><a href="' + url + '">Apri Troupe</a><script>try{window.top.location.href=' + JSON.stringify(url) + '}catch(e){}</script></body></html>')
    .setTitle('Troupe');
}

// per controllare da fuori quale versione del motore è attiva
function versione() { return VERSIONE_MOTORE; }
const VERSIONE_MOTORE = '2026-11-17f';

function nuovoCodice_(esistenti) {
  let c;
  do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (esistenti.indexOf(c) !== -1);
  return c;
}

// ───────────────────────── Accesso ─────────────────────────
function utenti_() { return memo_('utenti', utenti0_); }
function utenti0_() {
  const sh = sys_().getSheetByName('ACCESSI');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().map(r => ({
    codice: String(r[0]).trim(), nome: r[1], admin: String(r[2]).trim().toLowerCase() === 'admin',
    attivo: /^s[iì]/i.test(String(r[3]).trim())
  }));
}

function entra(codice) {
  const cache = CacheService.getScriptCache();
  const errori = Number(cache.get('errori') || 0);
  if (errori >= 8) return { ok: false, msg: 'Troppi tentativi sbagliati. Riprova tra 10 minuti.' };
  const u = utenti_().find(x => x.attivo && x.codice && x.codice === String(codice).trim());
  if (!u) {
    cache.put('errori', String(errori + 1), 600);
    return { ok: false, msg: 'Codice non valido, riprova' };
  }
  const token = Utilities.getUuid();
  cache.put('t_' + token, JSON.stringify({ nome: u.nome, admin: u.admin, t: Date.now() }), DURATA_SESSIONE);
  return { ok: true, token: token, nome: u.nome, admin: u.admin };
}

function chi_(token) {
  const v = token && CacheService.getScriptCache().get('t_' + token);
  if (!v) throw new Error('SESSIONE');
  const u = JSON.parse(v);
  const b = CacheService.getScriptCache().get('blocco_' + u.nome);   // accesso disattivato o codice cambiato
  if (b && (u.t || 0) < Number(b)) throw new Error('SESSIONE');
  return u;
}

function esci(token) {
  if (token) CacheService.getScriptCache().remove('t_' + token);
  return true;
}

// ───────────────────────── Dati ─────────────────────────
const COL = {
  ruolo: 'Roles / Categories', cognome: 'Surname', nome: 'Name', tel: 'Phone', email: 'Email',
  azienda: 'Company', citta: 'Location', last: 'Last Used',
  cf: 'Tax Code (CF)', nascita: 'Date of Birth', luogo: 'Place of Birth', via: 'Residence Address',
  comune: 'Residence City', cap: 'Residence ZIP', regime: 'Tax Regime', piva: 'VAT Number', iban: 'IBAN'
};

function foglio_() { return memo_('foglio', foglio0_); }
function foglio0_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('SUPPLIERS');
  const head = sh.getRange(2, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(h => String(h).trim());
  const idx = {};
  Object.keys(COL).forEach(k => { idx[k] = head.indexOf(COL[k]); });
  return { sh: sh, idx: idx, ncol: head.length };
}

const pieno_ = v => { v = String(v || '').trim(); return v !== '' && v !== '-'; };

function contatti(token) {
  chi_(token);
  return Object.keys(mappaContatti_().byRow).map(k => mappaContatti_().byRow[k]).filter(c => c.cognome || c.nome || c.azienda);
}

function ruoli(token) {
  chi_(token);
  return inMemoria_('ruoli', () => {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CATEGORIES');
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(r => String(r[0]).trim()).filter(Boolean);
  });
}

function sensibili(token, riga) {
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin può vedere questi dati');
  const f = foglio_();
  const r = f.sh.getRange(Number(riga), 1, 1, f.ncol).getDisplayValues()[0];
  const g = k => (f.idx[k] >= 0 ? String(r[f.idx[k]]).trim() : '');
  registra_(u.nome, g('nome') + ' ' + g('cognome'), 'dati sensibili');
  return {
    cf: g('cf'), nascita: [g('nascita'), g('luogo')].filter(Boolean).join(' · '),
    residenza: [g('via'), [g('cap'), g('comune')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    regime: g('regime'), piva: g('piva'), iban: g('iban')
  };
}

function registra_(chi, persona, cosa) {
  const sh = sys_().getSheetByName('REGISTRO');
  if (sh) sh.appendRow([Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'), chi, persona, cosa]);
}

function aggiungi(token, d) {
  bump_();
  const u = chi_(token);
  const pulisci = s => String(s || '').trim();
  d = {
    nome: pulisci(d.nome), cognome: pulisci(d.cognome), ruolo: pulisci(d.ruolo),
    citta: pulisci(d.citta), tel: pulisci(d.tel), email: pulisci(d.email).toLowerCase()
  };
  if (!d.nome || !d.ruolo) return { ok: false, msg: 'Servono almeno nome e ruolo' };
  if (!d.tel && !d.email) return { ok: false, msg: 'Serve almeno telefono o email' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = foglio_();
    const last = f.sh.getLastRow();
    const v = f.sh.getRange(3, 1, Math.max(last - 2, 1), f.ncol).getDisplayValues();
    // doppioni: stesso telefono (ultime 9 cifre) o stessa email
    const t9 = s => String(s).replace(/\D/g, '').slice(-9);
    const dup = v.findIndex(r => (d.tel && t9(r[f.idx.tel]) && t9(r[f.idx.tel]) === t9(d.tel)) ||
                                 (d.email && String(r[f.idx.email]).trim().toLowerCase() === d.email));
    if (dup !== -1) {
      const r = v[dup];
      return { ok: false, dup: true, msg: 'È già nel database: ' + (r[f.idx.nome] + ' ' + r[f.idx.cognome]).trim() + ' (' + r[f.idx.ruolo] + ')' };
    }
    let riga = -1;
    for (let i = 0; i < v.length; i++) {
      if (!v[i][f.idx.cognome] && !v[i][f.idx.nome] && !v[i][f.idx.ruolo] && !v[i][f.idx.tel] && !v[i][f.idx.email]) { riga = i + 3; break; }
    }
    if (riga === -1) { f.sh.insertRowAfter(last); riga = last + 1; }
    const set = (k, val) => { if (f.idx[k] >= 0 && val) f.sh.getRange(riga, f.idx[k] + 1).setValue(val); };
    set('ruolo', d.ruolo);
    set('cognome', d.cognome.toUpperCase());
    set('nome', d.nome.toUpperCase());
    set('tel', d.tel ? "'" + d.tel : '');
    set('email', d.email);
    set('citta', d.citta);
    f.sh.getRange(riga, f.idx.ruolo + 1).setNote('Fonte: app Troupe · ' + u.nome + ' (' +
      Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy') + ')\nDati per il collocamento da chiedere.');
    return { ok: true, r: riga };
  } finally {
    lock.releaseLock();
  }
}

// ═════════════════════════ FASE 2 · progetti, crew, conferme ═════════════════════════

const H_PROG = ['ID', 'Titolo', 'Luogo', 'Dal', 'Al', 'Producer', 'Stato', 'Creato', 'Cartella', 'Foglio', 'Azienda', 'Rilevamento', 'Mandato', 'Chiuso il', 'In crew', 'Da confermare', 'Giorni'];
const H_CREW = ['Riga contatto', 'Persona', 'Qualifica', 'Dal', 'Al', 'Da collocare', 'Contatto in crew list',
  'Referente', 'Conferma', 'Aggiornato', 'Codice link', 'Note', 'Compenso totale', 'Diaria', 'Diaria già data', 'Rimborso km', 'Km già dati'];

// file "TROUPE · Sistema": accessi, registro, indice dei progetti
function sys_() { return memo_('sys', sys0_); }
function sys0_() {
  const id = PropertiesService.getScriptProperties().getProperty('SYS_ID');
  if (!id) throw new Error('Manca il file Sistema: esegui "migra" dall\'editor');
  return SpreadsheetApp.openById(id);
}
function tabIn_(ss, nome, head) {
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.getRange(2, 1, 999, head.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < head.length) {
    const lc = sh.getLastColumn();
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.getRange(2, lc + 1, 999, head.length - lc).setNumberFormat('@');
  }
  return sh;
}
function righe_(sh, ncol) {
  const n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, ncol).getDisplayValues();
}
const oggi_ = () => Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');

// ───── migrazione / setup (da eseguire dall'editor) ─────
function migra() {
  bump_();
  const props = PropertiesService.getScriptProperties();
  let sys;
  if (!props.getProperty('SYS_ID')) {
    sys = SpreadsheetApp.create('TROUPE · Sistema');
    DriveApp.getFileById(sys.getId()).moveTo(DriveApp.getFolderById(CARTELLA_APP));
    props.setProperty('SYS_ID', sys.getId());
  } else sys = sys_();
  const db = SpreadsheetApp.openById(SHEET_ID);
  const copia = (nome, head) => {
    const dst = tabIn_(sys, nome, head);
    const src = db.getSheetByName(nome);
    if (src && src.getLastRow() > 1 && dst.getLastRow() < 2) {
      const v = src.getRange(2, 1, src.getLastRow() - 1, head.length).getDisplayValues();
      dst.getRange(2, 1, v.length, head.length).setNumberFormat('@').setValues(v);
    }
    return src;
  };
  const acc = copia('ACCESSI', ['Codice', 'Nome', 'Ruolo (admin / producer)', 'Attivo (sì / no)', 'Note']);
  const reg = copia('REGISTRO', ['Quando', 'Chi', 'Persona', 'Cosa']);
  const accSys = sys.getSheetByName('ACCESSI');
  if (accSys.getLastRow() < 2) {
    accSys.appendRow([nuovoCodice_([]), 'Simone Manfreda', 'admin', 'sì', 'Codice admin: vede tutto']);
  }
  const pSys = tabIn_(sys, 'PROGETTI', H_PROG);
  // progetti creati nel database: ognuno nella sua cartella con il suo foglio
  const oldP = db.getSheetByName('PROGETTI'), oldC = db.getSheetByName('CREW');
  if (oldP && oldP.getLastRow() > 1) {
    const crew = oldC && oldC.getLastRow() > 1 ? oldC.getRange(2, 1, oldC.getLastRow() - 1, 13).getDisplayValues() : [];
    const gia = righe_(pSys, H_PROG.length).map(r => r[0]);
    oldP.getRange(2, 1, oldP.getLastRow() - 1, 8).getDisplayValues().forEach(r => {
      if (!r[0] || gia.indexOf(r[0]) !== -1) return;
      const p = { id: r[0], titolo: r[1], luogo: r[2], dal: r[3], al: r[4], producer: r[5], stato: r[6] || 'attivo', creato: r[7] };
      creaCartella_(p);
      pSys.appendRow([p.id, p.titolo, p.luogo, p.dal, p.al, p.producer, p.stato, p.creato, p.cartella, p.foglio]);
      const righe = crew.filter(c => c[0] === p.id).map(c => c.slice(1).map((v, i) => i === 10 && v ? p.id + '-' + v : v));
      if (righe.length) crewTab_(p).getRange(2, 1, righe.length, 12).setValues(righe.map(x => x.slice(0, 12)));
    });
  }
  // il database torna pulito: restano SUPPLIERS e i suoi tab
  [acc, reg, oldP, oldC].forEach(sh => { if (sh) db.deleteSheet(sh); });
  const f1 = sys.getSheetByName('Foglio1') || sys.getSheetByName('Sheet1');
  if (f1 && sys.getSheets().length > 1) sys.deleteSheet(f1);
  tabIn_(sys, 'PROGETTI', H_PROG);
  installaPulizia_();
  Logger.log('Fatto. Codici di accesso nel file "TROUPE · Sistema" (cartella App), tab ACCESSI.');
}

// ───── un progetto = una cartella + un Google Sheet ─────
function nomeCartella_(p) { return p.dal + ' · ' + p.titolo; }
function creaCartella_(p) {
  const dir = DriveApp.getFolderById(CARTELLA_IN_CORSO).createFolder(nomeCartella_(p));
  const ss = SpreadsheetApp.create(p.titolo + ' · Troupe');
  DriveApp.getFileById(ss.getId()).moveTo(dir);
  const sh = ss.getSheets()[0];
  sh.setName('CREW');
  sh.getRange(1, 1, 1, H_CREW.length).setValues([H_CREW]).setFontWeight('bold');
  sh.getRange(2, 1, 999, H_CREW.length).setNumberFormat('@');
  sh.setFrozenRows(1);
  p.cartella = dir.getId(); p.foglio = ss.getId();
  return p;
}
function apri_(id) { return memo_('ss_' + id, () => SpreadsheetApp.openById(id)); }
function crewTab_(p) { return memo_('crew_' + p.foglio, () => tabIn_(apri_(p.foglio), 'CREW', H_CREW)); }

// contatti per riga, con controllo che la riga sia ancora la stessa persona
function mappaContatti_() { return inMemoria_('contatti', mappa0_); }
function mappa0_() {
  const f = foglio_();
  const n = f.sh.getLastRow() - 2;
  const v = n > 0 ? f.sh.getRange(3, 1, n, f.ncol).getDisplayValues() : [];
  const g = (r, k) => (f.idx[k] >= 0 ? String(r[f.idx[k]]).trim() : '');
  const byRow = {}, byName = {};
  v.forEach((r, i) => {
    const c = { r: i + 3, ruolo: g(r, 'ruolo'), cognome: g(r, 'cognome'), nome: g(r, 'nome'), tel: g(r, 'tel'), email: g(r, 'email'),
      azienda: g(r, 'azienda'), citta: g(r, 'citta'), last: g(r, 'last'), d: ['cf', 'nascita', 'via', 'regime', 'iban'].map(k => pieno_(g(r, k)) ? 1 : 0) };
    byRow[c.r] = c;
    const k = chiave_(c.nome + ' ' + c.cognome);
    if (k) byName[k] = c;
  });
  return { byRow: byRow, byName: byName };
}
const chiave_ = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
function trova_(m, riga, persona) {
  const c = m.byRow[riga];
  if (c && (!persona || chiave_(c.nome + ' ' + c.cognome) === chiave_(persona))) return c;
  return m.byName[chiave_(persona)] || c || null;
}

function puoProgetto_(u, p) { return u.admin || p.producer === u.nome; }

function leggiProgetti_() { return inMemoria_('progetti', leggiProgetti0_); }
function leggiProgetti0_() {
  return righe_(tabIn_(sys_(), 'PROGETTI', H_PROG), H_PROG.length).map((r, i) => ({
    row: i + 2, id: r[0], titolo: r[1], luogo: r[2], dal: r[3], al: r[4], producer: r[5], stato: r[6] || 'attivo', creato: r[7], cartella: r[8], foglio: r[9],
    azienda: r[10] || 'COURAGE', ril: r[11], man: r[12], chiuso: r[13], nCrew: r[14], nDaConf: r[15], giorni: r[16]
  })).filter(p => p.id);
}
function leggiCrew_(p, sh) {
  sh = sh || crewTab_(p);
  return righe_(sh, H_CREW.length).map((r, i) => ({
    row: i + 2, prj: p.id, r: Number(r[0]), persona: r[1], q: r[2], dal: r[3], al: r[4], col: r[5] !== 'no',
    cm: r[6] || 'suo', ref: r[7], conf: r[8], agg: r[9], cod: r[10], note: r[11],
    comp: r[12], diaria: r[13], diariaGia: r[14], km: r[15], kmGia: r[16]
  })).filter(c => c.r);
}
function vede_(u, c, p) {
  if (u.admin) return true;
  if (c.conf !== 'confermata' && c.conf !== 'sbloccata') return false;
  if (p && p.stato === 'chiuso' && p.chiuso) return giorniDa_(p.chiuso) <= 30;   // dopo la chiusura: 30 giorni, poi solo admin
  return true;
}
function giorniDa_(iso) { const t = new Date(iso + 'T12:00:00'); return Math.floor((new Date() - t) / 864e5); }

function progetti(token) {
  const u = chi_(token);
  return inMemoria_('pl_' + u.nome, () => progetti0_(u));
}
function progetti0_(u) {
  return leggiProgetti_().filter(p => puoProgetto_(u, p) && p.stato !== 'chiuso' && p.stato !== 'eliminato').map(p => {
    if (p.nCrew !== '' && p.nCrew != null) return Object.assign(p, { n: Number(p.nCrew), daConf: Number(p.nDaConf) || 0 });
    return Object.assign(p, conteggi_(p));   // la prima volta li calcola e li salva nell'indice
  }).sort((a, b) => String(a.dal).localeCompare(String(b.dal)));
}

function progetto(token, id) {
  const u = chi_(token);
  return inMemoria_('pr_' + u.nome + '_' + id, () => progetto0_(u, id));
}
function progetto0_(u, id) {
  const p = leggiProgetti_().find(x => x.id === id);
  if (!p || !puoProgetto_(u, p)) throw new Error('Progetto non trovato');
  const m = mappaContatti_();
  p.cartellaUrl = p.cartella ? 'https://drive.google.com/drive/folders/' + p.cartella : '';
  p.crew = leggiCrew_(p).map(c => {
    const k = trova_(m, c.r, c.persona) || { r: c.r, nome: c.persona, cognome: '', tel: '', email: '', ruolo: '', d: [0, 0, 0, 0, 0] };
    return { r: k.r, nome: k.nome, cognome: k.cognome, tel: k.tel, email: k.email, ruolo: k.ruolo, azienda: k.azienda, citta: k.citta, d: k.d,
      q: c.q, dal: c.dal, al: c.al, col: c.col, cm: c.cm, ref: c.ref, conf: c.conf, agg: c.agg, vede: vede_(u, c, p), comp: c.comp, diaria: c.diaria, diariaGia: c.diariaGia, km: c.km, kmGia: c.kmGia, note: c.note };
  });
  return p;
}

function salvaProgetto(token, d) {
  bump_();
  const u = chi_(token);
  const pul = s => String(s || '').trim();
  d = { id: pul(d.id), titolo: pul(d.titolo), luogo: pul(d.luogo), dal: pul(d.dal), al: pul(d.al) || pul(d.dal), azienda: pul(d.azienda).toUpperCase() || 'COURAGE',
    giorni: String(d.giorni || '').replace(/[^0-9A-Z:;-]/g, '').slice(0, 2000) };
  if (!d.titolo || !d.dal) return { ok: false, msg: 'Servono almeno titolo e data di inizio' };
  if (d.al < d.dal) return { ok: false, msg: 'La data di fine è prima di quella di inizio' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = tabIn_(sys_(), 'PROGETTI', H_PROG);
    if (!d.id) {
      d.id = 'P' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyMMddHHmmss');
      d.producer = u.nome;
      creaCartella_(d);
      sh.appendRow([d.id, d.titolo, d.luogo, d.dal, d.al, u.nome, 'attivo', oggi_(), d.cartella, d.foglio, d.azienda, '', '', '', '0', '0', d.giorni]);
      return { ok: true, id: d.id };
    }
    const p = leggiProgetti_().find(x => x.id === d.id);
    if (!p || !puoProgetto_(u, p)) return { ok: false, msg: 'Progetto non trovato' };
    sh.getRange(p.row, 2, 1, 4).setValues([[d.titolo, d.luogo, d.dal, d.al]]);
    sh.getRange(p.row, 11).setValue(d.azienda);
    sh.getRange(p.row, 17).setNumberFormat('@').setValue(d.giorni);
    try {
      if (p.titolo !== d.titolo || p.dal !== d.dal) {
        DriveApp.getFolderById(p.cartella).setName(nomeCartella_(d));
        DriveApp.getFileById(p.foglio).setName(d.titolo + ' · Troupe');
      }
    } catch (e) {}
    // chi aveva le date del progetto le segue; gli altri restano dentro il nuovo periodo
    let mosse = 0;
    const csh = crewTab_(p);
    leggiCrew_(p, csh).forEach(c => {
      let dal = c.dal, al = c.al;
      if (c.dal === p.dal && c.al === p.al) { dal = d.dal; al = d.al; }
      else { if (dal < d.dal || dal > d.al) dal = d.dal; if (al > d.al || al < d.dal) al = d.al; if (al < dal) al = dal; }
      if (dal !== c.dal || al !== c.al) { csh.getRange(c.row, 4, 1, 2).setValues([[dal, al]]); mosse++; }
    });
    return { ok: true, id: d.id, mosse: mosse };
  } finally { lock.releaseLock(); }
}

function aggiungiCrew(token, id, righe) {
  bump_();
  try {
  const u = chi_(token);
  const p = leggiProgetti_().find(x => x.id === id);
  if (!p || !puoProgetto_(u, p)) throw new Error('Progetto non trovato');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const m = mappaContatti_();
    const sh = crewTab_(p);
    const gia = leggiCrew_(p, sh).map(c => c.r);
    const nuove = [];
    righe.map(Number).forEach(r => {
      const c = m.byRow[r];
      if (!c || gia.indexOf(r) !== -1) return;
      const forn = /^(rental|location$|film commission|specific|shipping|catering)/i.test(c.ruolo);
      nuove.push([String(r), (c.nome + ' ' + c.cognome).trim(), c.ruolo, p.dal, p.al, forn ? 'no' : 'sì', 'suo', '', '', '', '', '']);
      gia.push(r);
    });
    if (nuove.length) {
      sh.getRange(sh.getLastRow() + 1, 1, nuove.length, H_CREW.length).setNumberFormat('@')
        .setValues(nuove.map(x => x.concat(Array(H_CREW.length - x.length).fill(''))));
    }
    return { ok: true, n: nuove.length };
  } finally { lock.releaseLock(); }
  } finally { try { riconta_(id); } catch (e) {} }
}

function rigaCrew_(u, id, r) {
  const p = leggiProgetti_().find(x => x.id === id);
  if (!p || !puoProgetto_(u, p)) throw new Error('Progetto non trovato');
  const sh = crewTab_(p);
  const c = leggiCrew_(p, sh).find(x => x.r === Number(r));
  if (!c) throw new Error('Persona non trovata nel progetto');
  return { p: p, c: c, sh: sh };
}

function aggiornaCrew(token, id, r, d) {
  bump_();
  try {
  const u = chi_(token);
  const x = rigaCrew_(u, id, r);
  if (d.dal && d.al && d.al < d.dal) return { ok: false, msg: 'La data di fine è prima di quella di inizio' };
  x.sh.getRange(x.c.row, 3, 1, 6).setValues([[String(d.q || '').trim(), d.dal || x.c.dal, d.al || x.c.al,
    d.col ? 'sì' : 'no', d.cm || 'suo', String(d.ref || '').trim()]]);
  return { ok: true };
  } finally { try { riconta_(id); } catch (e) {} }
}

function togliCrew(token, id, r) {
  bump_();
  try {
  const u = chi_(token);
  const x = rigaCrew_(u, id, r);
  x.sh.deleteRow(x.c.row);
  return { ok: true };
  } finally { try { riconta_(id); } catch (e) {} }
}

function chiediConferma(token, id, r) {
  bump_();
  const u = chi_(token);
  const x = rigaCrew_(u, id, r);
  let cod = x.c.cod;
  if (!cod) cod = id + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  const conf = x.c.conf === 'confermata' || x.c.conf === 'sbloccata' ? x.c.conf : 'chiesta';
  x.sh.getRange(x.c.row, 9, 1, 3).setValues([[conf, oggi_(), cod]]);
  return { ok: true, link: LINK_PUBBLICO + '?invito=' + cod };
}

function sblocca(token, id, r) {
  bump_();
  try {
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin può sbloccare');
  const x = rigaCrew_(u, id, r);
  x.sh.getRange(x.c.row, 9, 1, 2).setValues([['sbloccata', oggi_()]]);
  x.sh.getRange(x.c.row, 12).setValue('Sbloccata a mano da ' + u.nome);
  registra_(u.nome, x.c.persona, 'sblocco a mano · ' + x.p.titolo);
  return { ok: true };
  } finally { try { riconta_(id); } catch (e) {} }
}

function sensibiliCrew(token, id, r) {
  const u = chi_(token);
  const x = rigaCrew_(u, id, r);
  if (!vede_(u, x.c, x.p)) throw new Error('Dati visibili dopo la conferma della persona');
  const f = foglio_();
  const c = trova_(mappaContatti_(), x.c.r, x.c.persona);
  const row = f.sh.getRange(c.r, 1, 1, f.ncol).getDisplayValues()[0];
  const g = k => (f.idx[k] >= 0 ? String(row[f.idx[k]]).trim() : '');
  registra_(u.nome, x.c.persona, 'dati sensibili · ' + x.p.titolo);
  return { cf: g('cf'), nascita: [g('nascita'), g('luogo')].filter(Boolean).join(' · '),
    residenza: [g('via'), [g('cap'), g('comune')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    regime: g('regime'), piva: g('piva'), iban: g('iban') };
}

// ───── pagina pubblica di conferma (link ?c=codice) ─────
function crewDaCodice_(cod) {
  cod = String(cod || '').trim();
  if (cod.length < 20 || cod.indexOf('-') < 0) return null;
  const p = leggiProgetti_().find(x => x.id === cod.split('-')[0]);
  if (!p || p.stato === 'chiuso' || p.stato === 'eliminato') return null;
  const sh = crewTab_(p);
  const c = leggiCrew_(p, sh).find(x => x.cod === cod);
  if (!c) return null;
  return { c: c, p: p, sh: sh };
}

function confermaLeggi(cod) {
  const x = crewDaCodice_(cod);
  if (!x) return { ok: false };
  const f = foglio_();
  const k = trova_(mappaContatti_(), x.c.r, x.c.persona);
  if (!k) return { ok: false };
  const row = f.sh.getRange(k.r, 1, 1, f.ncol).getDisplayValues()[0];
  const g = n => (f.idx[n] >= 0 ? String(row[f.idx[n]]).trim() : '');
  const dati = {};
  ['nome', 'cognome', 'tel', 'email', 'cf', 'nascita', 'luogo', 'via', 'cap', 'comune', 'regime', 'piva', 'iban'].forEach(n => { dati[n] = g(n); });
  return { ok: true, titolo: x.p.titolo, luogo: x.p.luogo, q: x.c.q, dal: x.c.dal, al: x.c.al, producer: x.p.producer,
    conf: x.c.conf, dati: dati, cat: leggiCateringDi_(x.p, x.c.r), col: x.c.col };
}

function confermaInvia(cod, azione, d, cat) {
  bump_();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const x = crewDaCodice_(cod);
    if (!x) return { ok: false, msg: 'Link non più valido: chiedi un nuovo link a chi ti ha scritto' };
    const sh = x.sh;
    if (azione === 'no') {
      if (x.c.conf === 'confermata') return { ok: false, msg: 'Hai già confermato: per cambiare scrivi a chi ti ha mandato il link' };
      sh.getRange(x.c.row, 9, 1, 2).setValues([['non disponibile', oggi_()]]);
      riconta_(x.p.id);
      return { ok: true };
    }
    if (cat) salvaCatering_(x.p, x.c, cat);
    if (azione === 'cat') return { ok: true };
    if (azione === 'correggi' && d) scriviDati_(x.c, d, '(la persona)', 'dalla persona');
    sh.getRange(x.c.row, 9, 1, 2).setValues([['confermata', oggi_()]]);
    riconta_(x.p.id);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// scrive nel database i dati di una persona (telefono, email, dati per il collocamento)
function scriviDati_(c, d, chi, da) {
  bump_();
  const f = foglio_();
  // leggo solo la riga della persona; se nel frattempo il database è stato riordinato, la cerco per nome
  let riga = c.r, row = f.sh.getRange(riga, 1, 1, f.ncol).getValues()[0];
  const disp = () => f.sh.getRange(riga, 1, 1, f.ncol).getDisplayValues()[0];
  let shown = disp();
  if (chiave_(shown[f.idx.nome] + ' ' + shown[f.idx.cognome]) !== chiave_(c.persona)) {
    const k = trova_(mappaContatti_(), c.r, c.persona);
    if (!k) throw new Error('Contatto non trovato nel database');
    riga = k.r; row = f.sh.getRange(riga, 1, 1, f.ncol).getValues()[0]; shown = disp();
  }
  const testo = { tel: 1, cap: 1, piva: 1, cf: 1, iban: 1, nascita: 1 };
  const cambiati = [], colonne = [], fmt = [];
  ['tel', 'email', 'cf', 'nascita', 'luogo', 'via', 'cap', 'comune', 'regime', 'piva', 'iban'].forEach(n => {
    const i = f.idx[n];
    if (!(n in d) || i < 0) return;
    let v = String(d[n] || '').trim();
    if (n === 'cf' || n === 'iban') v = v.toUpperCase().replace(/\s/g, '');
    if (n === 'email') v = v.toLowerCase();
    if (String(shown[i]).trim() === v) return;
    row[i] = v; colonne.push(i); cambiati.push(n);
    if (testo[n]) fmt.push(f.sh.getRange(riga, i + 1).getA1Notation());
  });
  if (cambiati.length) {
    if (fmt.length) f.sh.getRangeList(fmt).setNumberFormat('@');
    // una scrittura per ogni blocco di colonne vicine (mai la colonna Location, che è un chip)
    colonne.sort((x, y) => x - y);
    let ini = colonne[0], fine = colonne[0];
    const scrivi = () => f.sh.getRange(riga, ini + 1, 1, fine - ini + 1).setValues([row.slice(ini, fine + 1)]);
    for (let j = 1; j < colonne.length; j++) {
      const col = colonne[j];
      const salto = row.slice(fine + 1, col).length;
      const passaChip = f.idx.citta > fine && f.idx.citta < col;
      if (col - fine <= 4 && !passaChip && salto >= 0) fine = col; else { scrivi(); ini = fine = col; }
    }
    scrivi();
    registra_(chi, c.persona, 'dati aggiornati ' + da + ': ' + cambiati.length + ' campi');
    const nc = f.sh.getRange(riga, f.idx.ruolo + 1);
    nc.setNote(((nc.getNote() || '') + '\nDati aggiornati ' + da + ' il ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy')).trim());
  }
  return cambiati.length;
}

// quanti in crew e quanti da confermare: salvati nell'indice, così la Home non apre ogni progetto
function conteggi_(p) {
  let cc = [];
  try { cc = leggiCrew_(p); } catch (e) {}
  const o = { n: cc.length, daConf: cc.filter(c => c.col && c.conf !== 'confermata' && c.conf !== 'sbloccata' && c.conf !== 'non disponibile').length };
  try { tabIn_(sys_(), 'PROGETTI', H_PROG).getRange(p.row, 15, 1, 2).setValues([[String(o.n), String(o.daConf)]]); } catch (e) {}
  return o;
}
function riconta_(id) {
  const p = leggiProgetti_().find(x => x.id === id);
  if (p) conteggi_(p);
}

// ═════════════════════════ FASE 3 · catering, collocamenti, chiusura ═════════════════════════

const MODELLO_RIL = '1MuL9iK-_yAv8zt0-ICNM4dATv23IOnWOjlG69ALpUTQ';   // Modelli › MODELLO Rilevamento · Troupe
const MODELLO_MAN = '16hComuoKb7x6Hne-6IAacCwdKj0EEg3pL98HwUNrizU';   // Modelli › MODELLO Mandato · Troupe
const CARTELLA_ARCHIVIO = '1MFBbK5Vxtgp_VGksSSSlfS7gjytnIR0U';        // TROUPE › Progetti › Archivio
const EMAIL_STUDIO = 'assunzioni@studiocimaschi.it';
const NOME_STUDIO = 'Elena';
const H_CAT = ['Riga contatto', 'Persona', 'Dieta', 'Allergie', 'Altro', 'Allergia grave', 'Aggiornato'];
const MESI_IT = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
const MESI_BR = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function progettoPer_(u, id) {
  const p = leggiProgetti_().find(x => x.id === id);
  if (!p || !puoProgetto_(u, p)) throw new Error('Progetto non trovato');
  return p;
}
const confOk_ = c => c.conf === 'confermata' || c.conf === 'sbloccata';
const iso2date_ = s => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
function meseAnno_(p) {
  const a = iso2date_(p.dal), b = iso2date_(p.al || p.dal);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return MESI_IT[a.getMonth()] + ' ' + a.getFullYear();
  if (a.getFullYear() === b.getFullYear()) return MESI_IT[a.getMonth()] + '-' + MESI_IT[b.getMonth()] + ' ' + b.getFullYear();
  return MESI_IT[a.getMonth()] + ' ' + a.getFullYear() + ' - ' + MESI_IT[b.getMonth()] + ' ' + b.getFullYear();
}
function giorniTesto_(dal, al) {
  const a = iso2date_(dal), b = iso2date_(al || dal);
  if (dal === al || !al) return a.getDate() + ' ' + MESI_BR[a.getMonth()];
  if (a.getMonth() === b.getMonth()) return 'dal ' + a.getDate() + ' al ' + b.getDate() + ' ' + MESI_BR[b.getMonth()];
  return 'dal ' + a.getDate() + ' ' + MESI_BR[a.getMonth()] + ' al ' + b.getDate() + ' ' + MESI_BR[b.getMonth()];
}
const nGiorni_ = (dal, al) => Math.round((iso2date_(al || dal) - iso2date_(dal)) / 864e5) + 1;
function datiCompleti_(c) {
  const f = foglio_();
  const row = f.sh.getRange(c.r, 1, 1, f.ncol).getDisplayValues()[0];
  const g = k => (f.idx[k] >= 0 ? String(row[f.idx[k]]).trim() : '');
  const o = {};
  ['nome', 'cognome', 'tel', 'email', 'cf', 'nascita', 'luogo', 'via', 'cap', 'comune', 'regime', 'piva', 'iban'].forEach(k => { o[k] = g(k); });
  return o;
}
// esporta un Google Sheet come .xlsx nella cartella del progetto
function esportaXlsx_(ssId, nome, cartellaId) {
  SpreadsheetApp.flush();
  const r = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  return DriveApp.getFolderById(cartellaId).createFile(r.getBlob().setName(nome + '.xlsx'));
}
function emailHtml_(testo, grassetto) {
  const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return testo.split('\n').map(l => grassetto.indexOf(l) !== -1 ? '<b>' + e(l) + '</b>' : e(l)).join('<br>');
}

// ───── conferma fatta dall'admin al posto della persona ─────
function datiPersona(token, id, r) {
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin');
  const x = rigaCrew_(u, id, r);
  const k = trova_(mappaContatti_(), x.c.r, x.c.persona);
  registra_(u.nome, x.c.persona, 'apre i dati per compilarli · ' + x.p.titolo);
  return datiCompleti_(k);
}
function confermaAdmin(token, id, r, d) {
  bump_();
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin può confermare al posto della persona');
  const x = rigaCrew_(u, id, r);
  if (d) scriviDati_(x.c, d, u.nome, 'da ' + u.nome);
  x.sh.getRange(x.c.row, 9, 1, 2).setValues([['confermata', oggi_()]]);
  x.sh.getRange(x.c.row, 12).setValue('Confermata da ' + u.nome + ' al posto della persona');
  registra_(u.nome, x.c.persona, 'conferma al posto della persona · ' + x.p.titolo);
  riconta_(id);
  return { ok: true };
}

// ───── catering ─────
function catTab_(p) { return memo_('cat_' + p.foglio, () => tabIn_(apri_(p.foglio), 'CATERING', H_CAT)); }
function leggiCatering_(p) {
  // le righe "fuori crew" (dal link catering libero) hanno come riga 'x:nome'
  return righe_(catTab_(p), H_CAT.length).map((r, i) => ({ row: i + 2, r: /^x:/.test(r[0]) ? r[0] : Number(r[0]), persona: r[1], dieta: r[2], allergie: r[3], altro: r[4], grave: r[5] === 'sì', agg: r[6] }))
    .filter(x => x.r);
}
function leggiCateringDi_(p, r) {
  try { return leggiCatering_(p).find(x => x.r === Number(r)) || null; } catch (e) { return null; }
}
function salvaCatering_(p, c, d) {
  bump_();
  const sh = catTab_(p);
  const pul = s => String(s || '').trim().slice(0, 300);
  const riga = [String(c.r), c.persona, pul(d.dieta) || 'Mangio tutto', [].concat(d.allergie || []).map(pul).join(', '), pul(d.altro), d.grave ? 'sì' : 'no', oggi_()];
  const es = leggiCatering_(p).find(x => x.r === c.r);
  if (es) sh.getRange(es.row, 1, 1, H_CAT.length).setValues([riga]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, H_CAT.length).setNumberFormat('@').setValues([riga]);
}
function chiediCatering(token, id, r) {
  bump_();
  const u = chi_(token);
  const x = rigaCrew_(u, id, r);
  let cod = x.c.cod;
  if (!cod) { cod = id + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 20); x.sh.getRange(x.c.row, 11).setValue(cod); }
  return { ok: true, link: LINK_PUBBLICO + '?invito=' + cod + '&tipo=cat' };
}
function catering(token, id) {
  const u = chi_(token);
  const p = progettoPer_(u, id);
  return leggiCatering_(p).map(x => ({ r: x.r, persona: x.persona, dieta: x.dieta, allergie: x.allergie, altro: x.altro, grave: x.grave }));
}
function fileCatering(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const cat = leggiCatering_(p);
  const crew = leggiCrew_(p).filter(c => c.conf !== 'non disponibile')
    .concat(cat.filter(x => typeof x.r === 'string').map(x => ({ r: x.r, persona: x.persona, q: 'Fuori crew', dal: p.dal, al: p.al })));
  const nome = 'Catering · ' + p.titolo;
  const dir = DriveApp.getFolderById(p.cartella);
  const it = dir.getFilesByName(nome);
  const ss = it.hasNext() ? SpreadsheetApp.open(it.next()) : (() => { const s = SpreadsheetApp.create(nome); DriveApp.getFileById(s.getId()).moveTo(dir); return s; })();
  const sh = ss.getSheets()[0];
  sh.clear(); sh.setName('Catering');
  const out = [['CATERING · ' + p.titolo.toUpperCase(), '', '', '', ''], [p.luogo || '', '', '', '', ''], ['', '', '', '', ''],
    ['Giorno', 'Persone', 'Vegetariani', 'Vegani', 'Pescetariani']];
  for (let d = iso2date_(p.dal); d <= iso2date_(p.al); d = new Date(d.getTime() + 864e5)) {
    const iso = Utilities.formatDate(d, 'Europe/Rome', 'yyyy-MM-dd');
    const qui = crew.filter(c => c.dal <= iso && c.al >= iso);
    const conta = t => qui.filter(c => { const k = cat.find(x => x.r === c.r); return k && k.dieta === t; }).length;
    out.push([Utilities.formatDate(d, 'Europe/Rome', 'EEE dd/MM'), qui.length, conta('Vegetariana'), conta('Vegana'), conta('Pescetariana')]);
  }
  out.push(['', '', '', '', '']);
  out.push(['Esigenze', '', '', '', '']);
  out.push(['Nome', 'Ruolo', 'Dieta', 'Allergie e intolleranze', 'Allergia grave']);
  crew.forEach(c => {
    const k = cat.find(x => x.r === c.r);
    if (!k || (k.dieta === 'Mangio tutto' && !k.allergie && !k.altro)) return;
    out.push([c.persona, c.q, k.dieta, [k.allergie, k.altro].filter(Boolean).join(' · '), k.grave ? 'SÌ' : '']);
  });
  sh.getRange(1, 1, out.length, 5).setValues(out);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(4, 1, 1, 5).setFontWeight('bold');
  sh.autoResizeColumns(1, 5);
  return { ok: true, url: ss.getUrl() };
}

// ───── rilevamento nullaosta ─────
function rilevamento(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const crew = leggiCrew_(p).filter(c => c.col && c.conf !== 'non disponibile');
  const ok = crew.filter(confOk_), no = crew.filter(c => !confOk_(c));
  if (!ok.length) return { ok: false, msg: 'Nessuno ha ancora confermato' };
  const m = mappaContatti_();
  const tmp = DriveApp.getFileById(MODELLO_RIL).makeCopy('tmp rilevamento', DriveApp.getFolderById(p.cartella));
  const ss = SpreadsheetApp.open(tmp);
  const el = ss.getSheetByName('Elenco'), an = ss.getSheetByName('Anagrafica');
  el.getRange('C1').setValue(p.azienda);
  el.getRange('C3').setValue(p.producer);
  el.getRange('C5').setValue(p.titolo);
  el.getRange('C7').setValue(meseAnno_(p));
  ok.forEach((c, i) => {
    const k = trova_(m, c.r, c.persona);
    const d = datiCompleti_(k);
    el.getRange(11 + i, 1, 1, 6).setValues([[i + 1, d.cognome.toUpperCase(), d.nome.toUpperCase(), c.q.toUpperCase(), iso2date_(c.dal), iso2date_(c.al)]]);
    el.getRange(11 + i, 5, 1, 2).setNumberFormat('dd/MM/yyyy');
    const b = 1 + i * 7;
    if (i > 0) an.getRange(1, 1, 7, 6).copyFormatToRange(an, 1, 6, b, b + 6);
    const forf = /^F/i.test(d.regime);
    an.getRange(b, 1, 7, 6).setNumberFormat('@').setValues([
      ['COGNOME', d.cognome.toUpperCase(), 'NOME', d.nome.toUpperCase(), '', ''],
      ['', '', '', '', '', ''],
      ['COD.FISC.', d.cf.toUpperCase(), 'LUOGO DI NASCITA', d.luogo.toUpperCase(), 'DATA', d.nascita],
      ['', '', '', '', '', ''],
      ['RESIDENZA', d.comune.toUpperCase(), 'VIA', d.via.toUpperCase(), 'C.A.P.', d.cap],
      ['', '', '', '', '', ''],
      ['MATR.ENPALS', '', 'P.IVA', d.piva ? d.piva + (forf ? ' - FORFETTARIO' : '') : '', '', '']
    ]);
  });
  const nome = 'Rilevamento nullaosta_' + p.titolo + '_' + oggi_();
  const file = esportaXlsx_(ss.getId(), nome, p.cartella);
  tmp.setTrashed(true);   // copia di lavoro: resta solo il file .xlsx
  tabIn_(sys_(), 'PROGETTI', H_PROG).getRange(p.row, 12).setValue(oggi_());
  registra_(u.nome, ok.length + ' persone', 'rilevamento nullaosta · ' + p.titolo);
  const firma = String(u.nome).split(' ')[0];
  const oggetto = 'Rilevamento nullaosta · ' + p.titolo + ' · ' + meseAnno_(p);
  const testo = 'Ciao ' + NOME_STUDIO + ',\nspero tutto bene!\n\nIn allegato condivido il file di rilevamento nullaosta e i dati estesi per i collocamenti relativi alla produzione:\n\n' +
    p.titolo.toUpperCase() + '\n' + meseAnno_(p) + '\n\nAttendiamo il vostro ok di ricezione e rimaniamo a disposizione per qualsiasi ulteriore informazione.\n\nGrazie,\n' + firma;
  return chiudiInvio_(u, file, oggetto, testo, [p.titolo.toUpperCase(), meseAnno_(p)], { ok: true, n: ok.length, esclusi: no.map(c => c.persona) });
}
function chiudiInvio_(u, file, oggetto, testo, grassetto, out) {
  out.fileUrl = file.getUrl(); out.fileNome = file.getName();
  out.oggetto = oggetto; out.testo = testo; out.email = EMAIL_STUDIO;
  return out;
}

// ───── mandato di pagamento ─────
function salvaMandato(token, id, righe) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const sh = crewTab_(p);
  const crew = leggiCrew_(p, sh);
  const num = v => String(v == null ? '' : v).replace(/[^\d,.]/g, '').replace(',', '.');
  righe.forEach(d => {
    const c = crew.find(x => x.r === Number(d.r));
    if (!c) return;
    sh.getRange(c.row, 13, 1, 5).setValues([[num(d.comp), num(d.diaria), d.diariaGia ? 'sì' : 'no', num(d.km), d.kmGia ? 'sì' : 'no']]);
  });
  return { ok: true };
}
function mandato(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const crew = leggiCrew_(p).filter(c => c.col && confOk_(c));
  if (!crew.length) return { ok: false, msg: 'Nessuna persona confermata da mettere nel mandato' };
  const manca = crew.filter(c => !c.comp).map(c => c.persona);
  if (manca.length) return { ok: false, msg: 'Manca il compenso di: ' + manca.join(', ') };
  const m = mappaContatti_();
  const tmp = DriveApp.getFileById(MODELLO_MAN).makeCopy('tmp mandato', DriveApp.getFolderById(p.cartella));
  const ss = SpreadsheetApp.open(tmp);
  const sh = ss.getSheets()[0];
  sh.getRange('C1').setValue(p.azienda);
  sh.getRange('C3').setValue(p.producer);
  sh.getRange('H3').setValue(meseAnno_(p));
  sh.getRange('C5').setValue(p.titolo);
  const n = v => (v === '' || v == null) ? '' : Number(v);
  crew.forEach((c, i) => {
    const d = datiCompleti_(trova_(m, c.r, c.persona));
    const reg = (d.regime || '').charAt(0).toUpperCase();
    sh.getRange(11 + i, 2, 1, 14).setValues([[d.cognome.toUpperCase(), d.nome.toUpperCase(), c.q.toUpperCase(), giorniTesto_(c.dal, c.al), nGiorni_(c.dal, c.al),
      n(c.comp), /^[IFP]$/.test(reg) ? reg : '', reg === 'P' ? '' : d.piva, n(c.diaria), c.diaria ? c.diariaGia || 'no' : '', n(c.km), c.km ? c.kmGia || 'no' : '',
      d.iban, d.email]]);
    sh.getRange(11 + i, 9).setNumberFormat('@').setValue(reg === 'P' ? '' : d.piva);
  });
  const nome = 'Mandato di Pagamento_' + p.titolo + '_' + oggi_();
  const file = esportaXlsx_(ss.getId(), nome, p.cartella);
  tmp.setTrashed(true);
  tabIn_(sys_(), 'PROGETTI', H_PROG).getRange(p.row, 13).setValue(oggi_());
  registra_(u.nome, crew.length + ' persone', 'mandato di pagamento · ' + p.titolo);
  const firma = String(u.nome).split(' ')[0];
  const oggetto = 'Mandato di pagamento · ' + p.titolo + ' · ' + meseAnno_(p);
  const testo = 'Ciao ' + NOME_STUDIO + ',\n\nspero tutto bene!\n\nIn allegato condivido file Mandato di Pagamento riguardo ai collocamenti relativi alla produzione:\n\n' +
    p.titolo.toUpperCase() + '\n' + meseAnno_(p) + '\n\nAttendiamo il vostro ok di ricezione e rimaniamo a disposizione per qualsiasi ulteriore informazione.\n\nGrazie,\n' + firma;
  return chiudiInvio_(u, file, oggetto, testo, [p.titolo.toUpperCase(), meseAnno_(p)], { ok: true, n: crew.length });
}

// ───── chiusura e archivio ─────
function chiudiProgetto(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const sh = tabIn_(sys_(), 'PROGETTI', H_PROG);
  sh.getRange(p.row, 7).setValue('chiuso');
  sh.getRange(p.row, 14).setValue(oggi_());
  try { DriveApp.getFolderById(p.cartella).moveTo(DriveApp.getFolderById(CARTELLA_ARCHIVIO)); } catch (e) {}
  registra_(u.nome, '', 'chiude il progetto · ' + p.titolo);
  return { ok: true };
}
function archivio(token) {
  const u = chi_(token);
  return leggiProgetti_().filter(p => p.stato === 'chiuso' && puoProgetto_(u, p))
    .map(p => ({ id: p.id, titolo: p.titolo, dal: p.dal, al: p.al, luogo: p.luogo, producer: p.producer, chiuso: p.chiuso }))
    .sort((a, b) => String(b.dal).localeCompare(String(a.dal)));
}

// ───── pulizia automatica (ogni notte) ─────
// I dati del catering si cancellano 30 giorni dopo l'ultimo giorno di riprese: restano solo i conteggi.
function pulizia() {
  bump_();
  try { puliziaCatLibero_(); } catch (e) {}
  leggiProgetti_().forEach(p => {
    if (!p.foglio || giorniDa_(p.al) <= 30) return;
    try {
      const ss = SpreadsheetApp.openById(p.foglio);
      const sh = ss.getSheetByName('CATERING');
      if (!sh || sh.getLastRow() < 2) return;
      const v = righe_(sh, H_CAT.length);
      const conta = t => v.filter(r => r[2] === t).length;
      const res = tabIn_(ss, 'CATERING · conteggi', ['Risposte', 'Mangio tutto', 'Vegetariana', 'Vegana', 'Pescetariana', 'Con allergie', 'Cancellato il']);
      res.appendRow([v.length, conta('Mangio tutto'), conta('Vegetariana'), conta('Vegana'), conta('Pescetariana'), v.filter(r => r[3] || r[4]).length, oggi_()]);
      sh.getRange(2, 1, sh.getLastRow() - 1, H_CAT.length).clearContent();
    } catch (e) {}
  });
}
function installaPulizia_() {
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pulizia')) {
    ScriptApp.newTrigger('pulizia').timeBased().everyDays(1).atHour(3).create();
  }
}

// ───── elimina un progetto che non è andato in porto (la cartella va in OLD, niente si cancella) ─────
const CARTELLA_OLD = '1fLAofe-SM9H_JUlCeiVRFRyyzx2bphWs';
function eliminaProgetto(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const sh = tabIn_(sys_(), 'PROGETTI', H_PROG);
  sh.getRange(p.row, 7).setValue('eliminato');
  sh.getRange(p.row, 14).setValue(oggi_());
  try {
    const dir = DriveApp.getFolderById(p.cartella);
    dir.setName('(ELIMINATO) ' + dir.getName());
    dir.moveTo(DriveApp.getFolderById(CARTELLA_OLD));
  } catch (e) {}
  registra_(u.nome, '', 'elimina il progetto · ' + p.titolo);
  return { ok: true };
}

// ═════════════════════════ ACCESSI (solo admin) ═════════════════════════

function accTab_() { return sys_().getSheetByName('ACCESSI'); }
function soloAdmin_(token) { const u = chi_(token); if (!u.admin) throw new Error('Solo l\'admin'); return u; }

function accessi(token) {
  soloAdmin_(token);
  const sh = accTab_();
  const n = sh.getLastRow() - 1;
  const v = n > 0 ? sh.getRange(2, 1, n, 5).getDisplayValues() : [];
  const utenti = v.map((r, i) => ({ row: i + 2, codice: String(r[0]).trim(), nome: r[1], admin: String(r[2]).trim().toLowerCase() === 'admin',
    attivo: /^s[iì]/i.test(String(r[3]).trim()), note: r[4] })).filter(x => x.nome);
  const reg = sys_().getSheetByName('REGISTRO');
  const m = reg ? reg.getLastRow() - 1 : 0;
  const registro = m > 0 ? reg.getRange(Math.max(2, reg.getLastRow() - 39), 1, Math.min(40, m), 4).getDisplayValues().reverse()
    .map(r => ({ quando: r[0], chi: r[1], persona: r[2], cosa: r[3] })) : [];
  return { utenti: utenti, registro: registro, link: LINK_PUBBLICO };
}

function creaProducer(token, nome) {
  bump_();
  const u = soloAdmin_(token);
  nome = String(nome || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 3) return { ok: false, msg: 'Scrivi nome e cognome' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = accTab_();
    const tutti = utenti_();
    if (tutti.some(x => String(x.nome).toLowerCase() === nome.toLowerCase())) return { ok: false, msg: 'Esiste già un accesso con questo nome' };
    const cod = nuovoCodice_(tutti.map(x => x.codice));
    sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setNumberFormat('@')
      .setValues([[cod, nome, 'producer', 'sì', 'Creato da ' + u.nome + ' il ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy')]]);
    registra_(u.nome, nome, 'nuovo accesso producer');
    return { ok: true, codice: cod, nome: nome };
  } finally { lock.releaseLock(); }
}

function cambiaAccesso(token, row, azione) {
  bump_();
  const u = soloAdmin_(token);
  const sh = accTab_();
  row = Number(row);
  if (row < 2 || row > sh.getLastRow()) throw new Error('Accesso non trovato');
  const r = sh.getRange(row, 1, 1, 4).getDisplayValues()[0];
  const nome = r[1], admin = String(r[2]).trim().toLowerCase() === 'admin';
  if (nome === u.nome && azione === 'disattiva') return { ok: false, msg: 'Non puoi disattivare il tuo accesso' };
  if (azione === 'disattiva' || azione === 'attiva') {
    sh.getRange(row, 4).setValue(azione === 'attiva' ? 'sì' : 'no');
    if (azione === 'disattiva') CacheService.getScriptCache().put('blocco_' + nome, String(Date.now()), DURATA_SESSIONE);
    else CacheService.getScriptCache().remove('blocco_' + nome);
    registra_(u.nome, nome, azione === 'attiva' ? 'riattiva accesso' : 'disattiva accesso');
    return { ok: true };
  }
  if (azione === 'codice') {
    const cod = nuovoCodice_(utenti_().map(x => x.codice));
    sh.getRange(row, 1).setNumberFormat('@').setValue(cod);
    CacheService.getScriptCache().put('blocco_' + nome, String(Date.now()), DURATA_SESSIONE);   // chi era dentro col vecchio codice deve rientrare
    registra_(u.nome, nome, 'nuovo codice' + (admin ? ' (admin)' : ''));
    return { ok: true, codice: cod, io: nome === u.nome };
  }
  throw new Error('Azione non valida');
}

// ═════════════════════════ VELOCITÀ · memoria temporanea ═════════════════════════
// I dati letti dai fogli restano in memoria qualche minuto. Ogni modifica fatta da Troupe
// cambia la "versione" e svuota tutto; le modifiche fatte a mano sul foglio si vedono entro 5 minuti.
const MEM_SEC = 300;
let VER_ = null;
function ver_() {
  if (VER_) return VER_;
  const c = CacheService.getScriptCache();
  VER_ = c.get('ver');
  if (!VER_) { VER_ = String(Date.now()); c.put('ver', VER_, 21600); }
  return VER_;
}
let NOCACHE_ = false;
function bump_() { NOCACHE_ = true; VER_ = String(Date.now()); CacheService.getScriptCache().put('ver', VER_, 21600); MEMO_ = {}; }
let MEMO_ = {};
function memo_(k, fn) { if (!(k in MEMO_)) MEMO_[k] = fn(); return MEMO_[k]; }
function getBig_(k) {
  const c = CacheService.getScriptCache(), key = k + '@' + ver_();
  const n = c.get(key + '#n');
  if (!n) return null;
  const parti = c.getAll(Array.from({ length: Number(n) }, (_, i) => key + '#' + i));
  let s = '';
  for (let i = 0; i < Number(n); i++) { const p = parti[key + '#' + i]; if (p == null) return null; s += p; }
  try { return JSON.parse(s); } catch (e) { return null; }
}
function putBig_(k, obj) {
  if (NOCACHE_) return obj;   // durante una modifica non salvo letture che potrebbero cambiare subito dopo
  try {
    const c = CacheService.getScriptCache(), key = k + '@' + ver_(), s = JSON.stringify(obj), parti = {};
    const n = Math.ceil(s.length / 90000) || 1;
    for (let i = 0; i < n; i++) parti[key + '#' + i] = s.slice(i * 90000, (i + 1) * 90000);
    parti[key + '#n'] = String(n);
    c.putAll(parti, MEM_SEC);
  } catch (e) {}
  return obj;
}
function inMemoria_(k, fn) {
  return memo_(k, () => { const v = getBig_(k); return v != null ? v : putBig_(k, fn()); });
}

// tutto quello che serve alla Home in una sola chiamata
function avvio(token) {
  chi_(token);
  return { contatti: contatti(token), ruoli: ruoli(token), progetti: progetti(token) };
}
// ═════════════════════════ AGGIORNAMENTI ═════════════════════════
// Il motore sta su GitHub (server/motore.gs). Nello script c'è solo un piccolo "avviatore" che lo scarica,
// lo tiene in memoria per 10 minuti e lo usa. Quindi ogni modifica pubblicata su GitHub arriva da sola, entro 10 minuti.

// dall'app (solo admin): "Aggiorna ora" → svuoto la memoria, la prossima richiesta scarica il codice nuovo
function aggiornaOra(token) {
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin');
  const c = CacheService.getScriptCache();
  c.remove('motore_n');
  return 'Fatto: dalla prossima azione Troupe usa il codice più recente';
}

// ═════════════════════════ CATERING LIBERO · link unico, fuori dai progetti ═════════════════════════
// Un link per produzione (catering.html?e=Nome&f=ultimo giorno): chiunque lo apre scrive nome ed esigenze.
// Le risposte vanno nel file "CATERING · risposte" (cartella TROUPE), un tab per produzione.
// Non toccano il database contatti né i progetti. Si cancellano 45 giorni dopo l'inizio dello shoot.
const CARTELLA_TROUPE = '1ytiU_TFTpA_AbWbmMxl4v3Zro_TdOWAh';
const H_CATL = ['Quando', 'Nome', 'Cosa mangia', 'Allergie e intolleranze', 'Altro', 'Allergia grave'];

function catLiberoSS_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('CAT_LIBERO_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('CATERING · risposte');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(CARTELLA_TROUPE));
  ss.getSheets()[0].setName('LEGGIMI').getRange(1, 1, 3, 1).setValues([['Un tab per ogni produzione, creato dal link del catering.'],
    ['Le risposte di ogni tab si cancellano da sole 45 giorni dopo l\'inizio shoot indicato.'], ['Nel tab CONTEGGI restano solo i numeri.']]);
  props.setProperty('CAT_LIBERO_ID', ss.getId());
  return ss;
}

function catInvia(d) {
  d = d || {};
  const pul = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200);
  const evento = pul(d.e, 80).replace(/[\[\]\*\?\/\\:]/g, ' ');
  const nome = pul(d.nome, 80);
  if (!evento) return { ok: false, msg: 'Link non completo: chiedi di nuovo il link a chi te l\'ha mandato' };
  if (nome.length < 2) return { ok: false, msg: 'Scrivi nome e cognome' };
  if (['Mangio tutto', 'Vegetariana', 'Vegana', 'Pescetariana'].indexOf(String(d.dieta || '')) === -1) return { ok: false, msg: 'Scegli cosa mangi' };
  // link catering di un progetto (catering.html?p=ID): la risposta va nel catering di quel progetto
  if (d.p) {
    const p = leggiProgetti_().find(x => x.id === String(d.p));
    if (p && p.stato !== 'chiuso' && p.stato !== 'eliminato') {
      bump_();
      const lock = LockService.getScriptLock(); lock.waitLock(20000);
      try {
        const sh = catTab_(p);
        const all = [].concat(d.allergie || []).map(x => pul(x, 40)).filter(Boolean).slice(0, 10).join(', ');
        const riga = ['x:' + nome, nome, pul(d.dieta, 30) || 'Mangio tutto', all, pul(d.altro, 200), d.grave ? 'sì' : 'no', oggi_()];
        const es = leggiCatering_(p).find(x => (typeof x.r === 'string' && chiave_(x.persona) === chiave_(nome)));
        if (es) sh.getRange(es.row, 1, 1, H_CAT.length).setValues([riga]);
        else sh.getRange(sh.getLastRow() + 1, 1, 1, H_CAT.length).setNumberFormat('@').setValues([riga]);
        return { ok: true };
      } finally { lock.releaseLock(); }
    }
  }
  const fino = /^\d{4}-\d{2}-\d{2}$/.test(String(d.f || '')) ? String(d.f) : '';
  // freno anti-abuso: massimo 300 risposte all'ora per tutto il catering
  const c = CacheService.getScriptCache(), n = Number(c.get('catl_n') || 0);
  if (n > 300) return { ok: false, msg: 'Troppe risposte in poco tempo, riprova tra un po\'' };
  c.put('catl_n', String(n + 1), 3600);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = catLiberoSS_();
    const sh = catTrova_(ss, evento);
    if (!sh || sh.isSheetHidden() || ['LEGGIMI', 'CONTEGGI'].indexOf(evento.toUpperCase()) !== -1) return { ok: false, msg: 'Questo link non è più attivo: chiedine uno nuovo a chi te l\'ha mandato' };
    const all = [].concat(d.allergie || []).map(x => pul(x, 40)).filter(Boolean).slice(0, 10).join(', ');
    // stessa persona che rimanda: aggiorno la sua riga invece di aggiungerne una
    const righe = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getDisplayValues() : [];
    const k = righe.findIndex(r => chiave_(r[0]) === chiave_(nome));
    const riga = [Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM HH:mm'), nome, pul(d.dieta, 30) || 'Mangio tutto', all, pul(d.altro, 200), d.grave ? 'SÌ' : ''];
    sh.getRange(k >= 0 ? k + 2 : sh.getLastRow() + 1, 1, 1, H_CATL.length).setValues([riga]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function puliziaCatLibero_() {
  const id = PropertiesService.getScriptProperties().getProperty('CAT_LIBERO_ID');
  if (!id) return;
  const ss = SpreadsheetApp.openById(id);
  ss.getSheets().forEach(sh => {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(sh.getRange('H1').getDisplayValue());
    if (!m || giorniDa_(m[1]) <= 45 || sh.getLastRow() < 2) return;
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, H_CATL.length).getDisplayValues();
    const conta = t => v.filter(r => r[2] === t).length;
    tabIn_(ss, 'CONTEGGI', ['Produzione', 'Risposte', 'Mangio tutto', 'Vegetariana', 'Vegana', 'Pescetariana', 'Con allergie', 'Cancellato il'])
      .appendRow([sh.getName(), v.length, conta('Mangio tutto'), conta('Vegetariana'), conta('Vegana'), conta('Pescetariana'), v.filter(r => r[3] || r[4]).length, oggi_()]);
    ss.deleteSheet(sh);
  });
}

// ───── app Catering separata: crea produzione, riepilogo e PDF (con chiave privata) ─────
function catCrea(e, f, token) {
  const u = chi_(token);   // per creare serve il codice Troupe
  const pul = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200);
  const evento = pul(e, 80).replace(/[\[\]\*\?\/\\:]/g, ' ').trim();
  if (evento.length < 2) return { ok: false, msg: 'Scrivi il nome della produzione' };
  const fino = /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) ? String(f) : '';
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = catLiberoSS_();
    if (ss.getSheetByName(evento) || ['LEGGIMI', 'CONTEGGI'].indexOf(evento.toUpperCase()) !== -1) return { ok: false, msg: 'Esiste già una produzione con questo nome: aggiungi qualcosa, per esempio la data' };
    const sh = ss.insertSheet(evento);
    sh.getRange(1, 1, 1, H_CATL.length).setValues([H_CATL]).setFontWeight('bold');
    sh.setFrozenRows(1);
    const k = Utilities.getUuid().replace(/-/g, '').slice(0, 18);
    sh.getRange('H1:H2').setValues([['Inizio shoot: ' + (fino || '–')], ['Chiave: ' + k]]);
    sh.getRange('H4').setValue('Creata da: ' + u.nome);
    return { ok: true, e: evento, f: fino, k: k };
  } finally { lock.releaseLock(); }
}
function catTabConChiave_(e, k) {
  const sh = catTrova_(catLiberoSS_(), String(e || ''));
  if (!sh || sh.isSheetHidden() || !k || sh.getRange('H2').getDisplayValue() !== 'Chiave: ' + k) throw new Error('Link non valido');
  return sh;
}
function catRiepilogo(e, k) {
  const sh = catTabConChiave_(e, k);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H_CATL.length).getDisplayValues() : [];
  return { e: sh.getName(), fino: (/(\d{4}-\d{2}-\d{2})/.exec(sh.getRange('H1').getDisplayValue()) || [])[1] || '',
    risposte: v.filter(r => r[1]).map(r => ({ quando: r[0], nome: r[1], dieta: r[2], allergie: r[3], altro: r[4], grave: r[5] === 'SÌ' })) };
}
function catPdf(e, k) {
  const d = catRiepilogo(e, k);
  const es = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const r = d.risposte;
  const conta = t => r.filter(x => x.dieta === t).length;
  const conEsig = r.filter(x => x.allergie || x.altro || x.grave);
  const oggiIt = Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy');
  // un solo elenco: prima le allergie gravi, poi chi ha allergie o note, poi gli altri; dentro ogni gruppo in ordine di nome
  const peso = x => x.grave ? 0 : (x.allergie || x.altro) ? 1 : 2;
  const lista = r.slice().sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, 'it'));
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#17181B;font-size:10.5pt;margin:28px}' +
    'h1{font-size:20pt;margin:0 0 4px}.sub{color:#686B70;margin:0 0 16px}' +
    '.box{display:inline-block;border:1px solid #ccc;border-radius:6px;padding:7px 12px;margin:0 6px 8px 0}.box b{font-size:15pt;display:block}' +
    'table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:10px}' +
    'td,th{border-bottom:1px solid #e3e3e3;padding:7px 8px;text-align:left;vertical-align:top;word-wrap:break-word}' +
    'th{font-size:8.5pt;color:#686B70;border-bottom:1.5px solid #17181B}' +
    'tr.al td{background:#FCEDEE}tr.gr td{background:#F8D7DA}' +
    '.alg{color:#A3202A;font-weight:bold}.pill{display:inline-block;background:#A3202A;color:#fff;font-size:7.5pt;font-weight:bold;border-radius:4px;padding:1px 5px;margin-left:4px}' +
    '.leg{color:#686B70;font-size:8.5pt;margin-top:10px}</style></head><body>' +
    '<h1>Catering · ' + es(d.e) + '</h1><p class="sub">' + r.length + ' risposte' + (d.fino ? ' · inizio shoot ' + d.fino.split('-').reverse().join('/') : '') + ' · aggiornato al ' + oggiIt + '</p>' +
    '<div>' + [['Totale', r.length], ['Mangio tutto', conta('Mangio tutto')], ['Vegetariani', conta('Vegetariana')], ['Vegani', conta('Vegana')], ['Pescetariani', conta('Pescetariana')], ['Con allergie o note', conEsig.length]]
      .map(x => '<span class="box"><b>' + x[1] + '</b>' + x[0] + '</span>').join('') + '</div>' +
    '<table><colgroup><col style="width:27%"><col style="width:17%"><col style="width:30%"><col style="width:26%"></colgroup>' +
    '<tr><th>Nome</th><th>Dieta</th><th>Allergie e intolleranze</th><th>Note</th></tr>' +
    lista.map(x => '<tr class="' + (x.grave ? 'gr' : (x.allergie || x.altro) ? 'al' : '') + '"><td>' + es(x.nome) + (x.grave ? '<span class="pill">GRAVE</span>' : '') + '</td><td>' + es(x.dieta) + '</td>' +
      '<td class="alg">' + es(x.allergie) + '</td><td>' + es(x.altro) + '</td></tr>').join('') + '</table>' +
    (conEsig.length ? '<p class="leg">In rosso chi ha allergie, intolleranze o note: sono in cima all\'elenco. GRAVE = allergia grave, da gestire con attenzione.</p>' : '') +
    '</body></html>';
  const nome = 'Catering_' + d.e.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd') + '.pdf';
  const pdf = Utilities.newBlob(html, 'text/html', 'catering.html').getAs('application/pdf').setName(nome);
  return { nome: nome, b64: Utilities.base64Encode(pdf.getBytes()) };
}

// tab di una produzione: col nome attuale o con un nome di prima (così i link già mandati continuano a funzionare)
function catTrova_(ss, nome) {
  const sh = ss.getSheetByName(nome); if (sh) return sh;
  const k = chiave_(nome);
  return ss.getSheets().find(x => String(x.getRange('H3').getDisplayValue()).replace(/^Nomi precedenti: /, '').split(' | ').some(n => n && chiave_(n) === k)) || null;
}
// rinomina e cambia l'ultimo giorno
function catModifica(e, k, nuovo, f) {
  const pul = s => String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 80);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = catLiberoSS_(), sh = catTabConChiave_(e, k), vecchio = sh.getName(), nome = pul(nuovo);
    if (nome.length < 2) return { ok: false, msg: 'Scrivi il nome della produzione' };
    if (nome !== vecchio) {
      const altro = ss.getSheetByName(nome);
      if ((altro && altro.getSheetId() !== sh.getSheetId()) || ['LEGGIMI', 'CONTEGGI'].indexOf(nome.toUpperCase()) !== -1) return { ok: false, msg: 'Esiste già una produzione con questo nome: aggiungi qualcosa, per esempio la data' };
      const prima = String(sh.getRange('H3').getDisplayValue()).replace(/^Nomi precedenti: /, '').split(' | ').filter(Boolean);
      prima.push(vecchio);
      sh.getRange('H3').setValue('Nomi precedenti: ' + prima.join(' | '));
      sh.setName(nome);
    }
    const fino = /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) ? String(f) : '';
    sh.getRange('H1').setValue('Inizio shoot: ' + (fino || '–'));
    return { ok: true, e: nome, f: fino };
  } finally { lock.releaseLock(); }
}
// elimina: il link smette di funzionare, il tab viene nascosto e rinominato; le risposte si cancellano con la pulizia (30 giorni dopo l'ultimo giorno)
function catElimina(e, k) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = catTabConChiave_(e, k);
    if (!/(\d{4}-\d{2}-\d{2})/.test(sh.getRange('H1').getDisplayValue())) sh.getRange('H1').setValue('Inizio shoot: ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd'));
    sh.setName(('(ELIMINATO) ' + sh.getName() + ' ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'dd-MM HH.mm')).slice(0, 99));
    sh.hideSheet();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// tutte le produzioni attive, per chi entra con il codice Troupe (admin e producer)
function catElenco(token) {
  chi_(token);
  return catLiberoSS_().getSheets().filter(sh => !sh.isSheetHidden() && sh.getLastRow() > 0).map(sh => {
    const v = sh.getRange(1, 1, sh.getLastRow(), 8).getDisplayValues();
    const h = i => String((v[i] || [])[7] || '');
    if (!/^Chiave: /.test(h(1))) return null;
    return { e: sh.getName(), f: (/(\d{4}-\d{2}-\d{2})/.exec(h(0)) || [])[1] || '', k: h(1).replace('Chiave: ', ''),
      da: h(3).replace(/^Creata da: /, ''), n: v.slice(1).filter(r => r[1]).length,
      r: v.slice(1).filter(r => r[1]).map(r => ({ quando: r[0], nome: r[1], dieta: r[2], allergie: r[3], altro: r[4], grave: r[5] === 'SÌ' })) };
  }).filter(Boolean).sort((a, b) => (b.f || '9').localeCompare(a.f || '9') || a.e.localeCompare(b.e, 'it'));
}
