import { loadMarkovModel, getModelStats } from './markovModel.js';
import { generateSuggestions } from './markovPredict.js';
import { loadDictionary, dictionaryHasWord, dictionaryHasPrefix } from './dictionary.js';
import {
  getState,
  setInputValue as setStateInput,
  setSuggestions,
  cycleActive,
  resetActive,
  setModelStats,
  setWordProbability,
} from './state.js';
import * as ui from './ui.js';

const LANG_CONFIG = {
  fr: {
    label: 'FR',
    heroEyebrow: 'Atelier Markov',
    heroTitle: 'Atelier de complétion Markov',
    heroSubtitle: 'Saisissez un début de mot et observez les prolongements les plus probables proposés par le modèle de Markov.',
    placeholder: 'Commencez à taper…',
    emptyDefault: 'Aucune suggestion à afficher.',
    emptyDictionary: 'Aucun mot du dictionnaire ne correspond à ce préfixe.',
    modelUrl: 'markov_model.json',
    dictionaryUrl: 'francais.txt',
  },
  en: {
    label: 'EN',
    heroEyebrow: 'Markov Studio',
    heroTitle: 'Markov Completion Studio',
    heroSubtitle: 'Type the beginning of a word and watch the model propose the most likely endings.',
    placeholder: 'Start typing…',
    emptyDefault: 'No suggestions to display.',
    emptyDictionary: 'No dictionary word matches this prefix.',
    modelUrl: 'markov_model_en.json',
    dictionaryUrl: 'english.txt',
  },
};

const MIN_PREFIX_LENGTH = 1;
const LETTER_PATTERN = /^[a-zA-ZÀ-ÖØ-öø-ÿœŒæÆ]$/;

const models = {};
const dictionaries = {};
let currentLanguage = 'fr';
let currentLanguageConfig = LANG_CONFIG[currentLanguage];

