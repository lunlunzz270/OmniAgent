import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import queryAgent from "./chat.js";
import knowledgeBaseManager from "./knowledge-base.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

const PORT = process.env.PORT || 5001;

/**
 * GET /documents - Retrieve all active documents and their indexing metadata
 */
app.get("/documents", (req, res) => {
  try {
    const documents = knowledgeBaseManager.getDocumentsList();
    res.json({
      success: true,
      count: documents.length,
      totalChunks: knowledgeBaseManager.getTotalChunksCount(),
      documents,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /upload - Asynchronous document ingestion into the vector store
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const savedFilePath = req.file.path;
    const originalName = req.file.originalname;

    // Ingest document, chunk text, and compute vector embeddings
    const docMeta = await knowledgeBaseManager.addDocument(savedFilePath, originalName, true);

    res.json({
      success: true,
      message: `File '${originalName}' ingested and indexed successfully.`,
      document: docMeta,
    });
  } catch (error) {
    console.error("[Upload] Ingestion failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /documents/:fileName - Cascading purge of document from disk and vector cache
 */
app.delete("/documents/:fileName", async (req, res) => {
  try {
    const rawFileName = decodeURIComponent(req.params.fileName);
    const result = await knowledgeBaseManager.deleteDocument(rawFileName);
    res.json(result);
  } catch (error) {
    console.error("[Delete] Deletion failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /chat - Dynamic query routing between grounded RAG and MCP web search
 */
app.get("/chat", async (req, res) => {
  try {
    const question = req.query.question;
    if (!question) {
      return res.status(400).json({ error: "Query parameter 'question' is required." });
    }

    const response = await queryAgent(question);

    // Provide modern structured payload, while maintaining backward-compatible keys
    res.json({
      answer: response.answer,
      sourceType: response.sourceType,
      confidence: response.confidence,
      sources: response.sources,
      routeReason: response.routeReason,
      // Backward-compatibility keys for legacy UI rendering
      ragAnswer:
        response.sourceType === "DOCUMENT_RAG" || response.sourceType === "HYBRID"
          ? response.answer
          : null,
      mcpAnswer:
        response.sourceType === "MCP_WEB_SEARCH" || response.sourceType === "HYBRID"
          ? response.answer
          : null,
    });
  } catch (error) {
    console.error("[Chat] Routing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize knowledge base on server startup
knowledgeBaseManager
  .initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`OmniAgent Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[Startup] Failed to initialize knowledge base:", err);
    process.exit(1);
  });
