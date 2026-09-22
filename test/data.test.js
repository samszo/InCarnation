import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGraphData,
  buildSparqlQuery,
  fetchIncarnations,
  formatDate,
  normalizeResults,
  sanitizeLimit,
  sanitizeHttpUrl,
} from '../src/data.js';

test('sanitizeLimit keeps value inside supported bounds', () => {
  assert.equal(sanitizeLimit('1'), 2);
  assert.equal(sanitizeLimit('6'), 6);
  assert.equal(sanitizeLimit('99'), 12);
  assert.equal(sanitizeLimit('abc'), 6);
});

test('buildSparqlQuery injects day month and bounded limit', () => {
  const query = buildSparqlQuery({ day: 8, month: 8, limit: 99 });

  assert.match(query, /DAY\(\?birthDate\) = 8 && MONTH\(\?birthDate\) = 8/);
  assert.match(query, /DAY\(\?deathDate\) = 8 && MONTH\(\?deathDate\) = 8/);
  assert.match(query, /LIMIT 12/);
});

test('buildSparqlQuery rejects invalid day or month values', () => {
  assert.throws(() => buildSparqlQuery({ day: 'x', month: 8, limit: 6 }), /jour/i);
  assert.throws(() => buildSparqlQuery({ day: 8, month: 44, limit: 6 }), /mois/i);
  assert.throws(() => buildSparqlQuery({ day: 31, month: 4, limit: 6 }), /invalide/i);
});

test('normalizeResults separates born and dead people without duplicates', () => {
  const results = normalizeResults(
    [
      {
        person: { value: 'http://www.wikidata.org/entity/Q1' },
        personLabel: { value: 'Ada Lovelace' },
        role: { value: 'born' },
        birthDate: { value: '1815-12-10T00:00:00Z' },
      },
      {
        person: { value: 'http://www.wikidata.org/entity/Q1' },
        personLabel: { value: 'Ada Lovelace' },
        role: { value: 'born' },
        birthDate: { value: '1815-12-10T00:00:00Z' },
      },
      {
        person: { value: 'http://www.wikidata.org/entity/Q2' },
        personLabel: { value: 'Alfred Nobel' },
        role: { value: 'dead' },
        deathDate: { value: '1896-12-10T00:00:00Z' },
      },
    ],
    { day: 10, month: 12 },
  );

  assert.equal(results.bornPeople.length, 1);
  assert.equal(results.deadPeople.length, 1);
  assert.equal(results.sharedDateLabel, '10 décembre');
});

test('fetchIncarnations calls the endpoint with the expected headers and normalizes the payload', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          results: {
            bindings: [
              {
                person: { value: 'https://www.wikidata.org/entity/Q1?foo=1' },
                personLabel: { value: 'Ada Lovelace' },
                role: { value: 'born' },
                birthDate: { value: '1815-12-10T00:00:00Z' },
              },
            ],
          },
        };
      },
    };
  };

  try {
    const results = await fetchIncarnations({
      day: 10,
      month: 12,
      limit: 3,
      endpoint: 'https://example.test/sparql',
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /^https:\/\/example\.test\/sparql\?format=json&query=/);
    assert.equal(calls[0].options.headers.accept, 'application/sparql-results+json');
    assert.equal(results.bornPeople[0].id, 'Q1');
    assert.equal(results.sharedDateLabel, '10 décembre');
  } finally {
    global.fetch = originalFetch;
  }
});

test('buildGraphData links every born person to every dead person', () => {
  const graph = buildGraphData({
    bornPeople: [
      { id: 'Q1', label: 'Ada', role: 'born' },
      { id: 'Q2', label: 'Grace', role: 'born' },
    ],
    deadPeople: [{ id: 'Q3', label: 'Nobel', role: 'dead' }],
  });

  assert.equal(graph.nodes.length, 3);
  assert.deepEqual(graph.links, [
    { source: 'Q1', target: 'Q3' },
    { source: 'Q2', target: 'Q3' },
  ]);
});

test('formatDate keeps Wikidata UTC dates stable and sanitizeHttpUrl filters unsafe URLs', () => {
  assert.equal(formatDate('1896-12-10T00:00:00Z'), '10 décembre 1896');
  assert.equal(sanitizeHttpUrl('http://www.wikidata.org/entity/Q1'), 'http://www.wikidata.org/entity/Q1');
  assert.equal(sanitizeHttpUrl('https://www.wikidata.org/entity/Q42'), 'https://www.wikidata.org/entity/Q42');
  assert.equal(sanitizeHttpUrl('://broken-url'), null);
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), null);
});

test('fetchIncarnations throws on non-OK HTTP responses', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });

  try {
    await assert.rejects(
      () => fetchIncarnations({ day: 10, month: 12, limit: 3, endpoint: 'https://example.test/sparql' }),
      /503/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
