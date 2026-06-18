import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let client = null;
let transport = null;
let isConnecting = false;
let connectionPromise = null;

/**
 * Lazy initialization and persistent connection management for the MCP client.
 */
const ensureConnected = async () => {
  if (client && transport) {
    return;
  }

  if (isConnecting && connectionPromise) {
    await connectionPromise;
    return;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      client = new Client({
        name: "chat-client",
        version: "1.0.0",
      });

      const serverPath = join(__dirname, "mcp-server.js");

      transport = new StdioClientTransport({
        command: "node",
        args: [serverPath],
        env: {
          ...process.env,
        },
      });

      await client.connect(transport);
    } finally {
      isConnecting = false;
      connectionPromise = null;
    }
  })();

  await connectionPromise;
};

/**
 * Invokes the MCP search tool directly to fetch live web search snippets.
 */
export const searchWebViaMCP = async (query, num = 5) => {
  await ensureConnected();

  const toolResult = await client.callTool({
    name: "search_web",
    arguments: {
      query,
      num,
    },
  });

  let searchResults = "";
  if (toolResult.content && toolResult.content.length > 0) {
    searchResults = toolResult.content[0].text;
  }

  return searchResults;
};

/**
 * MCP-driven web search Q&A pipeline.
 */
export const chatMCP = async (query) => {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const searchResults = await searchWebViaMCP(query);

    const model = new ChatOpenAI({
      model: "gpt-5",
      ...(apiKey && { apiKey }),
    });

    const answerTemplate = `You are a helpful research assistant.
Summarize the following live web search results to answer the question accurately and concisely.

Search Results:
{searchResults}

Question: {question}
Helpful Answer:`;

    const prompt = PromptTemplate.fromTemplate(answerTemplate);
    const formattedPrompt = await prompt.format({
      searchResults: searchResults || "No search results available",
      question: query,
    });

    const response = await model.invoke(formattedPrompt);
    return { text: response.content, rawResults: searchResults };
  } catch (error) {
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      client = null;
      transport = null;
    }
    throw error;
  }
};

export default chatMCP;
