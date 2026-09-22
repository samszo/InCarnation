import { buildGraphData, fetchIncarnations, sanitizeLimit } from './data.js';
import { renderDetails, renderGraph } from './graph.js';
import { handleSearchSubmission } from './ui.js';

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

  await handleSearchSubmission({
    day,
    month,
    limit,
    statusNode,
    summaryNode,
    graphNode,
    detailsNode,
    fetchIncarnationsFn: fetchIncarnations,
    buildGraphDataFn: buildGraphData,
    renderGraphFn: renderGraph,
    renderDetailsFn: renderDetails,
    renderErrorDetailsFn: renderErrorDetails,
  });
});

function renderErrorDetails(container, error) {
  container.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = 'Une erreur est survenue';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'Erreur inconnue';

  container.append(title, message);
}
