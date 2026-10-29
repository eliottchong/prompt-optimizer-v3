"use strict";

function setupPopup() {
  const apiKey = document.querySelector("#apiKey");
  const saveKey = document.querySelector("#saveKey");
  const keyStatus = document.querySelector("#keyStatus");

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.dataset.kind = isError ? "error" : "info";
  }

  chrome.storage.local.get("geminiApiKey").then(({ geminiApiKey }) => {
    apiKey.value = geminiApiKey || "";
  }).catch((error) => {
    showStatus(keyStatus, `Could not load key: ${error.message}`, true);
  });

  saveKey.addEventListener("click", async () => {
    try {
      const key = validateApiKey(apiKey.value);
      await chrome.storage.local.set({ geminiApiKey: key });
      // Activate the current page without requiring a refresh after installation.
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true }, files: ["content.js"],
          });
        }
      } catch {
        // Chrome internal pages block injection; normal web pages load it on navigation.
      }
      window.close();
    } catch (error) {
      showStatus(keyStatus, `Could not save key: ${error.message}`, true);
    }
  });

}


if (typeof document !== "undefined") {
  setupPopup();
}
