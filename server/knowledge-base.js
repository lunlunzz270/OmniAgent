import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KnowledgeBaseManager {
  constructor() {
    this.uploadsDir = path.join(__dirname, "uploads");
    this.cacheDir = path.join(__dirname, ".cache");
    this.cacheFile = path.join(this.cacheDir, "vector-cache.json");

    this.embeddings = null;
    this.vectorStore = null;

    // In-memory pool of document chunks: Map<fileName, Array<Document>>
    this.documentChunksMap = new Map();
    // Document metadata registry: Map<fileName, Object>
    this.documentsMetadata = new Map();
    this.isInitialized = false;

    // Cosine similarity threshold for filtering noise and ungrounded chunks
    this.similarityThreshold = 0.70;
  }

  getEmbeddings() {
    if (!this.embeddings) {
      const apiKey = process.env.OPENAI_API_KEY;
      this.embeddings = new OpenAIEmbeddings(apiKey ? { apiKey } : {});
    }
    return this.embeddings;
  }

  getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(fileBuffer).digest("hex");
  }

  loadCacheFromDisk() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn("[KnowledgeBase] Failed to load local cache, falling back to full ingest:", err.message);
    }
    return {};
  }

  saveCacheToDisk() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const cacheData = {};
      for (const [fileName, chunks] of this.documentChunksMap.entries()) {
        const metadata = this.documentsMetadata.get(fileName);
        cacheData[fileName] = {
          metadata,
          chunks: chunks.map((c) => ({
            pageContent: c.pageContent,
            metadata: c.metadata,
          })),
        };
      }

      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2), "utf-8");
    } catch (err) {
      console.error("[KnowledgeBase] Failed to persist cache to disk:", err.message);
    }
  }

  /**
   * Initializes the knowledge base by scanning the uploads directory and hydrating vector store from cache.
   */
  async initialize() {
    if (this.isInitialized) return;

    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    const diskCache = this.loadCacheFromDisk();
    const files = fs.readdirSync(this.uploadsDir);
    const pdfFiles = files.filter(
      (file) => file.toLowerCase().endsWith(".pdf") && !file.startsWith(".")
    );

    let hasNewOrUpdatedFiles = false;

    for (const fileName of pdfFiles) {
      const filePath = path.join(this.uploadsDir, fileName);
      const currentHash = this.getFileHash(filePath);

      // Hydrate from persistent disk cache if file hash matches
      if (
        diskCache[fileName] &&
        diskCache[fileName].metadata &&
        diskCache[fileName].metadata.fileHash === currentHash
      ) {
        const cachedChunks = diskCache[fileName].chunks.map(
          (c) => new Document({ pageContent: c.pageContent, metadata: c.metadata })
        );
        this.documentChunksMap.set(fileName, cachedChunks);
        this.documentsMetadata.set(fileName, diskCache[fileName].metadata);
      } else {
        try {
          await this.addDocument(filePath, fileName, false);
          hasNewOrUpdatedFiles = true;
        } catch (err) {
          console.error(`[KnowledgeBase] Failed to parse document ${fileName}:`, err.message);
        }
      }
    }

    await this.rebuildVectorStore();

    if (hasNewOrUpdatedFiles) {
      this.saveCacheToDisk();
    }

    this.isInitialized = true;
    console.log(
      `[KnowledgeBase] Ready: ${this.documentsMetadata.size} documents, ${this.getTotalChunksCount()} chunks indexed.`
    );
  }

  /**
   * Ingests a new document with metadata indexing.
   */
  async addDocument(filePath, fileName, shouldRebuild = true) {
    const stats = fs.statSync(filePath);
    const fileHash = this.getFileHash(filePath);
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const splitDocs = await textSplitter.splitDocuments(rawDocs);

    // Tag each chunk with explicit metadata for provenance and lifecycle tracking
    const taggedDocs = splitDocs.map((doc, index) => {
      doc.metadata = {
        ...doc.metadata,
        source: fileName,
        fileName: fileName,
        chunkIndex: index,
        totalChunks: splitDocs.length,
        timestamp: new Date().toISOString(),
      };
      return doc;
    });

    this.documentChunksMap.set(fileName, taggedDocs);
    this.documentsMetadata.set(fileName, {
      fileName: fileName,
      fileSize: stats.size,
      fileHash: fileHash,
      chunksCount: taggedDocs.length,
      pageCount: rawDocs.length,
      createdAt: new Date().toISOString(),
    });

    if (shouldRebuild) {
      await this.rebuildVectorStore();
      this.saveCacheToDisk();
    }

    return this.documentsMetadata.get(fileName);
  }

  /**
   * Cascading deletion: removes disk file, purges vector chunks, and synchronizes cache.
   */
  async deleteDocument(fileName) {
    const filePath = path.join(this.uploadsDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const existed = this.documentChunksMap.has(fileName);
    this.documentChunksMap.delete(fileName);
    this.documentsMetadata.delete(fileName);

    await this.rebuildVectorStore();
    this.saveCacheToDisk();

    return {
      success: true,
      message: existed
        ? `Document '${fileName}' and its vector embeddings were purged successfully.`
        : `Document record cleared.`,
      remainingDocuments: this.getDocumentsList(),
    };
  }

  async rebuildVectorStore() {
    const allChunks = [];
    for (const chunks of this.documentChunksMap.values()) {
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      this.vectorStore = null;
      return;
    }

    this.vectorStore = await MemoryVectorStore.fromDocuments(
      allChunks,
      this.getEmbeddings()
    );
  }

  getDocumentsList() {
    return Array.from(this.documentsMetadata.values());
  }

  getTotalChunksCount() {
    let total = 0;
    for (const chunks of this.documentChunksMap.values()) {
      total += chunks.length;
    }
    return total;
  }

  /**
   * Similarity search with score threshold filtering to mitigate hallucinations.
   */
  async similaritySearch(query, k = 4) {
    if (!this.vectorStore || this.getTotalChunksCount() === 0) {
      return {
        hasRelevantContext: false,
        relevantDocs: [],
        context: "",
        highestScore: 0,
        matchedSources: [],
      };
    }

    const rawResults = await this.vectorStore.similaritySearchWithScore(query, k);

    const scoredDocs = rawResults.map(([doc, score]) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata,
      score: Number(score.toFixed(4)),
    }));

    const highestScore = scoredDocs.length > 0 ? scoredDocs[0].score : 0;

    // Filter chunks below the confidence threshold
    const relevantDocs = scoredDocs.filter((item) => item.score >= this.similarityThreshold);

    const matchedSources = Array.from(
      new Set(relevantDocs.map((item) => item.metadata?.fileName).filter(Boolean))
    );

    const hasRelevantContext = relevantDocs.length > 0;
    const context = relevantDocs.map((item) => item.pageContent).join("\n\n");

    return {
      hasRelevantContext,
      relevantDocs,
      context,
      highestScore,
      matchedSources,
    };
  }
}

const knowledgeBaseManager = new KnowledgeBaseManager();
export default knowledgeBaseManager;
