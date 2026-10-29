"use strict";

importScripts("optimizer.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "optimizePrompt" || sender.id !== chrome.runtime.id) return;

  (async () => {
    if (typeof message.prompt !== "string" || !message.prompt.trim()) {
      throw new Error("Enter a prompt first.");
    }
    const { geminiApiKey } = await chrome.storage.local.get("geminiApiKey");
    if (!geminiApiKey) throw new Error("Save your Gemini API key in the extension popup first.");
    const candidate = await generateCandidate(geminiApiKey, message.prompt);
    return { optimized: chooseCandidate(message.prompt, candidate) };
  })().then(sendResponse).catch((error) => sendResponse({ error: error.message }));
  return true;
});
