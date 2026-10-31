import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardSource = readFileSync(
  new URL('../src/pages/agency/AgencyDashboard.jsx', import.meta.url),
  'utf8'
);

test('agency registration renders upload controls for all five Agency KYC documents', () => {
  const documentDefinitions = dashboardSource.match(/const AGENCY_DOCUMENTS = \[([\s\S]*?)\n\];/);
  assert.ok(documentDefinitions, 'Agency document definitions should exist');

  const definitions = documentDefinitions[1];
  const requiredTypes = [
    'ownerAadhaar',
    'businessRegistration',
    'tradeLicense',
    'gstCertificate',
    'taxId'
  ];

  for (const type of requiredTypes) {
    assert.match(definitions, new RegExp(`type: '${type}'`), `${type} should be defined`);
  }
  assert.match(definitions, /label: 'Owner Aadhaar \/ Identity Proof'/);
  assert.match(definitions, /label: 'Business Registration Certificate'/);
  assert.match(definitions, /label: 'Trade Licence'/);
  assert.match(definitions, /label: 'GST Certificate'/);
  assert.match(definitions, /label: 'Tax ID \/ PAN Document'/);

  const registrationForm = dashboardSource.slice(
    dashboardSource.indexOf('if (!agency)'),
    dashboardSource.indexOf('// Filtered views')
  );
  assert.match(registrationForm, /AGENCY_DOCUMENTS\.map/);
  assert.match(registrationForm, /type="file"/);
  assert.match(registrationForm, /registration-document-\$\{type\}/);
});

test('Owner Aadhaar is required while the other four registration documents are optional', () => {
  const documentDefinitions = dashboardSource.match(/const AGENCY_DOCUMENTS = \[([\s\S]*?)\n\];/);
  assert.ok(documentDefinitions, 'Agency document definitions should exist');
  const definitions = documentDefinitions[1];

  assert.match(definitions, /type: 'ownerAadhaar'[\s\S]*?optional: false/);
  for (const type of ['businessRegistration', 'tradeLicense', 'gstCertificate', 'taxId']) {
    assert.match(definitions, new RegExp(`type: '${type}'[\\s\\S]*?optional: true`));
  }
  assert.match(dashboardSource, /if \(!registrationDocuments\.ownerAadhaar\)/);
});