function debounce(fn, delay = 110) {
  let timer = null;
  let lastArgs = null;
  const debounced = (...args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

function applySuggestion(index) {
  const state = getState();
  const target = state.suggestions[index] ?? state.suggestions[0];
  if (!target) return;
  debouncedPredict.cancel();
  setStateInput(target.completion);
  ui.renderCapsules(target.completion);
  resetActive();
  refreshSuggestions(target.completion);
  ui.focusStage();
}

function filterSuggestionsWithDictionary(list) {
  const dictionary = dictionaries[currentLanguage];
  if (!dictionary) return list;
  return list.filter((suggestion) => {
    const completion = suggestion.completion;
    return dictionaryHasWord(dictionary, completion) || dictionaryHasPrefix(dictionary, completion);
  });
}

function updateEmptyStateMessage(useDictionaryMessage) {
  const message = useDictionaryMessage
    ? currentLanguageConfig.emptyDictionary
    : currentLanguageConfig.emptyDefault;
  ui.setEmptyStateMessage(message);
}

function getGhostCompletionCandidate(suggestions, activeIndex) {
  if (!suggestions.length) return '';
  if (activeIndex >= 0 && activeIndex < suggestions.length) {
    return suggestions[activeIndex]?.completion || '';
  }
  return suggestions[0]?.completion || '';
}

function updateProbabilityDisplay(probability) {
  setWordProbability(probability);
  ui.updateProbability(probability);
}

function refreshSuggestions(prefixValue) {
  const model = models[currentLanguage];
  if (!model) return;
  const dictionary = dictionaries[currentLanguage];

  if (prefixValue.trim().length < MIN_PREFIX_LENGTH) {
    setSuggestions([]);
    resetActive();
    ui.renderSuggestions([], -1);
    ui.toggleEmptyState(false);
    updateEmptyStateMessage(false);
    ui.updateGhostSuffix('', '');
    updateProbabilityDisplay(0);
    return;
  }

  const rawSuggestions = generateSuggestions(prefixValue, model, {
    maxSuggestions: 8,
    maxDepth: 22,
  });

  const filteredSuggestions = filterSuggestionsWithDictionary(rawSuggestions);
  const totalScore = filteredSuggestions.reduce((sum, item) => sum + (item.score || 0), 0);
  const suggestions = filteredSuggestions.map((item) => ({
    ...item,
    probability: totalScore > 0 ? item.score / totalScore : 0,
  }));

  setSuggestions(suggestions);
  resetActive();
  const state = getState();
  ui.renderSuggestions(suggestions, state.activeIndex);
  const dictionaryAvailable = Boolean(dictionary?.words?.size);
  const noSuggestions = suggestions.length === 0;
  const dictionaryMismatch = Boolean(dictionaryAvailable && rawSuggestions.length && !suggestions.length);
  ui.toggleEmptyState(noSuggestions);
  updateEmptyStateMessage(dictionaryMismatch);
  ui.updateGhostSuffix(prefixValue, getGhostCompletionCandidate(suggestions, state.activeIndex));
  updateProbabilityDisplay(suggestions[0]?.probability || 0);
}

const debouncedPredict = debounce(refreshSuggestions, 120);

function commitValue(value) {
  setStateInput(value);
  ui.renderCapsules(value);
  resetActive();
  debouncedPredict(value);
}

function handleCharacterInput(char) {
  const value = getState().inputValue + char;
  commitValue(value);
}

function handleBackspace() {
  const value = getState().inputValue;
  if (!value) return;
  commitValue(value.slice(0, -1));
}

function handleStageKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const key = event.key;
  const state = getState();

  if (LETTER_PATTERN.test(key)) {
    event.preventDefault();
    handleCharacterInput(key.toLowerCase());
    return;
  }

  switch (key) {
    case 'Backspace':
      event.preventDefault();
      handleBackspace();
      break;
    case 'Tab':
      if (state.suggestions.length) {
        event.preventDefault();
        applySuggestion(0);
      }
      break;
    case 'Enter':
      if (state.activeIndex >= 0) {
        event.preventDefault();
        applySuggestion(state.activeIndex);
      }
      break;
    case 'ArrowDown':
      if (!state.suggestions.length) break;
      event.preventDefault();
      {
        const nextIndex = cycleActive(1);
        const freshState = getState();
        ui.renderSuggestions(freshState.suggestions, nextIndex);
        ui.updateGhostSuffix(freshState.inputValue, getGhostCompletionCandidate(freshState.suggestions, nextIndex));
        updateProbabilityDisplay(freshState.suggestions[nextIndex]?.probability || freshState.suggestions[0]?.probability || 0);
      }
      break;
    case 'ArrowUp':
      if (!state.suggestions.length) break;
      event.preventDefault();
      {
        const nextIndex = cycleActive(-1);
        const freshState = getState();
        ui.renderSuggestions(freshState.suggestions, nextIndex);
        ui.updateGhostSuffix(freshState.inputValue, getGhostCompletionCandidate(freshState.suggestions, nextIndex));
        updateProbabilityDisplay(freshState.suggestions[nextIndex]?.probability || freshState.suggestions[0]?.probability || 0);
      }
      break;
    case 'Escape':
      event.preventDefault();
      commitValue('');
      updateProbabilityDisplay(0);
      break;
    default:
      break;
  }
}

function handleSuggestionClick(index) {
  applySuggestion(index);
}

function applyLanguage(lang) {
  if (!LANG_CONFIG[lang]) return;
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  currentLanguageConfig = LANG_CONFIG[lang];
  document.documentElement.setAttribute('lang', lang);
  ui.setActiveLanguageButton(lang);
  ui.updateLanguageTexts(currentLanguageConfig);
  updateEmptyStateMessage(false);
  const stats = models[lang] ? getModelStats(models[lang]) : null;
  if (stats) {
    setModelStats(stats);
    ui.updateStats(stats);
  }
  const value = getState().inputValue;
  debouncedPredict.cancel();
  refreshSuggestions(value);
}

async function loadResources() {
  const entries = Object.entries(LANG_CONFIG);
  await Promise.all(
    entries.map(([lang, config]) =>
      Promise.all([
        loadMarkovModel(config.modelUrl).then((model) => {
          models[lang] = model;
        }),
        loadDictionary(config.dictionaryUrl).then((dict) => {
          dictionaries[lang] = dict;
        }),
      ])
    )
  );
}

async function bootstrap() {
  ui.renderCapsules('');
  ui.updateProbability(0);
  ui.toggleEmptyState(false);
  ui.focusStage();
  ui.updateLanguageTexts(currentLanguageConfig);
  ui.setActiveLanguageButton(currentLanguage);
  document.documentElement.setAttribute('lang', currentLanguage);
  ui.bindStageKeydown(handleStageKeydown);
  ui.bindStageClick(() => ui.focusStage());
  ui.bindSuggestionClick(handleSuggestionClick);
  ui.bindLanguageToggle(() => {
    const next = currentLanguage === 'fr' ? 'en' : 'fr';
    applyLanguage(next);
  });

  try {
    await loadResources();
    const stats = getModelStats(models[currentLanguage]);
    if (stats) {
      setModelStats(stats);
      ui.updateStats(stats);
    }
  } catch (error) {
    console.error(error);
    ui.toggleEmptyState(true);
    const message = document.getElementById('no-suggestion-message');
    if (message) {
      message.textContent = 'Erreur de chargement : ' + error.message;
    }
    return;
  }

  commitValue('');
}

bootstrap();
