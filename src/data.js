export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export function sanitizeLimit(limit) {
  const value = Number.parseInt(limit, 10);
  if (Number.isNaN(value)) {
    return 6;
  }
  return Math.max(2, Math.min(12, value));
}

export function buildSparqlQuery({ day, month, limit }) {
  const safeDay = Number.parseInt(day, 10);
  const safeMonth = Number.parseInt(month, 10);
  const safeLimit = sanitizeLimit(limit);

  return `
SELECT ?person ?personLabel ?role ?birthDate ?deathDate ?image WHERE {
  {
    SELECT DISTINCT ?person ?role ?birthDate ?deathDate ?image WHERE {
      BIND("born" AS ?role)
      ?person wdt:P31 wd:Q5;
              wdt:P569 ?birthDate.
      FILTER(DAY(?birthDate) = ${safeDay} && MONTH(?birthDate) = ${safeMonth})
      OPTIONAL { ?person wdt:P570 ?deathDate. }
      OPTIONAL { ?person wdt:P18 ?image. }
    }
    LIMIT ${safeLimit}
  }
  UNION
  {
    SELECT DISTINCT ?person ?role ?birthDate ?deathDate ?image WHERE {
      BIND("dead" AS ?role)
      ?person wdt:P31 wd:Q5;
              wdt:P570 ?deathDate.
      FILTER(DAY(?deathDate) = ${safeDay} && MONTH(?deathDate) = ${safeMonth})
      OPTIONAL { ?person wdt:P569 ?birthDate. }
      OPTIONAL { ?person wdt:P18 ?image. }
    }
    LIMIT ${safeLimit}
  }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],fr,en". }
}
ORDER BY ?role ?personLabel
  `.trim();
}

export async function fetchIncarnations({ day, month, limit, endpoint = WIKIDATA_ENDPOINT }) {
  const query = buildSparqlQuery({ day, month, limit });
  const url = `${endpoint}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/sparql-results+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata a répondu ${response.status}.`);
  }

  const payload = await response.json();
  return normalizeResults(payload?.results?.bindings ?? [], { day, month });
}

export function normalizeResults(bindings, { day, month }) {
  const bornPeople = [];
  const deadPeople = [];
  const seen = new Set();

  for (const binding of bindings) {
    const person = toPerson(binding);
    const dedupeKey = `${person.role}:${person.id}`;

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    if (person.role === 'born') {
      bornPeople.push(person);
    } else if (person.role === 'dead') {
      deadPeople.push(person);
    }
  }

  return {
    day: Number.parseInt(day, 10),
    month: Number.parseInt(month, 10),
    sharedDateLabel: new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(new Date(Date.UTC(2024, Number.parseInt(month, 10) - 1, Number.parseInt(day, 10)))),
    bornPeople,
    deadPeople,
  };
}

export function buildGraphData({ bornPeople, deadPeople }) {
  const nodes = [...bornPeople, ...deadPeople];
  const links = [];

  for (const bornPerson of bornPeople) {
    for (const deadPerson of deadPeople) {
      if (bornPerson.id !== deadPerson.id) {
        links.push({
          source: bornPerson.id,
          target: deadPerson.id,
        });
      }
    }
  }

  return { nodes, links };
}

export function formatPersonDates(person) {
  const birth = formatDate(person.birthDate) ?? 'date de naissance inconnue';
  const death = formatDate(person.deathDate) ?? 'date de mort inconnue';
  return `${birth} — ${death}`;
}

export function formatDate(raw) {
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
  }).format(date);
}

export function toPerson(binding) {
  return {
    id: extractEntityId(binding.person?.value),
    label: binding.personLabel?.value ?? 'Sans nom',
    role: binding.role?.value ?? 'born',
    birthDate: binding.birthDate?.value ?? null,
    deathDate: binding.deathDate?.value ?? null,
    image: binding.image?.value ?? null,
    wikidataUrl: binding.person?.value ?? null,
  };
}

export function extractEntityId(uri) {
  return uri?.split('/').at(-1) ?? '';
}
