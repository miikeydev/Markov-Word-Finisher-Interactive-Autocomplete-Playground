import { loadMarkovModel, getModelStats } from './markovModel.js';
import { generateSuggestions } from './markovPredict.js';
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

let model = null;
const MIN_PREFIX_LENGTH = 1;
const LETTER_PATTERN = /^[a-zA-ZÀ-ÖØ-öø-ÿœŒæÆ]$/;

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

function updateProbabilityDisplay(probability) {
  setWordProbability(probability);
  ui.updateProbability(probability);
}

function refreshSuggestions(prefixValue) {
  if (!model) return;

  if (prefixValue.trim().length < MIN_PREFIX_LENGTH) {
    setSuggestions([]);
    resetActive();
    ui.renderSuggestions([], -1);
    ui.toggleEmptyState(false);
    updateProbabilityDisplay(0);
    return;
  }

  const rawSuggestions = generateSuggestions(prefixValue, model, {
    maxSuggestions: 8,
    maxDepth: 22,
  });

  const totalScore = rawSuggestions.reduce((sum, item) => sum + (item.score || 0), 0);
  const suggestions = rawSuggestions.map((item) => ({
    ...item,
    probability: totalScore > 0 ? item.score / totalScore : 0,
  }));

  setSuggestions(suggestions);
  resetActive();
  const state = getState();
  ui.renderSuggestions(suggestions, state.activeIndex);
  ui.toggleEmptyState(suggestions.length === 0);
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

async function bootstrap() {
  ui.renderCapsules('');
  ui.updateProbability(0);
  ui.toggleEmptyState(false);
  ui.focusStage();

  ui.bindStageKeydown(handleStageKeydown);
  ui.bindStageClick(() => ui.focusStage());
  ui.bindSuggestionClick(handleSuggestionClick);

  try {
    model = await loadMarkovModel();
    const stats = getModelStats(model);
    setModelStats(stats);
    ui.updateStats(stats);
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
