import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import knowledgeBaseManager from "./knowledge-base.js";
import { chatMCP, searchWebViaMCP } from "./chat-mcp.js";

const HIGH_CONFIDENCE_THRESHOLD = 0.80;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Executes private document RAG with grounded context.
 */
const executeDocumentRAG = async (query, context) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = new ChatOpenAI({
    model: "gpt-5",
    ...(apiKey && { apiKey }),
  });

  const template = `You are OmniAgent, a helpful and precise knowledge copilot.
Use the following pieces of retrieved context from private documents to answer the question at the end.
If the context does not contain enough information to answer the question, state clearly that the answer cannot be found in the current documents.
Do not make up facts. Keep the answer concise and well-structured.

Retrieved Document Context:
{context}

Question: {question}
Helpful Answer:`;

  const prompt = PromptTemplate.fromTemplate(template);
  const formattedPrompt = await prompt.format({
    context,
    question: query,
  });

  const response = await model.invoke(formattedPrompt);
  return response.content;
};

/**
 * Synthesizes private document context and live web search results into a unified hybrid answer.
 */
const executeHybridGeneration = async (query, documentContext, webContext) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = new ChatOpenAI({
    model: "gpt-5",
    ...(apiKey && { apiKey }),
  });

  const template = `You are OmniAgent, an intelligent knowledge copilot.
To answer the question, you have been provided with:
1. Private Document Context (retrieved from internal knowledge base)
2. Live Web Search Results (fetched via SerpAPI MCP server)

Synthesize a comprehensive, well-grounded answer:
- Ground your answer primarily in the private document context for internal concepts and proprietary information.
- Use the live web search findings to enrich details, provide recent updates, or verify external facts.
- Clearly delineate internal knowledge vs. external web findings where appropriate.

[Private Document Context]:
{documentContext}

[Live Web Search Results]:
{webContext}

Question: {question}
Synthesized Answer:`;

  const prompt = PromptTemplate.fromTemplate(template);
  const formattedPrompt = await prompt.format({
    documentContext,
    webContext: webContext || "No additional web results available.",
    question: query,
  });

  const response = await model.invoke(formattedPrompt);
  return response.content;
};

/**
 * Tiered Query Router: Dynamically routes between Document RAG, Live MCP Web Search, and Hybrid Synthesis.
 */
export const queryAgent = async (query) => {
  if (!query || query.trim() === "") {
    return {
      answer: "Please provide a valid question.",
      sourceType: "NONE",
      confidence: 0,
      sources: [],
      routeReason: "Empty query",
    };
  }

  // 1. Probe local knowledge base with confidence score
  const retrieval = await knowledgeBaseManager.similaritySearch(query, 4);
  const score = retrieval.highestScore;

  // 2. Tiered Routing Decision
  if (score >= HIGH_CONFIDENCE_THRESHOLD) {
    // High confidence: strictly grounded private document RAG
    const ragAnswer = await executeDocumentRAG(query, retrieval.context);
    return {
      answer: ragAnswer,
      sourceType: "DOCUMENT_RAG",
      confidence: score,
      sources: retrieval.matchedSources,
      routeReason: `High-confidence match (${score}) in private documents.`,
    };
  } else if (score >= LOW_CONFIDENCE_THRESHOLD) {
    // Medium confidence: hybrid synthesis combining local context with MCP live search
    const webResults = await searchWebViaMCP(query);
    const hybridAnswer = await executeHybridGeneration(
      query,
      retrieval.context,
      webResults
    );
    return {
      answer: hybridAnswer,
      sourceType: "HYBRID",
      confidence: score,
      sources: [...retrieval.matchedSources, "Live Web Search (SerpAPI MCP)"],
      routeReason: `Moderate match (${score}) in private documents; enriched with MCP live web search.`,
    };
  } else {
    // Low confidence: route entirely to MCP live web search to avoid hallucinations
    const mcpResult = await chatMCP(query);
    return {
      answer: mcpResult.text,
      sourceType: "MCP_WEB_SEARCH",
      confidence: score,
      sources: ["Live Web Search (SerpAPI MCP)"],
      routeReason: `Low match (${score}) in private documents; dynamically routed to live web search.`,
    };
  }
};

export default queryAgent;
