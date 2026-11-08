/**
 * Runtime credential validity, learned from real API responses.
 *   null  = not verified yet
 *   true  = last call succeeded
 *   false = the provider rejected the credential (requires `npm run setup` + restart)
 *
 * This tiny shared state lets the Gemini and Spotify services stay
 * independent of each other while the mode resolver reads both.
 */
export interface CredentialState {
  grokValid: boolean | null;
  geminiValid: boolean | null;
  openaiValid: boolean | null;
  spotifyValid: boolean | null;
}

export function createCredentialState(): CredentialState {
  return { grokValid: null, geminiValid: null, openaiValid: null, spotifyValid: null };
}

