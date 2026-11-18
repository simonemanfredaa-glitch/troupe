// Aggiunge il dominio del sito ai domini autorizzati per l'accesso con Google (se manca).
import { GoogleAuth } from 'google-auth-library';
const P = 'troupe-app-f0364', D = ['troupe-catering.web.app', 'troupe-catering.firebaseapp.com'];
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config`;
const cfg = (await c.request({ url, headers: { 'x-goog-user-project': P } })).data;
const att = cfg.authorizedDomains || [], nuovi = D.filter(d => !att.includes(d));
if (!nuovi.length) { console.log('Domini già autorizzati'); process.exit(0); }
await c.request({ url: url + '?updateMask=authorizedDomains', method: 'PATCH', headers: { 'x-goog-user-project': P }, data: { authorizedDomains: att.concat(nuovi) } });
console.log('Domini autorizzati aggiunti:', nuovi.join(', '));
