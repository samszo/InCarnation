export async function handleSearchSubmission({
  day,
  month,
  limit,
  statusNode,
  summaryNode,
  graphNode,
  detailsNode,
  fetchIncarnationsFn,
  buildGraphDataFn,
  renderGraphFn,
  renderDetailsFn,
  renderErrorDetailsFn,
}) {
  statusNode.textContent = 'Recherche en cours dans Wikidata…';
  summaryNode.textContent = '';

  try {
    const results = await fetchIncarnationsFn({ day, month, limit });
    const graph = buildGraphDataFn(results);

    statusNode.textContent = `Date partagée : ${results.sharedDateLabel}`;
    summaryNode.textContent = `${results.bornPeople.length} naissance(s), ${results.deadPeople.length} décès, ${graph.links.length} lien(s) potentiels affichés.`;

    renderGraphFn({
      container: graphNode,
      graph,
      onSelect: (person) => renderDetailsFn(detailsNode, person),
    });

    return { ok: true, results, graph };
  } catch (error) {
    graphNode.__graphSimulation?.stop();
    graphNode.__graphSimulation = null;
    graphNode.replaceChildren();
    renderErrorDetailsFn?.(detailsNode, error);
    statusNode.textContent = 'Impossible de charger les données.';
    summaryNode.textContent = 'Vérifiez votre connexion ou réessayez avec une autre date.';
    return { ok: false, error };
  }
}
