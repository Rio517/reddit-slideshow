import "@/assets/overlay.css";

export default defineContentScript({
  matches: ["https://old.reddit.com/*"],
  cssInjectionMode: "manifest",
  main() {
    const ROOT_ID = "reddit-slideshow-root";

    function ensureRoot() {
      let root = document.getElementById(ROOT_ID);
      if (root) return root;
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.hidden = true;
      document.documentElement.append(root);
      return root;
    }

    /**
     * @param {HTMLElement} root
     * @param {string} title
     * @param {string[]} lines
     */
    function renderDiagnostic(root, title, lines) {
      root.replaceChildren();
      const panel = document.createElement("section");
      panel.className = "reddit-slideshow-diagnostic";

      const heading = document.createElement("h1");
      heading.textContent = title;
      panel.append(heading);

      for (const line of lines) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        panel.append(paragraph);
      }

      root.append(panel);
    }

    browser.runtime.onMessage.addListener((/** @type {any} */ message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      const root = ensureRoot();
      root.hidden = false;
      renderDiagnostic(root, "Reddit Slideshow", [
        "Checking current listing JSON with your browser session...",
      ]);

      return browser.runtime
        .sendMessage({
          type: "slideshow.probeListing",
          payload: { pageUrl: window.location.href },
        })
        .then((response) => {
          if (response?.ok) {
            const summary = response.summary;
            renderDiagnostic(root, "Listing JSON reachable", [
              `Posts returned: ${summary.childCount}`,
              `Next page cursor: ${summary.after ?? "none"}`,
              `HTTP status: ${summary.status}`,
              `Rate limit remaining: ${summary.rateLimitRemaining ?? "not reported"}`,
            ]);
            return { ok: true };
          }

          renderDiagnostic(root, "Listing JSON check failed", [
            response?.error?.message ?? "Unknown listing fetch failure",
            response?.error?.jsonUrl
              ? `JSON URL: ${response.error.jsonUrl}`
              : "JSON URL unavailable",
          ]);
          return { ok: false };
        });
    });
  },
});
