export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info("Reddit Slideshow installed");
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    try {
      await browser.tabs.sendMessage(tab.id, {
        type: "slideshow.startRequested",
        payload: { source: "action" },
      });
    } catch {
      console.info("Reddit Slideshow: open an old.reddit.com listing first");
    }
  });
});
