"use node";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import axios from 'axios';

const monsterApiKey = 'INSERT API KEY HERE';
const apiUrl = 'https://68c611d9-c026-4477-a296-9e017e39a15f.monsterapi.ai/generate';

const inputs = {
    "input_variables": {"prompt": "You are a helpful AI teacher. Your student will be telling you ideas for a paper they are writing, but unfortunately their ideas tend to have flaws. In order to be a useful and helpful teacher, you must help by pointing out potential counterarguments for their paper ideas. \n You must make sure *not* to be overly agreeable, and indicate all potential counterarguments against the initial argument. Make sure you focus on counteragruments against the overall claim, rather than small details in the argument.\n Also, for any writing provided please mention any ways to improve the phrasing or understandability of the argument.", "user": "What is your opinion on my idea to make ChatGPT for dogs?"},
    "prompt": "What is your opinion on my idea to make ChatGPT for dogs?",
    "stream": false,
    "max_tokens": 256,
    "n": 1,
    "best_of": 1,
    "presence_penalty": 0,
    "frequency_penalty": 0,
    "repetition_penalty": 2,
    "temperature": 0.3,
    "top_p": 0.2,
    "top_k": -1,
    "min_p": 0,
    "use_beam_search": false,
    "length_penalty": 1,
    "early_stopping": false
};


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
  
      var gptMessages = "";
      let lastInstructions = null;
      for (const { body, author, instructions } of messages) {
        if (instructions && instructions !== lastInstructions) {
          gptMessages += instructions;
          lastInstructions = instructions;
        }
        gptMessages += body;
      }
      if (instructions !== lastInstructions) {
        gptMessages += instructions ?? "You are a helpful assistant";
        lastInstructions = instructions;
      }
        
        try {
            // Make the HTTP POST request
            const response = await axios.post(apiUrl, {}, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${monsterApiKey}`,
              },
            });
        
            // Parse the JSON response
            const jsonResponse = response.data;
        
            // Access the "text" key (assuming it's an array)
            const textArray: string[] = jsonResponse.text;
        
            // Get the first string from the array
            const firstString: string | undefined = textArray[0];
        
            // Display the first string
            if (firstString !== undefined) {
              console.log('First string:', firstString);
        
              // Now you can use the firstString in your subsequent logic
              await ctx.runMutation(internal.messages.update, {
                messageId: botMessageId,
                patch: {
                  body: firstString,
                  usage: null,
                  updatedAt: Date.now(),
                  ms: 0,
                },
              });
            } else {
              console.error('No strings found in the "text" array.');
            }
          } catch (error) {
            // Handle errors
            await fail(`Error: ${error}`);
          }
    },
  });

  export const get_response = action({
    args: {
      identityName: v.string(),
      threadId: v.id("threads"),
    },
    handler: async (ctx, { identityName, threadId }) => {
      const { instructions, messages, botMessageId } =
        await ctx.runMutation(internal.messages.receive, {
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
        // Make the HTTP POST request
        const response = await axios.post(apiUrl, {}, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${monsterApiKey}`,
          },
        });
    
        // Parse the JSON response
        const jsonResponse = response.data;
    
        // Access the "text" key (assuming it's an array)
        const textArray: string[] = jsonResponse.text;
    
        // Get the first string from the array
        const firstString: string | undefined = textArray[0];
    
        // Display the first string
        if (firstString !== undefined) {
          console.log('First string:', firstString);
    
          // Now you can use the firstString in your subsequent logic
          await ctx.runMutation(internal.messages.update, {
            messageId: botMessageId,
            patch: {
              body: firstString,
              usage: null,
              updatedAt: Date.now(),
              ms: 0,
            },
          });
        } else {
          console.error('No strings found in the "text" array.');
        }
      } catch (error) {
        // Handle errors
        await fail(`Error: ${error}`);
      }
    },
  });
