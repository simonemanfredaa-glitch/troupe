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
const API_OK = ['avvio', 'entra', 'esci', 'contatti', 'ruoli', 'sensibili', 'aggiungi', 'progetti', 'progetto', 'salvaProgetto', 'aggiungiCrew',
  'aggiornaCrew', 'togliCrew', 'chiediConferma', 'sblocca', 'sensibiliCrew', 'confermaLeggi', 'confermaInvia', 'datiPersona', 'confermaAdmin',
  'chiediCatering', 'catering', 'fileCatering', 'rilevamento', 'salvaMandato', 'mandato', 'chiudiProgetto', 'archivio', 'accessi',
  'creaProducer', 'cambiaAccesso', 'eliminaProgetto', 'aggiornaOra'];
function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    if (API_OK.indexOf(q.fn) === -1) throw new Error('Funzione non disponibile');
    out = { data: globalThis[q.fn].apply(null, q.args || []) };
  } catch (err) {
    out = { err: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── Pagina ─────────────────────────
function doGet(e) {
  const conf = (e && e.parameter && e.parameter.invito) ? String(e.parameter.invito).replace(/[^a-z0-9-]/gi, '').slice(0, 60) : '';
  return HtmlService.createHtmlOutput(PAGINA.replace('__SCHEDA__', JSON.stringify(LINK_SCHEDA)).replace('__CONF__', JSON.stringify(conf)).replace('__MODE__', JSON.stringify(conf && e.parameter.tipo === 'cat' ? 'cat' : '')))
    .setTitle(conf ? 'Conferma' : 'Troupe')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

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
  return righe_(catTab_(p), H_CAT.length).map((r, i) => ({ row: i + 2, r: Number(r[0]), persona: r[1], dieta: r[2], allergie: r[3], altro: r[4], grave: r[5] === 'sì', agg: r[6] }))
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
  return leggiCatering_(p).map(x => ({ r: x.r, dieta: x.dieta, allergie: x.allergie, altro: x.altro, grave: x.grave }));
}
function fileCatering(token, id) {
  bump_();
  const u = chi_(token);
  const p = progettoPer_(u, id);
  const crew = leggiCrew_(p).filter(c => c.conf !== 'non disponibile');
  const cat = leggiCatering_(p);
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

// ═════════════════════════ AGGIORNAMENTI AUTOMATICI DA GITHUB ═════════════════════════
// Troupe si aggiorna da sola: ogni 10 minuti controlla se su GitHub c'è un codice nuovo
// (server/Codice.gs nel repository troupe). Se sì, lo copia qui, crea una versione e la pubblica.
const URL_CODICE = 'https://raw.githubusercontent.com/simonemanfredaa-glitch/troupe/main/server/Codice.gs';

// Da eseguire UNA volta dall'editor: autorizza, attiva il controllo ogni 10 minuti e fa il primo aggiornamento.
function attivaAggiornamenti() {
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'aggiornaDaGitHub')) {
    ScriptApp.newTrigger('aggiornaDaGitHub').timeBased().everyMinutes(10).create();
  }
  installaPulizia_();
  const r = aggiornaDaGitHub(true);
  Logger.log(r);
}

function aggiornaDaGitHub(forza) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 'Aggiornamento già in corso';
  try {
    const props = PropertiesService.getScriptProperties();
    const res = UrlFetchApp.fetch(URL_CODICE + '?t=' + Date.now(), { muteHttpExceptions: true, headers: { 'Cache-Control': 'no-cache' } });
    if (res.getResponseCode() !== 200) return 'GitHub non risponde (' + res.getResponseCode() + ')';
    const nuovo = res.getContentText();
    if (nuovo.indexOf('function doPost') === -1 || nuovo.indexOf('URL_CODICE') === -1) return 'Il file su GitHub non sembra Troupe: non aggiorno';
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, nuovo));
    if (!forza && props.getProperty('hash_codice') === hash) return 'Già aggiornata';

    const id = ScriptApp.getScriptId();
    const api = 'https://script.googleapis.com/v1/projects/' + id;
    const opt = (method, body) => ({ method: method, contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: body ? JSON.stringify(body) : undefined });
    const chk = (r, cosa) => { if (r.getResponseCode() >= 300) throw new Error(cosa + ': ' + r.getContentText().slice(0, 300)); return JSON.parse(r.getContentText() || '{}'); };

    // 1. sostituisco il codice (il manifest appsscript.json resta quello che c'è)
    const cont = chk(UrlFetchApp.fetch(api + '/content', opt('get')), 'Lettura progetto');
    const manifest = cont.files.filter(f => f.type === 'JSON');
    chk(UrlFetchApp.fetch(api + '/content', opt('put', { files: manifest.concat([{ name: 'Codice', type: 'SERVER_JS', source: nuovo }]) })), 'Scrittura codice');
    // 2. nuova versione
    const ver = chk(UrlFetchApp.fetch(api + '/versions', opt('post', { description: 'Da GitHub ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM HH:mm') })), 'Nuova versione');
    // 3. la pubblico sull'app web già esistente (stesso link)
    const deps = chk(UrlFetchApp.fetch(api + '/deployments', opt('get')), 'Elenco deployment').deployments || [];
    const dep = deps.find(d => (d.entryPoints || []).some(e => e.entryPointType === 'WEB_APP' && e.webApp && e.webApp.url && e.webApp.url.indexOf(LINK_APP.split('/macros/s/')[1].split('/')[0]) !== -1));
    if (!dep) throw new Error('Non trovo il deployment dell\'app web');
    chk(UrlFetchApp.fetch(api + '/deployments/' + dep.deploymentId, opt('put', { deploymentConfig: {
      scriptId: id, versionNumber: ver.versionNumber, manifestFileName: 'appsscript', description: 'Troupe · versione ' + ver.versionNumber } })), 'Pubblicazione');
    props.setProperty('hash_codice', hash);
    try { registra_('aggiornamento automatico', '', 'Troupe aggiornata alla versione ' + ver.versionNumber); } catch (e) {}
    return 'Aggiornata alla versione ' + ver.versionNumber;
  } catch (e) {
    try { registra_('aggiornamento automatico', '', 'ERRORE: ' + String(e.message).slice(0, 200)); } catch (x) {}
    return 'Errore: ' + e.message;
  } finally { lock.releaseLock(); }
}

// dall'app (solo admin): "Aggiorna ora"
function aggiornaOra(token) {
  const u = chi_(token);
  if (!u.admin) throw new Error('Solo l\'admin');
  return aggiornaDaGitHub(false);
}

