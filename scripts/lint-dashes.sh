#!/usr/bin/env bash
# Fails on em dashes (U+2014). Warns on en dashes (U+2013).
cd "$(dirname "$0")/.."
ex=(--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=dist --exclude-dir=data)
if LC_ALL=C grep -rIn "${ex[@]}" $'\xe2\x80\x94' . ; then echo "ERROR: em dash found"; exit 1; fi
LC_ALL=C grep -rIn "${ex[@]}" $'\xe2\x80\x93' . && echo "WARNING: en dash found, prefer a hyphen or the word to"
exit 0
