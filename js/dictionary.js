const cacheMap = new Map();

function normalize(word = '') {
  return word.normalize('NFC').trim().toLowerCase();
}

function parseList(rawText) {
  const words = new Set();
  const prefixes = new Set();
  rawText.split(/\r?\n/).forEach((line) => {
    const cleaned = normalize(line);
    if (!cleaned.length) return;
    words.add(cleaned);
    for (let i = 1; i <= cleaned.length; i += 1) {
      prefixes.add(cleaned.slice(0, i));
    }
  });
  return { words, prefixes };
}

export async function loadDictionary(url = 'francais.txt') {
  const cached = cacheMap.get(url);
  if (cached?.data) return cached.data;
  if (cached?.promise) return cached.promise;

  const promise = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Impossible de charger le dictionnaire (${response.status})`);
      const text = await response.text();
      const data = parseList(text);
      cacheMap.set(url, { data });
      return data;
    })
    .catch((error) => {
      cacheMap.delete(url);
      throw error;
    });

  cacheMap.set(url, { promise });
  return promise;
}

export function dictionaryHasWord(dictionary, word) {
  if (!dictionary?.words) return false;
  return dictionary.words.has(normalize(word));
}

export function dictionaryHasPrefix(dictionary, word) {
  if (!dictionary?.prefixes) return false;
  return dictionary.prefixes.has(normalize(word));
}

export function dictionaryHas(dictionary, word) {
  return dictionaryHasWord(dictionary, word);
}
