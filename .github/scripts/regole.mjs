// Pubblica firestore.rules su Firebase con la chiave di servizio (API Firebase Rules).
import { readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';
const P = 'troupe-app-f0364';
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const base = `https://firebaserules.googleapis.com/v1/projects/${P}`;
const content = readFileSync('firestore.rules', 'utf8');
const rs = await client.request({ url: `${base}/rulesets`, method: 'POST', data: { source: { files: [{ name: 'firestore.rules', content }] } } });
console.log('Regole controllate e salvate:', rs.data.name);
const release = { name: `projects/${P}/releases/cloud.firestore`, rulesetName: rs.data.name };
try {
  await client.request({ url: `${base}/releases/cloud.firestore`, method: 'PATCH', data: { release } });
} catch (e) {
  if (e.response && e.response.status === 404) await client.request({ url: `${base}/releases`, method: 'POST', data: release });
  else throw e;
}
console.log('Regole pubblicate su Firestore');
