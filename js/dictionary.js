const cache = {
  promise: null,
  words: null,
};

function normalize(word = '') {
  return word.normalize('NFC').trim().toLowerCase();
}

function parseList(rawText) {
  const set = new Set();
  rawText.split(/\r?\n/).forEach((line) => {
    const cleaned = normalize(line);
    if (cleaned.length) {
      set.add(cleaned);
    }
  });
  return set;
}

export async function loadDictionary(url = 'francais.txt') {
  if (cache.words) return cache.words;
  if (!cache.promise) {
    cache.promise = fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Impossible de charger le dictionnaire (${response.status})`);
        const text = await response.text();
        cache.words = parseList(text);
        cache.promise = null;
        return cache.words;
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }
  return cache.promise;
}

export function dictionaryHas(dictionary, word) {
  if (!dictionary) return true;
  return dictionary.has(normalize(word));
}
