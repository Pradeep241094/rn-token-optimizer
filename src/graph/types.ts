// ─── Node labels ─────────────────────────────────────────────────────────────

export type NodeLabel =
  | 'File'
  | 'Function'
  | 'Class'
  | 'Interface'
  | 'Type'
  | 'Component'
  // RN-specific
  | 'Screen'
  | 'Hook'
  | 'Navigator'
  | 'Provider'
  | 'Slice';

// ─── Edge types ───────────────────────────────────────────────────────────────

export type EdgeType =
  | 'DEFINES'        // File → symbol
  | 'IMPORTS'        // File → File
  | 'CALLS'          // Function → Function
  | 'EXPORTS'        // File → symbol
  | 'IMPLEMENTS'     // Class → Interface
  | 'INHERITS'       // Class → Class
  | 'RENDERS'        // Component/Screen → Component (JSX usage)
  | 'NAVIGATES_TO'   // Screen/Function → Screen (navigate/push/replace)
  | 'USES_TYPE';     // Function/Class → Type/Interface

// ─── Core graph entities ──────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: NodeLabel;
  name: string;
  qualifiedName: string;   // e.g. src/screens/Login.handleAuth
  filePath: string;        // relative to project root
  lineStart: number;
  lineEnd: number;
  signature: string;       // short human-readable signature
  exported: boolean;
  async: boolean;
  language: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  weight: number;
  properties: Record<string, unknown>;
}

export interface GraphProject {
  id: string;
  name: string;
  rootPath: string;
  indexedAt: string;
  nodeCount: number;
  edgeCount: number;
}

// ─── Query inputs ─────────────────────────────────────────────────────────────

export interface SearchOptions {
  namePattern?: string;        // substring or regex-like
  label?: NodeLabel;
  filePattern?: string;        // substring of filePath
  minCallers?: number;
  maxCallers?: number;
  exported?: boolean;
  limit?: number;
  offset?: number;
}

export interface TraceOptions {
  functionName: string;
  direction: 'inbound' | 'outbound' | 'both';
  depth: number;               // 1-5
}

// ─── Query outputs ────────────────────────────────────────────────────────────

export interface SearchResult {
  node: GraphNode;
  callerCount: number;
  calleeCount: number;
}

export interface TraceNode {
  node: GraphNode;
  depth: number;
  edgeType: EdgeType;
  children: TraceNode[];
}

export interface TraceResult {
  root: GraphNode;
  inbound: TraceNode[];    // who calls this
  outbound: TraceNode[];   // what this calls
}

export interface HotspotEntry {
  node: GraphNode;
  inDegree: number;        // how many things call/render this
  outDegree: number;
}

export interface ArchitectureReport {
  projectName: string;
  indexedAt: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    fileCount: number;
    functionCount: number;
    classCount: number;
    screenCount: number;
    hookCount: number;
    navigatorCount: number;
  };
  entryPoints: GraphNode[];       // exported from index/App files
  screens: GraphNode[];
  navigators: GraphNode[];
  hotspots: HotspotEntry[];       // top 10 by in-degree
  deadCodeCount: number;
  rnStack: string[];              // dep aliases from package.json
}

export interface ChangeImpact {
  changedSymbol: GraphNode;
  risk: 'high' | 'medium' | 'low';
  affectedCallers: GraphNode[];
  blastRadius: number;
}

export interface DeadCodeEntry {
  node: GraphNode;
  reason: string;
}

// ─── Raw parse output (intermediate, not persisted) ──────────────────────────

export interface RawCallRef {
  callerQualifiedName: string;
  calleeName: string;               // unresolved name from source
  line: number;
}

export interface RawNavigateRef {
  callerQualifiedName: string;
  targetScreenName: string;
  line: number;
}

export interface RawRenderRef {
  callerQualifiedName: string;
  renderedComponentName: string;
  line: number;
}

export interface ParsedFile {
  filePath: string;                 // relative to project root
  nodes: GraphNode[];
  importedFiles: string[];          // resolved relative paths
  rawCalls: RawCallRef[];
  rawNavigates: RawNavigateRef[];
  rawRenders: RawRenderRef[];
}
