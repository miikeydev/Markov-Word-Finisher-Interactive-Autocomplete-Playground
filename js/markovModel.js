const modelCache = {
  data: null,
  promise: null,
};

function computeTotals(contexts = {}) {
  let transitions = 0;
  for (const dist of Object.values(contexts)) {
    transitions += Object.values(dist).reduce((sum, weight) => sum + weight, 0);
  }
  return { contexts: Object.keys(contexts).length, transitions };
}

function normalizeModel(raw) {
  const contexts = raw.contexts ?? {};
  const totals = computeTotals(contexts);
  return {
    order: raw.order ?? 2,
    startToken: raw.startToken ?? '^',
    endToken: raw.endToken ?? '$',
    contexts,
    alphabet: raw.alphabet ?? [],
    metadata: {
      totalTransitions: raw.metadata?.totalTransitions ?? totals.transitions,
      contexts: raw.metadata?.contexts ?? totals.contexts,
      source: raw.metadata?.source ?? 'embedded',
    },
  };
}

export async function loadMarkovModel(url = 'markov_model.json') {
  if (modelCache.data) {
    return modelCache.data;
  }

  if (!modelCache.promise) {
    modelCache.promise = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Impossible de charger le modèle (${response.status})`);
        }
        const json = await response.json();
        modelCache.data = Object.freeze(normalizeModel(json));
        modelCache.promise = null;
        return modelCache.data;
      })
      .catch((error) => {
        modelCache.promise = null;
        throw error;
      });
  }

  return modelCache.promise;
}

export function getModelStats(model) {
  if (!model) return null;
  return {
    order: model.order,
    contexts: model.metadata.contexts,
    transitions: model.metadata.totalTransitions,
  };
}
