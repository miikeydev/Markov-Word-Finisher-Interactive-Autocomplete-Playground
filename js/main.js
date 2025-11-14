import { loadMarkovModel, getModelStats } from './markovModel.js';
import {
  generateCompletion,
  generateSuggestions,
  getDistributionForPrefix,
} from './markovPredict.js';
import {
  getState,
  setInputValue as setStateInput,
  setSuggestions,
  setActiveIndex,
  cycleActive,
  resetActive,
  setModelStats,
} from './state.js';
import * as ui from './ui.js';

let model = null;
const MIN_PREFIX_LENGTH = 2;

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
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...(lastArgs ?? []));
    }
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

function clearSuggestionsUI() {
  setSuggestions([]);
  setActiveIndex(-1);
  ui.renderSuggestions([], -1);
  ui.toggleEmptyState(false);
  ui.updateGhostCompletion('', '');
}

function applySuggestion(index) {
  const state = getState();
  const target = state.suggestions[index] ?? state.suggestions[0];
  if (!target) return;
  setStateInput(target.completion);
  ui.setInputValue(target.completion);
  ui.updateGhostCompletion('', '');
  resetActive();
  debouncedPredict.cancel();
  refreshSuggestions(target.completion);
}

function handleSuggestionClick(index) {
  applySuggestion(index);
  ui.focusInput();
}

function updateDistribution(prefixValue) {
  if (!model) return;
  const distribution = getDistributionForPrefix(prefixValue, model);
  ui.renderDistribution(distribution);
}

function syncGhost(prefixValue, suggestions) {
  if (!suggestions.length) {
    const completion = generateCompletion(prefixValue, model, { deterministic: true });
    const suffix = completion.suffix;
    ui.updateGhostCompletion(prefixValue, suffix);
    return;
  }
  const best = suggestions[0];
  const suffix = best.completion.slice(prefixValue.length);
  ui.updateGhostCompletion(prefixValue, suffix);
}

function refreshSuggestions(prefixValue) {
  if (!model) return;
  updateDistribution(prefixValue);
  if (prefixValue.trim().length < MIN_PREFIX_LENGTH) {
    clearSuggestionsUI();
    return;
  }
  const suggestions = generateSuggestions(prefixValue, model, {
    maxSuggestions: 8,
    maxDepth: 18,
  });
  setSuggestions(suggestions);
  const state = getState();
  ui.renderSuggestions(suggestions, state.activeIndex);
  ui.toggleEmptyState(suggestions.length === 0);
  syncGhost(prefixValue, suggestions);
}

const debouncedPredict = debounce(refreshSuggestions, 110);

function handleInput(event) {
  const value = event.target.value;
  setStateInput(value);
  resetActive();
  debouncedPredict(value);
}

function handleKeydown(event) {
  const state = getState();
  if (!state.suggestions.length && event.key !== 'Tab') {
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      {
        const nextIndex = cycleActive(1);
        ui.renderSuggestions(getState().suggestions, nextIndex);
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      {
        const nextIndex = cycleActive(-1);
        ui.renderSuggestions(getState().suggestions, nextIndex);
      }
      break;
    case 'Enter':
      if (getState().activeIndex >= 0) {
        event.preventDefault();
        applySuggestion(getState().activeIndex);
      }
      break;
    case 'Tab':
      if (model) {
        const stateAfter = getState();
        if (stateAfter.suggestions.length) {
          event.preventDefault();
          applySuggestion(0);
        }
      }
      break;
    default:
      break;
  }
}

function handleClear() {
  setStateInput('');
  ui.setInputValue('');
  clearSuggestionsUI();
  ui.focusInput();
  refreshSuggestions('');
}

async function bootstrap() {
  ui.toggleEmptyState(false);
  ui.renderDistribution(null);
  ui.updateGhostCompletion('', '');
  ui.bindInput(handleInput);
  ui.bindKeydown(handleKeydown);
  ui.bindClear(handleClear);
  ui.bindSuggestionClick(handleSuggestionClick);

  try {
    model = await loadMarkovModel();
    const stats = getModelStats(model);
    setModelStats(stats);
    ui.updateStats(stats);
  } catch (error) {
    console.error(error);
    ui.toggleEmptyState(true);
    ui.renderSuggestions([], -1);
    const message = document.getElementById('no-suggestion-message');
    if (message) {
      message.textContent = 'Erreur de chargement : ' + error.message;
    }
    return;
  }

  const initialValue = '';
  setStateInput(initialValue);
  refreshSuggestions(initialValue);
}

bootstrap();
