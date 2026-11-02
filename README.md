# Prompt Optimizer v3

Minimal prompt optimizer powered by Gemini. A small Chrome extension popup with optimization rules.

The optimizer asks Gemini to shorten prompts while preserving requirements, facts, numbers, names, URLs, code blocks, and requested output format. If Gemini returns something longer, the tool keeps the original prompt.

## Files

- `manifest.json` - Chrome extension manifest.
- `popup.html` - Chrome popup UI.
- `popup.js` - Chrome popup logic and Gemini REST call.

## Requirements
- A Gemini API key.
- Chrome for the extension.



## API Key

For the Chrome extension, paste the key into the popup and click `Save`. The key is stored in `chrome.storage.local` for this unpacked extension.


## Load The Chrome Extension

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `/Users/xx/Documents/prompt-optimizerv2`.
5. Pin `Prompt Optimizer` from the Chrome toolbar menu.
6. Open the popup, save your Gemini API key, enter a prompt, and click `Optimize`.

## Behavior

The shared optimization rules are:

- Preserve all requirements, facts, numbers, code blocks, URLs, names, and output format.
- Remove redundancy, filler, awkward wording, greetings, and direct address.
- Prefer key semantic words when safe.
- Do not answer the prompt.
- Return only the optimized prompt text.

Example:

```text
what will the weather be next week
```

becomes:

```text
weather next week
```

## Development Checks

```sh
node --check popup.js
node popup.js
```

## Privacy
 The Chrome extension sends prompts directly to Gemini through the Gemini REST API. The project has no backend, analytics, history, or tracking.
