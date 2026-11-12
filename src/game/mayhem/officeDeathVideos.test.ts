import { describe, expect, it } from "vitest";
import { chooseOfficeDeathVideo, OFFICE_DEATH_VIDEOS } from "./officeDeathVideos";

describe("office death videos", () => {
  it("pairs each viewport video with a compatible MP3 soundtrack", () => {
    expect(OFFICE_DEATH_VIDEOS.length).toBeGreaterThan(0);
    for (const clip of OFFICE_DEATH_VIDEOS) {
      expect(clip.video).toMatch(/\.mp4(?:$|\?)/i);
      expect(clip.audio).toMatch(/\.mp3(?:$|\?)/i);
    }
  });

  it("selects clips from the configured list", () => {
    expect(chooseOfficeDeathVideo(OFFICE_DEATH_VIDEOS, () => 0))
      .toBe(OFFICE_DEATH_VIDEOS[0]);
    expect(() => chooseOfficeDeathVideo([])).toThrow("At least one office death video is required");
  });
});
