import { createServerFn } from "@tanstack/react-start";

export type ChatTurn = { role: "user" | "assistant"; content: string };

type ProviderConfig = {
  provider: "openrouter" | "ollama";
  model: string;
  apiKey: string | undefined;
  endpoint: string;
};

const MODEL_ROUTES: Record<string, Omit<ProviderConfig, "apiKey">> = {
  "openrouter:free": {
    provider: "openrouter",
    model: "openrouter/free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
  "ollama:gpt-oss:20b": {
    provider: "ollama",
    model: "gpt-oss:20b",
    endpoint: "https://ollama.com/v1/chat/completions",
  },
};

export const askLumen = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; history?: ChatTurn[]; modelId?: string }) => {
    const prompt = input.prompt.trim().slice(0, 4000);
    const history = (input.history ?? []).slice(-8);
    const modelId = input.modelId ?? "openrouter:free";
    return { prompt, history, modelId };
  })
  .handler(async ({ data }) => {
    const route = MODEL_ROUTES[data.modelId] ?? MODEL_ROUTES["openrouter:free"];
    const apiKey = route.provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: `${route.provider}_not_configured` };
    }

    const res = await fetch(route.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(route.provider === "openrouter"
          ? {
              "HTTP-Referer": "https://lumen-orpin-alpha.vercel.app",
              "X-OpenRouter-Title": "Lumen Fleet Investigation Console",
            }
          : {}),
      },
      body: JSON.stringify({
        model: route.model,
        max_tokens: 900,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are Lumen, a calm investigation agent. Explain findings in plain language. Use short sections, named files, and concrete model or provider names when relevant. No emoji. No filler. If you do not have the source, say what you would inspect and how.",
          },
          ...data.history,
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false as const, error: `${route.provider}_api_${res.status}` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
  });