// ───────────────────────── Pagina (non modificare) ─────────────────────────
const PAGINA = "<!DOCTYPE html>\n<html lang=\"it\">\n<head>\n<base target=\"_top\">\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover\">\n<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"default\">\n<title>Troupe</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link href=\"https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n<style>\n:root{--bg:#E9E8E4;--card:#fff;--ink:#17181B;--muted:#686B70;--line:#DEDDD8;--soft:#F4F3F0;--blue:#1E3A8A;--blue-soft:#EAEFFA;--ok:#1F6B3A;--err:#A3202A;--wa:#1F8F4E}\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\nhtml,body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,sans-serif;-webkit-font-smoothing:antialiased}\nbutton,input{font:inherit;color:inherit}\n.app{max-width:480px;margin:0 auto;min-height:100vh;padding:calc(14px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) 40px calc(14px + env(safe-area-inset-left))}\n.top{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 14px}\n.brand{font-weight:700;font-size:18px;letter-spacing:-.01em}\n.who{font-size:13px;color:var(--muted);display:flex;gap:10px;align-items:center}\n.link{background:none;border:none;padding:8px 0;color:var(--blue);font-weight:600;font-size:14px;cursor:pointer}\n.card{background:var(--card);border-radius:18px;padding:16px;margin-bottom:12px}\nh1{font-size:24px;line-height:1.2;margin:4px 4px 14px;letter-spacing:-.015em}\nh2{font-size:15px;margin:0 0 10px}\n.lab{display:block;font-size:13px;font-weight:600;margin:0 0 6px}\n.f{margin-bottom:12px;position:relative}\n.f:last-child{margin-bottom:0}\ninput[type=text],input[type=tel],input[type=email],input[type=search]{width:100%;height:46px;border:1px solid var(--line);border-radius:12px;padding:0 12px;font-size:16px;background:#fff;outline:none;-webkit-appearance:none;appearance:none}\ninput:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(30,58,138,.12)}\n.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;border-radius:14px;border:none;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none}\n.btn.main{background:var(--ink);color:#fff}\n.btn.sec{background:#fff;border:1px solid var(--line);color:var(--ink)}\n.btn.wa{background:var(--wa);color:#fff}\n.btn:disabled{opacity:.5}\n.row{display:flex;gap:10px}\n.row>*{flex:1}\n.hide{display:none!important}\n.muted{color:var(--muted);font-size:13px;line-height:1.45}\n/* lista a discesa */\n.list{position:absolute;left:0;right:0;top:100%;margin:4px 0 0;padding:4px;list-style:none;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 28px rgba(20,22,26,.14);max-height:260px;overflow-y:auto;z-index:20}\n.list li{padding:11px 10px;border-radius:8px;font-size:15px;cursor:pointer;display:flex;justify-content:space-between;gap:8px}\n.list li small{color:var(--muted);font-size:12px;align-self:center}\n.list li:hover,.list li.on{background:var(--blue-soft);color:var(--blue)}\n/* accesso */\n.pin{max-width:320px;margin:9vh auto 0;text-align:center}\n.pin .brand{font-size:28px}\n.dots{display:flex;justify-content:center;gap:12px;margin:22px 0 8px;height:14px}\n.dots span{width:13px;height:13px;border-radius:50%;border:1.5px solid var(--ink)}\n.dots span.on{background:var(--ink)}\n.pmsg{min-height:20px;font-size:13px;color:var(--err);margin-bottom:10px}\n.keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}\n.keys button{height:62px;border-radius:16px;border:none;background:#fff;font-size:22px;font-weight:600;cursor:pointer}\n.keys button:active{background:var(--soft)}\n.keys .x{background:transparent;font-size:15px}\n/* risultati */\n.res{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--soft);cursor:pointer}\n.res:last-child{border-bottom:none}\n.res .t{flex:1;min-width:0}\n.res b{display:block;font-size:15px;font-weight:600}\n.res small{display:block;color:var(--muted);font-size:13px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.chk{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line);flex:0 0 auto;display:flex;align-items:center;justify-content:center;background:#fff;cursor:pointer}\n.chk.on{background:var(--ink);border-color:var(--ink);color:#fff}\n.bar{position:sticky;bottom:12px;display:flex;gap:10px;margin-top:12px}\n.count{font-size:13px;color:var(--muted);margin:0 4px 8px}\n/* scheda */\n.big{font-size:22px;font-weight:700;letter-spacing:-.01em}\n.sub{color:var(--muted);font-size:14px;margin-top:4px}\n.acts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}\n.acts a{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 4px;border-radius:14px;background:var(--soft);color:var(--ink);text-decoration:none;font-size:13px;font-weight:600}\n.acts a.off{opacity:.35;pointer-events:none}\ndl{margin:0}\ndt{font-size:12px;color:var(--muted);margin-top:10px}\ndt:first-child{margin-top:0}\ndd{margin:2px 0 0;font-size:15px;word-break:break-word}\n.lock{display:flex;gap:10px;align-items:flex-start;background:var(--soft);border-radius:12px;padding:12px;font-size:13px;color:var(--muted);line-height:1.45}\n.have{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}\n.have span{font-size:12px;padding:4px 9px;border-radius:20px;background:var(--soft);color:var(--muted)}\n.have span.y{background:#E5F2EA;color:var(--ok)}\n.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:12px 16px;border-radius:12px;font-size:14px;z-index:50;max-width:90vw}\n.err{background:#FBECEC;color:var(--err);border-radius:12px;padding:10px 12px;font-size:14px;margin-bottom:12px}\n.sec-h{display:flex;justify-content:space-between;align-items:baseline;margin:18px 4px 8px}\n.sec-h h2{margin:0;font-size:17px}\n.prj{display:block;width:100%;text-align:left;background:#fff;border:none;border-radius:18px;padding:14px 16px;margin-bottom:10px;cursor:pointer}\n.prj b{display:block;font-size:16px}\n.prj small{display:block;color:var(--muted);font-size:13px;margin-top:3px}\n.stats{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}\n.stats span{font-size:12px;padding:4px 9px;border-radius:20px;background:var(--soft);color:var(--ink)}\n.stats span.w{background:#FFF1D6;color:#7A4B00}\n.dep{font-size:13px;font-weight:700;color:var(--muted);margin:16px 4px 6px}\n.badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;background:var(--soft);color:var(--muted);flex:0 0 auto;white-space:nowrap}\n.badge.ok{background:#E5F2EA;color:var(--ok)}.badge.w{background:#FFF1D6;color:#7A4B00}.badge.no{background:#FBECEC;color:var(--err)}\n.seg{display:flex;gap:4px;background:var(--soft);padding:4px;border-radius:12px}\n.seg button{flex:1;min-height:38px;border:none;border-radius:9px;background:transparent;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;padding:0 4px}\n.seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}\ninput[type=date]{width:100%;height:46px;border:1px solid var(--line);border-radius:12px;padding:0 10px;font-size:16px;background:#fff;-webkit-appearance:none;appearance:none;min-width:0}\nselect{width:100%;height:46px;border:1px solid var(--line);border-radius:12px;padding:0 10px;font-size:16px;background:#fff}\npre.cl{white-space:pre-wrap;font:inherit;font-size:14px;line-height:1.5;margin:0}\n.btn.danger{color:var(--err)}\n.bad input{border-color:var(--err)}\n.fmsg{font-size:12px;color:var(--err);margin-top:4px}\n.row>.f{min-width:0}\n.step{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--soft)}\n.step:first-of-type{border-top:none}\n.step .t{flex:1;min-width:0}.step b{display:block;font-size:15px}.step small{display:block;color:var(--muted);font-size:13px;margin-top:2px}\n.tg{width:100%;border-collapse:collapse;font-size:14px}.tg th{font-size:12px;font-weight:600;color:var(--muted);text-align:right;padding:6px 0 8px}.tg th:first-child,.tg td:first-child{text-align:left}.tg td{text-align:right;padding:9px 0;border-top:1px solid var(--soft)}\n.btn.mini{width:auto;height:38px;padding:0 14px;font-size:14px;border-radius:11px;flex:0 0 auto}\n.seg.wrap{flex-wrap:wrap}.seg.wrap button{flex:1 1 40%}\n.chips{display:flex;flex-wrap:wrap;gap:6px}\n.chip{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--line);border-radius:20px;font-size:14px;cursor:pointer}\n.chip input{position:absolute;opacity:0;pointer-events:none}.chip{position:relative}\n.chip:has(input:checked){background:var(--ink);color:#fff;border-color:var(--ink)}\n.chk-row{display:flex;align-items:center;gap:10px;font-size:14px;margin-top:8px;cursor:pointer}\n.chk-row input{width:20px;height:20px;margin:0;accent-color:var(--ink)}\n.ov{position:fixed;inset:0;background:rgba(20,22,26,.35);z-index:40;display:flex;align-items:flex-end;justify-content:center}\n.sheet{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px 16px calc(14px + env(safe-area-inset-bottom))}\n.sheet .prev{max-height:34vh;overflow:auto;background:var(--soft);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:14px}\n.add{width:36px;height:36px;border-radius:50%;border:1.5px solid var(--ink);background:#fff;color:var(--ink);font-size:22px;line-height:1;font-weight:500;display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;padding:0}\n.btn.mini{white-space:nowrap;padding:0 10px}\n.res small{white-space:normal}\n.btn.soft{background:var(--blue-soft);color:var(--blue);border:none}\n.head-acts{display:flex;justify-content:space-between;align-items:center;margin-top:10px}\n.fchips{display:flex;gap:6px;overflow-x:auto;margin:12px 0 0;padding:0 2px 2px;-webkit-overflow-scrolling:touch}\n.fchip{flex:0 0 auto;height:34px;padding:0 12px;border-radius:17px;border:1px solid var(--line);background:#fff;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer}\n.fchip span{color:var(--muted);font-weight:500;margin-left:2px}\n.fchip.on{background:var(--ink);border-color:var(--ink);color:#fff}.fchip.on span{color:#C9CBD0}\n.cr{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--soft);cursor:pointer}\n.cr:first-child{border-top:none}\n.cr .t{flex:1;min-width:0}.cr b{display:block;font-size:15px;font-weight:600}\n.cr small{display:block;color:var(--muted);font-size:13px;margin-top:2px}\n.cr .manca{color:#7A4B00}\n.st{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;margin-top:5px;color:var(--muted)}\n.st::before{content:\"\";width:7px;height:7px;border-radius:50%;background:#B9BBBF}\n.st.ok{color:var(--ok)}.st.ok::before{background:var(--ok)}\n.st.w{color:#8A5A00}.st.w::before{background:#E0A11B}\n.st.no{color:var(--err)}.st.no::before{background:var(--err)}\n.hero{background:var(--ink);color:#fff;padding:20px 18px 16px}\n.hero .big{font-size:26px;color:#fff}.hero .sub{color:#C9CBD0;font-size:15px}.hero .sub2{color:#9EA2A9;font-size:13px;margin-top:4px}\n.hero .stats span{background:rgba(255,255,255,.12);color:#fff}.hero .stats span.w{background:rgba(224,161,27,.22);color:#FFD98A}\n.hero .link{color:#AFC3F5}.hero .btn.main{background:#fff;color:var(--ink)}\n.fchip .pallino{width:9px;height:9px;margin-right:6px;vertical-align:0}.fchip .pallino.da{border-width:1.5px}\n.fchip.on .pallino.da{background:transparent}\n.giorni{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}\n.gg{display:flex;flex-direction:column;align-items:center;padding:7px 2px 8px;border-radius:12px;border:1.5px solid transparent;cursor:pointer;font:inherit}\n.gg .w{font-size:11px;text-transform:capitalize;opacity:.8}.gg b{font-size:18px;line-height:1.2}.gg .k{font-size:10px;font-weight:600;margin-top:1px;white-space:nowrap}\n.gg.tS{background:var(--ink);color:#fff}.gg.tA{background:var(--blue-soft);color:var(--blue)}.gg.tR{background:#FFF1D6;color:#7A4B00}.gg.tP{background:#fff;color:var(--muted);border-style:dashed;border-color:var(--line)}\n.pallino{display:inline-block;width:12px;height:12px;border-radius:50%;flex:0 0 auto;background:#C9CBD0}\n.pallino.ok{background:var(--ok)}.pallino.att{background:#E0A11B}.pallino.da{background:#fff;border:2px solid #E0A11B;width:12px;height:12px;box-sizing:border-box}\n.pallino.no{background:var(--err)}.pallino.cl{background:#C9CBD0}\n.legenda{display:flex;flex-wrap:wrap;gap:4px 12px;margin:10px 4px 0;font-size:12px;color:var(--muted)}\n.legenda span{display:inline-flex;align-items:center;gap:5px}.legenda .pallino{width:9px;height:9px}.legenda .pallino.da{width:9px;height:9px;border-width:1.5px}\n.passi{position:fixed;left:0;right:0;bottom:0;z-index:30;background:rgba(233,232,228,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);padding:8px 16px max(14px, calc(6px + env(safe-area-inset-bottom)))}\n.passi-in{max-width:480px;margin:0 auto;background:#fff;border-radius:18px;padding:10px 12px 12px;box-shadow:0 -2px 18px rgba(20,22,26,.08)}\n.steps{display:flex;justify-content:space-between;position:relative;margin-bottom:10px}\n.steps::before{content:\"\";position:absolute;left:10%;right:10%;top:13px;height:2px;background:var(--line)}\n.dot{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;padding:0;cursor:pointer}\n.dot .c{width:26px;height:26px;border-radius:50%;background:#fff;border:2px solid var(--line);font-size:12px;font-weight:700;color:var(--muted);display:flex;align-items:center;justify-content:center}\n.dot .l{font-size:11px;color:var(--muted);font-weight:600}\n.dot.fatto .c{background:var(--ok);border-color:var(--ok);color:#fff}\n.dot.cur .c{border-color:var(--ink);color:var(--ink)}.dot.cur .l{color:var(--ink)}\n.dot.fatto.cur .c{box-shadow:0 0 0 3px #CDE6D6}\n.passo-ora{display:flex;align-items:center;gap:10px;border-top:1px solid var(--soft);padding-top:10px}\n.passo-ora .t{flex:1;min-width:0}.passo-ora b{display:block;font-size:15px}.passo-ora small{display:block;color:var(--muted);font-size:13px;margin-top:1px}\n.nuovo-bar{position:fixed;left:0;right:0;bottom:0;z-index:25;padding:8px 16px max(14px, calc(6px + env(safe-area-inset-bottom)));background:rgba(233,232,228,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}\n.nuovo-in{max-width:456px;margin:0 auto;background:#fff;border-radius:16px;padding:8px 8px 8px 14px;display:flex;align-items:center;gap:8px;box-shadow:0 -2px 18px rgba(20,22,26,.08)}\n.nuovo-in .lab{flex:1;font-size:14px}\n.gwrap{overflow-x:auto;background:#fff;border-radius:18px;padding:6px 0 6px;-webkit-overflow-scrolling:touch}\n.gt{border-collapse:separate;border-spacing:0;font-size:12px}\n.gt th,.gt td{padding:0;text-align:center}\n.gt .nm{position:sticky;left:0;z-index:2;background:#fff;text-align:left;padding:6px 10px 6px 12px;min-width:118px;max-width:118px;border-right:1px solid var(--soft)}\n.gt td.nm b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.gt td.nm small{display:block;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.gt .gh{min-width:34px;padding:4px 2px 6px;color:var(--muted);font-weight:500}.gt .gh span{display:block;font-size:10px}.gt .gh b{display:block;font-size:14px;color:var(--ink)}\n.tp{display:inline-flex;width:16px;height:16px;border-radius:5px;font-size:10px;font-style:normal;font-weight:700;align-items:center;justify-content:center;margin-top:2px}\n.tp.tS{background:var(--ink);color:#fff}.tp.tA{background:var(--blue-soft);color:var(--blue)}.tp.tR{background:#FFF1D6;color:#7A4B00}.tp.tP{background:#fff;color:var(--muted);border:1px dashed var(--line)}\n.gt .dr td{background:var(--soft);font-size:11px;font-weight:700;color:var(--muted);padding:4px 12px}.gt .dr td.nm{background:var(--soft)}\n.gc{height:40px;cursor:pointer;border-top:1px solid var(--soft);position:relative}\n.gc.on::after{content:\"\";position:absolute;left:2px;right:2px;top:9px;bottom:9px;border-radius:6px;background:#C9CBD0}\n.gc.on.sok::after{background:var(--ok)}.gc.on.satt::after,.gc.on.sda::after{background:#E0A11B}.gc.on.sno::after{background:#E9B9BC}\n.gc.sel{box-shadow:inset 0 0 0 2px var(--blue)}\n.gt .tot td{font-weight:700;padding:8px 0;border-top:1px solid var(--line)}.gt .tot td.nm{font-size:12px;color:var(--muted)}\n.legenda-g{display:flex;gap:12px;margin:8px 4px 0;font-size:12px;color:var(--muted)}.legenda-g span{display:inline-flex;align-items:center;gap:5px}.legenda-g .tp{margin:0}\n.toast{bottom:auto!important;top:calc(14px + env(safe-area-inset-top))}\n.bar.fissa{position:fixed;left:16px;right:16px;bottom:max(14px, calc(6px + env(safe-area-inset-bottom)));max-width:452px;margin:0 auto;z-index:25}\n.add.on{background:var(--ok);border-color:var(--ok);color:#fff;font-size:16px}\n.add:disabled{opacity:.5}\n.load{text-align:center;color:var(--muted);padding:50px 0;font-size:14px}\n</style>\n</head>\n<body>\n<div class=\"app\" id=\"app\"><div class=\"load\">Apro Troupe…</div></div>\n\n<script>\nvar LINK_SCHEDA = __SCHEDA__;\nvar CONF = __CONF__;\nvar MODE = __MODE__;\nvar ALIAS = {\n    'Props Master':'attrezzista capo attrezzista','Props Assistant':'aiuto attrezzista','Props Buyer':'acquisti attrezzeria',\n    'Electric':'elettricista','Gaffer':'capo elettricista','Grip':'macchinista','Key Grip':'capo macchinista',\n    'Sound Mixer':'fonico presa diretta','Boom Operator':'microfonista asta','Sound Assistant':'assistente fonico',\n    'Camera Operator':'operatore di macchina cameraman','1st AC':'aiuto operatore primo assistente operatore fuochista focus',\n    '2nd AC':'assistente operatore secondo','Director of Photography':'direttore della fotografia dop dp',\n    'Director':'regista regia','1st Assistant Director':'aiuto regia primo aiuto','2nd Assistant Director':'assistente alla regia secondo aiuto',\n    'Script Supervisor':'segretaria di edizione edizione','Set Designer':'scenografo scenografia','Set Decorator':'arredatore arredamento',\n    'Art Director':'art direction','Stylist':'costumista stylist','Seamstress / Tailor':'sarta sarto',\n    'Make-up Artist':'truccatore trucco make up','Hairdresser':'parrucchiere parrucco hair','Driver':'autista furgone',\n    'Ncc':'autista noleggio con conducente','Runner':'runner fattorino','PA':'assistente di produzione runner',\n    'Production Manager':'direttore di produzione','Production Coordinator':'coordinatore di produzione',\n    'Line Producer':'organizzatore generale','Editor':'montatore montaggio','Assistant Editor':'assistente al montaggio',\n    'Colorist':'colorista color','Photographer':'fotografo foto','Digitech':'dit digital imaging','Data Manager':'data manager backup',\n    'Video Assist Operator':'video assist','Steadicam Operator':'steadicam','Drone Operator':'drone pilota',\n    'Location Manager':'location','Casting Director':'casting','Catering/Craft Services':'catering mensa',\n    'Security':'sicurezza vigilanza','Interpreter / Translator':'interprete traduttore','Food Stylist':'food',\n    'Graphic Designer':'grafico grafica','Music Composer':'compositore musica','Writer':'autore autrice testi',\n    'Editorial Team':'redazione redattore autore','Fixer':'fixer','Voice Over':'speaker voce','Painter Greensman':'pittore'\n  };\n</script>\n<script>\n(function(){\n  var S = { token: null, nome: '', admin: false, view: 'pin', pin: '', msg: '',\n            contatti: null, ruoli: [], progetti: null, target: null, pr: null, cv: null, csens: null, q: { ruolo: '', dove: '', nome: '' }, ris: [], sel: {}, cur: null, sens: null };\n  try { var t = JSON.parse(localStorage.getItem('troupe') || 'null'); if (t) { S.token = t.token; S.nome = t.nome; S.admin = t.admin; S.view = 'home'; } } catch (e) {}\n\n  var app = document.getElementById('app');\n  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]; }); };\n  var norm = function(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };\n  var cap = function(s){ return String(s || '').toLowerCase().replace(/(^|[\\s'’-])(\\S)/g, function(m, a, b){ return a + b.toUpperCase(); }); };\n  var nomeDi = function(c){ return (cap(c.nome) + ' ' + cap(c.cognome)).trim() || c.azienda; };\n  var waNum = function(t){ var d = String(t || '').replace(/\\D/g, ''); if (!d) return ''; if (d.indexOf('00') === 0) d = d.slice(2); if (d.length <= 10 && d[0] === '3') d = '39' + d; return d; };\n\n  function toast(m){ Array.prototype.forEach.call(document.querySelectorAll('.toast'), function(x){ x.remove(); }); var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2600); }\n\n  // chiamate al server\n  function call(fn, args, ok, ko){\n    var fail = function(e){\n      if (String(e && e.message).indexOf('SESSIONE') !== -1) { esci(true); return; }\n      (ko || function(err){ toast('Qualcosa non va: ' + (err && err.message || 'riprova')); })(e);\n    };\n    if (window.API_URL) {   // versione su GitHub: parla con Google via internet\n      fetch(window.API_URL, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })\n        .then(function(r){ return r.json(); })\n        .then(function(j){ if (j.err) fail(new Error(j.err)); else ok(j.data); })\n        .catch(function(){ fail(new Error('Connessione assente, riprova')); });\n      return;\n    }\n    if (typeof google === 'undefined' || !google.script) return window.__mock(fn, args, ok, fail);\n    var r = google.script.run.withSuccessHandler(ok).withFailureHandler(fail);\n    r[fn].apply(r, args);\n  }\n\n  function salvaSessione(){ try { localStorage.setItem('troupe', JSON.stringify({ token: S.token, nome: S.nome, admin: S.admin })); } catch (e) {} }\n  function esci(scaduta){\n    if (S.token && !scaduta) call('esci', [S.token], function(){});\n    S.token = null; S.contatti = null; S.sens = null; S.view = 'pin'; S.pin = ''; S.msg = scaduta ? 'Sessione scaduta: inserisci di nuovo il codice' : '';\n    try { localStorage.removeItem('troupe'); } catch (e) {}\n    render();\n  }\n\n  function carica(){\n    if (S.contatti || S.caricando) return;\n    S.caricando = true;\n    call('contatti', [S.token], function(c){ S.caricando = false; S.contatti = c; if (S.view === 'home') render(); });\n    call('ruoli', [S.token], function(r){ S.ruoli = r; });\n  }\n\n  // ───── viste ─────\n  function vPin(){\n    var d = ''; for (var i = 0; i < 6; i++) d += '<span class=\"' + (i < S.pin.length ? 'on' : '') + '\"></span>';\n    var k = [1,2,3,4,5,6,7,8,9].map(function(n){ return '<button data-k=\"' + n + '\">' + n + '</button>'; }).join('');\n    return '<div class=\"pin\"><div class=\"brand\">Troupe</div><p class=\"muted\" style=\"margin-top:6px\">Inserisci il tuo codice</p>' +\n      '<div class=\"dots\">' + d + '</div><div class=\"pmsg\" role=\"alert\">' + esc(S.msg) + '</div>' +\n      '<div class=\"keys\">' + k + '<button class=\"x\" data-k=\"del\" aria-label=\"Cancella\">Cancella</button><button data-k=\"0\">0</button>' +\n      '<button class=\"x\" data-k=\"ok\" style=\"font-weight:700;color:var(--blue)\">Entra</button></div></div>';\n  }\n\n  function top(back){\n    return '<div class=\"top\">' + (back ? '<button class=\"link\" data-go=\"' + back + '\">‹ Indietro</button>' : '<span class=\"brand\">Troupe</span>') +\n      '<span class=\"who\">' + esc(S.nome) + (S.admin ? ' · admin' : '') + ' <button class=\"link\" data-act=\"esci\">Esci</button></span></div>';\n  }\n\n  function vHome(){\n    var n = S.contatti ? S.contatti.length + ' contatti' : 'Carico i contatti…';\n    return top() + (S.target ? '<div class=\"card\" style=\"display:flex;align-items:center;gap:10px;padding:12px 14px\"><span class=\"muted\" style=\"flex:1\">Cerca la crew da aggiungere a <b style=\"color:var(--ink)\">' + esc(S.target.titolo) + '</b></span><button class=\"link\" data-act=\"annullaTarget\">Annulla</button></div>' : '') + '<h1>Chi stai cercando?</h1>' +\n      '<div class=\"card\"><form id=\"cerca\" autocomplete=\"off\">' +\n      '<div class=\"f\"><label class=\"lab\" for=\"qr\">Ruolo</label><input type=\"search\" id=\"qr\" data-ac=\"ruolo\" placeholder=\"Es. fonico, gaffer, PA\" value=\"' + esc(S.q.ruolo) + '\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"qd\">Dove</label><input type=\"search\" id=\"qd\" data-ac=\"dove\" placeholder=\"Es. Milano\" value=\"' + esc(S.q.dove) + '\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"qn\">Nome o cognome</label><input type=\"search\" id=\"qn\" data-ac=\"nome\" placeholder=\"Facoltativo\" value=\"' + esc(S.q.nome) + '\"></div>' +\n      '<button class=\"btn main\" type=\"submit\"' + (S.contatti ? '' : ' disabled') + '>Cerca</button>' +\n      '<p class=\"muted\" style=\"text-align:center;margin:10px 0 0\">' + n + '</p></form></div>' +\n      vProgHome() +\n      '<div style=\"height:84px\"></div>' +\n      '<div class=\"nuovo-bar\"><div class=\"nuovo-in\"><span class=\"lab\" style=\"margin:0\">Nuovo contatto</span>' +\n      '<button class=\"btn wa mini\" data-act=\"invita\">Invita</button><button class=\"btn sec mini\" data-go=\"mano\">A mano</button></div></div>';\n  }\n\n  function cerca(){\n    var r = norm(S.q.ruolo), d = norm(S.q.dove), n = norm(S.q.nome);\n    var ruoliOk = null;\n    if (r) {\n      ruoliOk = {};\n      Object.keys(ALIAS).concat(S.ruoli).forEach(function(k){ if (norm(k).indexOf(r) !== -1 || norm(ALIAS[k] || '').indexOf(r) !== -1) ruoliOk[norm(k)] = 1; });\n    }\n    S.ris = (S.contatti || []).filter(function(c){\n      if (r) { var cr = norm(c.ruolo); if (!(cr.indexOf(r) !== -1 || Object.keys(ruoliOk).some(function(k){ return cr.indexOf(k) !== -1; }))) return false; }\n      if (d && norm(c.citta).indexOf(d) === -1) return false;\n      if (n && norm(c.nome + ' ' + c.cognome + ' ' + c.cognome + ' ' + c.nome + ' ' + c.azienda).indexOf(n) === -1) return false;\n      return true;\n    }).sort(function(a, b){ return norm(a.cognome).localeCompare(norm(b.cognome)); });\n    S.sel = {};\n  }\n\n  function vRis(){\n    var ns = Object.keys(S.sel).length;\n    var righe = S.ris.slice(0, 200).map(function(c){\n      var on = S.sel[c.r];\n      var dx = S.target ? (S.target.rs[c.r] ? '<span class=\"add on\" title=\"Già in crew\" aria-label=\"Già in crew\">✓</span>' :\n          '<button class=\"add\" data-add=\"' + c.r + '\" aria-label=\"Aggiungi ' + esc(nomeDi(c)) + ' a ' + esc(S.target.titolo) + '\">+</button>') :\n        '<button class=\"chk' + (on ? ' on' : '') + '\" data-sel=\"' + c.r + '\" aria-label=\"Seleziona ' + esc(nomeDi(c)) + '\">' + (on ? '✓' : '') + '</button>';\n      return '<div class=\"res\" data-apri=\"' + c.r + '\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' +\n        esc([c.ruolo, c.citta].filter(Boolean).join(' · ')) + '</small></div>' + dx + '</div>';\n    }).join('');\n    var q = [S.q.ruolo, S.q.dove, S.q.nome].filter(Boolean).join(', ') || 'tutti';\n    return top('home') + (S.target ? '<p class=\"count\" style=\"color:var(--blue);font-weight:600\">Tocca + per aggiungere a ' + esc(S.target.titolo) + ', il nome per aprire la scheda</p>' : '') + '<h1>' + S.ris.length + (S.ris.length === 1 ? ' risultato' : ' risultati') + '</h1>' +\n      '<p class=\"count\">Per: ' + esc(q) + '</p>' +\n      (S.ris.length ? '<div class=\"card\" style=\"padding:4px 12px\">' + righe + '</div>' :\n        '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessuno trovato. Prova a togliere un filtro, oppure invita un nuovo contatto dalla Home.</p></div>') +\n      (S.ris.length > 200 ? '<p class=\"count\">Mostro i primi 200: aggiungi un filtro per restringere.</p>' : '') +\n      (S.target ? '<div class=\"bar\"><button class=\"btn main\" data-act=\"fattoTarget\">' + (S.target.n ? 'Fatto · ' + S.target.n + (S.target.n === 1 ? ' aggiunto' : ' aggiunti') : 'Torna a ' + esc(S.target.titolo)) + '</button></div>' :\n       ns ? (\n        '<div class=\"bar\"><button class=\"btn sec\" data-act=\"condividi\">Condividi</button><button class=\"btn main\" data-act=\"scegliPrj\">Aggiungi a progetto</button></div>') : '');\n  }\n\n  function vScheda(){\n    var c = S.cur, tel = waNum(c.tel);\n    var tags = ['Codice fiscale', 'Nascita', 'Residenza', 'Regime', 'IBAN'].map(function(t, i){ return '<span class=\"' + (c.d[i] ? 'y' : '') + '\">' + (c.d[i] ? '✓ ' : '') + t + '</span>'; }).join('');\n    var sens;\n    if (!S.admin) sens = '<div class=\"lock\">I dati per il collocamento si vedono quando la persona conferma di far parte della tua produzione. Arriva con i progetti.</div>';\n    else if (!S.sens) sens = '<button class=\"btn sec\" data-act=\"mostra\">Mostra i dati</button><p class=\"muted\" style=\"margin:8px 0 0\">L\\'apertura resta nel registro.</p>';\n    else sens = '<dl>' + [['Codice fiscale', S.sens.cf], ['Nascita', S.sens.nascita], ['Residenza', S.sens.residenza], ['Regime', S.sens.regime], ['Partita IVA', S.sens.piva], ['IBAN', S.sens.iban]]\n      .filter(function(x){ return x[1]; }).map(function(x){ return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>';\n    return top(S.target ? 'addc' : 'ris') +\n      '<div class=\"card\"><div class=\"big\">' + esc(nomeDi(c)) + '</div><div class=\"sub\">' + esc([c.ruolo, c.citta].filter(Boolean).join(' · ')) + '</div>' +\n      '<div class=\"acts\"><a href=\"tel:' + esc(String(c.tel).replace(/\\s/g, '')) + '\" class=\"' + (c.tel ? '' : 'off') + '\">Chiama</a>' +\n      '<a href=\"' + waHref(tel, '') + '\" class=\"' + (tel ? '' : 'off') + '\">WhatsApp</a>' +\n      '<a href=\"mailto:' + esc(c.email) + '\" class=\"' + (c.email ? '' : 'off') + '\">Email</a></div></div>' +\n      '<div class=\"card\"><dl>' + [['Telefono', c.tel], ['Email', c.email], ['Azienda', c.azienda], ['Ultimo lavoro', c.last]]\n        .filter(function(x){ return x[1]; }).map(function(x){ return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>' +\n      '<div class=\"card\"><h2>Dati per il collocamento</h2>' + sens + '<div class=\"have\">' + tags + '</div></div>' +\n      (S.target ? (S.target.rs[c.r] ? '<p class=\"count\" style=\"text-align:center\">Già nella crew di ' + esc(S.target.titolo) + '</p>' :\n        '<div class=\"bar\"><button class=\"btn main\" data-add=\"' + c.r + '\">Aggiungi a ' + esc(S.target.titolo) + '</button></div>') : '');\n  }\n\n  function vMano(){\n    return top('home') + '<h1>Aggiungi a mano</h1><form id=\"mano\" class=\"card\" autocomplete=\"off\">' +\n      '<div id=\"manoErr\"></div>' +\n      '<div class=\"row\"><div class=\"f\"><label class=\"lab\" for=\"mn\">Nome</label><input type=\"text\" id=\"mn\" name=\"nome\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"mc\">Cognome</label><input type=\"text\" id=\"mc\" name=\"cognome\"></div></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"mr\">Ruolo</label><input type=\"text\" id=\"mr\" name=\"ruolo\" data-ac=\"ruoloSolo\" placeholder=\"Scegli dalla lista\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"mw\">Città</label><input type=\"text\" id=\"mw\" name=\"citta\" data-ac=\"dove\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"mt\">Telefono</label><input type=\"tel\" id=\"mt\" name=\"tel\" placeholder=\"+39 333 1234567\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"me\">Email</label><input type=\"email\" id=\"me\" name=\"email\" placeholder=\"nome@email.it\"></div>' +\n      '<button class=\"btn main\" type=\"submit\">Salva nel database</button>' +\n      '<p class=\"muted\" style=\"margin:10px 0 0\">I dati per il collocamento li chiedi dopo con il link della scheda.</p></form>';\n  }\n\n  function render(){\n    if (S.view !== 'pin' && S.view !== 'conf' && !S.token) S.view = 'pin';\n    app.innerHTML = { pin: vPin, home: vHome, ris: vRis, scheda: vScheda, mano: vMano, prjForm: vPrjForm, prj: vPrj, pers: vPers, cl: vCl, scegli: vScegli, conf: vConf, cat: vCat, ril: vRil, man: vMan, adminF: vAdminF, arch: vArch, invio: vInvio, acc: vAcc, addc: vAdd }[S.view]();\n    if (S.view === 'home') { carica(); if (!S.progetti || S.progStale) { S.progStale = false; caricaProgetti(); } }\n    window.scrollTo(0, 0);\n  }\n\n  // ───── accesso ─────\n  function tasto(k){\n    if (k === 'del') S.pin = S.pin.slice(0, -1);\n    else if (k === 'ok') return prova();\n    else if (S.pin.length < 6) S.pin += k;\n    S.msg = ''; render();\n    if (S.pin.length === 6) prova();\n  }\n  function prova(){\n    if (S.pin.length < 4) { S.msg = 'Il codice ha almeno 4 cifre'; return render(); }\n    var c = S.pin; S.msg = 'Controllo…'; render();\n    call('entra', [c], function(r){\n      if (!r.ok) { S.pin = ''; S.msg = r.msg; return render(); }\n      S.token = r.token; S.nome = r.nome; S.admin = r.admin; S.view = 'home'; S.pin = ''; S.msg = '';\n      salvaSessione(); render();\n    }, function(){ S.pin = ''; S.msg = 'Connessione assente, riprova'; render(); });\n  }\n  document.addEventListener('keydown', function(e){\n    if (S.view !== 'pin') return;\n    if (/^[0-9]$/.test(e.key)) tasto(e.key);\n    else if (e.key === 'Backspace') tasto('del');\n    else if (e.key === 'Enter') tasto('ok');\n  });\n\n  // ───── autocompletamento ─────\n  var lista = null;\n  function chiudi(){ if (lista) { lista.remove(); lista = null; } }\n  function voci(tipo, q){\n    q = norm(q); var out = [], vis = {};\n    function add(v, hint){ var k = norm(v); if (!v || vis[k]) return; vis[k] = 1; out.push([v, hint || '']); }\n    if (tipo === 'ruolo' || tipo === 'ruoloSolo') {\n      var tutti = S.ruoli.length ? S.ruoli : Object.keys(ALIAS);\n      tutti.forEach(function(r){ if (!q || norm(r).indexOf(q) !== -1) add(r); });\n      tutti.forEach(function(r){ var a = ALIAS[r] || ''; if (q && norm(a).indexOf(q) !== -1) add(r, a.split(' ').filter(function(w){ return norm(w).indexOf(q.split(' ')[0]) !== -1; })[0]); });\n    } else if (tipo === 'dove') {\n      var cnt = {};\n      (S.contatti || []).forEach(function(c){ if (c.citta) { var k = c.citta.split(',')[0].trim(); cnt[k] = (cnt[k] || 0) + 1; } });\n      Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; }).forEach(function(k){ if (!q || norm(k).indexOf(q) !== -1) add(k, cnt[k]); });\n    } else if (tipo === 'nome') {\n      if (q.length < 2) return [];\n      (S.contatti || []).forEach(function(c){ if (norm(c.nome + ' ' + c.cognome + ' ' + c.cognome + ' ' + c.nome).indexOf(q) !== -1) out.push([nomeDi(c), c.ruolo, c]); });\n    }\n    return out.slice(0, 30);\n  }\n  function apri(inp){\n    chiudi();\n    var tipo = inp.getAttribute('data-ac'), v = voci(tipo, inp.value);\n    if (S.view === 'addc' && tipo === 'nome') return;\n    if (!v.length) return;\n    lista = document.createElement('ul'); lista.className = 'list'; lista.setAttribute('role', 'listbox');\n    v.forEach(function(x){\n      var li = document.createElement('li'); li.setAttribute('role', 'option');\n      li.innerHTML = '<span>' + esc(x[0]) + '</span>' + (x[1] !== '' ? '<small>' + esc(x[1]) + '</small>' : '');\n      li.addEventListener('mousedown', function(e){\n        e.preventDefault(); chiudi();\n        if (tipo === 'nome' && x[2]) { S.cur = x[2]; S.sens = null; S.ris = [x[2]]; S.sel = {}; S.view = S.target ? 'ris' : 'scheda'; return render(); }\n        inp.value = x[0]; if (S.q.hasOwnProperty(tipo)) S.q[tipo] = x[0];\n        if (S.view === 'addc') aggiornaAdd();\n      });\n      lista.appendChild(li);\n    });\n    inp.parentNode.appendChild(lista);\n  }\n  app.addEventListener('focusin', function(e){ if (e.target.getAttribute && e.target.getAttribute('data-ac')) apri(e.target); });\n  app.addEventListener('input', function(e){\n    var t = e.target.getAttribute && e.target.getAttribute('data-ac');\n    if (!t) return;\n    if (S.q.hasOwnProperty(t)) S.q[t] = e.target.value;\n    if (S.view === 'addc') aggiornaAdd();\n    apri(e.target);\n  });\n  app.addEventListener('focusout', function(){ setTimeout(function(){ var a = document.activeElement; if (!a || !a.getAttribute || !a.getAttribute('data-ac')) chiudi(); }, 150); });\n\n  // ───── clic ─────\n  app.addEventListener('click', function(e){\n    var b = e.target.closest('[data-k],[data-go],[data-act],[data-sel],[data-apri],[data-prj],[data-pers],[data-seg],[data-add]');\n    if (!b) return;\n    if (b.dataset.k) return tasto(b.dataset.k);\n    if (b.dataset.add) { e.stopPropagation(); return aggiungiUno(Number(b.dataset.add), b); }\n    if (b.dataset.prj) return apriPrj(b.dataset.prj);\n    if (b.dataset.pers) { S.cv = Number(b.dataset.pers); S.csens = null; S.view = 'pers'; return render(); }\n    if (b.dataset.seg) { var g = b.parentNode; Array.prototype.forEach.call(g.querySelectorAll('button'), function(x){ x.classList.toggle('on', x === b); }); g.setAttribute('data-val', b.dataset.seg); segCambio(g); return; }\n    if (b.dataset.go) { if (b.dataset.go === 'home') S.progStale = true; S.view = b.dataset.go; return render(); }\n    if (b.dataset.sel) { e.stopPropagation(); var r = b.dataset.sel; if (S.sel[r]) delete S.sel[r]; else S.sel[r] = 1; return render(); }\n    if (b.dataset.apri) { S.cur = S.ris.filter(function(c){ return String(c.r) === b.dataset.apri; })[0]; S.sens = null; S.view = 'scheda'; return render(); }\n    var a = b.dataset.act;\n    if (azioni2(a, b)) return;\n    if (a === 'esci') esci();\n    if (a === 'invita') {\n      if (!/^https?:/.test(LINK_SCHEDA)) return toast('Manca il link della scheda: va incollato nel codice (LINK_SCHEDA)');\n      var m = 'Ciao! Per aggiungerti alla mia lista crew ti chiedo di compilare questa scheda, ci vogliono 3 minuti: ' + LINK_SCHEDA;\n      foglioWA('Invito a compilare la scheda', m, '');\n    }\n    if (a === 'mostra') {\n      b.disabled = true; b.textContent = 'Apro…';\n      call('sensibili', [S.token, S.cur.r], function(d){ S.sens = d; render(); }, function(err){ toast(err.message); render(); });\n    }\n    if (a === 'condividi') {\n      var t = S.ris.filter(function(c){ return S.sel[c.r]; }).map(function(c){\n        return [nomeDi(c) + (c.ruolo ? ' · ' + c.ruolo : ''), c.tel, c.email].filter(Boolean).join('\\n');\n      }).join('\\n\\n');\n      foglioWA(Object.keys(S.sel).length === 1 ? 'Contatto da condividere' : 'Contatti da condividere', t, '');\n    }\n  });\n\n  app.addEventListener('submit', function(e){\n    e.preventDefault();\n    if (e.target.id === 'cerca') { chiudi(); cerca(); S.view = 'ris'; return render(); }\n    if (submit2(e.target)) return;\n    if (e.target.id === 'mano') {\n      var f = e.target, d = {}; ['nome', 'cognome', 'ruolo', 'citta', 'tel', 'email'].forEach(function(k){ d[k] = f.elements[k].value; });\n      var errBox = document.getElementById('manoErr');\n      var ko = function(m){ errBox.innerHTML = '<div class=\"err\" role=\"alert\">' + esc(m) + '</div>'; window.scrollTo(0, 0); };\n      if (!d.nome.trim() || !d.ruolo.trim()) return ko('Servono almeno nome e ruolo');\n      if (!d.tel.trim() && !d.email.trim()) return ko('Serve almeno telefono o email');\n      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Salvo…';\n      call('aggiungi', [S.token, d], function(r){\n        if (!r.ok) { btn.disabled = false; btn.textContent = 'Salva nel database'; return ko(r.msg); }\n        S.contatti = null; S.view = 'home'; render();\n        toast('Contatto salvato: ' + cap(d.nome) + ' ' + cap(d.cognome));\n      });\n    }\n  });\n\n\n  // ═════════ FASE 2 · progetti, crew, conferme ═════════\n  var MESI = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];\n  function pd(s){ var p = String(s || '').split('-'); return p.length === 3 ? { y: +p[0], m: +p[1], d: +p[2] } : null; }\n  function fmtRange(a, b){\n    var x = pd(a), y = pd(b || a); if (!x) return ''; if (!y) y = x;\n    if (a === b || !b) return x.d + ' ' + MESI[x.m - 1] + ' ' + x.y;\n    if (x.m === y.m && x.y === y.y) return x.d + '–' + y.d + ' ' + MESI[x.m - 1] + ' ' + x.y;\n    return x.d + ' ' + MESI[x.m - 1] + ' – ' + y.d + ' ' + MESI[y.m - 1] + ' ' + y.y;\n  }\n  function giorni(a, b){ var x = pd(a), y = pd(b || a); if (!x || !y) return 0; return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 864e5) + 1; }\n\n  var REP = [\n    ['Produzione', /producer|production|showrunner|runner|^pa$|driver|ncc|transport|location manager/i],\n    ['Casting', /casting|talent|model/i],\n    ['Regia', /director(?! of photography)|script supervisor/i],\n    ['Testi', /writer|editorial/i],\n    ['Camera', /photography|camera|1st ac|2nd ac|focus|loader|data manager|video assist|steadicam|drone|videographer|photographer|digitech/i],\n    ['Luci e macchinisti', /lights|cable|gaffer|grip|electric|lighting/i],\n    ['Suono', /sound mixer|boom|sound assistant/i],\n    ['Food', /food|catering/i],\n    ['Scenografia', /set |set$|art director|props|graphic|painter|builder|decorator/i],\n    ['Costumi', /stylist|seamstress|tailor/i],\n    ['Trucco e parrucco', /make-up|makeup|hair/i],\n    ['Effetti speciali', /sfx|special fx|stunt/i],\n    ['Post-produzione', /post|editor|colorist|sound designer|sound editor|music|vfx|compositor|3d|motion/i],\n    ['Fornitori', /rental|^location$|film commission|specific|shipping|fixer|security|animal|interpreter/i]\n  ];\n  function repOf(q){ for (var i = 0; i < REP.length; i++) if (REP[i][1].test(q || '')) return REP[i][0]; return 'Altro'; }\n  function ordRep(a){ for (var i = 0; i < REP.length; i++) if (REP[i][0] === a) return i; return 99; }\n  function crewDi(r){ return (S.pr.crew || []).filter(function(c){ return c.r === r; })[0]; }\n  function confOk(c){ return c.conf === 'confermata' || c.conf === 'sbloccata'; }\n  function badgeConf(c){\n    if (!c.col) return '<span class=\"badge\">non collocato</span>';\n    if (c.conf === 'confermata') return '<span class=\"badge ok\">confermato</span>';\n    if (c.conf === 'sbloccata') return '<span class=\"badge ok\">sbloccato</span>';\n    if (c.conf === 'non disponibile') return '<span class=\"badge no\">non disponibile</span>';\n    if (c.conf === 'chiesta') return '<span class=\"badge w\">in attesa</span>';\n    return '<span class=\"badge w\">da chiedere</span>';\n  }\n  function contactOf(c){\n    if (c.cm === 'nascosto') return { tel: '', txt: 'contatto tramite produzione', email: '' };\n    if (c.cm === 'ref') {\n      var rr = /^r:(\\d+)$/.exec(c.ref || '');\n      if (rr) { var x = crewDi(Number(rr[1])); if (x) return { tel: x.tel, txt: 'tramite ' + nomeDi(x) + (x.tel ? ' · ' + x.tel : ''), email: x.email }; }\n      return { tel: '', txt: 'tramite ' + (c.ref || 'referente'), email: '' };\n    }\n    return { tel: c.tel, txt: c.tel || '—', email: c.email };\n  }\n\n  function caricaProgetti(){\n    call('progetti', [S.token], function(p){ S.progetti = p; if (S.view === 'home') { var y = window.scrollY; render(); window.scrollTo(0, y); } });\n  }\n  function vProgHome(){\n    var l = S.progetti;\n    var corpo = !l ? '<p class=\"muted\" style=\"margin:0 4px\">Carico i progetti…</p>' : !l.length ?\n      '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessun progetto in corso. Creane uno per comporre la crew e chiedere le conferme.</p></div>' :\n      l.map(function(p){\n        return '<button class=\"prj\" data-prj=\"' + esc(p.id) + '\"><b>' + esc(p.titolo) + '</b><small>' + esc([fmtRange(p.dal, p.al), p.luogo].filter(Boolean).join(' · ')) +\n          (S.admin && p.producer !== S.nome ? ' · ' + esc(p.producer) : '') + '</small><div class=\"stats\"><span>' + p.n + ' in crew</span>' +\n          (p.daConf ? '<span class=\"w\">' + p.daConf + ' da confermare</span>' : '') + '</div></button>';\n      }).join('');\n    return '<div class=\"sec-h\"><h2>In programma</h2><button class=\"link\" data-act=\"nuovoPrj\">+ Nuovo progetto</button></div>' + corpo +\n      '<div style=\"display:flex;justify-content:space-between;margin:0 4px\"><button class=\"link\" data-act=\"apriArch\">Archivio progetti chiusi</button>' +\n      (S.admin ? '<button class=\"link\" data-act=\"apriAcc\">Accessi e registro</button>' : '') + '</div>';\n  }\n\n  S.prjC = {};\n  function apriPrj(id, poi){\n    if (!S.pr || S.pr.id !== id) { S.passo = null; S.fCrew = 'tutti'; }\n    var c = S.prjC[id];\n    if (c && !poi) { S.pr = c; S.view = 'prj'; render(); }   // subito la versione in memoria, poi aggiorno\n    else if (S.view !== 'prj') { app.innerHTML = top('home') + '<div class=\"load\">Apro il progetto…</div>'; }\n    call('progetto', [S.token, id], function(p){\n      S.prjC[id] = p;\n      if (poi) { S.pr = p; return poi(); }\n      if (S.view === 'prj' && S.pr && S.pr.id === id) { var y = window.scrollY; S.pr = p; render(); window.scrollTo(0, y); }\n      else if (!c) { S.pr = p; S.view = 'prj'; render(); }\n    });\n  }\n  function ricarica(poi){ var id = S.pr.id; call('progetto', [S.token, id], function(p){ S.prjC[id] = p; if (S.pr && S.pr.id === id) S.pr = p; if (poi) poi(); var y = window.scrollY; render(); window.scrollTo(0, y); }); }\n\n  function vPrjForm(){\n    var p = S.prjEdit || {};\n    return top(p.id ? 'prj' : 'home') + '<h1>' + (p.id ? 'Modifica progetto' : 'Nuovo progetto') + '</h1><form id=\"prjF\" class=\"card\" autocomplete=\"off\"><div id=\"prjErr\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pt\">Titolo</label><input type=\"text\" id=\"pt\" name=\"titolo\" value=\"' + esc(p.titolo) + '\" placeholder=\"Es. DbyD Luxottica\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pl\">Luogo</label><input type=\"text\" id=\"pl\" name=\"luogo\" value=\"' + esc(p.luogo) + '\" placeholder=\"Es. Milano, studio\"></div>' +\n      '<div class=\"row\"><div class=\"f\"><label class=\"lab\" for=\"pd1\">Primo giorno</label><input type=\"date\" id=\"pd1\" name=\"dal\" value=\"' + esc(p.dal) + '\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pd2\">Ultimo giorno</label><input type=\"date\" id=\"pd2\" name=\"al\" value=\"' + esc(p.al) + '\"></div></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"paz\">Azienda per i collocamenti</label><input type=\"text\" id=\"paz\" name=\"azienda\" value=\"' + esc(p.azienda || 'COURAGE') + '\"></div>' +\n      (p.id ? '<p class=\"muted\" style=\"margin:0 0 12px\">Se cambi le date, chi lavora su tutto il progetto segue le nuove date; gli altri restano dentro il nuovo periodo.</p>' : '') +\n      '<button class=\"btn main\" type=\"submit\">' + (p.id ? 'Salva le modifiche' : 'Crea progetto') + '</button></form>';\n  }\n\n  function vPrj(){\n    var p = S.pr, cr = p.crew || [];\n    var col = cr.filter(function(c){ return c.col; });\n    var daConf = col.filter(function(c){ return !confOk(c); }).length;\n    var senza = col.filter(function(c){ return !(c.d[0] && c.d[4]); }).length;\n    var deps = {};\n    cr.forEach(function(c){ var d = repOf(c.q); (deps[d] = deps[d] || []).push(c); });\n    var lista = Object.keys(deps).sort(function(a, b){ return ordRep(a) - ordRep(b); }).map(function(d){\n      return '<div class=\"dep\">' + esc(d) + '</div><div class=\"card\" style=\"padding:4px 12px\">' + deps[d].map(function(c){\n        var dd = c.dal === p.dal && c.al === p.al ? '' : ' · ' + fmtRange(c.dal, c.al);\n        return '<div class=\"res\" data-pers=\"' + c.r + '\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc(c.q + dd) + '</small></div>' + badgeConf(c) + '</div>';\n      }).join('') + '</div>';\n    }).join('');\n    return top('home') + '<div class=\"card\"><div class=\"big\">' + esc(p.titolo) + '</div><div class=\"sub\">' + esc([fmtRange(p.dal, p.al), p.luogo].filter(Boolean).join(' · ')) +\n      '</div><div class=\"stats\"><span>' + cr.length + ' in crew</span><span>' + col.length + ' da collocare</span>' +\n      (daConf ? '<span class=\"w\">' + daConf + ' da confermare</span>' : '') + (senza ? '<span class=\"w\">' + senza + ' senza dati</span>' : '') + '</div>' +\n      (p.cartellaUrl ? '<a class=\"link\" style=\"display:inline-block;margin-top:8px;text-decoration:none\" href=\"' + esc(p.cartellaUrl) + '\" target=\"_blank\">Apri la cartella su Drive</a>' : '') +\n      (p.stato === 'chiuso' ? '<p class=\"muted\" style=\"margin:12px 0 0\">Progetto chiuso il ' + esc(itData(p.chiuso)) + '. Lo trovi in Progetti › Archivio.</p></div>' :\n      '<div class=\"row\" style=\"margin-top:14px\"><button class=\"btn sec\" data-act=\"modPrj\">Modifica</button><button class=\"btn main\" data-act=\"addCrew\">+ Aggiungi crew</button></div></div>') +\n      (cr.length ? '<div class=\"row\" style=\"margin:4px 0 12px\"><button class=\"btn sec\" data-go=\"cl\">Crew list</button><button class=\"btn sec\" data-act=\"apriCat\">Catering</button></div>' +\n        vCollocamenti(p, col) + lista :\n        '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Ancora nessuno in crew. Tocca Aggiungi crew per cercare le persone nel database.</p></div>');\n  }\n\n  function vPers(){\n    var p = S.pr, c = crewDi(S.cv);\n    if (!c) { S.view = 'prj'; return vPrj(); }\n    var altri = p.crew.filter(function(x){ return x.r !== c.r; });\n    var refR = /^r:(\\d+)$/.exec(c.ref || ''), refTxt = refR ? '' : c.ref;\n    var tel = waNum(c.tel);\n    var sens;\n    if (!c.col) sens = '<p class=\"muted\" style=\"margin:0\">Non va collocato: per la crew list bastano i contatti.</p>';\n    else if (!c.vede) sens = '<div class=\"lock\">Li vedi quando ' + esc(cap(c.nome)) + ' conferma di far parte della produzione.' + (S.admin ? '' : ' Se serve prima, chiedi all\\'admin di sbloccarli.') + '</div>';\n    else if (!S.csens) sens = '<button class=\"btn sec\" data-act=\"mostraC\">Mostra i dati</button><p class=\"muted\" style=\"margin:8px 0 0\">L\\'apertura resta nel registro.</p>';\n    else sens = '<dl>' + [['Codice fiscale', S.csens.cf], ['Nascita', S.csens.nascita], ['Residenza', S.csens.residenza], ['Regime', S.csens.regime], ['Partita IVA', S.csens.piva], ['IBAN', S.csens.iban]]\n      .filter(function(x){ return x[1]; }).map(function(x){ return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>';\n    var tags = c.col ? '<div class=\"have\">' + ['Codice fiscale', 'Nascita', 'Residenza', 'Regime', 'IBAN'].map(function(t, i){ return '<span class=\"' + (c.d[i] ? 'y' : '') + '\">' + (c.d[i] ? '✓ ' : '') + t + '</span>'; }).join('') + '</div>' : '';\n    var confBox = !c.col ? '' : '<div class=\"card\"><h2 style=\"display:flex;justify-content:space-between;align-items:center\">Conferma ' + badgeConf(c) + '</h2>' +\n      (c.conf === 'confermata' ? '<p class=\"muted\" style=\"margin:0 0 12px\">Ha confermato presenza e dati' + (c.agg ? ' il ' + esc(c.agg.split('-').reverse().join('/')) : '') + '.</p>' :\n       c.conf === 'non disponibile' ? '<p class=\"muted\" style=\"margin:0 0 12px\">Ha risposto che non può esserci.</p>' :\n       '<p class=\"muted\" style=\"margin:0 0 12px\">Mandale il link: conferma la presenza e controlla i suoi dati. Dopo la conferma vedi i dati per il collocamento.</p>') +\n      '<button class=\"btn wa\" data-act=\"chiedi\"' + (tel ? '' : ' disabled') + '>' + (c.conf ? 'Manda di nuovo il link' : 'Chiedi conferma su WhatsApp') + '</button>' +\n      (S.admin && c.conf !== 'confermata' ? '<button class=\"btn sec\" style=\"margin-top:8px\" data-act=\"compila\">Compila e conferma tu</button><p class=\"muted\" style=\"margin:8px 0 0\">Se non riesce ad aprire il link: inserisci tu i suoi dati e confermi al suo posto. Resta nel registro.</p>' : '') + '</div>';\n    if (p.stato === 'chiuso') { confBox = ''; }\n    return top('prj') +\n      '<div class=\"card\"><div class=\"big\">' + esc(nomeDi(c)) + '</div><div class=\"sub\">' + esc(c.ruolo) + '</div>' +\n      '<div class=\"acts\"><a href=\"tel:' + esc(String(c.tel).replace(/\\s/g, '')) + '\" class=\"' + (c.tel ? '' : 'off') + '\">Chiama</a>' +\n      '<a href=\"' + waHref(tel, '') + '\" class=\"' + (tel ? '' : 'off') + '\">WhatsApp</a>' +\n      '<a href=\"mailto:' + esc(c.email) + '\" class=\"' + (c.email ? '' : 'off') + '\">Email</a></div></div>' +\n      '<form id=\"persF\" class=\"card\" autocomplete=\"off\"><div id=\"persErr\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"cq\">Qualifica in questo progetto</label><input type=\"text\" id=\"cq\" name=\"q\" data-ac=\"ruoloSolo\" value=\"' + esc(c.q) + '\"></div>' +\n      '<div class=\"row\"><div class=\"f\"><label class=\"lab\" for=\"cd1\">Dal</label><input type=\"date\" id=\"cd1\" name=\"dal\" min=\"' + p.dal + '\" max=\"' + p.al + '\" value=\"' + esc(c.dal) + '\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"cd2\">Al</label><input type=\"date\" id=\"cd2\" name=\"al\" min=\"' + p.dal + '\" max=\"' + p.al + '\" value=\"' + esc(c.al) + '\"></div></div>' +\n      '<div class=\"f\"><span class=\"lab\">Da collocare</span><div class=\"seg\" id=\"segCol\" data-val=\"' + (c.col ? 'si' : 'no') + '\"><button type=\"button\" data-seg=\"si\" class=\"' + (c.col ? 'on' : '') + '\">Sì</button><button type=\"button\" data-seg=\"no\" class=\"' + (c.col ? '' : 'on') + '\">No</button></div></div>' +\n      '<div class=\"f\"><span class=\"lab\">Contatto nella crew list</span><div class=\"seg\" id=\"segCm\" data-val=\"' + c.cm + '\">' +\n      [['suo', 'Il suo numero'], ['ref', 'Referente'], ['nascosto', 'Nascosto']].map(function(o){ return '<button type=\"button\" data-seg=\"' + o[0] + '\" class=\"' + (c.cm === o[0] ? 'on' : '') + '\">' + o[1] + '</button>'; }).join('') + '</div></div>' +\n      '<div id=\"refBox\" class=\"' + (c.cm === 'ref' ? '' : 'hide') + '\"><div class=\"f\"><label class=\"lab\" for=\"crs\">Referente</label><select id=\"crs\" name=\"refR\"><option value=\"\">Scrivo nome e telefono</option>' +\n      altri.map(function(x){ return '<option value=\"r:' + x.r + '\"' + (refR && +refR[1] === x.r ? ' selected' : '') + '>' + esc(nomeDi(x) + ' · ' + x.q) + '</option>'; }).join('') + '</select></div>' +\n      '<div class=\"f' + (refR ? ' hide' : '') + '\" id=\"refTxtF\"><label class=\"lab\" for=\"crt\">Nome e telefono</label><input type=\"text\" id=\"crt\" name=\"refT\" value=\"' + esc(refTxt) + '\" placeholder=\"Es. Agenzia Rossi · 02 1234567\"></div></div>' +\n      '<button class=\"btn main\" type=\"submit\">Salva</button></form>' +\n      confBox +\n      (c.col ? '<div class=\"card\"><h2>Dati per il collocamento</h2>' + sens + tags + '</div>' : '') +\n      (p.stato === 'chiuso' ? '' : '<button class=\"btn sec danger\" data-act=\"togli\">Togli dal progetto</button>');\n  }\n  function segCambio(g){\n    if (g.id === 'segCm') document.getElementById('refBox').classList.toggle('hide', g.getAttribute('data-val') !== 'ref');\n  }\n  app.addEventListener('change', function(e){\n    if (e.target.id === 'crs') document.getElementById('refTxtF').classList.toggle('hide', !!e.target.value);\n  });\n\n  function crewText(){\n    var p = S.pr, deps = {};\n    p.crew.forEach(function(c){ if (c.conf === 'non disponibile') return; var d = repOf(c.q); (deps[d] = deps[d] || []).push(c); });\n    var rg = riassuntoGiorni(p);\n    var t = 'CREW LIST · ' + p.titolo + '\\n' + [fmtRange(p.dal, p.al), p.luogo].filter(Boolean).join(' · ') + (rg ? '\\n' + rg : '') + '\\nProducer: ' + p.producer + '\\n';\n    Object.keys(deps).sort(function(a, b){ return ordRep(a) - ordRep(b); }).forEach(function(d){\n      t += '\\n' + d.toUpperCase() + '\\n' + deps[d].map(function(c){\n        var k = contactOf(c), dd = c.dal === p.dal && c.al === p.al ? '' : ' (' + fmtRange(c.dal, c.al) + ')';\n        return [c.q + dd, nomeDi(c) + (c.azienda && (c.nome || c.cognome) && d === 'Fornitori' ? ' · ' + c.azienda : ''), k.txt, k.email].filter(Boolean).join(' — ');\n      }).join('\\n') + '\\n';\n    });\n    return t.trim();\n  }\n  function vCl(){\n    return top('prj') + '<h1>Crew list</h1><div class=\"card\"><pre class=\"cl\">' + esc(crewText()) + '</pre></div>' +\n      '<div class=\"row\"><button class=\"btn sec\" data-act=\"copiaCl\">Copia testo</button><button class=\"btn main\" data-act=\"condCl\">Condividi</button></div>' +\n      '<p class=\"muted\" style=\"margin:10px 4px\">Chi ha risposto \"non posso esserci\" non compare. Per i referenti e i contatti nascosti vale la scelta fatta nella scheda di ogni persona.</p>';\n  }\n\n  function vScegli(){\n    var l = S.progetti || [];\n    var n = Object.keys(S.sel).length;\n    return top('ris') + '<h1>Aggiungi ' + n + (n === 1 ? ' persona' : ' persone') + ' a…</h1>' +\n      (l.length ? l.map(function(p){ return '<button class=\"prj\" data-act=\"aggiungiQui\" data-id=\"' + esc(p.id) + '\"><b>' + esc(p.titolo) + '</b><small>' + esc(fmtRange(p.dal, p.al)) + '</small></button>'; }).join('') :\n        '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessun progetto in corso.</p></div>') +\n      '<button class=\"btn sec\" data-act=\"nuovoPrjSel\">+ Nuovo progetto</button>';\n  }\n\n  function aggiungiSel(id){\n    var righe = Object.keys(S.sel).map(Number);\n    app.innerHTML = top() + '<div class=\"load\">Aggiungo…</div>';\n    call('aggiungiCrew', [S.token, id, righe], function(r){\n      S.sel = {}; S.target = null; S.progStale = true;\n      apriPrj(id, function(){ S.view = 'prj'; render(); toast(r.n ? (r.n === 1 ? '1 persona aggiunta' : r.n + ' persone aggiunte') : 'Erano già tutti in crew'); });\n    });\n  }\n\n  function azioni2(a, b){\n    if (azioni5(a, b) || azioni3(a, b) || azioni4(a, b)) return true;\n    if (a === 'nuovoPrj') { S.prjEdit = {}; S.giorniEdit = null; S.view = 'prjForm'; render(); return true; }\n    if (a === 'nuovoPrjSel') { S.prjEdit = { dopoSel: true }; S.giorniEdit = null; S.view = 'prjForm'; render(); return true; }\n    if (a === 'modPrj') { S.prjEdit = { id: S.pr.id, titolo: S.pr.titolo, luogo: S.pr.luogo, dal: S.pr.dal, al: S.pr.al, azienda: S.pr.azienda, giorni: S.pr.giorni }; S.giorniEdit = null; S.view = 'prjForm'; render(); return true; }\n    if (a === 'addCrew') { var rs = {}; S.pr.crew.forEach(function(c){ rs[c.r] = 1; }); S.target = { id: S.pr.id, titolo: S.pr.titolo, rs: rs, n: 0 }; S.view = 'home'; render(); return true; }\n    if (a === 'fattoTarget') { var tt = S.target; S.target = null; S.progStale = true; apriPrj(tt.id); return true; }\n    if (a === 'annullaTarget') { var t = S.target; S.target = null; apriPrj(t.id); return true; }\n    if (a === 'aggiungiA') { aggiungiSel(S.target.id); return true; }\n    if (a === 'scegliPrj') {\n      if (S.progetti) { S.view = 'scegli'; render(); }\n      else call('progetti', [S.token], function(p){ S.progetti = p; S.view = 'scegli'; render(); });\n      return true;\n    }\n    if (a === 'aggiungiQui') { aggiungiSel(b.dataset.id); return true; }\n    if (a === 'mostraC') {\n      b.disabled = true; b.textContent = 'Apro…';\n      call('sensibiliCrew', [S.token, S.pr.id, S.cv], function(d){ S.csens = d; render(); }, function(err){ toast(err.message); render(); });\n      return true;\n    }\n    if (a === 'chiedi') {\n      var c = crewDi(S.cv);\n      b.disabled = true; b.textContent = 'Preparo il link…';\n      call('chiediConferma', [S.token, S.pr.id, S.cv], function(r){\n        var p = S.pr;\n        var m = 'Ciao ' + cap(c.nome) + ', ti scrivo per ' + p.titolo + ': ' + c.q + ', ' + fmtRange(c.dal, c.al) + (p.luogo ? ', ' + p.luogo : '') + '.\\n' +\n          'Mi confermi la tua presenza e controlli i tuoi dati qui? ' + r.link;\n        ricarica(function(){ foglioWA('Messaggio per ' + cap(c.nome), m, waNum(c.tel)); });\n      }, function(err){ toast(err.message); render(); });\n      return true;\n    }\n    if (a === 'sblocca') {\n      var c2 = crewDi(S.cv);\n      if (!confirm('Sbloccare i dati di ' + nomeDi(c2) + ' per il producer senza la sua conferma? Resta nel registro.')) return true;\n      call('sblocca', [S.token, S.pr.id, S.cv], function(){ ricarica(function(){ toast('Dati sbloccati'); }); });\n      return true;\n    }\n    if (a === 'togli') {\n      var c3 = crewDi(S.cv);\n      if (!confirm('Togliere ' + nomeDi(c3) + ' da ' + S.pr.titolo + '? Resta nel database contatti.')) return true;\n      call('togliCrew', [S.token, S.pr.id, S.cv], function(){ S.view = 'prj'; ricarica(function(){ toast(nomeDi(c3) + ' tolto dal progetto'); }); });\n      return true;\n    }\n    if (a === 'copiaCl') {\n      copia(crewText());\n      return true;\n    }\n    if (a === 'condCl') {\n      var t2 = crewText();\n      foglioWA('Crew list · ' + S.pr.titolo, t2, '');\n      return true;\n    }\n    if (a && a.indexOf('cf_') === 0) { confAzione(a.slice(3), b); return true; }\n    return false;\n  }\n\n  function submit2(f){\n    if (submit3(f) || submit4(f)) return true;\n    if (f.id === 'prjF') {\n      var d = { id: S.prjEdit.id || '', giorni: scriviGiorni(S.giorniEdit || {}, f.elements.dal.value, f.elements.al.value || f.elements.dal.value), azienda: f.elements.azienda.value, titolo: f.elements.titolo.value, luogo: f.elements.luogo.value, dal: f.elements.dal.value, al: f.elements.al.value };\n      var ko = function(m){ document.getElementById('prjErr').innerHTML = '<div class=\"err\" role=\"alert\">' + esc(m) + '</div>'; };\n      if (!d.titolo.trim() || !d.dal) { ko('Servono almeno titolo e primo giorno'); return true; }\n      if (d.al && d.al < d.dal) { ko('L\\'ultimo giorno è prima del primo'); return true; }\n      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Salvo…';\n      call('salvaProgetto', [S.token, d], function(r){\n        if (!r.ok) { btn.disabled = false; btn.textContent = 'Riprova'; return ko(r.msg); }\n        S.progStale = true;\n        if (S.prjEdit.dopoSel) return aggiungiSel(r.id);\n        apriPrj(r.id, function(){ S.view = 'prj'; render(); toast(d.id ? (r.mosse ? 'Salvato. Date aggiornate per ' + r.mosse + (r.mosse === 1 ? ' persona' : ' persone') : 'Salvato') : 'Progetto creato'); });\n      });\n      return true;\n    }\n    if (f.id === 'persF') {\n      var cm = document.getElementById('segCm').getAttribute('data-val');\n      var d2 = { q: f.elements.q.value, dal: f.elements.dal.value, al: f.elements.al.value,\n        col: document.getElementById('segCol').getAttribute('data-val') === 'si', cm: cm,\n        ref: cm === 'ref' ? (f.elements.refR.value || f.elements.refT.value) : '' };\n      var ko2 = function(m){ document.getElementById('persErr').innerHTML = '<div class=\"err\" role=\"alert\">' + esc(m) + '</div>'; window.scrollTo(0, 0); };\n      if (!d2.q.trim()) { ko2('Scrivi la qualifica'); return true; }\n      if (d2.al < d2.dal) { ko2('La data di fine è prima di quella di inizio'); return true; }\n      if (cm === 'ref' && !d2.ref.trim()) { ko2('Scegli il referente o scrivi nome e telefono'); return true; }\n      var c0 = crewDi(S.cv);\n      c0.q = d2.q.trim(); c0.dal = d2.dal; c0.al = d2.al; c0.col = d2.col; c0.cm = d2.cm; c0.ref = d2.ref;\n      S.view = 'prj'; render(); toast('Salvato');\n      call('aggiornaCrew', [S.token, S.pr.id, S.cv, d2], function(r){\n        if (!r.ok) { toast('Non salvato: ' + r.msg); }\n        ricarica();\n      }, function(e){ toast('Non salvato: ' + e.message); ricarica(); });\n      return true;\n    }\n    if (f.id === 'confF') { confSalva(f); return true; }\n    return false;\n  }\n\n  // ───── pagina di conferma per la crew ─────\n  var ODD = {0:1,1:0,2:5,3:7,4:9,5:13,6:15,7:17,8:19,9:21,A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23};\n  function cfOk(v){\n    v = String(v).toUpperCase().replace(/\\s/g, '');\n    if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(v)) return false;\n    var s = 0; for (var i = 0; i < 15; i++){ var c = v[i]; s += i % 2 === 0 ? ODD[c] : (/[0-9]/.test(c) ? +c : c.charCodeAt(0) - 65); }\n    return String.fromCharCode(65 + s % 26) === v[15];\n  }\n  function ibanOk(v){\n    v = String(v).toUpperCase().replace(/\\s/g, '');\n    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false;\n    if (v.slice(0, 2) === 'IT' && v.length !== 27) return false;\n    var r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, function(c){ return c.charCodeAt(0) - 55; }), m = 0;\n    for (var i = 0; i < r.length; i++) m = (m * 10 + +r[i]) % 97;\n    return m === 1;\n  }\n  function pivaOk(v){\n    v = String(v).replace(/\\s/g, '').replace(/^IT/i, '');\n    if (!/^[0-9]{11}$/.test(v)) return false;\n    var s = 0; for (var i = 0; i < 11; i++){ var n = +v[i]; if (i % 2){ n *= 2; if (n > 9) n -= 9; } s += n; }\n    return s % 10 === 0;\n  }\n  var REGIMI = ['I · IVA ordinaria', 'F · Forfettario', 'P · Privato'];\n\n  function apriConf(){\n    S.cmode = 'load';\n    call('confermaLeggi', [CONF], function(r){ S.cd = r; S.cmode = r.ok ? (r.conf === 'confermata' && MODE !== 'cat' ? 'gia' : 'vedi') : 'err'; render(); },\n      function(){ S.cmode = 'err'; render(); });\n  }\n  function vConf(){\n    var d = S.cd, m = S.cmode;\n    var head = '<div class=\"top\"><span class=\"brand\">Troupe</span></div>';\n    if (m === 'load') return head + '<div class=\"load\">Apro i tuoi dati…</div>';\n    if (m === 'err') return head + '<div class=\"card\"><h2>Link non valido</h2><p class=\"muted\" style=\"margin:0\">Il link è scaduto o non è completo. Chiedine uno nuovo a chi ti ha scritto.</p></div>';\n    if (m === 'fatto') return head + '<div class=\"card\" style=\"text-align:center;padding:30px 20px\"><div class=\"big\">Grazie, tutto ricevuto!</div><p class=\"muted\" style=\"margin:10px 0 0\">Procedo con il collocamento, ci vediamo sul set.</p></div>';\n    if (m === 'no') return head + '<div class=\"card\" style=\"text-align:center;padding:30px 20px\"><div class=\"big\">Ricevuto, grazie</div><p class=\"muted\" style=\"margin:10px 0 0\">Ho avvisato che non puoi esserci. Alla prossima!</p></div>';\n    var x = d.dati;\n    var job = '<div class=\"card\"><div class=\"sub\" style=\"margin:0 0 4px\">Ciao ' + esc(cap(x.nome)) + ', ci vediamo sul set</div><div class=\"big\">' + esc(d.titolo) + '</div>' +\n      '<dl style=\"margin-top:10px\"><dt>Ruolo</dt><dd>' + esc(d.q) + '</dd><dt>Date</dt><dd>' + esc(fmtRange(d.dal, d.al)) + (giorni(d.dal, d.al) > 1 ? ' · ' + giorni(d.dal, d.al) + ' giorni' : '') + '</dd>' +\n      (d.luogo ? '<dt>Luogo</dt><dd>' + esc(d.luogo) + '</dd>' : '') + '<dt>Producer</dt><dd>' + esc(d.producer) + '</dd></dl></div>';\n    if (m === 'catFatto') return head + '<div class=\"card\" style=\"text-align:center;padding:30px 20px\"><div class=\"big\">Grazie, ricevuto!</div><p class=\"muted\" style=\"margin:10px 0 0\">Lo giro al catering. Ci vediamo sul set.</p></div>';\n    if (m === 'correggi') return head + job + vConfForm(x);\n    if (MODE === 'cat') return head + job.replace('ci vediamo sul set', 'cosa mangi sul set?') + catBlock(d.cat) + '<button class=\"btn main\" data-act=\"cf_cat\">Invia</button>';\n    var righe = [['Nome', cap(x.nome) + ' ' + cap(x.cognome)], ['Telefono', x.tel], ['Email', x.email], ['Codice fiscale', x.cf], ['Nascita', [x.nascita, x.luogo].filter(Boolean).join(' · ')],\n      ['Residenza', [x.via, [x.cap, x.comune].filter(Boolean).join(' ')].filter(Boolean).join(', ')], ['Regime', x.regime], ['Partita IVA', x.piva], ['IBAN', x.iban]];\n    var manca = !x.cf || !x.iban || !x.via;\n    return head + job + '<div class=\"card\"><h2>Dati collocamento · da ' + esc(String(d.producer).split(' ')[0]) + '</h2>' +\n      (m === 'gia' ? '<p class=\"muted\" style=\"margin:0 0 10px\">Hai già confermato. Se è cambiato qualcosa, correggi qui sotto.</p>' : '') +\n      '<dl>' + righe.map(function(r){ return '<dt>' + r[0] + '</dt><dd>' + (r[1] ? esc(r[1]) : '<span class=\"muted\">mancante</span>') + '</dd>'; }).join('') + '</dl></div>' +\n      (d.col === false ? '' : catBlock(d.cat)) +\n      (manca ? '<div class=\"err\">Mancano alcuni dati: tocca Correggi i dati per completarli.</div>' : '') +\n      (manca ? '' : '<button class=\"btn main\" data-act=\"cf_ok\">' + (m === 'gia' ? 'Confermo di nuovo' : 'Confermo, è tutto giusto') + '</button>') +\n      '<button class=\"btn sec\" style=\"margin-top:10px\" data-act=\"cf_correggi\">Correggi i dati</button>' +\n      (m === 'gia' ? '' : '<button class=\"btn sec danger\" style=\"margin-top:10px\" data-act=\"cf_no\">Non posso esserci</button>');\n  }\n  function vConfForm(x){ return formDati(x, 'confF', 'Correggi i dati', 'Salva e conferma', 'cf_annulla', S.cd.col !== false); }\n  function formDati(x, id, titolo, invia, annulla, conCat){\n    var f = function(n, l, v, t, extra){ return '<div class=\"f\" id=\"cf-' + n + '\"><label class=\"lab\" for=\"k' + n + '\">' + l + '</label><input type=\"' + (t || 'text') + '\" id=\"k' + n + '\" name=\"' + n + '\" value=\"' + esc(v) + '\"' + (extra || '') + '><div class=\"fmsg hide\"></div></div>'; };\n    return '<form id=\"' + id + '\" class=\"card\" autocomplete=\"off\"><h2>' + titolo + '</h2>' +\n      f('tel', 'Telefono', x.tel, 'tel') + f('email', 'Email', x.email, 'email') +\n      f('cf', 'Codice fiscale', x.cf, 'text', ' autocapitalize=\"characters\" maxlength=\"16\"') +\n      '<div class=\"row\">' + f('nascita', 'Data di nascita', x.nascita, 'text', ' placeholder=\"gg/mm/aaaa\"') + f('luogo', 'Luogo di nascita', x.luogo) + '</div>' +\n      f('via', 'Indirizzo di residenza', x.via, 'text', ' placeholder=\"Via Roma 10\"') +\n      '<div class=\"row\">' + f('cap', 'CAP', x.cap, 'text', ' inputmode=\"numeric\" maxlength=\"5\"') + f('comune', 'Comune', x.comune) + '</div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"kregime\">Come vieni pagato</label><select id=\"kregime\" name=\"regime\"><option value=\"\">Scegli</option>' +\n      REGIMI.map(function(r){ return '<option' + (r === x.regime ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +\n      f('piva', 'Partita IVA', x.piva, 'text', ' inputmode=\"numeric\" maxlength=\"13\"') +\n      f('iban', 'IBAN', x.iban, 'text', ' autocapitalize=\"characters\"') +\n      (conCat ? '</form>' + catBlock(S.cd && S.cd.cat) + '<div>' : '') +\n      '<button class=\"btn main\" type=\"submit\"' + (conCat ? ' form=\"' + id + '\"' : '') + '>' + invia + '</button><button class=\"btn sec\" type=\"button\" style=\"margin-top:10px\" data-act=\"' + annulla + '\">Annulla</button>' + (conCat ? '</div>' : '</form>');\n  }\n  function confAzione(a, b){\n    if (a === 'correggi') { S.cmode = 'correggi'; return render(); }\n    if (a === 'annulla') { S.cmode = S.cd.conf === 'confermata' ? 'gia' : 'vedi'; return render(); }\n    if (a === 'no' && !confirm('Confermi che non puoi esserci?')) return;\n    b.disabled = true;\n    var az = a === 'no' ? 'no' : a === 'cat' ? 'cat' : 'ok';\n    call('confermaInvia', [CONF, az, null, az === 'no' ? null : leggiCat()], function(r){\n      if (!r.ok) { toast(r.msg); b.disabled = false; return; }\n      S.cmode = az === 'no' ? 'no' : az === 'cat' ? 'catFatto' : 'fatto'; render();\n    }, function(){ b.disabled = false; toast('Invio non riuscito, riprova'); });\n  }\n  function confSalva(f){\n    var d = validaDati(f); if (!d) return;\n    var btn = f.querySelector('button[type=submit]') || document.querySelector('button[form=confF]'); btn.disabled = true; btn.textContent = 'Invio…';\n    call('confermaInvia', [CONF, 'correggi', d, leggiCat()], function(r){\n      if (!r.ok) { toast(r.msg); btn.disabled = false; btn.textContent = 'Salva e conferma'; return; }\n      S.cmode = 'fatto'; render();\n    }, function(){ btn.disabled = false; btn.textContent = 'Salva e conferma'; toast('Invio non riuscito, riprova'); });\n  }\n  function validaDati(f){\n    var d = {}, ok = true, first = null;\n    ['tel', 'email', 'cf', 'nascita', 'luogo', 'via', 'cap', 'comune', 'regime', 'piva', 'iban'].forEach(function(n){ d[n] = f.elements[n].value.trim(); });\n    function err(n, m){ var box = document.getElementById('cf-' + n); if (!box) return; box.classList.toggle('bad', !!m); var e = box.querySelector('.fmsg'); e.textContent = m || ''; e.classList.toggle('hide', !m); if (m) { ok = false; first = first || box; } }\n    err('tel', d.tel.replace(/\\D/g, '').length >= 8 ? '' : 'Controlla il numero');\n    err('email', !d.email || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(d.email) ? '' : 'Controlla l\\'email');\n    err('cf', cfOk(d.cf) ? '' : 'Il codice fiscale non sembra corretto');\n    err('via', d.via ? '' : 'Scrivi via e numero civico');\n    err('cap', /^[0-9]{5}$/.test(d.cap) ? '' : 'Il CAP ha 5 cifre');\n    err('comune', d.comune ? '' : 'Scrivi il comune');\n    err('iban', ibanOk(d.iban) ? '' : 'L\\'IBAN non sembra corretto');\n    err('piva', !d.piva || d.regime.indexOf('P ·') === 0 || pivaOk(d.piva) ? '' : 'La partita IVA non sembra corretta');\n    if (!ok) { first.scrollIntoView({ block: 'center' }); return null; }\n    if (d.regime.indexOf('P ·') === 0) d.piva = '';\n    return d;\n  }\n\n  // ───── invio su WhatsApp: apre l'app direttamente, con copia come riserva ─────\n  function waHref(num, testo){\n    return 'whatsapp://send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + encodeURIComponent(testo || '');\n  }\n  function foglioWA(titolo, testo, num){\n    chiudiFoglio();\n    var o = document.createElement('div'); o.className = 'ov'; o.id = 'foglio';\n    o.innerHTML = '<div class=\"sheet\" role=\"dialog\" aria-label=\"' + esc(titolo) + '\"><h2>' + esc(titolo) + '</h2>' +\n      '<pre class=\"cl prev\">' + esc(testo) + '</pre>' +\n      '<a class=\"btn wa\" href=\"' + waHref(num, testo) + '\" target=\"_top\">Apri WhatsApp</a>' +\n      '<div class=\"row\" style=\"margin-top:8px\"><button class=\"btn sec\" data-f=\"copia\">Copia testo</button>' +\n      (navigator.share ? '<button class=\"btn sec\" data-f=\"altro\">Altre app</button>' : '') + '</div>' +\n      '<button class=\"link\" style=\"width:100%;margin-top:6px\" data-f=\"chiudi\">Chiudi</button></div>';\n    o.addEventListener('click', function(e){\n      var t = e.target.closest('[data-f]');\n      if (e.target === o) return chiudiFoglio();\n      if (!t) return;\n      if (t.dataset.f === 'chiudi') chiudiFoglio();\n      if (t.dataset.f === 'copia') copia(testo);\n      if (t.dataset.f === 'altro') navigator.share({ text: testo }).catch(function(){ copia(testo); });\n    });\n    document.body.appendChild(o);\n  }\n  function chiudiFoglio(){ var o = document.getElementById('foglio'); if (o) o.remove(); }\n  function copia(t){\n    var ok = function(){ toast('Testo copiato: incollalo dove vuoi'); };\n    var vecchio = function(){ var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';\n      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); try { document.execCommand('copy'); ok(); } catch (e) { toast('Copia non riuscita'); } ta.remove(); };\n    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, vecchio); else vecchio();\n  }\n\n  // aggiunge una persona al progetto con un tocco (dalla ricerca \"Aggiungi crew\")\n  function aggiungiUno(r, b){\n    var t = S.target; if (!t || t.rs[r]) return;\n    t.rs[r] = 1; t.n++;\n    var c = (S.contatti || []).filter(function(x){ return x.r === r; })[0];\n    var y = window.scrollY; render(); window.scrollTo(0, y);\n    toast((c ? nomeDi(c) : 'Persona') + ' è nella crew di ' + t.titolo);\n    delete S.prjC[t.id];\n    call('aggiungiCrew', [S.token, t.id, [r]], function(){}, function(e){\n      delete t.rs[r]; t.n--; var y2 = window.scrollY; render(); window.scrollTo(0, y2); toast('Non aggiunto: ' + e.message);\n    });\n  }\n\n  // ═════════ FASE 3 · catering, collocamenti, chiusura ═════════\n  function itData(iso){ var x = pd(iso); return x ? ('0' + x.d).slice(-2) + '/' + ('0' + x.m).slice(-2) + '/' + x.y : ''; }\n  var DIETE = ['Mangio tutto', 'Vegetariana', 'Vegana', 'Pescetariana'];\n  var ALLERGIE = ['Glutine', 'Lattosio', 'Frutta a guscio', 'Crostacei e pesce', 'Uova'];\n\n  // blocco \"Per il catering\" nella pagina della crew\n  function catBlock(cat){\n    cat = cat || {};\n    var dieta = cat.dieta || 'Mangio tutto', all = String(cat.allergie || '').split(', ').filter(Boolean);\n    return '<div class=\"card\" id=\"catBox\"><h2>Per il catering</h2><p class=\"muted\" style=\"margin:-4px 0 10px\">Facoltativo. Va solo al catering di questa produzione.</p>' +\n      '<div class=\"f\"><span class=\"lab\">Cosa mangi</span><div class=\"seg wrap\" id=\"segDieta\" data-val=\"' + esc(dieta) + '\">' +\n      DIETE.map(function(t){ return '<button type=\"button\" data-seg=\"' + t + '\" class=\"' + (t === dieta ? 'on' : '') + '\">' + t + '</button>'; }).join('') + '</div></div>' +\n      '<div class=\"f\"><span class=\"lab\">Allergie o intolleranze</span><div class=\"chips\">' +\n      ALLERGIE.map(function(t){ return '<label class=\"chip\"><input type=\"checkbox\" name=\"all\" value=\"' + t + '\"' + (all.indexOf(t) !== -1 ? ' checked' : '') + '>' + t + '</label>'; }).join('') + '</div></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"catAltro\">Altro</label><input type=\"text\" id=\"catAltro\" value=\"' + esc(cat.altro) + '\" placeholder=\"Es. niente funghi\"></div>' +\n      '<label class=\"chk-row\"><input type=\"checkbox\" id=\"catGrave\"' + (cat.grave ? ' checked' : '') + '>Ho un\\'allergia grave: avvisate il catering</label></div>';\n  }\n  function leggiCat(){\n    var box = document.getElementById('catBox'); if (!box) return null;\n    return { dieta: document.getElementById('segDieta').getAttribute('data-val'),\n      allergie: Array.prototype.map.call(box.querySelectorAll('input[name=all]:checked'), function(i){ return i.value; }),\n      altro: document.getElementById('catAltro').value, grave: document.getElementById('catGrave').checked };\n  }\n\n  // ───── collocamenti nel progetto ─────\n  function vCollocamenti(p, col){\n    var conf = col.filter(confOk).length;\n    var chiuso = p.stato === 'chiuso';\n    var riga = function(t, s, btn){ return '<div class=\"step\"><div class=\"t\"><b>' + t + '</b><small>' + s + '</small></div>' + btn + '</div>'; };\n    return '<div class=\"card\"><h2>Collocamenti</h2>' +\n      riga('Rilevamento nullaosta', conf + ' confermati su ' + col.length + ' da collocare' + (p.ril ? ' · creato il ' + itData(p.ril) : ''),\n        '<button class=\"btn sec mini\" data-go=\"ril\"' + (conf && !chiuso ? '' : ' disabled') + '>Prepara</button>') +\n      riga('Mandato di pagamento', p.man ? 'creato il ' + itData(p.man) : 'a riprese concluse', '<button class=\"btn sec mini\" data-act=\"apriMan\"' + (conf && !chiuso ? '' : ' disabled') + '>Prepara</button>') +\n      (chiuso ? '' : riga('Chiudi progetto', 'la cartella passa in Archivio', '<button class=\"btn sec mini danger\" data-act=\"chiudiPrj\">Chiudi</button>')) +\n      '</div>';\n  }\n\n  function vRil(){\n    var p = S.pr, col = p.crew.filter(function(c){ return c.col && c.conf !== 'non disponibile'; });\n    var ok = col.filter(confOk), no = col.filter(function(c){ return !confOk(c); });\n    return top('prj') + '<h1>Rilevamento nullaosta</h1>' +\n      '<div class=\"card\"><h2>Nel file (' + ok.length + ')</h2>' + ok.map(function(c){\n        return '<div class=\"res\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc(c.q + ' · ' + fmtRange(c.dal, c.al)) + '</small></div></div>'; }).join('') + '</div>' +\n      (no.length ? '<div class=\"card\"><h2>Non ancora confermati (' + no.length + ')</h2><p class=\"muted\" style=\"margin:0 0 6px\">Restano fuori finché non confermano' + (S.admin ? ' o finché non confermi tu al loro posto' : '') + '.</p>' +\n        no.map(function(c){ return '<div class=\"res\" data-pers=\"' + c.r + '\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc(c.q) + '</small></div>' + badgeConf(c) + '</div>'; }).join('') + '</div>' : '') +\n      '<p class=\"muted\" style=\"margin:0 4px 12px\">Creo il file .xlsx nella cartella del progetto' + ' e ti preparo l\\'email per lo studio.' + '</p>' +\n      '<button class=\"btn main\" data-act=\"creaRil\">Crea file</button>';\n  }\n\n  function vMan(){\n    var p = S.pr, ok = p.crew.filter(function(c){ return c.col && confOk(c); });\n    return top('prj') + '<h1>Mandato di pagamento</h1><form id=\"manF\" autocomplete=\"off\">' + ok.map(function(c){\n      var gg = giorni(c.dal, c.al);\n      return '<div class=\"card\" data-r=\"' + c.r + '\"><b>' + esc(nomeDi(c)) + '</b><div class=\"sub\" style=\"margin:2px 0 10px\">' + esc(c.q + ' · ' + fmtRange(c.dal, c.al) + ' · ' + gg + (gg === 1 ? ' giorno' : ' giorni')) + '</div>' +\n        '<div class=\"f\"><label class=\"lab\">Compenso totale €</label><input type=\"text\" inputmode=\"decimal\" name=\"comp\" value=\"' + esc(c.comp) + '\" placeholder=\"Es. 1250\"></div>' +\n        '<div class=\"row\"><div class=\"f\"><label class=\"lab\">Diaria €</label><input type=\"text\" inputmode=\"decimal\" name=\"diaria\" value=\"' + esc(c.diaria) + '\"></div>' +\n        '<div class=\"f\"><label class=\"lab\">Rimborso km €</label><input type=\"text\" inputmode=\"decimal\" name=\"km\" value=\"' + esc(c.km) + '\"></div></div>' +\n        '<label class=\"chk-row\"><input type=\"checkbox\" name=\"diariaGia\"' + (c.diariaGia === 'sì' ? ' checked' : '') + '>Diaria già data</label>' +\n        '<label class=\"chk-row\"><input type=\"checkbox\" name=\"kmGia\"' + (c.kmGia === 'sì' ? ' checked' : '') + '>Rimborso km già dato</label></div>';\n    }).join('') + '<div id=\"manErr\"></div><button class=\"btn sec\" type=\"button\" data-act=\"salvaMan\">Salva per dopo</button>' +\n      '<button class=\"btn main\" type=\"submit\" style=\"margin-top:10px\">Crea file</button></form>';\n  }\n  function datiMan(){\n    return Array.prototype.map.call(document.querySelectorAll('#manF [data-r]'), function(box){\n      var v = function(n){ return box.querySelector('[name=' + n + ']'); };\n      return { r: Number(box.getAttribute('data-r')), comp: v('comp').value, diaria: v('diaria').value, km: v('km').value, diariaGia: v('diariaGia').checked, kmGia: v('kmGia').checked };\n    });\n  }\n\n  function vInvio(){\n    var r = S.invio;\n    var mail = 'mailto:' + r.email + '?subject=' + encodeURIComponent(r.oggetto) + '&body=' + encodeURIComponent(r.testo);\n    return top('prj') + '<div class=\"card\" style=\"text-align:center;padding:24px 18px\"><div class=\"big\">File pronto</div>' +\n      '<p class=\"muted\" style=\"margin:8px 0 0\">È nella cartella del progetto. Scaricalo e allegalo all\\'email per lo studio.</p></div>' +\n      (r.esclusi && r.esclusi.length ? '<div class=\"err\">Fuori dal file perché non hanno confermato: ' + esc(r.esclusi.map(cap).join(', ')) + '</div>' : '') +\n      '<a class=\"btn sec\" href=\"' + esc(r.fileUrl) + '\" target=\"_blank\" style=\"margin-bottom:12px\">Apri il file</a>' +\n      '<div class=\"card\"><h2>Email per lo studio</h2><dl><dt>A</dt><dd>' + esc(r.email) + '</dd><dt>Oggetto</dt><dd>' + esc(r.oggetto) + '</dd></dl><pre class=\"cl prev\" style=\"margin-top:10px\">' + esc(r.testo) + '</pre></div>' +\n      '<div class=\"row\"><button class=\"btn sec\" data-act=\"copiaMail\">Copia testo</button><a class=\"btn main\" href=\"' + esc(mail) + '\">Apri email</a></div>' +\n      '<p class=\"muted\" style=\"margin:10px 4px\">Apri email usa l\\'app di posta del telefono: scegli l\\'account Courage come mittente e ricordati l\\'allegato.</p>';\n  }\n\n  // ───── catering nel progetto ─────\n  function vCat(){\n    var p = S.pr, cat = S.catD || [];\n    var crew = p.crew.filter(function(c){ return c.conf !== 'non disponibile'; });\n    var di = function(c){ return cat.filter(function(x){ return x.r === c.r; })[0]; };\n    var risp = crew.filter(di), mancano = crew.filter(function(c){ return !di(c); });\n    var giorniL = [], x = pd(p.dal), y = pd(p.al);\n    for (var t = Date.UTC(x.y, x.m - 1, x.d); t <= Date.UTC(y.y, y.m - 1, y.d); t += 864e5) giorniL.push(new Date(t).toISOString().slice(0, 10));\n    var gruppi = [];\n    giorniL.forEach(function(g){\n      var qui = crew.filter(function(c){ return c.dal <= g && c.al >= g; });\n      var conta = function(tp){ return qui.filter(function(c){ var k = di(c); return k && k.dieta === tp; }).length; };\n      var v = [qui.length, conta('Vegetariana'), conta('Vegana'), conta('Pescetariana')];\n      var u = gruppi[gruppi.length - 1];\n      if (u && u.v.join() === v.join()) u.al = g; else gruppi.push({ dal: g, al: g, v: v });\n    });\n    var temp = function(n){ return n ? n : '<span class=\"muted\">–</span>'; };\n    var righeG = '<table class=\"tg\"><thead><tr><th>Giorni</th><th>Pasti</th><th>Veget.</th><th>Vegani</th><th>Pesc.</th></tr></thead><tbody>' +\n      gruppi.map(function(gr){ return '<tr><td>' + esc(fmtRange(gr.dal, gr.al).replace(/ \\d{4}$/, '')) + '</td><td><b>' + gr.v[0] + '</b></td><td>' + temp(gr.v[1]) + '</td><td>' + temp(gr.v[2]) + '</td><td>' + temp(gr.v[3]) + '</td></tr>'; }).join('') +\n      '</tbody></table>';\n    var esig = risp.filter(function(c){ var k = di(c); return k.dieta !== 'Mangio tutto' || k.allergie || k.altro; }).map(function(c){\n      var k = di(c);\n      return '<div class=\"res\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc([k.dieta !== 'Mangio tutto' ? k.dieta : '', k.allergie, k.altro].filter(Boolean).join(' · ')) + '</small></div>' + (k.grave ? '<span class=\"badge no\">allergia grave</span>' : '') + '</div>';\n    }).join('');\n    return top('prj') + '<h1>Catering</h1><p class=\"count\">' + risp.length + (risp.length === 1 ? ' risposta su ' : ' risposte su ') + crew.length + (mancano.length ? ' · ' + mancano.length + ' da sentire' : ' · tutti hanno risposto') + '</p>' +\n      '<div class=\"dep\">Pasti al giorno</div><div class=\"card\" style=\"padding:6px 14px\">' + righeG + '</div>' +\n      '<div class=\"dep\">Esigenze</div><div class=\"card\" style=\"padding:4px 12px\">' + (esig || '<p class=\"muted\">Nessuna esigenza particolare finora.</p>') + '</div>' +\n      (mancano.length ? '<div class=\"dep\">Non hanno ancora risposto</div><div class=\"card\" style=\"padding:4px 12px\">' + mancano.map(function(c){\n        return '<div class=\"res\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc(c.q) + '</small></div><button class=\"btn sec mini\" data-act=\"catChiedi\" data-r=\"' + c.r + '\"' + (waNum(c.tel) ? '' : ' disabled') + '>Chiedi</button></div>'; }).join('') + '</div>' : '') +\n      '<div class=\"row\" style=\"margin-top:12px\"><button class=\"btn sec\" data-act=\"copiaCat\">Copia testo</button><button class=\"btn main\" data-act=\"fileCat\">File per il catering</button></div>' +\n      '<p class=\"muted\" style=\"margin:10px 4px\">Le risposte restano solo in questo progetto e si cancellano 30 giorni dopo l\\'ultimo giorno di riprese.</p>';\n  }\n  function testoCat(){\n    var p = S.pr, cat = S.catD || [];\n    var crew = p.crew.filter(function(c){ return c.conf !== 'non disponibile'; });\n    var di = function(c){ return cat.filter(function(x){ return x.r === c.r; })[0]; };\n    var t = 'CATERING · ' + p.titolo + '\\n' + [fmtRange(p.dal, p.al), p.luogo].filter(Boolean).join(' · ') + '\\n\\n';\n    var x = pd(p.dal), y = pd(p.al);\n    for (var s = Date.UTC(x.y, x.m - 1, x.d); s <= Date.UTC(y.y, y.m - 1, y.d); s += 864e5) {\n      var g = new Date(s).toISOString().slice(0, 10);\n      var qui = crew.filter(function(c){ return c.dal <= g && c.al >= g; });\n      var vv = ['Vegetariana', 'Vegana', 'Pescetariana'].map(function(tp){ var n = qui.filter(function(c){ var k = di(c); return k && k.dieta === tp; }).length; return n ? n + ' ' + tp.toLowerCase() : ''; }).filter(Boolean);\n      t += fmtRange(g, g) + ': ' + qui.length + (qui.length === 1 ? ' pasto' : ' pasti') + (vv.length ? ' (di cui ' + vv.join(', ') + ')' : '') + '\\n';\n    }\n    var es = crew.filter(function(c){ var k = di(c); return k && (k.allergie || k.altro || k.dieta !== 'Mangio tutto'); });\n    if (es.length) t += '\\nESIGENZE\\n' + es.map(function(c){ var k = di(c); return nomeDi(c) + ' — ' + [k.dieta, k.allergie, k.altro].filter(Boolean).join(', ') + (k.grave ? ' — ALLERGIA GRAVE' : ''); }).join('\\n');\n    return t.trim();\n  }\n\n  // ───── compila e conferma (admin) ─────\n  function vAdminF(){\n    var c = crewDi(S.cv);\n    if (!S.adm) return top('pers') + '<div class=\"load\">Apro i dati…</div>';\n    return top('pers') + '<h1>' + esc(nomeDi(c)) + '</h1><p class=\"count\">Compili tu i dati e confermi al suo posto. Resta nel registro.</p>' +\n      formDati(S.adm, 'admF', 'Dati per il collocamento', 'Salva e conferma', 'admAnnulla', false);\n  }\n\n  function vArch(){\n    var l = S.arch;\n    return top('home') + '<h1>Archivio</h1>' + (!l ? '<div class=\"load\">Carico…</div>' : !l.length ? '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessun progetto chiuso.</p></div>' :\n      l.map(function(p){ return '<button class=\"prj\" data-prj=\"' + esc(p.id) + '\"><b>' + esc(p.titolo) + '</b><small>' + esc(fmtRange(p.dal, p.al) + (p.chiuso ? ' · chiuso il ' + itData(p.chiuso) : '')) + '</small></button>'; }).join('')) +\n      '<p class=\"muted\" style=\"margin:10px 4px\">Dopo 30 giorni dalla chiusura i dati per il collocamento li vede solo l\\'admin.</p>';\n  }\n\n  function azioni3(a, b){\n    if (a === 'apriCat') {\n      app.innerHTML = top('prj') + '<div class=\"load\">Carico le risposte…</div>';\n      call('catering', [S.token, S.pr.id], function(d){ S.catD = d; S.view = 'cat'; render(); });\n      return true;\n    }\n    if (a === 'catChiedi') {\n      var c = crewDi(Number(b.dataset.r)); b.disabled = true;\n      call('chiediCatering', [S.token, S.pr.id, c.r], function(r){\n        b.disabled = false;\n        var m = 'Ciao ' + cap(c.nome) + ', per ' + S.pr.titolo + ' ti chiedo cosa mangi sul set, così lo giro al catering: ' + r.link;\n        foglioWA('Messaggio per ' + cap(c.nome), m, waNum(c.tel));\n      }, function(e){ b.disabled = false; toast(e.message); });\n      return true;\n    }\n    if (a === 'copiaCat') { copia(testoCat()); return true; }\n    if (a === 'fileCat') {\n      b.disabled = true; b.textContent = 'Creo il file…';\n      call('fileCatering', [S.token, S.pr.id], function(r){ b.disabled = false; b.textContent = 'File per il catering'; foglioLink('File per il catering pronto', 'È nella cartella del progetto. Da Google Sheets puoi scaricarlo in PDF o Excel e mandarlo al catering.', r.url); },\n        function(e){ b.disabled = false; b.textContent = 'File per il catering'; toast(e.message); });\n      return true;\n    }\n    if (a === 'creaRil') {\n      b.disabled = true; b.textContent = 'Creo il file…';\n      call('rilevamento', [S.token, S.pr.id], function(r){\n        if (!r.ok) { b.disabled = false; b.textContent = 'Riprova'; return toast(r.msg); }\n        S.invio = r; S.view = 'invio'; ricarica();\n      }, function(e){ b.disabled = false; b.textContent = 'Riprova'; toast(e.message); });\n      return true;\n    }\n    if (a === 'apriMan') { S.view = 'man'; render(); return true; }\n    if (a === 'salvaMan') {\n      b.disabled = true;\n      call('salvaMandato', [S.token, S.pr.id, datiMan()], function(){ ricarica(function(){ S.view = 'prj'; toast('Salvato'); }); }, function(e){ b.disabled = false; toast(e.message); });\n      return true;\n    }\n    if (a === 'copiaMail') { copia(S.invio.testo); return true; }\n    if (a === 'chiudiPrj') {\n      if (!confirm('Chiudere ' + S.pr.titolo + '? La cartella passa in Archivio e i link di conferma smettono di funzionare.')) return true;\n      call('chiudiProgetto', [S.token, S.pr.id], function(){ S.progStale = true; S.view = 'home'; render(); toast('Progetto chiuso e archiviato'); });\n      return true;\n    }\n    if (a === 'apriArch') {\n      S.arch = null; S.view = 'arch'; render();\n      call('archivio', [S.token], function(l){ S.arch = l; if (S.view === 'arch') render(); });\n      return true;\n    }\n    if (a === 'compila') {\n      S.adm = null; S.view = 'adminF'; render();\n      call('datiPersona', [S.token, S.pr.id, S.cv], function(d){ S.adm = d; if (S.view === 'adminF') render(); }, function(e){ toast(e.message); S.view = 'pers'; render(); });\n      return true;\n    }\n    if (a === 'admAnnulla') { S.view = 'pers'; render(); return true; }\n    if (a === 'cf_cat') { confAzione('cat', b); return true; }\n    return false;\n  }\n\n  function submit3(f){\n    if (f.id === 'manF') {\n      var d = datiMan();\n      var manca = d.filter(function(x){ return !String(x.comp).trim(); });\n      if (manca.length) { document.getElementById('manErr').innerHTML = '<div class=\"err\">Manca il compenso di ' + manca.length + (manca.length === 1 ? ' persona' : ' persone') + '.</div>'; return true; }\n      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Creo il file…';\n      call('salvaMandato', [S.token, S.pr.id, d], function(){\n        call('mandato', [S.token, S.pr.id], function(r){\n          if (!r.ok) { btn.disabled = false; btn.textContent = 'Riprova'; return toast(r.msg); }\n          S.invio = r; S.view = 'invio'; ricarica();\n        }, function(e){ btn.disabled = false; btn.textContent = 'Riprova'; toast(e.message); });\n      }, function(e){ btn.disabled = false; btn.textContent = 'Riprova'; toast(e.message); });\n      return true;\n    }\n    if (f.id === 'admF') {\n      var dd = validaDati(f); if (!dd) return true;\n      var b2 = f.querySelector('button[type=submit]'); b2.disabled = true; b2.textContent = 'Salvo…';\n      call('confermaAdmin', [S.token, S.pr.id, S.cv, dd], function(){ S.view = 'pers'; S.csens = null; ricarica(function(){ toast('Dati salvati e confermati'); }); },\n        function(e){ b2.disabled = false; b2.textContent = 'Salva e conferma'; toast(e.message); });\n      return true;\n    }\n    return false;\n  }\n\n  function foglioLink(titolo, testo, url){\n    chiudiFoglio();\n    var o = document.createElement('div'); o.className = 'ov'; o.id = 'foglio';\n    o.innerHTML = '<div class=\"sheet\"><h2>' + esc(titolo) + '</h2><p class=\"muted\" style=\"margin:0 0 12px\">' + esc(testo) + '</p>' +\n      '<a class=\"btn main\" href=\"' + esc(url) + '\" target=\"_blank\">Apri il file</a><button class=\"link\" style=\"width:100%;margin-top:6px\" data-f=\"chiudi\">Chiudi</button></div>';\n    o.addEventListener('click', function(e){ if (e.target === o || e.target.closest('[data-f]')) chiudiFoglio(); });\n    document.body.appendChild(o);\n  }\n\n  // ═════════ ACCESSI (admin) ═════════\n  function vAcc(){\n    var d = S.acc;\n    if (!d) return top('home') + '<h1>Accessi</h1><div class=\"load\">Carico…</div>';\n    var utenti = d.utenti.map(function(x){\n      return '<div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:center;gap:10px\"><div><b style=\"font-size:16px\">' + esc(x.nome) + '</b>' +\n        '<div class=\"sub\" style=\"margin-top:2px\">' + (x.admin ? 'Admin' : 'Producer') + ' · codice <b style=\"color:var(--ink);letter-spacing:.06em\">' + esc(x.codice) + '</b></div></div>' +\n        '<span class=\"badge ' + (x.attivo ? 'ok' : 'no') + '\">' + (x.attivo ? 'attivo' : 'disattivato') + '</span></div>' +\n        '<div class=\"row\" style=\"margin-top:12px\">' +\n        (x.attivo ? '<button class=\"btn sec mini\" style=\"flex:1\" data-act=\"accInvia\" data-row=\"' + x.row + '\">Invia</button>' : '') +\n        '<button class=\"btn sec mini\" style=\"flex:1\" data-act=\"accCodice\" data-row=\"' + x.row + '\">Cambia codice</button>' +\n        (x.nome === S.nome ? '' : '<button class=\"btn sec mini' + (x.attivo ? ' danger' : '') + '\" style=\"flex:1\" data-act=\"' + (x.attivo ? 'accOff' : 'accOn') + '\" data-row=\"' + x.row + '\">' + (x.attivo ? 'Disattiva' : 'Riattiva') + '</button>') +\n        '</div></div>';\n    }).join('');\n    var reg = d.registro.length ? d.registro.map(function(r){\n      return '<div class=\"res\"><div class=\"t\"><b style=\"font-weight:500\">' + esc(r.cosa) + '</b><small>' + esc([r.quando, r.chi, r.persona].filter(Boolean).join(' · ')) + '</small></div></div>';\n    }).join('') : '<p class=\"muted\">Ancora niente.</p>';\n    return top('home') + '<h1>Accessi</h1>' + utenti +\n      '<form id=\"accF\" class=\"card\" autocomplete=\"off\"><h2>Nuovo producer</h2><div id=\"accErr\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"accN\">Nome e cognome</label><input type=\"text\" id=\"accN\" name=\"nome\" placeholder=\"Es. Giulia Bianchi\"></div>' +\n      '<button class=\"btn main\" type=\"submit\">Crea accesso</button><p class=\"muted\" style=\"margin:10px 0 0\">Troupe crea un codice personale: vede solo i progetti suoi e i dati di chi ha confermato.</p></form>' +\n      '<div class=\"card\"><h2>Aggiornamenti</h2><p class=\"muted\" style=\"margin:0 0 10px\">Troupe controlla da sola ogni 10 minuti se c\\'è una versione nuova. Se vuoi, puoi forzarla subito.</p><button class=\"btn sec\" data-act=\"aggOra\">Aggiorna ora</button></div>' +\n      '<div class=\"dep\">Registro · ultimi 40</div><div class=\"card\" style=\"padding:4px 12px\">' + reg + '</div>';\n  }\n  function caricaAcc(){ call('accessi', [S.token], function(d){ S.acc = d; if (S.view === 'acc') { var y = window.scrollY; render(); window.scrollTo(0, y); } }); }\n  function utenteRow(row){ return S.acc.utenti.filter(function(x){ return x.row === Number(row); })[0]; }\n  function mandaCodice(nome, codice){\n    var m = 'Ciao ' + String(nome).split(' ')[0] + ', ecco Troupe, l\\'app per crew e collocamenti: ' + S.acc.link +\n      '\\nIl tuo codice personale è ' + codice + '. Tienilo per te: con quel codice entri a nome tuo.\\nSu iPhone: Condividi › Aggiungi alla schermata Home.';\n    foglioWA('Codice per ' + nome, m, '');\n  }\n  function azioni4(a, b){\n    if (a === 'aggOra') { b.disabled = true; b.textContent = 'Controllo…'; call('aggiornaOra', [S.token], function(r){ b.disabled = false; b.textContent = 'Aggiorna ora'; toast(r); caricaAcc(); }, function(e){ b.disabled = false; b.textContent = 'Aggiorna ora'; toast(e.message); }); return true; }\n    if (a === 'apriAcc') { S.acc = null; S.view = 'acc'; render(); caricaAcc(); return true; }\n    if (a === 'accInvia') { var u = utenteRow(b.dataset.row); mandaCodice(u.nome, u.codice); return true; }\n    if (a === 'accOff' || a === 'accOn' || a === 'accCodice') {\n      var u2 = utenteRow(b.dataset.row);\n      var q = a === 'accOff' ? 'Disattivare l\\'accesso di ' + u2.nome + '? Esce subito da Troupe e il codice smette di funzionare.' :\n              a === 'accCodice' ? 'Creare un nuovo codice per ' + u2.nome + '? Il vecchio smette di funzionare' + (u2.nome === S.nome ? ' e dovrai rientrare con il nuovo.' : '.') : '';\n      if (q && !confirm(q)) return true;\n      b.disabled = true;\n      call('cambiaAccesso', [S.token, u2.row, a === 'accOff' ? 'disattiva' : a === 'accOn' ? 'attiva' : 'codice'], function(r){\n        if (!r.ok) { b.disabled = false; return toast(r.msg); }\n        if (r.io) { alert('Il tuo nuovo codice è ' + r.codice + '. Segnatelo: ora rientri con questo.'); return esci(true); }\n        caricaAcc();\n        if (r.codice) { u2.codice = r.codice; mandaCodice(u2.nome, r.codice); } else toast(a === 'accOff' ? 'Accesso disattivato' : 'Accesso riattivato');\n      }, function(e){ b.disabled = false; toast(e.message); });\n      return true;\n    }\n    return false;\n  }\n  function submit4(f){\n    if (f.id !== 'accF') return false;\n    var nome = f.elements.nome.value.trim(), box = document.getElementById('accErr');\n    if (nome.split(' ').length < 2) { box.innerHTML = '<div class=\"err\">Scrivi nome e cognome</div>'; return true; }\n    var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Creo…';\n    call('creaProducer', [S.token, nome], function(r){\n      if (!r.ok) { btn.disabled = false; btn.textContent = 'Crea accesso'; box.innerHTML = '<div class=\"err\">' + esc(r.msg) + '</div>'; return; }\n      caricaAcc(); mandaCodice(r.nome, r.codice);\n    }, function(e){ btn.disabled = false; btn.textContent = 'Crea accesso'; toast(e.message); });\n    return true;\n  }\n\n  // ═════════ AVVIO VELOCE · una sola chiamata + memoria sul telefono ═════════\n  function cacheKey(){ return 'troupe_dati_' + S.nome; }\n  function carica(){\n    if (S.contatti || S.caricando) return;\n    S.caricando = true;\n    try {\n      var c = JSON.parse(localStorage.getItem(cacheKey()) || 'null');\n      if (c) { S.contatti = c.contatti; S.ruoli = c.ruoli || []; if (!S.progetti) S.progetti = c.progetti; }\n    } catch (e) {}\n    call('avvio', [S.token], function(d){\n      S.caricando = false; S.contatti = d.contatti; S.ruoli = d.ruoli; S.progetti = d.progetti; S.progStale = false;\n      try { localStorage.setItem(cacheKey(), JSON.stringify(d)); } catch (e) {}\n      if (S.view === 'home' || S.view === 'addc') { var y = window.scrollY; render(); window.scrollTo(0, y); }\n    }, function(e){ S.caricando = false; toast('Qualcosa non va: ' + e.message); });\n  }\n  function caricaProgetti(){\n    if (S.caricando) return;\n    call('progetti', [S.token], function(p){\n      S.progetti = p;\n      try { var c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (c) { c.progetti = p; localStorage.setItem(cacheKey(), JSON.stringify(c)); } } catch (e) {}\n      if (S.view === 'home') { var y = window.scrollY; render(); window.scrollTo(0, y); }\n    });\n  }\n  function esci(scaduta){\n    if (S.token && !scaduta) call('esci', [S.token], function(){});\n    try { localStorage.removeItem('troupe'); localStorage.removeItem(cacheKey()); } catch (e) {}\n    S.token = null; S.contatti = null; S.progetti = null; S.prjC = {}; S.sens = null; S.view = 'pin'; S.pin = ''; S.msg = scaduta ? 'Sessione scaduta: inserisci di nuovo il codice' : '';\n    render();\n  }\n\n  // ═════════ SCHEDA PROGETTO · nuova versione ═════════\n  function statoCrew(c){\n    if (!c.col) return { k: 'cl', t: 'Solo crew list', cls: '' };\n    if (c.conf === 'confermata') return { k: 'ok', t: 'Confermato', cls: 'ok' };\n    if (c.conf === 'sbloccata') return { k: 'ok', t: 'Sbloccato', cls: 'ok' };\n    if (c.conf === 'non disponibile') return { k: 'no', t: 'Non disponibile', cls: 'no' };\n    if (c.conf === 'chiesta') return { k: 'att', t: 'In attesa', cls: 'w' };\n    return { k: 'da', t: 'Da chiedere', cls: 'w' };\n  }\n  function passi(p){\n    var cr = p.crew || [], col = cr.filter(function(c){ return c.col && c.conf !== 'non disponibile'; });\n    var ok = col.filter(confOk).length, chiuso = p.stato === 'chiuso';\n    return [\n      { t: 'Crew', fatto: cr.length > 0, info: cr.length ? cr.length + ' in crew' : 'Aggiungi chi lavora alla produzione', btn: '+ Aggiungi crew', act: 'addCrew', on: !chiuso },\n      { t: 'Conferme', fatto: col.length > 0 && ok === col.length, info: col.length ? ok + (ok === 1 ? ' confermato su ' : ' confermati su ') + col.length + ' da collocare' : 'Nessuno da collocare', btn: 'Vedi chi manca', act: 'filtroDa', on: col.length > ok && !chiuso },\n      { t: 'Rilevamento', fatto: !!p.ril, info: p.ril ? 'Creato il ' + itData(p.ril) : ok ? 'Pronto per ' + ok + (ok === 1 ? ' persona confermata' : ' persone confermate') : 'Serve almeno una conferma', btn: p.ril ? 'Rifai' : 'Prepara', go: 'ril', on: ok > 0 && !chiuso },\n      { t: 'Mandato', fatto: !!p.man, info: p.man ? 'Creato il ' + itData(p.man) : 'A riprese concluse', btn: p.man ? 'Rifai' : 'Prepara', act: 'apriMan', on: ok > 0 && !chiuso },\n      { t: 'Chiusura', fatto: chiuso, info: chiuso ? 'Chiuso il ' + itData(p.chiuso) : 'La cartella passa in Archivio', btn: 'Chiudi', act: 'chiudiPrj', on: !chiuso }\n    ];\n  }\n  function barraPassi(p){\n    var ps = passi(p), cur = S.passo != null ? S.passo : ps.findIndex(function(x){ return !x.fatto; });\n    if (cur < 0) cur = ps.length - 1;\n    var x = ps[cur];\n    var attr = x.go ? 'data-go=\"' + x.go + '\"' : 'data-act=\"' + x.act + '\"';\n    return '<div class=\"passi\" role=\"navigation\" aria-label=\"Avanzamento del progetto\"><div class=\"passi-in\">' +\n      '<div class=\"steps\">' + ps.map(function(s, i){\n        return '<button class=\"dot' + (s.fatto ? ' fatto' : '') + (i === cur ? ' cur' : '') + '\" data-act=\"passo\" data-i=\"' + i + '\" aria-label=\"' + s.t + (s.fatto ? ', fatto' : '') + '\">' +\n          '<span class=\"c\">' + (s.fatto ? '✓' : i + 1) + '</span><span class=\"l\">' + s.t + '</span></button>';\n      }).join('') + '</div>' +\n      '<div class=\"passo-ora\"><div class=\"t\"><b>' + esc(x.t) + '</b><small>' + esc(x.info) + '</small></div>' +\n      (x.on ? '<button class=\"btn main mini\" ' + attr + '>' + esc(x.btn) + '</button>' : '') + '</div></div></div>';\n  }\n\n  function vPrj(){\n    var p = S.pr, cr = p.crew || [];\n    var col = cr.filter(function(c){ return c.col; });\n    var daConf = col.filter(function(c){ return !confOk(c) && c.conf !== 'non disponibile'; }).length;\n    var senza = col.filter(function(c){ return !confOk(c) && !(c.d[0] && c.d[4]); }).length;\n    var f = S.fCrew || 'tutti';\n    var filtra = function(c){ var k = statoCrew(c).k; return f === 'tutti' || (f === 'da' && (k === 'da' || k === 'att')) || (f === 'ok' && k === 'ok') || (f === 'cl' && (k === 'cl' || k === 'no')); };\n    var deps = {};\n    cr.filter(filtra).forEach(function(c){ var d = repOf(c.q); (deps[d] = deps[d] || []).push(c); });\n    var chiuso = p.stato === 'chiuso';\n    var lista = Object.keys(deps).sort(function(a, b){ return ordRep(a) - ordRep(b); }).map(function(d){\n      return '<div class=\"dep\">' + esc(d) + ' · ' + deps[d].length + '</div><div class=\"card\" style=\"padding:2px 14px\">' + deps[d].map(function(c){\n        var st = statoCrew(c);\n        var manca = c.col && !confOk(c) && !(c.d[0] && c.d[4]);\n        var chiedi = !chiuso && (st.k === 'da' || st.k === 'att') && waNum(c.tel);\n        return '<div class=\"cr\" data-pers=\"' + c.r + '\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b>' +\n          '<small>' + esc(c.q) + ' · ' + esc(fmtRange(c.dal, c.al).replace(/ \\d{4}$/, '')) + (manca ? ' · <span class=\"manca\">dati mancanti</span>' : '') + '</small></div>' +\n          (chiedi ? '<button class=\"btn sec mini\" data-act=\"chiediR\" data-r=\"' + c.r + '\">' + (st.k === 'att' ? 'Richiedi' : 'Chiedi') + '</button>' : '') +\n          '<span class=\"pallino ' + st.k + '\" title=\"' + st.t + '\" aria-label=\"' + st.t + '\"></span></div>';\n      }).join('') + '</div>';\n    }).join('');\n    var chip = function(k, t, n, dot){ return '<button class=\"fchip' + (f === k ? ' on' : '') + '\" data-act=\"fCrew\" data-f=\"' + k + '\">' + (dot ? '<i class=\"pallino ' + dot + '\"></i>' : '') + t + (n != null ? ' <span>' + n + '</span>' : '') + '</button>'; };\n    var nOk = cr.filter(function(c){ return statoCrew(c).k === 'ok'; }).length, nCl = cr.filter(function(c){ var k = statoCrew(c).k; return k === 'cl' || k === 'no'; }).length;\n    return top('home') +\n      '<div class=\"card hero\"><div style=\"min-width:0\"><div class=\"big\">' + esc(p.titolo) + '</div>' +\n      '<div class=\"sub\">' + esc([fmtRange(p.dal, p.al), p.luogo].filter(Boolean).join(' · ')) + '</div>' +\n      (riassuntoGiorni(p) ? '<div class=\"sub2\">' + esc(riassuntoGiorni(p)) + '</div>' : '') + '</div>' +\n      '<div class=\"stats\"><span>' + cr.length + ' in crew</span><span>' + col.length + ' da collocare</span>' +\n      (daConf ? '<span class=\"w\">' + daConf + ' da confermare</span>' : '') + (senza ? '<span class=\"w\">' + senza + ' senza dati</span>' : '') + '</div>' +\n      (chiuso ? '' : '<div class=\"head-acts\"><button class=\"link\" data-act=\"modPrj\">Modifica progetto</button><button class=\"btn main mini\" data-act=\"addCrew\">+ Aggiungi crew</button></div>') +\n      (chiuso ? '<p class=\"muted\" style=\"margin:10px 0 0\">Progetto chiuso: lo trovi in Archivio.</p>' : '') + '</div>' +\n      (cr.length ? '<div class=\"row\" style=\"margin:0 0 4px\"><button class=\"btn soft\" data-go=\"cl\">Crew list</button><button class=\"btn soft\" data-act=\"apriCat\">Catering</button></div>' +\n        '<div class=\"seg\" style=\"margin-top:12px\"><button type=\"button\" class=\"' + (S.vista !== 'giorni' ? 'on' : '') + '\" data-act=\"vista\" data-v=\"elenco\">Elenco</button><button type=\"button\" class=\"' + (S.vista === 'giorni' ? 'on' : '') + '\" data-act=\"vista\" data-v=\"giorni\">Giorni</button></div>' +\n        (S.vista === 'giorni' ? vistaGiorni(p, cr) : '<div class=\"fchips\">' + chip('tutti', 'Tutti', cr.length) + chip('da', 'Da confermare', daConf, 'da') + chip('ok', 'Confermati', nOk, 'ok') + chip('cl', 'Altri', nCl, 'cl') + '</div>' +\n\n        (lista || '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessuno in questo filtro.</p></div>')) :\n        '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Ancora nessuno in crew. Tocca + Aggiungi crew per cercare le persone nel database.</p></div>') +\n      '<div style=\"height:170px\"></div>' + barraPassi(p);\n  }\n\n  function azioni5(a, b){\n    if (a === 'addCrew') { var rs = {}; S.pr.crew.forEach(function(c){ rs[c.r] = 1; }); S.target = { id: S.pr.id, titolo: S.pr.titolo, rs: rs, n: 0 }; S.q = { ruolo: '', dove: '', nome: '' }; S.view = 'addc'; render(); return true; }\n    if (a === 'vista') { S.vista = b.dataset.v; S.gSel = null; render(); return true; }\n    if (a === 'gCella') { cellaGiorni(b); return true; }\n    if (a === 'fCrew') { S.fCrew = b.dataset.f; var y = window.scrollY; render(); window.scrollTo(0, y); return true; }\n    if (a === 'filtroDa') { S.fCrew = 'da'; render(); return true; }\n    if (a === 'passo') { var i = Number(b.dataset.i); S.passo = S.passo === i ? null : i; var y2 = window.scrollY; render(); window.scrollTo(0, y2); return true; }\n    if (a === 'eliminaPrj') {\n      if (!confirm('Eliminare ' + S.prjEdit.titolo + '? Sparisce da Troupe e i link di conferma smettono di funzionare. La cartella va in Drive › OLD.')) return true;\n      b.disabled = true; b.textContent = 'Elimino…';\n      call('eliminaProgetto', [S.token, S.prjEdit.id], function(){ delete S.prjC[S.prjEdit.id]; S.progStale = true; S.progetti = (S.progetti || []).filter(function(x){ return x.id !== S.prjEdit.id; }); S.view = 'home'; render(); toast('Progetto eliminato'); },\n        function(e){ b.disabled = false; b.textContent = 'Elimina progetto'; toast(e.message); });\n      return true;\n    }\n    if (a === 'chiediR') { S.cv = Number(b.dataset.r); return azioni2('chiedi', b); }\n    return false;\n  }\n\n  // ═════════ GIORNI DEL PROGETTO · shoot, allestimento, ritiri e resi ═════════\n  var TIPI = { S: 'Shoot', A: 'Allestimento', R: 'Ritiri e resi', P: 'Pausa' };\n  var CICLO = ['S', 'A', 'R', 'P'];\n  function elencoGiorni(dal, al){\n    var out = [], x = pd(dal), y = pd(al || dal); if (!x || !y) return out;\n    for (var t = Date.UTC(x.y, x.m - 1, x.d), e = Date.UTC(y.y, y.m - 1, y.d); t <= e && out.length < 120; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));\n    return out;\n  }\n  function leggiGiorni(s){ var m = {}; String(s || '').split(';').forEach(function(x){ var p = x.split(':'); if (p.length === 2) m[p[0]] = p[1]; }); return m; }\n  function scriviGiorni(m, dal, al){ return elencoGiorni(dal, al).filter(function(g){ return m[g] && m[g] !== 'S'; }).map(function(g){ return g + ':' + m[g]; }).join(';'); }\n  // \"Shoot 17–20 nov · Allestimento 15–16 nov · Ritiri e resi 23 nov\"\n  function riassuntoGiorni(p){\n    var m = leggiGiorni(p.giorni), gs = elencoGiorni(p.dal, p.al);\n    if (!gs.length) return '';\n    var gruppi = {};\n    gs.forEach(function(g){ var t = m[g] || 'S'; if (t === 'P') return; (gruppi[t] = gruppi[t] || []).push(g); });\n    if (!gruppi.A && !gruppi.R) return '';\n    var blocchi = function(arr){\n      var out = [], ini = arr[0], prev = arr[0];\n      for (var i = 1; i <= arr.length; i++) {\n        var g = arr[i], cont = g && (Date.parse(g) - Date.parse(prev) === 864e5);\n        if (!cont) { out.push(fmtRange(ini, prev).replace(/ \\d{4}$/, '')); ini = g; }\n        prev = g;\n      }\n      return out.join(', ');\n    };\n    return ['S', 'A', 'R'].filter(function(t){ return gruppi[t]; }).map(function(t){ return TIPI[t] + ' ' + blocchi(gruppi[t]); }).join(' · ');\n  }\n  function griglia(){\n    var f = document.getElementById('prjF'); if (!f) return;\n    var dal = f.elements.dal.value, al = f.elements.al.value || dal, box = document.getElementById('giorniBox');\n    var gs = elencoGiorni(dal, al);\n    if (!gs.length || al < dal) { box.innerHTML = '<p class=\"muted\" style=\"margin:0\">Scegli primo e ultimo giorno.</p>'; return; }\n    var m = S.giorniEdit || (S.giorniEdit = {});\n    var GS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];\n    box.innerHTML = '<div class=\"giorni\">' + gs.map(function(g){\n      var t = m[g] || 'S', d = new Date(g + 'T12:00:00');\n      return '<button type=\"button\" class=\"gg t' + t + '\" data-gg=\"' + g + '\"><span class=\"w\">' + GS[d.getDay()] + '</span><b>' + d.getDate() + '</b><span class=\"k\">' + TIPI[t] + '</span></button>';\n    }).join('') + '</div><p class=\"muted\" style=\"margin:8px 0 0\">Tocca un giorno per cambiarlo: Shoot › Allestimento › Ritiri e resi › Pausa.</p>';\n  }\n  app.addEventListener('change', function(e){ if (e.target.id === 'pd1' || e.target.id === 'pd2') griglia(); });\n  app.addEventListener('click', function(e){\n    var b = e.target.closest && e.target.closest('[data-gg]'); if (!b) return;\n    var m = S.giorniEdit || (S.giorniEdit = {}), g = b.dataset.gg, t = m[g] || 'S';\n    m[g] = CICLO[(CICLO.indexOf(t) + 1) % CICLO.length]; griglia();\n  });\n\n  function vPrjForm(){\n    var p = S.prjEdit || {};\n    if (!S.giorniEdit) S.giorniEdit = leggiGiorni(p.giorni);\n    setTimeout(griglia, 0);\n    return top(p.id ? 'prj' : 'home') + '<h1>' + (p.id ? 'Modifica progetto' : 'Nuovo progetto') + '</h1><form id=\"prjF\" class=\"card\" autocomplete=\"off\"><div id=\"prjErr\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pt\">Titolo</label><input type=\"text\" id=\"pt\" name=\"titolo\" value=\"' + esc(p.titolo) + '\" placeholder=\"Es. DbyD Luxottica\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pl\">Luogo</label><input type=\"text\" id=\"pl\" name=\"luogo\" value=\"' + esc(p.luogo) + '\" placeholder=\"Es. Milano, studio\"></div>' +\n      '<div class=\"row\"><div class=\"f\"><label class=\"lab\" for=\"pd1\">Primo giorno</label><input type=\"date\" id=\"pd1\" name=\"dal\" value=\"' + esc(p.dal) + '\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"pd2\">Ultimo giorno</label><input type=\"date\" id=\"pd2\" name=\"al\" value=\"' + esc(p.al) + '\"></div></div>' +\n      '<div class=\"f\"><span class=\"lab\">Giorni</span><div id=\"giorniBox\"></div></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"paz\">Azienda per i collocamenti</label><input type=\"text\" id=\"paz\" name=\"azienda\" value=\"' + esc(p.azienda || 'COURAGE') + '\"></div>' +\n      (p.id ? '<p class=\"muted\" style=\"margin:0 0 12px\">Se cambi le date, chi lavora su tutto il progetto segue le nuove date; gli altri restano dentro il nuovo periodo.</p>' : '') +\n      '<button class=\"btn main\" type=\"submit\">' + (p.id ? 'Salva le modifiche' : 'Crea progetto') + '</button></form>' +\n      (p.id ? '<button class=\"btn sec danger\" data-act=\"eliminaPrj\" style=\"margin-top:4px\">Elimina progetto</button>' +\n        '<p class=\"muted\" style=\"margin:8px 4px 0;text-align:center\">Per una produzione che non è andata in porto. La cartella finisce in Drive › OLD, non si perde nulla.</p>' : '');\n  }\n\n  // ═════════ AGGIUNGI CREW · resta dentro il progetto ═════════\n  function righeAdd(){\n    var q = S.q, vuoto = !q.ruolo.trim() && !q.dove.trim() && !q.nome.trim();\n    if (!S.contatti) return '<div class=\"load\">Carico i contatti…</div>';\n    if (vuoto) return '<p class=\"muted\" style=\"margin:6px 4px\">Scrivi un ruolo, una città o un nome: i risultati compaiono qui sotto mentre scrivi.</p>';\n    cerca();\n    if (!S.ris.length) return '<div class=\"card\"><p class=\"muted\" style=\"margin:0\">Nessuno trovato. Prova a togliere un filtro.</p></div>';\n    var t = S.target;\n    return '<p class=\"count\">' + S.ris.length + (S.ris.length === 1 ? ' risultato' : ' risultati') + (S.ris.length > 60 ? ' · mostro i primi 60' : '') + '</p>' +\n      '<div class=\"card\" style=\"padding:4px 12px\">' + S.ris.slice(0, 60).map(function(c){\n        var dx = t.rs[c.r] ? '<span class=\"add on\" title=\"Già in crew\" aria-label=\"Già in crew\">✓</span>' :\n          '<button class=\"add\" data-add=\"' + c.r + '\" aria-label=\"Aggiungi ' + esc(nomeDi(c)) + '\">+</button>';\n        return '<div class=\"res\" data-apri=\"' + c.r + '\"><div class=\"t\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc([c.ruolo, c.citta].filter(Boolean).join(' · ')) + '</small></div>' + dx + '</div>';\n      }).join('') + '</div>';\n  }\n  function aggiornaAdd(){ var b = document.getElementById('addRis'); if (b) b.innerHTML = righeAdd(); }\n  function vAdd(){\n    var t = S.target;\n    if (!S.contatti) setTimeout(carica, 0);\n    return '<div class=\"top\"><button class=\"link\" data-act=\"fattoTarget\">‹ ' + esc(t.titolo) + '</button>' +\n      '<span class=\"who\">' + esc(S.nome) + (S.admin ? ' · admin' : '') + '</span></div>' +\n      '<h1>Aggiungi crew</h1>' +\n      '<div class=\"card\"><div class=\"f\"><label class=\"lab\" for=\"aqr\">Ruolo</label><input type=\"search\" id=\"aqr\" data-ac=\"ruolo\" placeholder=\"Es. fonico, gaffer, PA\" value=\"' + esc(S.q.ruolo) + '\" autocomplete=\"off\"></div>' +\n      '<div class=\"row\"><div class=\"f\"><label class=\"lab\" for=\"aqd\">Dove</label><input type=\"search\" id=\"aqd\" data-ac=\"dove\" placeholder=\"Es. Milano\" value=\"' + esc(S.q.dove) + '\" autocomplete=\"off\"></div>' +\n      '<div class=\"f\"><label class=\"lab\" for=\"aqn\">Nome</label><input type=\"search\" id=\"aqn\" data-ac=\"nome\" placeholder=\"Nome o cognome\" value=\"' + esc(S.q.nome) + '\" autocomplete=\"off\"></div></div></div>' +\n      '<div id=\"addRis\">' + righeAdd() + '</div><div style=\"height:90px\"></div>' +\n      '<div class=\"bar fissa\"><button class=\"btn main\" data-act=\"fattoTarget\">' + (t.n ? 'Fatto · ' + t.n + (t.n === 1 ? ' aggiunto' : ' aggiunti') : 'Torna al progetto') + '</button></div>';\n  }\n\n  // ═════════ CONFERMA ISTANTANEA per la crew ═════════\n  // \"Grazie, ricevuto\" compare subito; il salvataggio continua in sottofondo (anche se la pagina viene chiusa).\n  function inviaConferma(az, d, cat, fatto){\n    var prima = S.cmode;\n    S.cmode = fatto; render();\n    var prova = function(){\n      call('confermaInvia', [CONF, az, d, cat], function(r){\n        if (!r.ok) erroreInvio(r.msg, prova, prima);\n      }, function(){ erroreInvio('Connessione assente: i tuoi dati non sono ancora arrivati.', prova, prima); });\n    };\n    prova();\n  }\n  function erroreInvio(msg, riprova, prima){\n    chiudiFoglio();\n    var o = document.createElement('div'); o.className = 'ov'; o.id = 'foglio';\n    o.innerHTML = '<div class=\"sheet\"><h2>Invio non riuscito</h2><p class=\"muted\" style=\"margin:0 0 12px\">' + esc(msg) + '</p>' +\n      '<button class=\"btn main\" data-f=\"riprova\">Riprova</button><button class=\"link\" style=\"width:100%;margin-top:6px\" data-f=\"indietro\">Torna ai dati</button></div>';\n    o.addEventListener('click', function(e){\n      var t = e.target.closest('[data-f]'); if (!t) return;\n      chiudiFoglio();\n      if (t.dataset.f === 'riprova') { toast('Invio in corso…'); riprova(); }\n      else { S.cmode = prima; render(); }\n    });\n    document.body.appendChild(o);\n  }\n  function confAzione(a, b){\n    if (a === 'correggi') { S.cmode = 'correggi'; return render(); }\n    if (a === 'annulla') { S.cmode = S.cd.conf === 'confermata' ? 'gia' : 'vedi'; return render(); }\n    if (a === 'no' && !confirm('Confermi che non puoi esserci?')) return;\n    var az = a === 'no' ? 'no' : a === 'cat' ? 'cat' : 'ok';\n    inviaConferma(az, null, az === 'no' ? null : leggiCat(), az === 'no' ? 'no' : az === 'cat' ? 'catFatto' : 'fatto');\n  }\n  function confSalva(f){\n    var d = validaDati(f); if (!d) return;\n    inviaConferma('correggi', d, leggiCat(), 'fatto');\n  }\n\n  // ═════════ VISTA GIORNI · chi c'è giorno per giorno ═════════\n  function vistaGiorni(p, cr){\n    var gs = elencoGiorni(p.dal, p.al), m = leggiGiorni(p.giorni), sel = S.gSel;\n    var GS = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];\n    var deps = {};\n    cr.forEach(function(c){ var d = repOf(c.q); (deps[d] = deps[d] || []).push(c); });\n    var testa = '<tr><th class=\"nm\"></th>' + gs.map(function(g){\n      var d = new Date(g + 'T12:00:00'), t = m[g] || 'S';\n      return '<th class=\"gh\"><span>' + GS[d.getDay()] + '</span><b>' + d.getDate() + '</b><i class=\"tp t' + t + '\" title=\"' + TIPI[t] + '\">' + t + '</i></th>';\n    }).join('') + '</tr>';\n    var corpo = Object.keys(deps).sort(function(a, b){ return ordRep(a) - ordRep(b); }).map(function(dep){\n      return '<tr class=\"dr\"><td class=\"nm\">' + esc(dep) + '</td><td colspan=\"' + gs.length + '\"></td></tr>' + deps[dep].map(function(c){\n        var st = statoCrew(c).k;\n        return '<tr><td class=\"nm\" data-pers=\"' + c.r + '\"><b>' + esc(nomeDi(c)) + '</b><small>' + esc(c.q) + '</small></td>' + gs.map(function(g){\n          var on = c.dal <= g && c.al >= g, s = sel && sel.r === c.r && sel.g === g;\n          return '<td class=\"gc' + (on ? ' on s' + st : '') + (s ? ' sel' : '') + '\" data-act=\"gCella\" data-r=\"' + c.r + '\" data-g=\"' + g + '\"></td>';\n        }).join('') + '</tr>';\n      }).join('');\n    }).join('');\n    var tot = '<tr class=\"tot\"><td class=\"nm\">Persone</td>' + gs.map(function(g){\n      return '<td>' + cr.filter(function(c){ return c.conf !== 'non disponibile' && c.dal <= g && c.al >= g; }).length + '</td>';\n    }).join('') + '</tr>';\n    return '<p class=\"muted\" style=\"margin:10px 4px 6px\">' + (sel ? 'Ora tocca l\\'ultimo giorno di ' + esc(nomeDi(crewDi(sel.r))) + '.' : 'Per cambiare le date di qualcuno tocca il suo primo giorno, poi l\\'ultimo.') + '</p>' +\n      '<div class=\"gwrap\"><table class=\"gt\">' + testa + corpo + tot + '</table></div>' +\n      '<div class=\"legenda-g\"><span><i class=\"tp tS\">S</i>Shoot</span><span><i class=\"tp tA\">A</i>Allestimento</span><span><i class=\"tp tR\">R</i>Ritiri e resi</span></div>';\n  }\n  function cellaGiorni(b){\n    var r = Number(b.dataset.r), g = b.dataset.g, c = crewDi(r);\n    if (!c || S.pr.stato === 'chiuso') return;\n    if (!S.gSel || S.gSel.r !== r) { S.gSel = { r: r, g: g }; var y = window.scrollY, x = (document.querySelector('.gwrap') || {}).scrollLeft; render(); window.scrollTo(0, y); var w = document.querySelector('.gwrap'); if (w) w.scrollLeft = x; return; }\n    var a = S.gSel.g < g ? S.gSel.g : g, z = S.gSel.g < g ? g : S.gSel.g;\n    S.gSel = null;\n    c.dal = a; c.al = z;\n    var y2 = window.scrollY, x2 = (document.querySelector('.gwrap') || {}).scrollLeft; render(); window.scrollTo(0, y2); var w2 = document.querySelector('.gwrap'); if (w2) w2.scrollLeft = x2;\n    toast(nomeDi(c) + ': ' + fmtRange(a, z));\n    call('aggiornaCrew', [S.token, S.pr.id, r, { q: c.q, dal: a, al: z, col: c.col, cm: c.cm, ref: c.ref }], function(res){\n      if (!res.ok) { toast('Non salvato: ' + res.msg); ricarica(); }\n    }, function(e){ toast('Non salvato: ' + e.message); ricarica(); });\n  }\n\n  if (CONF) { S.view = 'conf'; apriConf(); }\n  render();\n})();\n</script>\n</body>\n</html>\n";
