// Controllo tecnico: elenco producer (senza stampare le email) e prova delle regole.
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';
const P = 'troupe-app-f0364';
const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const r = await c.request({ url: `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/producer` });
for (const d of r.data.documents || []) {
  const id = decodeURIComponent(d.name.split('/').pop());
  console.log('producer:', id.replace(/^(.).*(@.*)$/, '$1***$2'), '| lunghezza', id.length, '| maiuscole', /[A-Z]/.test(id), '| spazi', /\s/.test(id), '| campi', Object.keys(d.fields || {}).join(','));
}
const email = (r.data.documents || []).map(d => decodeURIComponent(d.name.split('/').pop()))[0];
if (email) {
  const t = await c.request({ url: `https://firebaserules.googleapis.com/v1/projects/${P}:test`, method: 'POST', data: {
    source: { files: [{ name: 'firestore.rules', content: readFileSync('firestore.rules', 'utf8') }] },
    testSuite: { testCases: ['producer/' + email, 'produzioni/x'].map(p => ({
      expectation: 'ALLOW',
      request: { auth: { uid: 'u1', token: { email, email_verified: true } }, path: `/databases/(default)/documents/${p}`, method: 'get' },
      functionMocks: [{ function: 'exists', args: [{ anyValue: {} }], result: { value: true } }]
    })) } } });
  for (const x of t.data.testResults || []) console.log('prova regole:', x.state, (x.debugMessages || []).join(' ').slice(0, 200));
}
