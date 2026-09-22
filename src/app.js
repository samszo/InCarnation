import { buildGraphData, fetchIncarnations, sanitizeLimit } from './data.js';
import { renderDetails, renderGraph } from './graph.js';

const form = document.querySelector('#search-form');
const dayInput = document.querySelector('#day');
const monthInput = document.querySelector('#month');
const limitInput = document.querySelector('#limit');
const statusNode = document.querySelector('#status');
const summaryNode = document.querySelector('#summary');
const graphNode = document.querySelector('#graph');
const detailsNode = document.querySelector('#details');

const now = new Date();
dayInput.value = String(now.getUTCDate());
monthInput.value = String(now.getUTCMonth() + 1);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const day = Number.parseInt(dayInput.value, 10);
  const month = Number.parseInt(monthInput.value, 10);
  const limit = sanitizeLimit(limitInput.value);
  limitInput.value = String(limit);

  statusNode.textContent = 'Recherche en cours dans Wikidata…';
  summaryNode.textContent = '';

  try {
    const results = await fetchIncarnations({ day, month, limit });
    const graph = buildGraphData(results);

    statusNode.textContent = `Date partagée : ${results.sharedDateLabel}`;
    summaryNode.textContent = `${results.bornPeople.length} naissance(s), ${results.deadPeople.length} décès, ${graph.links.length} lien(s) potentiels affichés.`;

    renderGraph({
      container: graphNode,
      graph,
      onSelect: (person) => renderDetails(detailsNode, person),
    });
  } catch (error) {
    graphNode.replaceChildren();
    detailsNode.replaceChildren();

    const title = document.createElement('h2');
    title.textContent = 'Une erreur est survenue';
    const message = document.createElement('p');
    message.textContent = error instanceof Error ? error.message : 'Erreur inconnue';

    detailsNode.append(title, message);
    statusNode.textContent = 'Impossible de charger les données.';
    summaryNode.textContent = 'Vérifiez votre connexion ou réessayez avec une autre date.';
  }
});
