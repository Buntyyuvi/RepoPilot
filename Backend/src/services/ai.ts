// AI provider abstraction.
//
// Uses OpenRouter (OpenAI-compatible API) when OPENAI_KEY is set (an
// sk-or-v1-... key). Otherwise falls back to the Gemini API via GEMINI_KEY.

import { withRetry } from '../lib/retryWithBackoff';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// The code_chunks table stores vectors with this many dimensions, so every
// provider must return embeddings of exactly this size.
const EMBEDDING_DIMENSIONS = 768;

export class AIError extends Error {
  status: number;

  // Set when the upstream response carried a Retry-After header, so a caller
  // can honor it before retrying.
  retryAfterSeconds?: number;

  constructor(message: string, status = 500, retryAfterSeconds?: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getProvider(): 'openrouter' | 'gemini' {
  if (process.env.OPENAI_KEY) {
    return 'openrouter';
  }
  if (process.env.GEMINI_KEY) {
    return 'gemini';
  }
  throw new Error(
    'No AI provider key is configured. Set OPENAI_KEY (OpenRouter, sk-or-v1-...) or GEMINI_KEY (Google AI Studio).'
  );
}

export interface ActiveEngine {
  provider: 'openrouter' | 'gemini';
  chatModel: string;
  embeddingModel: string;
}

// The engine that is actually in use, resolved from the server environment.
// Exposed so the UI can truthfully report what is configured (read-only).
export function getActiveEngine(): ActiveEngine {
  const provider = getProvider();
  if (provider === 'openrouter') {
    return {
      provider,
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'openrouter/auto',
      embeddingModel: process.env.OPENAI_EMBED_MODEL ?? 'openai/text-embedding-3-small',
    };
  }
  return {
    provider,
    chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash',
    embeddingModel: process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001',
  };
}

function parseRetryAfter(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

async function openrouterFetch(path: string, body: unknown): Promise<unknown> {
  return withRetry(async () => {
    const response = await fetch(`${OPENROUTER_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AIError(
        `OpenRouter API request failed (${response.status}): ${detail.slice(0, 300)}`,
        response.status,
        parseRetryAfter(response.headers)
      );
    }

    return response.json();
  });
}

async function geminiFetch(path: string, body: unknown): Promise<unknown> {
  return withRetry(async () => {
    const response = await fetch(`${GEMINI_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_KEY as string,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AIError(
        `Gemini API request failed (${response.status}): ${detail.slice(0, 300)}`,
        response.status,
        parseRetryAfter(response.headers)
      );
    }

    return response.json();
  });
}

// Returns the embedding vector for a single text input. Both providers are
// configured to return EMBEDDING_DIMENSIONS-dimensional vectors to match the
// pgvector column definition.
export async function embedText(text: string): Promise<number[]> {
  const provider = getProvider();

  if (provider === 'openrouter') {
    const model = process.env.OPENAI_EMBED_MODEL ?? 'openai/text-embedding-3-small';
    const dimOverride = Number(process.env.OPENAI_EMBED_DIMENSIONS ?? EMBEDDING_DIMENSIONS);

    const body: Record<string, unknown> = { model, input: text };
    if (dimOverride > 0) {
      body.dimensions = dimOverride;
    }

    const data = (await openrouterFetch('/embeddings', body)) as {
      data?: Array<{ embedding?: number[] }>;
    };

    const values = data.data?.[0]?.embedding;
    if (!values || values.length === 0) {
      throw new AIError('OpenRouter embedding response was empty.');
    }
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new AIError(
        `Embedding model ${model} returned ${values.length} dimensions, expected ` +
          `${EMBEDDING_DIMENSIONS} (the code_chunks column is vector(${EMBEDDING_DIMENSIONS})). ` +
          'Pick a 768-dimension model via OPENAI_EMBED_MODEL.'
      );
    }
    return values;
  }

  // Gemini provider
  const model = process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001';
  const data = (await geminiFetch(`/models/${model}:embedContent`, {
    model: `models/${model}`,
    content: { parts: [{ text }] },
    output_dimensionality: EMBEDDING_DIMENSIONS,
  })) as {
    embedding?: { values?: number[] };
  };

  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new AIError('Gemini embedding response was empty.');
  }
  return values;
}

export interface GroundingChunk {
  filePath: string;
  content: string;
}

// Asks the chat model to answer using only the provided code chunks.
export async function generateGroundedAnswer(
  question: string,
  chunks: GroundingChunk[]
): Promise<string> {
  const provider = getProvider();

  const contextBlock = chunks
    .map((chunk) => `[Source] ${chunk.filePath}\n${chunk.content}`)
    .join('\n\n---\n\n');

  const systemInstruction = [
    'You are RepoMind, an expert code assistant with access to the actual',
    'contents of the repository the user is asking about.',
    'Answer the question using ONLY the provided code chunks.',
    'Reference exact file paths and relevant lines from the chunks.',
    'If the chunks do not contain the answer, say so clearly instead of guessing.',
  ].join(' ');

  if (provider === 'openrouter') {
    const model = process.env.OPENAI_CHAT_MODEL ?? 'openrouter/auto';
    const data = (await openrouterFetch('/chat/completions', {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        {
          role: 'user',
          content: `Relevant repository code:\n\n${contextBlock}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) {
      throw new AIError('OpenRouter generated an empty answer.');
    }
    return text;
  }

  // Gemini provider
  const model = process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash';
  const data = (await geminiFetch(`/models/${model}:generateContent`, {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Relevant repository code:\n\n${contextBlock}` },
          { text: `Question: ${question}` },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  })) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? '';

  if (!text) {
    throw new AIError('Gemini generated an empty answer.');
  }
  return text;
}