import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { formatPersonDates } from './data.js';

const COLORS = {
  born: '#2f6fed',
  dead: '#d94b4b',
};

export function renderGraph({ container, graph, onSelect }) {
  container.__graphSimulation?.stop();
  container.replaceChildren();

  if (!graph.nodes.length) {
    const empty = document.createElement('div');
    empty.className = 'graph-empty';
    empty.textContent = "Aucune personne trouvée pour cette date. Essayez un autre jour ou augmentez un peu la limite.";
    container.append(empty);
    return;
  }

  const width = Math.max(container.clientWidth || 960, 960);
  const height = 720;
  const radius = 34;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', [0, 0, width, height]);

  const defs = svg.append('defs');
  graph.nodes.forEach((node) => {
    if (!node.image) {
      return;
    }

    const pattern = defs
      .append('pattern')
      .attr('id', `avatar-${node.id}`)
      .attr('patternUnits', 'objectBoundingBox')
      .attr('width', 1)
      .attr('height', 1);

    pattern
      .append('image')
      .attr('href', node.image)
      .attr('width', radius * 2)
      .attr('height', radius * 2)
      .attr('aria-hidden', true)
      .attr('focusable', false)
      .attr('preserveAspectRatio', 'xMidYMid slice');
  });

  const links = graph.links.map((link) => ({ ...link }));
  const nodes = graph.nodes.map((node) => ({ ...node }));

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(150).strength(0.28))
    .force('charge', d3.forceManyBody().strength(-280))
    .force('collide', d3.forceCollide(radius + 48))
    .force('x', d3.forceX((node) => (node.role === 'born' ? width * 0.28 : width * 0.72)).strength(0.28))
    .force('y', d3.forceY(height / 2).strength(0.08));
  container.__graphSimulation = simulation;

  const link = svg
    .append('g')
    .attr('stroke', 'rgba(72, 61, 54, 0.2)')
    .attr('stroke-width', 1.4)
    .selectAll('line')
    .data(links)
    .join('line');

  const node = svg
    .append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'graph-node')
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.label}, ${formatPersonDates(d)}`)
    .style('cursor', 'pointer')
    .call(drag(simulation));

  node
    .append('circle')
    .attr('r', radius)
    .attr('fill', (d) => (d.image ? `url(#avatar-${d.id})` : COLORS[d.role]))
    .attr('stroke', (d) => COLORS[d.role])
    .attr('stroke-width', 4);

  node
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', radius + 18)
    .attr('fill', '#1d1b1a')
    .style('font-size', '12px')
    .style('font-weight', '700')
    .text((d) => truncate(d.label, 18));

  node
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', radius + 34)
    .attr('fill', '#665c54')
    .style('font-size', '11px')
    .text((d) => shortDates(d));

  node
    .on('click', (_, selectedNode) => onSelect?.(selectedNode))
    .on('keydown', (event, selectedNode) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(selectedNode);
      }
    });

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });
}

function shortDates(person) {
  const birthYear = yearFromValue(person.birthDate);
  const deathYear = yearFromValue(person.deathDate);
  return `${birthYear ?? '?'} — ${deathYear ?? '?'}`;
}

function yearFromValue(raw) {
  if (!raw) {
    return null;
  }
  return raw.slice(0, 4);
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function drag(simulation) {
  function dragStarted(event) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag().on('start', dragStarted).on('drag', dragged).on('end', dragEnded);
}

export function renderDetails(container, person) {
  if (!person) {
    return;
  }

  container.replaceChildren();

  const card = document.createElement('div');
  card.className = 'details-card';

  const pill = document.createElement('span');
  pill.className = `pill ${person.role === 'born' ? 'pill-born' : 'pill-dead'}`;
  pill.textContent = person.role === 'born' ? 'Né ce jour-là' : 'Mort ce jour-là';
  card.append(pill);

  if (person.image) {
    const image = document.createElement('img');
    image.src = person.image;
    image.alt = `Portrait de ${person.label}`;
    card.append(image);
  }

  const textBlock = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = person.label;
  const meta = document.createElement('p');
  meta.className = 'details-meta';
  meta.textContent = formatPersonDates(person);
  textBlock.append(heading, meta);
  card.append(textBlock);

  if (person.wikidataUrl) {
    const linkParagraph = document.createElement('p');
    const link = document.createElement('a');
    link.href = person.wikidataUrl;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.textContent = 'Voir la fiche Wikidata';
    linkParagraph.append(link);
    card.append(linkParagraph);
  }

  container.append(card);
}
