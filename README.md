
# Markov Completion Studio
---

Markov Completion Studio is a lightweight web app that predicts word endings based on the beginning of a word using a Markov chain model. Suggestions are ranked by probability and displayed as interactive animated bubbles.

---

https://github.com/user-attachments/assets/055047ef-ee8e-4869-892c-9276df9d730e

## Features

* Custom typing zone (no classic text input)
* Automatic word completion using an n-order Markov model
* Probability-based ranking of suggestions
* Animated bubble visualization of predictions
* “Ghost completion” preview of the most likely continuation
* Probability display of the top suggestion
* Dictionary filtering to hide non-existing words
* Language switching (French / English)
* Light and dark mode with saved preference

---

## Run the project

Start any local web server in the project folder. Example:

```
npx serve .
```

Then open the shown URL (typically `http://localhost:3000`).

## Notes

* The model is based purely on character transitions learned from a word list.
* The dictionary filter prevents the display of invalid or nonsensical words.
* No external dependencies or frameworks are required.

