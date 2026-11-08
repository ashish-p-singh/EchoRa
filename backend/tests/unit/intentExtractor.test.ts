import { describe, it, expect } from "vitest";
import { parseIntent } from "../../src/services/gemini/intentExtractor.js";

describe("intentExtractor - parseIntent", () => {
  it("parses valid JSON structured intent", () => {
    const raw = JSON.stringify({
      mood: "calm",
      activity: "studying",
      energy: "low",
      tempo: "slow",
      genre: ["ambient", "lofi"],
      vocals: "instrumental_preferred",
      time_context: "late_night",
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("calm");
    expect(parsed.activity).toBe("studying");
    expect(parsed.energy).toBe("low");
    expect(parsed.genre).toEqual(["ambient", "lofi"]);
  });

  it("handles markdown code fences around JSON", () => {
    const raw = "```json\n{\"mood\": \"happy\", \"activity\": null, \"energy\": \"high\", \"tempo\": \"fast\", \"genre\": [\"pop\"], \"vocals\": \"any\", \"time_context\": \"morning\"}\n```";
    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("happy");
    expect(parsed.energy).toBe("high");
  });

  it("normalizes invalid or missing enum fields to defaults", () => {
    const raw = JSON.stringify({
      mood: "CHILL",
      energy: "unknown_energy",
      genre: "not an array",
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("chill");
    expect(parsed.energy).toBe("medium"); // default
    expect(parsed.genre).toEqual([]);
    expect(parsed.vocals).toBe("any");
  });

  it("parses explicit language, era, and multi-queries with negative filters", () => {
    const raw = JSON.stringify({
      explicit: {
        mood: "chill",
        activity: "night drive",
        energy: "low",
        tempo: "slow",
        genre: ["bollywood"],
        vocals: "vocals_preferred",
        time_context: "late_night",
        language: "hindi",
        era: "1990s",
      },
      queries: {
        moodQuery: "hindi chill nostalgic acoustic NOT remix",
        genreQuery: "genre:\"bollywood\" year:1990-1999 NOT live",
        contextQuery: "hindi late night drive NOT remix",
      },
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("chill");
    expect(parsed.language).toBe("hindi");
    expect(parsed.era).toBe("1990s");
    expect(parsed.multiQueries?.moodQuery).toContain("hindi");
    expect(parsed.multiQueries?.moodQuery).toContain("NOT remix");
    expect(parsed.multiQueries?.genreQuery).toContain("year:1990-1999");
  });

  it("parses sonicProfile and masterQuery cleanly", () => {
    const raw = JSON.stringify({
      explicit: {
        mood: "melancholic",
        language: "russian",
        era: "1980s",
      },
      queries: {
        moodQuery: "russian cold synthwave",
        genreQuery: "genre:\"sovietwave\" year:1980-1989",
        contextQuery: "russian late night doomer",
        masterQuery: "russian post-punk 80s",
      },
      sonicProfile: {
        instruments: ["analog synth", "drum machine", "chorus bass"],
        production: "cold Sovietwave reverb",
        tempoDescription: "driving unhurried 110bpm",
        emotionalSubtext: "stark late-night post-Soviet solitude",
        harmonicMode: "modal_dissonant",
        vocalStyle: "deadpan baritone monotone",
        antiSonicAura: {
          forbiddenInstruments: ["phonk cowbell", "trap 808s"],
          forbiddenVibes: ["party dance track", "energetic folk"],
        },
      },
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("melancholic");
    expect(parsed.language).toBe("russian");
    expect(parsed.era).toBe("1980s");
    expect(parsed.sonicProfile?.instruments).toContain("analog synth");
    expect(parsed.sonicProfile?.production).toBe("cold sovietwave reverb");
    expect(parsed.sonicProfile?.emotionalSubtext).toContain("post-soviet solitude");
    expect(parsed.sonicProfile?.harmonicMode).toBe("modal_dissonant");
    expect(parsed.sonicProfile?.vocalStyle).toBe("deadpan baritone monotone");
    expect(parsed.sonicProfile?.antiSonicAura?.forbiddenInstruments).toContain("phonk cowbell");
    expect(parsed.sonicProfile?.antiSonicAura?.forbiddenVibes).toContain("party dance track");
    expect(parsed.multiQueries?.masterQuery).toBe("russian post-punk 80s");
  });

  it("does not fabricate mood when only language and song are provided", () => {
    const raw = JSON.stringify({
      explicit: {
        mood: null,
        language: "hindi",
        track_title: "Tum Hi Ho",
        artist: "Arijit Singh",
      },
      inferred: {
        mood: null,
      },
      queries: {
        moodQuery: "tum hi ho arijit singh",
        genreQuery: "tum hi ho aashiqui 2",
        contextQuery: "tum hi ho hindi song",
        masterQuery: "tum hi ho arijit singh hindi",
      },
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("any"); // Must not invent a mood!
    expect(parsed.language).toBe("hindi");
    expect(parsed.trackTitle).toBe("tum hi ho");
    expect(parsed.artist).toBe("arijit singh");
    expect(parsed.multiQueries?.moodQuery).toBe("tum hi ho arijit singh");
  });

  it("normalizes situational events like breakup to canonical mood sad and activity breakup", () => {
    const raw = JSON.stringify({
      explicit: {
        mood: "breakup", // Situational event received
        activity: null,
      },
      queries: {
        moodQuery: "sad acoustic breakup",
        genreQuery: "breakup songs",
        contextQuery: "heartbroken late night",
        masterQuery: "sad breakup songs",
      },
    });

    const parsed = parseIntent(raw);
    expect(parsed.mood).toBe("sad"); // Canonical UI mood!
    expect(parsed.activity).toBe("breakup");
  });

  it("throws on completely malformed non-JSON output", () => {
    expect(() => parseIntent("Here are some songs for you")).toThrow();
  });
});

