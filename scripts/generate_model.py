#!/usr/bin/env python3
"""Génère markov_model.json à partir d'une liste de mots."""
import argparse
import json
import unicodedata
from pathlib import Path

ALLOWED_CHARS = set(
    "abcdefghijklmnopqrstuvwxyzàâçéèêëîïôöùûüÿœæ"
)

def sanitize(word: str) -> str:
    normalized = unicodedata.normalize('NFC', word.strip().lower())
    filtered = ''.join(ch for ch in normalized if ch in ALLOWED_CHARS)
    return filtered

def build_model(words, order, start_token='^', end_token='$'):
    contexts = {}
    alphabet = set()

    for raw_word in words:
        word = sanitize(raw_word)
        if len(word) < 2:
            continue
        padded = f"{start_token * order}{word}{end_token}"
        for i in range(len(padded) - order):
            ctx = padded[i : i + order]
            nxt = padded[i + order]
            contexts.setdefault(ctx, {})
            contexts[ctx][nxt] = contexts[ctx].get(nxt, 0) + 1
            if nxt not in (start_token, end_token):
                alphabet.add(nxt)

    transitions = sum(sum(dist.values()) for dist in contexts.values())
    model = {
        'order': order,
        'startToken': start_token,
        'endToken': end_token,
        'contexts': contexts,
        'alphabet': sorted(alphabet),
        'metadata': {
            'source': 'francais.txt',
            'vocabularySize': len(words),
            'contexts': len(contexts),
            'totalTransitions': transitions,
        },
    }
    return model


def main():
    parser = argparse.ArgumentParser(description='Générer markov_model.json depuis un dictionnaire texte')
    parser.add_argument('--input', '-i', default='francais.txt', help='Fichier texte avec un mot par ligne')
    parser.add_argument('--output', '-o', default='markov_model.json', help='Fichier JSON de sortie')
    parser.add_argument('--order', '-n', type=int, default=3, help='Ordre du modèle (longueur du contexte)')
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Fichier d'entrée introuvable: {input_path}")

    with input_path.open(encoding='utf-8') as fh:
        words = [line.strip() for line in fh if line.strip()]

    model = build_model(words, args.order)

    output_path = Path(args.output)
    with output_path.open('w', encoding='utf-8') as fh:
        json.dump(model, fh, ensure_ascii=False, indent=2)

    print(f"Modèle enregistré dans {output_path} (contexte={args.order}, transitions={model['metadata']['totalTransitions']})")


if __name__ == '__main__':
    main()
