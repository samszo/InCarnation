import test from 'node:test';
import assert from 'node:assert/strict';

import { handleSearchSubmission } from '../src/ui.js';

test('handleSearchSubmission updates UI state on success', async () => {
  const statusNode = { textContent: '' };
  const summaryNode = { textContent: '' };
  const graphNode = { replaceChildrenCalled: false, replaceChildren() { this.replaceChildrenCalled = true; } };
  const detailsNode = {};
  const renderCalls = [];

  const result = await handleSearchSubmission({
    day: 8,
    month: 8,
    limit: 4,
    statusNode,
    summaryNode,
    graphNode,
    detailsNode,
    fetchIncarnationsFn: async () => {
      assert.equal(statusNode.textContent, 'Recherche en cours dans Wikidata…');
      assert.equal(summaryNode.textContent, '');
      return {
        sharedDateLabel: '8 août',
        bornPeople: [{ id: 'Q1', label: 'Ada', role: 'born' }],
        deadPeople: [{ id: 'Q2', label: 'Nobel', role: 'dead' }],
      };
    },
    buildGraphDataFn: (results) => ({ nodes: [...results.bornPeople, ...results.deadPeople], links: [{ source: 'Q1', target: 'Q2' }] }),
    renderGraphFn: (payload) => renderCalls.push(payload),
    renderDetailsFn: () => {},
    renderErrorDetailsFn: () => assert.fail('error renderer should not be called on success'),
  });

  assert.equal(result.ok, true);
  assert.equal(statusNode.textContent, 'Date partagée : 8 août');
  assert.equal(summaryNode.textContent, '1 naissance(s), 1 décès, 1 lien(s) potentiels affichés.');
  assert.equal(renderCalls.length, 1);
  assert.equal(graphNode.replaceChildrenCalled, false);
});

test('handleSearchSubmission updates UI state on error', async () => {
  const statusNode = { textContent: '' };
  const summaryNode = { textContent: '' };
  const graphNode = { replaceChildrenCalled: false, replaceChildren() { this.replaceChildrenCalled = true; } };
  const detailsNode = {};
  let renderedError = null;

  const result = await handleSearchSubmission({
    day: 8,
    month: 8,
    limit: 4,
    statusNode,
    summaryNode,
    graphNode,
    detailsNode,
    fetchIncarnationsFn: async () => {
      assert.equal(statusNode.textContent, 'Recherche en cours dans Wikidata…');
      throw new Error('Service indisponible');
    },
    buildGraphDataFn: () => assert.fail('graph builder should not run on error'),
    renderGraphFn: () => assert.fail('graph renderer should not run on error'),
    renderDetailsFn: () => {},
    renderErrorDetailsFn: (_container, error) => {
      renderedError = error.message;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(renderedError, 'Service indisponible');
  assert.equal(graphNode.replaceChildrenCalled, true);
  assert.equal(statusNode.textContent, 'Impossible de charger les données.');
  assert.equal(summaryNode.textContent, 'Vérifiez votre connexion ou réessayez avec une autre date.');
});
