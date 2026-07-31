# Prompt Optimizer v2

Minimal prompt optimizer powered by Gemini. It keeps the Python CLI and adds a small Chrome extension popup with the same optimization rules.

The optimizer asks Gemini to shorten prompts while preserving requirements, facts, numbers, names, URLs, code blocks, and requested output format. If Gemini returns something longer, the tool keeps the original prompt.

## Files

- `prompt-optimizerv2.py` - Python CLI.
- `manifest.json` - Chrome extension manifest.
- `popup.html` - Chrome popup UI.
- `popup.js` - Chrome popup logic and Gemini REST call.

## Requirements

- Python 3.10 or newer.
- `google-genai` for the Python CLI.
- A Gemini API key.
- Chrome for the extension.

Install the Python dependency:

```sh
python3 -m pip install google-genai
```

## API Key

For the Python CLI, export your Gemini API key before running the script:

```sh
export GEMINI_API_KEY="your-api-key"
```

If your shell or SDK setup already uses `GOOGLE_API_KEY`, that may also work, but `GEMINI_API_KEY` is the clearest default for this project.

For the Chrome extension, paste the key into the popup and click `Save`. The key is stored in `chrome.storage.local` for this unpacked extension.

## Run The Python CLI

Pipe a prompt into the script:

```sh
echo "what will the weather be next week" | python3 prompt-optimizerv2.py
```

Or pass a text file:

```sh
python3 prompt-optimizerv2.py prompt.txt
```

Run the self-test:

```sh
python3 -B prompt-optimizerv2.py --self-test
```

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
python3 -B prompt-optimizerv2.py --self-test
node --check popup.js
node popup.js
python3 -m json.tool manifest.json
```

## Privacy

The Python CLI sends prompts directly to Gemini through the Google GenAI SDK. The Chrome extension sends prompts directly to Gemini through the Gemini REST API. The project has no backend, analytics, history, or tracking.
