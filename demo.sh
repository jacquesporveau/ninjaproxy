#!/bin/bash

set -e

CYAN='\033[0;36m'
GRAY='\033[0;90m'
RESET='\033[0m'

step() {
  echo ""
  echo -e "${CYAN}▶ $1${RESET}"
  echo -e "${GRAY}$2${RESET}"
  echo ""
}

step "Original text" "What we're starting with — real names, emails, URLs."
cat example.txt

step "Sanitize" "Replace all detected entities with stable aliases."
npx ts-node src/cli.ts sanitize example.txt

step "Prompt mode" "Wrap sanitized output in a Claude-ready system prompt."
npx ts-node src/cli.ts prompt example.txt 2>/dev/null

step "Rehydrate" "Simulate a Claude response and restore the original values."
MOCK_RESPONSE="MENTION_1 confirmed. PERSON_2 will send the spec to ORG_1 at URL_1. Reply to EMAIL_1 when done."
echo "$MOCK_RESPONSE"
echo ""
echo -e "${GRAY}→ rehydrated:${RESET}"
echo "$MOCK_RESPONSE" | npx ts-node src/cli.ts rehydrate -

echo ""
