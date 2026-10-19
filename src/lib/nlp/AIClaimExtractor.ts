import { GoogleGenAI, Type } from '@google/genai';

export interface ClaimedCommute {
  destination: string;
  claimed_time_minutes: number;
  transport_mode: 'walking' | 'transit' | 'driving';
}

/**
 * AIClaimExtractor: Uses Gemini Flash to parse unstructured real estate marketing copy
 * into structured JSON claims for empirical validation.
 */
export class AIClaimExtractor {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('AIClaimExtractor requires a Google Gemini API Key.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Extracts specific travel time claims from unstructured listing descriptions.
   */
  public async extractClaims(rawListingText: string): Promise<ClaimedCommute[]> {
    if (!rawListingText || rawListingText.trim().length === 0) {
      return [];
    }

    // System instruction defense against prompt injections
    const systemPrompt = `You are an objective real estate auditor. Extract all explicit commute and travel time claims made in the listing. Return ONLY a valid JSON array.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.8-flash', // <--- Update from 'gemini-2.5-flash' to 'gemini-3.8-flash'
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nListing Text:\n"""\n${rawListingText.slice(0, 4000)}\n"""` }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              destination: { type: Type.STRING, description: 'Name of the landmark or transit hub' },
              claimed_time_minutes: { type: Type.INTEGER, description: 'Claimed travel time in minutes' },
              transport_mode: { type: Type.STRING, enum: ['walking', 'transit', 'driving'] },
            },
            required: ['destination', 'claimed_time_minutes', 'transport_mode'],
          },
        },
      },
    });

    const responseText = response.text;
    if (!responseText) return [];

    try {
      return JSON.parse(responseText) as ClaimedCommute[];
    } catch {
      return [];
    }
  }
}