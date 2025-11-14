function normalizePrefix(prefix = '') {
  return prefix.normalize('NFC').toLowerCase();
}

function getContextKey(sequence, model) {
  const order = model.order;
  const startToken = model.startToken;
  const filler = startToken.repeat(order);
  const tail = sequence.slice(-order);
  return (filler + tail).slice(-order) || filler;
}

const distributionCache = new WeakMap();

function distributionEntries(distribution = {}) {
  if (!distribution) return [];
  const cached = distributionCache.get(distribution);
  if (cached) return cached;
  const total = Object.values(distribution).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    distributionCache.set(distribution, []);
    return [];
  }
  const entries = Object.entries(distribution)
    .map(([char, weight]) => ({ char, weight, probability: weight / total }))
    .sort((a, b) => b.probability - a.probability);
  distributionCache.set(distribution, entries);
  return entries;
}

function deterministicPick(distribution) {
  const entries = distributionEntries(distribution);
  return entries.length ? entries[0].char : null;
}

export function sampleNext(distribution, temperature = 1) {
  const entries = distributionEntries(distribution);
  if (!entries.length) return null;
  const adjusted = entries.map(({ char, probability }) => ({
    char,
    weight: Math.pow(probability, 1 / Math.max(temperature, 0.05)),
  }));
  const totalWeight = adjusted.reduce((sum, item) => sum + item.weight, 0);
  let threshold = Math.random() * totalWeight;
  for (const item of adjusted) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.char;
    }
  }
  return adjusted[adjusted.length - 1].char;
}

export function generateCompletion(prefix, model, options = {}) {
  const normalized = normalizePrefix(prefix);
  const {
    temperature = 0.9,
    maxLength = 18,
    deterministic = true,
  } = options;

  let suffix = '';
  for (let step = 0; step < maxLength; step += 1) {
    const ctxKey = getContextKey(normalized + suffix, model);
    const distribution = model.contexts[ctxKey];
    if (!distribution) break;
    const nextChar = deterministic
      ? deterministicPick(distribution)
      : sampleNext(distribution, temperature);
    if (!nextChar || nextChar === model.endToken) {
      break;
    }
    suffix += nextChar;
  }

  return {
    completion: prefix + suffix,
    suffix,
  };
}

export function generateSuggestions(prefix, model, options = {}) {
  const normalized = normalizePrefix(prefix);
  const {
    maxSuggestions = 6,
    maxDepth = 16,
  } = options;

  const queue = [{ fragment: '', logProb: 0 }];
  const seen = new Set();
  const suggestions = [];

  while (queue.length && suggestions.length < maxSuggestions) {
    queue.sort((a, b) => b.logProb - a.logProb);
    const node = queue.shift();
    const ctxKey = getContextKey(normalized + node.fragment, model);
    const distribution = model.contexts[ctxKey];
    if (!distribution) continue;
    const alpha = 0.45;
    const entries = Object.entries(distribution)
      .map(([char, weight]) => ({
        char,
        probability: (weight + alpha) / (Object.values(distribution).reduce((s, w) => s + w + alpha, 0))
      }))
      .sort((a, b) => b.probability - a.probability);

    for (const entry of entries) {
      const nextLogProb = node.logProb + Math.log(entry.probability);
      if (entry.char === model.endToken) {
        const suggestion = node.fragment.length > 0 ? prefix + node.fragment : prefix;
        if (!seen.has(suggestion) && suggestion.trim().length >= 2) {
          seen.add(suggestion);
          suggestions.push({
            completion: suggestion,
            suffix: node.fragment,
            score: Math.exp(nextLogProb),
          });
        }
      } else if (node.fragment.length + 1 <= maxDepth) {
        queue.push({
          fragment: node.fragment + entry.char,
          logProb: nextLogProb,
        });
      }
    }
  }

  return suggestions;
}

export function getDistributionForPrefix(prefix, model) {
  const normalized = normalizePrefix(prefix);
  const ctxKey = getContextKey(normalized, model);
  const distribution = model.contexts[ctxKey];
  if (!distribution) return null;
  return distributionEntries(distribution);
}
