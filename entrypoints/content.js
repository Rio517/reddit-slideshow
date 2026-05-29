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
      root.textContent = "Reddit Slideshow";
      document.documentElement.append(root);
      return root;
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== "slideshow.startRequested") return undefined;
      const root = ensureRoot();
      root.hidden = false;
      return Promise.resolve({ ok: true });
    });
  },
});
