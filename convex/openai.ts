"use node";
import { internal } from "./_generated/api";
import {
  Configuration,
  OpenAIApi,
} from "openai";
import { action } from "./_generated/server";
import { v } from "convex/values";

if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Missing OPENAI_API_KEY in environment variables.\n" +
    "Set it in the project settings in the Convex dashboard:\n" +
    "    npx convex dashboard\n or https://dashboard.convex.dev"
  );
}

export const moderateIdentity = action({
  args: { name: v.string(), instructions: v.string() },
  handler: async (ctx, { name, instructions }) => {
    await ctx.runMutation(internal.identity.add, { name, instructions });
    return null;
  },
});

export const chat = action({
  args: {
    body: v.string(),
    identityName: v.string(),
    threadId: v.id("threads"),
  },
  handler: async (ctx, { body, identityName, threadId }) => {
    const { instructions, messages, botMessageId } =
      await ctx.runMutation(internal.messages.send, {
        body,
        identityName,
        threadId,
      });
    const fail = (reason: string) =>
      ctx
        .runMutation(internal.messages.update, {
          messageId: botMessageId,
          patch: {
            error: reason,
          },
        })
        .then(() => {
          throw new Error(reason);
        });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await fail(
        "Add your OPENAI_API_KEY as an env variable in the dashboard:" +
        "https://dashboard.convex.dev"
      );
    }
    const basePath = "https://api.together.xyz/v1";
    const configuration = new Configuration({ apiKey, basePath });
    const openai = new OpenAIApi(configuration);

    const gptMessages = [];
    let lastInstructions = null;
    for (const { body, author, instructions } of messages) {
      if (instructions && instructions !== lastInstructions) {
        gptMessages.push({
          role: "system" as const,
          content: instructions,
        });
        lastInstructions = instructions;
      }
      gptMessages.push({ role: author, content: body });
    }
    if (instructions !== lastInstructions) {
      gptMessages.push({
        role: "system" as const,
        content: instructions ?? "You are a helpful assistant",
      });
      lastInstructions = instructions;
    }

    try {
      const openaiResponse = await openai.createChatCompletion({
        model: "xu.briguy@gmail.com/Mistral-7B-Instruct-v0.2-2024-02-17-20-53-49",
        messages: gptMessages,
        stop: ["<human>", "<SYS>", "<<SYS>>", "[/INST]", "</s>", "<</SYS>>", "\n\n"],
        max_tokens: 150,
      });
      await ctx.runMutation(internal.messages.update, {
        messageId: botMessageId,
        patch: {
          body: openaiResponse.data.choices[0].message?.content,
          usage: openaiResponse.data.usage,
          updatedAt: Date.now(),
          ms: Number(openaiResponse.headers["openai-processing-ms"]),
        },
      });
    } catch (e) {
      await fail(`OpenAI error: ${e}`);
    }
  },
});
