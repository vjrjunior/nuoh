#!/bin/sh
report() { printf '\033]7501;state=%s:app=fake-agent\007' "$1"; }
default='{"blocking": 0, "summary": "Nothing blocking."}'
report idle
while IFS= read -r line; do
  file=$(printf '%s\n' "$line" | sed -nE 's/.*(answer to|answer in) (\/[^ :]*).*/\2/p')
  file=${file%.}
  [ -n "$file" ] || continue
  report working
  sleep "${FAKE_AGENT_SECONDS:-1}"
  case "$file" in
    *.json) printf '%s\n' "${FAKE_AGENT_JSON:-$default}" > "$file" ;;
    *) printf 'Done: %s\n' "$(basename "$file")" > "$file" ;;
  esac
  report idle
done
