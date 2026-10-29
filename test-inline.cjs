// Run with Playwright available: node test-inline.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { chromium } = require("playwright");

(async () => {
  let handler;
  const context = vm.createContext({
    importScripts() { vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context); },
    chrome: {
      runtime: { id: "test", onMessage: { addListener(fn) { handler = fn; } } },
      storage: { local: { async get() { return {}; } } },
    },
  });
  vm.runInContext(fs.readFileSync("background.js", "utf8"), context);
  const missingKey = await new Promise((resolve) => {
    assert.equal(handler({ type: "optimizePrompt", prompt: "hello" }, { id: "test" }, resolve), true);
  });
  assert.match(missingKey.error, /API key/);
  assert.equal(handler({ type: "optimizePrompt", prompt: "hello" }, { id: "other" }, () => {}), undefined);
  context.chrome.storage.local.get = async () => ({ geminiApiKey: "key🌍" });
  let fetched = false;
  context.fetch = async () => { fetched = true; throw new Error("Unexpected network call"); };
  const invalidKey = await new Promise((resolve) => {
    handler({ type: "optimizePrompt", prompt: "Explain gravity" }, { id: "test" }, resolve);
  });
  assert.match(invalidKey.error, /unsupported character U\+1F30D/);
  assert.equal(fetched, false);
  context.chrome.storage.local.get = async () => ({ geminiApiKey: "\u200b“test-\nkey_123”\ufeff" });
  context.fetch = async (_, request) => {
    assert.equal(new Headers(request.headers).get("x-goog-api-key"), "test-key_123");
    assert.ok(JSON.parse(request.body).contents[0].parts[0].text.includes("Explain gravity in 日本語 🌍"));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "重力を説明" }] } }] }) };
  };
  const unicodePrompt = await new Promise((resolve) => {
    handler({ type: "optimizePrompt", prompt: "Explain gravity in 日本語 🌍" }, { id: "test" }, resolve);
  });
  assert.equal(unicodePrompt.optimized, "重力を説明");

  let saveClick;
  let closed = false;
  let injected = false;
  let failSave = false;
  let savedKey;
  const keyInput = { value: "" };
  const keyStatus = { dataset: {} };
  vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8") + "\n" + fs.readFileSync("popup.js", "utf8"), {
    document: { querySelector(id) {
      return { "#apiKey": keyInput, "#keyStatus": keyStatus,
        "#saveKey": { addEventListener(_, fn) { saveClick = fn; } } }[id];
    } },
    window: { close() { closed = true; } },
    chrome: {
      storage: { local: {
        async get() { return { geminiApiKey: "stored-key" }; },
        async set(value) { if (failSave) throw new Error("Storage failed"); savedKey = value.geminiApiKey; },
      } },
      tabs: { async query() { return [{ id: 42 }]; } },
      scripting: { async executeScript(options) {
        assert.equal(options.target.tabId, 42);
        assert.equal(options.files[0], "content.js");
        injected = true;
      } },
    },
  });
  await Promise.resolve();
  assert.equal(keyInput.value, "stored-key");
  await saveClick();
  assert.ok(closed && injected);
  closed = false;
  failSave = true;
  await saveClick();
  assert.equal(closed, false);
  assert.match(keyStatus.textContent, /Storage failed/);
  failSave = false;
  keyInput.value = "\u201ckey\u201d";
  await saveClick();
  assert.equal(closed, true);
  assert.equal(savedKey, "key");
  closed = false;
  keyInput.value = "key🌍";
  await saveClick();
  assert.equal(closed, false);
  assert.match(keyStatus.textContent, /unsupported character U\+1F30D/);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<textarea id="text">hello chat, please explain gravity</textarea>
      <input id="input" value="hello chat, please explain gravity">
      <input id="password" type="password" value="secret">
      <textarea id="readonly" readonly>private</textarea>
      <div id="rich" contenteditable="true"><p>hello chat, please explain gravity</p></div>`);
    // Expose the closed shadow root only inside this test page.
    await page.evaluate(() => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) {
        const root = attach.call(this, options);
        window.optimizerUI = root;
        return root;
      };
      window.calls = 0;
      window.chrome = { runtime: { async sendMessage(message) {
        window.calls++;
        window.lastPrompt = message.prompt;
        if (window.delay) await new Promise((resolve) => { window.finish = resolve; });
        return window.reply || { optimized: "Explain gravity" };
      } } };
    });
    await page.focus("#text"); // Already focused when the extension activates.
    await page.addScriptTag({ path: "content.js" });
    assert.equal(await page.evaluate(() => window.optimizerUI.host.style.display), "block");
    await page.addScriptTag({ path: "content.js" });
    assert.equal(await page.locator("html > div").count(), 1); // Reinjection is safe.
    const click = async () => {
      const rect = await page.evaluate(() => {
        const r = window.optimizerUI.querySelector("#toggle").getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.mouse.click(rect.x, rect.y);
    };
    const label = () => page.evaluate(() => window.optimizerUI.querySelector("#toggle").getAttribute("aria-label"));
    for (const selector of ["#text", "#input", "#rich"]) {
      await page.focus(selector);
      await click();
      assert.equal(await label(), "Accept optimized prompt");
      const original = await page.$eval(selector, (el) => el.value ?? el.innerText);
      assert.match(original, /hello chat/); // Preview does not mutate the field.
      await click();
      assert.equal(await page.$eval(selector, (el) => el.value ?? el.innerText), "Explain gravity");
    }
    for (const selector of ["#password", "#readonly"]) {
      await page.focus(selector);
      assert.equal(await page.evaluate(() => window.optimizerUI.host.style.display), "none");
    }
    await page.$eval("#input", (el) => {
      el.focus();
      // Simulate an editor whose focus event was missed or intercepted.
      document.querySelector("#password").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      el.value = "Typed after missed focus";
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
    assert.equal(await page.evaluate(() => window.optimizerUI.host.style.display), "block");
    await page.focus("#text");
    await page.evaluate(() => { window.delay = true; });
    await click();
    await page.fill("#text", "New typing must survive");
    await page.evaluate(() => { window.finish(); window.delay = false; });
    await page.waitForTimeout(20);
    assert.equal(await label(), "Optimize prompt");
    assert.equal(await page.inputValue("#text"), "New typing must survive");

    await click();
    await page.$eval("#text", (el) => { el.value = "Programmatic update"; });
    await click();
    assert.equal(await page.inputValue("#text"), "Programmatic update");

    await page.evaluate(() => { window.reply = { error: "Save API key first" }; });
    await click();
    assert.equal(await page.evaluate(() => window.optimizerUI.querySelector("#status").textContent), "Save API key first");
    assert.equal(await label(), "Optimize prompt");
    await page.evaluate(() => { window.reply = { optimized: "Programmatic update" }; });
    await click();
    assert.match(await page.evaluate(() => window.optimizerUI.querySelector("#status").textContent), /Already concise/);
    console.log("Checks passed: pre-focused fields, typing recovery, reinjection, real mouse clicks, preview/apply, protected fields, stale results, popup save/close.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
