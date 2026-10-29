"use strict";

const MODEL = "gemini-2.5-flash";
const API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function estimateTokens(text) {
  return text ? Math.ceil(text.length / 4) : 0;
}

function buildRequest(prompt) {
  return [
    "Optimize the prompt below for lower token count.",
    "Rules:",
    "- Preserve every requirement, fact, number, code block, URL, name, and requested output format.",
    "- Remove only redundancy, filler, and awkward wording.",
    '- Remove greetings and direct address like "hey chat", "hi there", or "hello chat".',
    '- Prefer key semantic words when safe, e.g. "what will the weather be next week" -> "weather next week".',
    "- Do not answer the prompt.",
    "- Return only the optimized prompt text.",
    "",
    "Prompt:",
    "<<<PROMPT",
    prompt,
    "PROMPT>>>",
  ].join("\n");
}

function chooseCandidate(original, candidate) {
  return estimateTokens(candidate) < estimateTokens(original)
    ? candidate
    : original;
}

function validateApiKey(value) {
  // Clipboard formatting is not part of a credential. Gemini validates its format.
  const key = typeof value === "string"
    ? value.replace(/[\s\p{Cf}]/gu, "").replace(/^["'`“”‘’]+|["'`“”‘’]+$/gu, "")
    : "";
  if (!key) throw new Error("Enter a Gemini API key.");
  const unsupported = key.match(/[^\x21-\x7e]/u);
  if (unsupported) {
    const code = unsupported[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
    throw new Error(`API key contains unsupported character U+${code}. Copy the key again, then save. Do not share your key.`);
  }
  return key;
}

async function generateCandidate(apiKey, prompt) {
  const key = validateApiKey(apiKey);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildRequest(prompt) }] }],
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Gemini returned invalid response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `Gemini request failed (${response.status}).`,
    );
  }

  const candidate = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();

  if (!candidate) {
    throw new Error("Gemini returned empty text.");
  }

  return candidate;
}

function selfTest() {
  const request = buildRequest("hello");
  const checks = [
    estimateTokens("") === 0,
    estimateTokens("abcd") === 1,
    estimateTokens("abcde") === 2,
    chooseCandidate("abcdefgh", "abcd") === "abcd",
    chooseCandidate("abcd", "abcdefgh") === "abcd",
    validateApiKey("  test-key_123\n") === "test-key_123",
    validateApiKey("\u200b“test-\nkey_123”\ufeff") === "test-key_123",
    validateApiKey("test.key:123") === "test.key:123",
    request.includes("Remove greetings and direct address"),
    request.includes("weather next week"),
    request.includes("Do not answer the prompt"),
  ];

  if (checks.includes(false)) {
    throw new Error("Optimizer self-test failed.");
  }
  for (const invalid of ["", "\u200b“”", "key\u00e9", "key\u0000"]) {
    let rejected = false;
    try { validateApiKey(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error("API key validation self-test failed.");
  }
}

selfTest();
