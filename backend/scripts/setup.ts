import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import { ENV_FILE, loadConfig, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL, DEFAULT_GROK_MODEL } from "../src/config/env.js";
import { validateGeminiKey } from "../src/services/gemini/validateKey.js";
import { validateSpotifyCredentials } from "../src/services/spotify/validateCredentials.js";

async function promptSecret(rl: readline.Interface, promptText: string): Promise<string> {
  process.stdout.write(promptText);
  // Simple prompt for secure manual setup in local terminal
  const answer = await rl.question("");
  return answer.trim();
}

async function main() {
  console.log("\n=========================================");
  console.log("       ECHORA Phase 1 Setup Wizard       ");
  console.log("=========================================\n");
  console.log("This wizard configures your backend API keys securely.");
  console.log("Credentials will be written to backend/.env (gitignored).\n");

  const existing = loadConfig();
  const rl = readline.createInterface({ input, output });

  try {
    // 1. Google Gemini API Key (Primary Provider, 1st preference)
    console.log("1. Google Gemini API Key (Primary Provider, 1st preference)");
    console.log("   (Get one from https://aistudio.google.com/app/apikey)");
    const currentGemini = existing.geminiApiKey ? `[configured: ...${existing.geminiApiKey.slice(-4)}]` : "[not configured]";
    const geminiKey = await promptSecret(rl, `   Enter Gemini API Key ${currentGemini} (press Enter to keep): `);
    const finalGeminiKey = geminiKey || existing.geminiApiKey || "";

    // 2. Grok (xAI) API Key (Secondary Provider, 2nd preference)
    console.log("\n2. Grok (xAI) API Key (Secondary Provider, 2nd preference)");
    console.log("   (Get one from https://console.x.ai)");
    const currentGrok = existing.grokApiKey ? `[configured: ...${existing.grokApiKey.slice(-4)}]` : "[not configured]";
    const grokKey = await promptSecret(rl, `   Enter Grok API Key ${currentGrok} (press Enter to keep): `);
    const finalGrokKey = grokKey || existing.grokApiKey || "";
    const grokModelInput = await promptSecret(rl, `   Grok model [${existing.grokModel || DEFAULT_GROK_MODEL}] (press Enter to keep): `);
    const finalGrokModel = grokModelInput || existing.grokModel || DEFAULT_GROK_MODEL;

    // 3. OpenAI API Key (Tertiary fallback provider, optional)
    console.log("\n3. OpenAI API Key (Tertiary fallback provider, optional)");
    const currentOpenAI = existing.openaiApiKey ? "[configured: hidden]" : "[not configured]";
    const openaiKey = await promptSecret(rl, `   Enter OpenAI API Key ${currentOpenAI} (press Enter to keep): `);
    const finalOpenAIKey = openaiKey || existing.openaiApiKey || "";
    const openaiModelInput = await promptSecret(rl, `   OpenAI model [${existing.openaiModel || DEFAULT_OPENAI_MODEL}] (press Enter to keep): `);
    const finalOpenAIModel = openaiModelInput || existing.openaiModel || DEFAULT_OPENAI_MODEL;

    if (finalGeminiKey) {
      process.stdout.write("   Validating Gemini API Key... ");
      const check = await validateGeminiKey(finalGeminiKey, existing.geminiModel || DEFAULT_GEMINI_MODEL);
      if (check.ok) {
        console.log("✓ Valid!");
      } else {
        console.log(`✗ Validation failed: ${check.message}`);
        console.log("   (Saving anyway so you can test or fix later.)");
      }
    }

    // 2. Spotify Client ID
    console.log("\n2. Spotify Web API Application");
    console.log("   (Create an app at https://developer.spotify.com/dashboard)");
    console.log("   IMPORTANT: Add Redirect URI: http://127.0.0.1:4000/api/spotify/callback");
    const currentSpotifyId = existing.spotifyClientId ? `[configured: ...${existing.spotifyClientId.slice(-4)}]` : "[not configured]";
    const spotifyId = await promptSecret(rl, `   Enter Spotify Client ID ${currentSpotifyId} (press Enter to keep): `);
    const finalSpotifyId = spotifyId || existing.spotifyClientId || "";

    // 3. Spotify Client Secret
    const currentSpotifySecret = existing.spotifyClientSecret ? "[configured: hidden]" : "[not configured]";
    const spotifySecret = await promptSecret(rl, `   Enter Spotify Client Secret ${currentSpotifySecret} (press Enter to keep): `);
    const finalSpotifySecret = spotifySecret || existing.spotifyClientSecret || "";

    if (finalSpotifyId && finalSpotifySecret) {
      process.stdout.write("   Validating Spotify credentials... ");
      const check = await validateSpotifyCredentials(finalSpotifyId, finalSpotifySecret);
      if (check.ok) {
        console.log("✓ Valid!");
      } else {
        console.log(`✗ Validation failed: ${check.message}`);
        console.log("   (Saving anyway so you can test or fix later.)");
      }
    }

    // Write to backend/.env
    const envContent = [
      `# ECHORA API Credentials`,
      `GROK_API_KEY=${finalGrokKey}`,
      `GROK_MODEL=${finalGrokModel}`,
      `GEMINI_API_KEY=${finalGeminiKey}`,
      `GEMINI_MODEL=${existing.geminiModel || DEFAULT_GEMINI_MODEL}`,
      `OPENAI_API_KEY=${finalOpenAIKey}`,
      `OPENAI_MODEL=${finalOpenAIModel}`,
      `SPOTIFY_CLIENT_ID=${finalSpotifyId}`,
      `SPOTIFY_CLIENT_SECRET=${finalSpotifySecret}`,
      ``,
    ].join("\n");

    fs.writeFileSync(ENV_FILE, envContent, { encoding: "utf8", mode: 0o600 });
    console.log(`\n✓ Successfully saved credentials to backend/.env (mode 0600)`);
    console.log("You can now start the application using: npm run dev\n");
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});

