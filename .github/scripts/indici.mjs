// Crea gli indici di Firestore descritti in firestore.indexes.json (solo fieldOverrides), con l'API Admin.
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';
const P = 'troupe-app-f0364';
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const cfg = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
for (const f of cfg.fieldOverrides || []) {
  const url = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/collectionGroups/${f.collectionGroup}/fields/${f.fieldPath}`;
  const att = (await c.request({ url })).data;
  const ha = JSON.stringify(((att.indexConfig || {}).indexes || []).map(i => i.queryScope + ((i.fields || [])[0] || {}).order).sort());
  const voglio = JSON.stringify(f.indexes.map(i => i.queryScope + i.order).sort());
  if (ha === voglio && !(att.indexConfig || {}).usesAncestorConfig) { console.log('Indice già presente:', f.collectionGroup + '.' + f.fieldPath); continue; }
  await c.request({ url: url + '?updateMask=indexConfig', method: 'PATCH', data: { indexConfig: { indexes: f.indexes.map(i => ({ queryScope: i.queryScope, fields: [{ fieldPath: f.fieldPath, order: i.order }] })) } } });
  console.log('Indice in creazione:', f.collectionGroup + '.' + f.fieldPath);
}
