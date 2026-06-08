/**
 * tfidf.ts — Pure TypeScript TF-IDF and Cosine Similarity search engine.
 *
 * Provides fast, zero-dependency semantic-like retrieval of codebase symbol nodes.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GraphNode, SemanticSearchResult } from './types.js';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
  'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is',
  'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of',
  'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than', 'that', 'thats',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll',
  'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt',
  'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which',
  'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll',
  'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves',
  // Common programming terms to de-emphasize in similarity
  'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from', 'return', 'default', 'async', 'await',
]);

/** Split text into lowercased terms and strip stopwords */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/ig, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}

interface TermDocFreq {
  docCount: number;
}

/** Pre-processed document vector information */
interface DocVector {
  node: GraphNode;
  termTfs: Map<string, number>;
}

export class TfIdfEngine {
  private docVectors: DocVector[] = [];
  private docFreqs = new Map<string, TermDocFreq>();
  private idfs = new Map<string, number>();
  private totalDocs = 0;
  private rootDir: string;

  constructor(nodes: GraphNode[], rootDir: string) {
    this.rootDir = rootDir;
    this.buildIndex(nodes);
  }

  /**
   * Reads snippet code for a node if possible.
   * To prevent slow startup, we fall back to properties if file reading fails.
   */
  private getNodeContent(node: GraphNode): string {
    let sourceContent = '';
    if (node.label !== 'File' && node.lineStart > 0 && node.lineEnd >= node.lineStart) {
      try {
        const fullPath = path.join(this.rootDir, node.filePath);
        if (fs.existsSync(fullPath)) {
          const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
          // Limit code snippet size (max 40 lines) to avoid over-indexing filler code
          const start = Math.max(0, node.lineStart - 1);
          const end = Math.min(lines.length - 1, node.lineEnd);
          const maxLines = lines.slice(start, end + 1);
          sourceContent = maxLines.slice(0, 40).join(' ');
        }
      } catch {
        // Fallback silently to signature and metadata
      }
    }

    return [
      node.name,
      node.label,
      node.filePath,
      node.signature,
      sourceContent,
      JSON.stringify(node.properties),
    ].join(' ');
  }

  private buildIndex(nodes: GraphNode[]): void {
    const docTokensList: Array<{ node: GraphNode; tokens: string[] }> = [];

    // 1. Tokenize all nodes
    for (const node of nodes) {
      const text = this.getNodeContent(node);
      const tokens = tokenize(text);
      if (tokens.length > 0) {
        docTokensList.push({ node, tokens });
      }
    }

    this.totalDocs = docTokensList.length;

    // 2. Compute Term Frequencies and Document Frequencies
    for (const { node, tokens } of docTokensList) {
      const termTfs = new Map<string, number>();
      for (const t of tokens) {
        termTfs.set(t, (termTfs.get(t) || 0) + 1);
      }

      // Normalize Term Frequency by document length
      for (const [t, count] of termTfs.entries()) {
        termTfs.set(t, count / tokens.length);
      }

      this.docVectors.push({ node, termTfs });

      // Count term document appearances
      const uniqueTerms = new Set(tokens);
      for (const t of uniqueTerms) {
        let df = this.docFreqs.get(t);
        if (!df) {
          df = { docCount: 0 };
          this.docFreqs.set(t, df);
        }
        df.docCount++;
      }
    }

    // 3. Compute Inverse Document Frequencies (IDF)
    for (const [term, df] of this.docFreqs.entries()) {
      // Math.log(1 + N / df)
      const idf = Math.log(1 + this.totalDocs / df.docCount);
      this.idfs.set(term, idf);
    }
  }

  /** Compute TF-IDF vector of a tokenized query/doc */
  private getTfIdfVector(termTfs: Map<string, number>): Map<string, number> {
    const tfidf = new Map<string, number>();
    for (const [term, tfVal] of termTfs.entries()) {
      const idfVal = this.idfs.get(term) || 0;
      tfidf.set(term, tfVal * idfVal);
    }
    return tfidf;
  }

  /** Run similarity search */
  public search(query: string, limit = 5): SemanticSearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.totalDocs === 0) {
      return [];
    }

    // Compute Query TF-IDF Vector
    const queryTfs = new Map<string, number>();
    for (const q of queryTokens) {
      queryTfs.set(q, (queryTfs.get(q) || 0) + 1);
    }
    for (const [q, count] of queryTfs.entries()) {
      queryTfs.set(q, count / queryTokens.length);
    }
    const queryVector = this.getTfIdfVector(queryTfs);

    // Score all documents
    const results: SemanticSearchResult[] = [];

    for (const doc of this.docVectors) {
      const docVector = this.getTfIdfVector(doc.termTfs);
      const score = cosineSimilarity(queryVector, docVector);
      if (score > 0) {
        results.push({ node: doc.node, score });
      }
    }

    // Sort by score descending and take top limits
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

/** Compute Cosine Similarity between two sparse vectors */
function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const [term, val] of vec1.entries()) {
    dotProduct += val * (vec2.get(term) || 0);
    norm1 += val * val;
  }

  for (const val of vec2.values()) {
    norm2 += val * val;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
