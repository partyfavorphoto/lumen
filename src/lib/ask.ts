import { createServerFn } from "@tanstack/react-start";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const askLumen = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; history?: ChatTurn[] }) => {
    const prompt = input.prompt.trim().slice(0, 4000);
    const history = (input.history ?? []).slice(-8);
    return { prompt, history };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "unavailable" };
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
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
      return { ok: false as const, error: `xAI API error ${res.status}` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
  });
