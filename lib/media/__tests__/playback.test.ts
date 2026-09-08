import { describe, expect, it, vi } from "vitest";
import { announcePlayback, onOtherPlayback } from "../playback";

describe("playback bus (F-33)", () => {
  it("pauses every other player when one announces, and never the announcer", () => {
    const video = vi.fn();
    const audio = vi.fn();
    const take = vi.fn();
    const offVideo = onOtherPlayback("video-1", video);
    const offAudio = onOtherPlayback("audio-1", audio);
    const offTake = onOtherPlayback("take-1", take);

    announcePlayback("audio-1");
    expect(audio).not.toHaveBeenCalled();
    expect(video).toHaveBeenCalledTimes(1);
    expect(take).toHaveBeenCalledTimes(1);

    announcePlayback("take-1");
    expect(take).toHaveBeenCalledTimes(1);
    expect(audio).toHaveBeenCalledTimes(1);
    expect(video).toHaveBeenCalledTimes(2);

    offVideo();
    announcePlayback("audio-1");
    expect(video).toHaveBeenCalledTimes(2);
    offAudio();
    offTake();
  });
});
