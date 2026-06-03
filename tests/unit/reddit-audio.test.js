import { describe, expect, it } from "vitest";
import { audioUrlFromDash } from "../../lib/reddit-audio.js";

const MANIFEST = "https://v.redd.it/abc/DASHPlaylist.mpd?a=000&v=1&f=sd";

const MPD_WITH_AUDIO = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT14S">
  <Period>
    <AdaptationSet contentType="video" mimeType="video/mp4">
      <Representation id="DASH_720" bandwidth="2000000"><BaseURL>DASH_720.mp4</BaseURL></Representation>
      <Representation id="DASH_480" bandwidth="1000000"><BaseURL>DASH_480.mp4</BaseURL></Representation>
    </AdaptationSet>
    <AdaptationSet contentType="audio" mimeType="audio/mp4">
      <Representation id="DASH_AUDIO_128" bandwidth="128000"><BaseURL>DASH_AUDIO_128.mp4</BaseURL></Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

const MPD_SILENT = `<MPD><Period>
  <AdaptationSet contentType="video" mimeType="video/mp4">
    <Representation id="DASH_480"><BaseURL>DASH_480.mp4</BaseURL></Representation>
  </AdaptationSet>
</Period></MPD>`;

describe("audioUrlFromDash", () => {
  it("resolves the audio BaseURL against the manifest URL", () => {
    expect(audioUrlFromDash(MPD_WITH_AUDIO, MANIFEST)).toBe(
      "https://v.redd.it/abc/DASH_AUDIO_128.mp4",
    );
  });

  it("returns null when the manifest has no audio track", () => {
    expect(audioUrlFromDash(MPD_SILENT, MANIFEST)).toBeNull();
  });

  it("keeps a same-host absolute audio BaseURL", () => {
    const mpd = `<MPD><Period><AdaptationSet contentType="audio">
      <Representation><BaseURL>https://v.redd.it/abc/DASH_AUDIO_128.mp4</BaseURL></Representation>
    </AdaptationSet></Period></MPD>`;
    expect(audioUrlFromDash(mpd, MANIFEST)).toBe(
      "https://v.redd.it/abc/DASH_AUDIO_128.mp4",
    );
  });

  it("rejects an audio BaseURL that resolves to another host", () => {
    // The manifest is third-party content; don't follow an off-host absolute URL.
    const mpd = `<MPD><Period><AdaptationSet contentType="audio">
      <Representation><BaseURL>https://evil.example/DASH_AUDIO_128.mp4</BaseURL></Representation>
    </AdaptationSet></Period></MPD>`;
    expect(audioUrlFromDash(mpd, MANIFEST)).toBeNull();
  });

  it("returns null for an unusable manifest", () => {
    expect(audioUrlFromDash("", MANIFEST)).toBeNull();
    expect(audioUrlFromDash(/** @type {any} */ (null), MANIFEST)).toBeNull();
    expect(audioUrlFromDash("<MPD></MPD>", MANIFEST)).toBeNull();
  });
});
