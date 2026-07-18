import { describe, expect, it } from "vitest";
import { matchProjectFolderAssets } from "./asset-folder";

function asset(name: string, folder = "song"): { name: string; webkitRelativePath: string } {
  return { name, webkitRelativePath: `${folder}/${name}` };
}

describe("project asset folder matching", () => {
  it("matches score, MIDI and MP3 files with the same stem", () => {
    const matched = matchProjectFolderAssets([
      asset("cruel-summer.mp3"),
      asset("cruel-summer.mxl"),
      asset("notes.txt"),
      asset("cruel-summer.mid"),
    ]);

    expect(matched.score.name).toBe("cruel-summer.mxl");
    expect(matched.midi.name).toBe("cruel-summer.mid");
    expect(matched.audio.name).toBe("cruel-summer.mp3");
    expect(matched.backgrounds).toEqual([]);
  });

  it("collects supported background images and prefers the project-stem image", () => {
    const matched = matchProjectFolderAssets([
      asset("song.mxl"), asset("song.mid"), asset("song.mp3"),
      asset("zebra.webp"), asset("cover.jpg"), asset("song.png"), asset("ignored.gif"),
    ]);

    expect(matched.backgrounds.map((background) => background.name)).toEqual([
      "song.png",
      "cover.jpg",
      "zebra.webp",
    ]);
  });

  it("reports every missing required format", () => {
    expect(() => matchProjectFolderAssets([asset("song.musicxml")])).toThrow("MIDI、MP3");
  });

  it("rejects multiple complete sets instead of guessing", () => {
    expect(() => matchProjectFolderAssets([
      asset("one.mxl"), asset("one.mid"), asset("one.mp3"),
      asset("two.mxl"), asset("two.mid"), asset("two.mp3"),
    ])).toThrow("多组同名资源");
  });
});
