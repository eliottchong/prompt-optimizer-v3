"use strict";

(() => {
  // Saving settings can inject into an already-open page; keep one widget per frame.
  if (globalThis.promptOptimizerLoaded) return;
  globalThis.promptOptimizerLoaded = true;
  const host = document.createElement("div");
  host.style.cssText = "all:initial!important;position:fixed!important;z-index:2147483647!important;display:none!important";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { font: 14px/1.4 system-ui, sans-serif; color-scheme: light; }
      * { box-sizing: border-box; }
      button { font: inherit; cursor: pointer; border: 1px solid #cbd5e1;
        background: white; color: #172033; border-radius: 8px; padding: 6px 10px; }
      button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
      button:disabled { cursor: wait; opacity: .6; }
      #toggle { width: 32px; height: 32px; padding: 0; border-radius: 50%;
        background: #1a73e8; color: white; border: 0; box-shadow: 0 2px 8px #0003; }
      #panel { position: absolute; right: 0; bottom: 40px; width: min(320px, calc(100vw - 16px));
        max-height: 60vh; overflow: auto; padding: 12px; background: white;
        color: #172033; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 20px #0003; }
      #preview { white-space: pre-wrap; overflow-wrap: anywhere; margin: 10px 0; }
      #status { margin: 0; }
      #dismiss { margin-top: 10px; }
      [hidden] { display: none !important; }
    </style>
    <button id="toggle" type="button" aria-label="Optimize prompt" title="Optimize prompt" aria-expanded="false">✦</button>
    <section id="panel" aria-label="Prompt Optimizer" hidden>
      <p id="status" role="status" aria-live="polite"></p>
      <div id="preview"></div>
      <button id="dismiss" type="button">Dismiss</button>
    </section>`;
  const button = shadow.querySelector("#toggle");
  const panel = shadow.querySelector("#panel");
  const status = shadow.querySelector("#status");
  const preview = shadow.querySelector("#preview");
  let target = null;
  let pending = null;
  let revision = 0;

  function editorFor(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.matches("textarea, input[type=text], input[type=search], input:not([type])")) {
      return element.disabled || element.readOnly ? null : element;
    }
    if (!element.isContentEditable) return null;
    while (element.parentElement?.isContentEditable) element = element.parentElement;
    return element;
  }

  function read(element) {
    return element.isContentEditable ? element.innerText : element.value;
  }

  function reset() {
    revision++;
    pending = null;
    button.disabled = false;
    button.textContent = "✦";
    button.title = "Optimize prompt";
    button.setAttribute("aria-label", "Optimize prompt");
    button.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    preview.textContent = "";
  }

  function position() {
    if (!target?.isConnected || !editorFor(target)) {
      host.style.setProperty("display", "none", "important");
      return;
    }
    const rect = target.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
      rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    host.style.setProperty("display", visible ? "block" : "none", "important");
    host.style.setProperty("left", `${Math.max(8, Math.min(innerWidth - 40, rect.right - 36))}px`, "important");
    host.style.setProperty("top", `${Math.max(8, Math.min(innerHeight - 40, rect.bottom - 36))}px`, "important");
    // ponytail: one panel follows the active field; flip below fields near the top.
    panel.style.bottom = rect.bottom < 300 ? "auto" : "40px";
    panel.style.top = rect.bottom < 300 ? "40px" : "auto";
    panel.style.right = parseFloat(host.style.left) < 280 ? "auto" : "0";
  }

  function trackEditor(event) {
    if (event.target === host) return;
    const editor = editorFor(event.composedPath()[0]);
    if (editor !== target) {
      if (target) observer.unobserve(target);
      reset();
      target = editor;
      if (target) observer.observe(target);
    }
    position();
  }
  document.addEventListener("focusin", trackEditor, true);
  document.addEventListener("pointerup", trackEditor, true);
  document.addEventListener("input", (event) => {
    trackEditor(event);
    if (target) reset();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      reset();
      target?.focus();
    }
  }, true);
  document.addEventListener("scroll", position, true);
  window.addEventListener("resize", position);
  const observer = new ResizeObserver(position);
  observer.observe(document.documentElement);
  shadow.querySelector("#dismiss").addEventListener("click", () => {
    reset();
    target?.focus();
  });

  button.addEventListener("click", async () => {
    const editor = target;
    if (!editor?.isConnected || !editorFor(editor)) return;
    if (pending) {
      const { original, optimized } = pending;
      if (read(editor) !== original) {
        reset();
        return;
      }
      editor.focus();
      const before = new InputEvent("beforeinput", {
        bubbles: true, composed: true, cancelable: true,
        inputType: "insertReplacementText", data: optimized,
      });
      if (!editor.dispatchEvent(before)) {
        status.textContent = "This editor blocked replacement. Copy the preview instead.";
        return;
      }
      if (editor.isContentEditable) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        // Native edit preserves undo and lets rich-text editors process the change.
        if (!document.execCommand("insertText", false, optimized)) {
          status.textContent = "This editor does not support replacement. Copy the preview instead.";
          return;
        }
      } else {
        const prototype = editor instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(editor, optimized);
        editor.dispatchEvent(new InputEvent("input", {
          bubbles: true, composed: true, inputType: "insertReplacementText", data: optimized,
        }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
      }
      reset();
      return;
    }

    const original = read(editor);
    const requestRevision = ++revision;
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    if (!original.trim()) {
      status.textContent = "Enter a prompt first.";
      return;
    }
    button.disabled = true;
    status.textContent = "Optimizing…";
    try {
      const response = await chrome.runtime.sendMessage({ type: "optimizePrompt", prompt: original });
      if (revision !== requestRevision || target !== editor) return;
      if (read(editor) !== original) { reset(); return; }
      if (response?.error) throw new Error(response.error);
      if (typeof response?.optimized !== "string" || !response.optimized.trim()) {
        throw new Error("Optimizer returned no text.");
      }
      if (response.optimized === original) {
        status.textContent = "Already concise; original kept.";
        return;
      }
      pending = { original, optimized: response.optimized };
      preview.textContent = response.optimized;
      status.textContent = "Preview — click ✓ to apply to this textbox.";
      button.textContent = "✓";
      button.title = "Accept optimized prompt";
      button.setAttribute("aria-label", "Accept optimized prompt");
    } catch (error) {
      if (revision === requestRevision) status.textContent = error.message;
    } finally {
      if (revision === requestRevision) button.disabled = false;
    }
  });
  document.documentElement.append(host);
  // Focus may precede content-script injection (autofocus, restored tabs, popup save).
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  trackEditor({ target: focused, composedPath: () => [focused] });
})();
