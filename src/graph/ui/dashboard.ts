/**
 * dashboard.ts — Returns the redesigned Graph Sandbox HTML as a string.
 *
 * Design language matches https://prmargas.com/projects/rn-token-optimizer/
 * Dark navy background, coral/cyan gradients, monospace code blocks.
 *
 * UX improvements:
 *  - Welcome/onboarding modal for first-time users
 *  - "What is this?" explainer header bar
 *  - Legend panel explaining every node type + edge type
 *  - Full node names (no truncation)
 *  - Guided "How to Use" sidebar section
 *  - Human-readable labels and tooltips everywhere
 */

/* eslint-disable max-len */
export function getDashboardHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>rn-token-optimizer — Code Graph Explorer</title>
<style>
/* ── Reset & Design Tokens ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  /* Colors — match prmargas.com */
  --bg:          #080b10;
  --bg2:         #0d1117;
  --bg3:         #161b22;
  --bg4:         #1f2937;
  --border:      rgba(255,255,255,0.07);
  --border2:     rgba(255,255,255,0.12);
  --text:        #e6edf3;
  --text-muted:  #8b949e;
  --text-dim:    #4a5568;

  /* Brand gradients */
  --grad-coral:  #f97316;
  --grad-cyan:   #22d3ee;
  --grad-purple: #7c3aed;
  --teal:        #14b8a6;
  --teal-dark:   #0f766e;

  /* Node label colors */
  --c-screen:     #22d3ee;
  --c-hook:       #a78bfa;
  --c-function:   #94a3b8;
  --c-class:      #fbbf24;
  --c-navigator:  #60a5fa;
  --c-provider:   #fb923c;
  --c-component:  #34d399;
  --c-slice:      #4ade80;
  --c-controller: #22d3ee;
  --c-service:    #34d399;
  --c-repository: #60a5fa;
  --c-middleware:  #f472b6;
  --c-apiendpoint:#fbbf24;
  --c-interface:  #64748b;
  --c-type:       #64748b;
  --c-namespace:  #475569;
  --c-default:    #94a3b8;

  --sidebar-w: 280px;
  --detail-w:  320px;
  --header-h:  52px;
  --bar-h:     42px;
  --font-mono: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

html, body { height: 100%; overflow: hidden; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  display: flex;
  flex-direction: column;
}

/* ── Welcome Modal ──────────────────────────────────────────────────────────── */
#welcome-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(8,11,16,0.92);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
#welcome-overlay.hidden { display: none; }

#welcome-modal {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: 16px;
  max-width: 680px;
  width: 100%;
  padding: 36px 40px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6);
}
.wm-logo {
  display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
}
.wm-logo-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #22d3ee);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.wm-logo-text { font-size: 15px; font-weight: 700; color: var(--text); font-family: var(--font-mono); }
.wm-logo-sub  { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

.wm-headline {
  font-size: 26px; font-weight: 800; line-height: 1.3; margin-bottom: 12px;
}
.wm-headline .coral { color: var(--grad-coral); }
.wm-headline .cyan  { background: linear-gradient(90deg, #22d3ee, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

.wm-desc {
  color: var(--text-muted); font-size: 14px; line-height: 1.7; margin-bottom: 24px;
}

.wm-steps {
  display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px;
}
.wm-step {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--bg3); border-radius: 10px; padding: 12px 14px;
  border: 1px solid var(--border);
}
.wm-step-num {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--teal), #22d3ee);
  color: #000; font-weight: 800; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
}
.wm-step-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
.wm-step-body  { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
.wm-step-body code {
  background: var(--bg4); padding: 1px 6px; border-radius: 4px;
  font-family: var(--font-mono); color: var(--grad-cyan); font-size: 11px;
}

.wm-actions { display: flex; gap: 10px; align-items: center; }
.btn-primary {
  padding: 11px 24px; border-radius: 8px; font-size: 14px; font-weight: 700;
  background: var(--teal); color: #000; border: none; cursor: pointer;
  transition: background .15s, transform .1s;
}
.btn-primary:hover { background: #0d9488; transform: translateY(-1px); }
.btn-secondary {
  padding: 11px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: transparent; color: var(--text-muted); border: 1px solid var(--border2);
  cursor: pointer; transition: color .15s, border-color .15s;
}
.btn-secondary:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }

/* ── Header ─────────────────────────────────────────────────────────────────── */
#header {
  height: var(--header-h); flex-shrink: 0;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 16px; gap: 12px;
}
#header .logo {
  display: flex; align-items: center; gap: 8px; text-decoration: none;
}
.logo-icon {
  width: 28px; height: 28px; border-radius: 6px;
  background: linear-gradient(135deg, #7c3aed, #22d3ee);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.logo-name { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--text); }
.logo-sep  { color: var(--border2); }
.logo-proj { font-family: var(--font-mono); font-size: 13px; color: var(--grad-cyan); font-weight: 600; }

.stat-pill {
  background: rgba(255,255,255,0.05); border: 1px solid var(--border);
  border-radius: 20px; padding: 3px 10px; font-size: 11px;
  color: var(--text-muted); white-space: nowrap; font-family: var(--font-mono);
}
.stat-pill .val { color: var(--grad-cyan); font-weight: 700; }

#header-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.hdr-btn {
  padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border2); background: transparent;
  color: var(--text-muted); transition: all .15s; white-space: nowrap;
}
.hdr-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }
.hdr-btn.primary { background: var(--teal); color: #000; border-color: transparent; }
.hdr-btn.primary:hover { background: #0d9488; }

/* ── Explainer bar ──────────────────────────────────────────────────────────── */
#explainer-bar {
  background: linear-gradient(90deg, rgba(124,58,237,0.12), rgba(20,184,166,0.08));
  border-bottom: 1px solid rgba(124,58,237,0.2);
  padding: 8px 16px; font-size: 12px; color: var(--text-muted);
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
#explainer-bar .tag {
  background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.3);
  color: var(--teal); border-radius: 20px; padding: 1px 8px; font-size: 10px;
  font-weight: 700; white-space: nowrap;
}
#explainer-bar strong { color: var(--text); }

/* ── Filter bar ─────────────────────────────────────────────────────────────── */
#filter-bar {
  height: var(--bar-h); flex-shrink: 0;
  background: var(--bg2); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 12px; gap: 6px;
  overflow-x: auto; scrollbar-width: none;
}
#filter-bar::-webkit-scrollbar { display: none; }
.fb-label { color: var(--text-dim); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin-right: 4px; white-space: nowrap; }
.filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  cursor: pointer; border: 1px solid transparent; transition: all .15s;
  user-select: none; white-space: nowrap;
}
.filter-pill .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.filter-pill .pill-count { opacity: 0.55; font-size: 10px; }
.filter-pill.active { opacity: 1; }
.filter-pill.inactive { opacity: 0.3; }
.filter-pill:hover { opacity: 1 !important; transform: translateY(-1px); }

/* ── Main Layout ─────────────────────────────────────────────────────────────── */
#main { display: flex; flex: 1; overflow: hidden; }

/* ── Left Sidebar ───────────────────────────────────────────────────────────── */
#sidebar {
  width: var(--sidebar-w); flex-shrink: 0;
  background: var(--bg2); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}

/* Search */
.sidebar-section { border-bottom: 1px solid var(--border); }
.sidebar-section-header {
  padding: 10px 12px 8px; font-size: 10px; font-weight: 700; color: var(--text-dim);
  text-transform: uppercase; letter-spacing: .1em; display: flex; align-items: center; gap: 6px;
}
.sidebar-section-header .dot { width: 6px; height: 6px; border-radius: 50%; }

#search-wrap { padding: 0 10px 10px; }
#search-input {
  width: 100%; background: var(--bg3); border: 1px solid var(--border2);
  color: var(--text); padding: 8px 10px 8px 30px; border-radius: 8px;
  font-family: var(--font-mono); font-size: 12px; outline: none;
  transition: border-color .2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%238b949e' viewBox='0 0 16 16'%3E%3Cpath d='M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: 8px center;
}
#search-input:focus { border-color: var(--teal); }
#search-input::placeholder { color: var(--text-dim); }
.search-hint-text {
  padding: 8px 12px 4px; font-size: 11px; color: var(--text-dim); line-height: 1.5;
}

/* Search Results */
#search-results { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }

.no-results {
  padding: 16px 12px; font-size: 12px; color: var(--text-dim);
  text-align: center; line-height: 1.6;
}
.no-results .cmd {
  background: var(--bg3); padding: 6px 10px; border-radius: 6px; margin-top: 10px;
  font-family: var(--font-mono); font-size: 11px; color: var(--grad-cyan); display: block;
}

.result-item {
  padding: 8px 12px; cursor: pointer; border-left: 2px solid transparent;
  transition: all .12s; display: flex; flex-direction: column; gap: 2px;
}
.result-item:hover { background: rgba(255,255,255,0.04); border-left-color: var(--teal); }
.result-item.selected { background: rgba(20,184,166,0.08); border-left-color: var(--teal); }

.result-name { font-weight: 700; font-size: 12px; font-family: var(--font-mono); }
.result-label { font-size: 10px; font-weight: 600; }
.result-file  { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }
.result-score { font-size: 10px; color: var(--teal); }

/* Legend */
#legend-section { overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.legend-body { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 8px; }
.legend-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { font-size: 11px; font-weight: 600; }
.legend-desc { font-size: 10px; color: var(--text-dim); }
.legend-edge-section { padding: 4px 12px 10px; }
.legend-edge-title { font-size: 10px; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
.legend-edge-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.legend-edge-line { width: 22px; height: 2px; border-radius: 1px; position: relative; }
.legend-edge-line::after { content: '›'; position: absolute; right: -6px; top: -7px; font-size: 14px; }

/* How to Use */
#howto-section { border-top: 1px solid var(--border); }
.howto-body { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 8px; }
.howto-step { display: flex; gap: 8px; align-items: flex-start; }
.howto-num {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: rgba(20,184,166,0.2); border: 1px solid rgba(20,184,166,0.4);
  color: var(--teal); font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; margin-top: 1px;
}
.howto-text { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.howto-text strong { color: var(--text); }
.howto-text code {
  background: var(--bg3); padding: 1px 5px; border-radius: 3px;
  font-family: var(--font-mono); color: var(--grad-cyan); font-size: 10px;
}

/* ── Graph canvas ───────────────────────────────────────────────────────────── */
#canvas-wrap {
  flex: 1; position: relative; overflow: hidden;
  background: radial-gradient(ellipse at 25% 25%, rgba(124,58,237,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 75% 75%, rgba(20,184,166,0.05) 0%, transparent 55%),
              var(--bg);
}

#graph-svg {
  width: 100%; height: 100%;
  cursor: grab; user-select: none;
}
#graph-svg:active { cursor: grabbing; }

.node-circle { cursor: pointer; transition: filter .15s; }
.node-circle:hover { filter: brightness(1.4) drop-shadow(0 0 5px currentColor); }
.node-text {
  font-family: var(--font-mono); font-size: 10px;
  pointer-events: none; text-anchor: middle; dominant-baseline: middle;
  fill: rgba(255,255,255,0.65);
}
.edge-line { stroke-opacity: 0.3; fill: none; }

#empty-state {
  position: absolute; inset: 0; display: none; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
  color: var(--text-muted); text-align: center;
}
.empty-icon { font-size: 48px; }
.empty-title { font-size: 18px; font-weight: 700; color: var(--text); }
.empty-sub   { font-size: 13px; color: var(--text-muted); max-width: 380px; line-height: 1.6; }
.empty-cmd {
  background: var(--bg3); border: 1px solid var(--border2); border-radius: 8px;
  padding: 10px 20px; font-family: var(--font-mono); font-size: 13px;
  color: var(--grad-cyan);
}

#canvas-hint {
  position: absolute; bottom: 12px; left: 12px;
  font-size: 11px; color: var(--text-dim);
  background: rgba(8,11,16,0.7); padding: 4px 12px; border-radius: 20px;
  pointer-events: none; backdrop-filter: blur(4px);
}

/* Selected node glow */
.node-selected circle { filter: drop-shadow(0 0 8px var(--teal)); }

/* ── Right Detail Panel ─────────────────────────────────────────────────────── */
#detail-panel {
  width: var(--detail-w); flex-shrink: 0;
  background: var(--bg2); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
  transform: translateX(100%);
  transition: transform .25s cubic-bezier(.4,0,.2,1);
}
#detail-panel.open { transform: translateX(0); }

#detail-head {
  padding: 14px 14px 10px; border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 6px;
}
#detail-head-row1 { display: flex; align-items: center; gap: 8px; }
#detail-label-badge {
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
}
#detail-name { font-family: var(--font-mono); font-size: 14px; font-weight: 700; word-break: break-all; flex: 1; }
#detail-close {
  margin-left: auto; cursor: pointer; color: var(--text-muted); font-size: 20px;
  line-height: 1; padding: 0 4px; border-radius: 4px; transition: color .15s; flex-shrink: 0;
}
#detail-close:hover { color: var(--text); }
#detail-what-is {
  font-size: 11px; color: var(--text-muted); line-height: 1.5;
  background: var(--bg3); border-radius: 6px; padding: 6px 8px;
}

#detail-body {
  flex: 1; overflow-y: auto; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 16px;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}

.detail-sec { display: flex; flex-direction: column; gap: 6px; }
.detail-sec-title {
  font-size: 10px; font-weight: 700; color: var(--text-dim);
  text-transform: uppercase; letter-spacing: .1em;
  display: flex; align-items: center; gap: 6px;
}
.detail-sec-title .tip {
  font-size: 9px; background: rgba(255,255,255,0.05); border-radius: 4px;
  padding: 1px 5px; color: var(--text-dim); text-transform: none; letter-spacing: 0;
  font-weight: 400;
}
.detail-meta { font-size: 12px; color: var(--text-muted); word-break: break-all; font-family: var(--font-mono); }
.detail-meta strong { color: var(--text); }

.rel-item {
  padding: 5px 8px; background: var(--bg3); border-radius: 6px;
  font-size: 11px; cursor: pointer; border: 1px solid transparent;
  transition: border-color .12s; display: flex; gap: 6px; align-items: center;
  word-break: break-all;
}
.rel-item:hover { border-color: var(--teal); }
.rel-label { font-size: 9px; font-weight: 700; flex-shrink: 0; }
.rel-name  { font-family: var(--font-mono); font-size: 11px; flex: 1; }
.rel-edge  { font-size: 9px; color: var(--text-dim); flex-shrink: 0; }

#snippet-box {
  background: #0d1117; border: 1px solid var(--border2);
  border-radius: 8px; overflow: hidden;
}
#snippet-title {
  padding: 5px 10px; font-size: 10px; color: var(--text-muted);
  background: var(--bg3); border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
}
#snippet-code {
  padding: 10px; font-family: var(--font-mono); font-size: 11px;
  line-height: 1.6; overflow-x: auto; white-space: pre;
  color: #adbac7; max-height: 220px; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}

/* loading */
.spinner {
  width: 20px; height: 20px; border: 2px solid var(--border);
  border-top-color: var(--teal); border-radius: 50%;
  animation: spin .6s linear infinite; margin: 20px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Tooltip ─────────────────────────────────────────────────────────────────── */
#tooltip {
  position: fixed; background: rgba(13,17,23,0.96); border: 1px solid var(--border2);
  border-radius: 10px; padding: 8px 12px; font-size: 12px; pointer-events: none;
  opacity: 0; transition: opacity .12s; z-index: 200; max-width: 240px;
  backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
#tooltip.visible { opacity: 1; }
.tt-label { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
.tt-name  { font-family: var(--font-mono); font-weight: 700; margin-bottom: 4px; word-break: break-all; }
.tt-file  { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); }
.tt-sig   { font-size: 10px; color: var(--text-dim); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.tt-hint  { font-size: 10px; color: var(--teal); margin-top: 4px; }

/* ── Scrollbars ──────────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════════════════════
     WELCOME MODAL
══════════════════════════════════════════════════════════════════════════════ -->
<div id="welcome-overlay">
  <div id="welcome-modal">
    <div class="wm-logo">
      <div class="wm-logo-icon">🧠</div>
      <div>
        <div class="wm-logo-text">rn-token-optimizer</div>
        <div class="wm-logo-sub">Code Graph Explorer</div>
      </div>
    </div>

    <h1 class="wm-headline">
      Your codebase as a <span class="cyan">queryable graph</span>,<br>
      not <span class="coral">200 files to read</span>.
    </h1>
    <p class="wm-desc">
      This interactive explorer visualises the <strong>knowledge graph</strong> that
      <code style="font-family:monospace;background:#1f2937;padding:1px 5px;border-radius:3px;color:#22d3ee">rn-token-optimizer graph index</code>
      built from your codebase. Every <strong>dot</strong> is a function, class, hook, or screen.
      Every <strong>line</strong> is a call relationship between them.
    </p>

    <div class="wm-steps">
      <div class="wm-step">
        <div class="wm-step-num">1</div>
        <div>
          <div class="wm-step-title">🔍 Explore the graph</div>
          <div class="wm-step-body">Scroll to zoom, drag to pan. Each coloured dot is a code symbol — <code>Screen</code>, <code>Hook</code>, <code>Function</code>, etc. Lines between them show which code calls which.</div>
        </div>
      </div>
      <div class="wm-step">
        <div class="wm-step-num">2</div>
        <div>
          <div class="wm-step-title">🖱️ Click any dot to inspect it</div>
          <div class="wm-step-body">A panel opens on the right showing the <strong>exact file &amp; line</strong>, what calls it (<strong>callers</strong>), what it calls (<strong>callees</strong>), and the <strong>source code snippet</strong>.</div>
        </div>
      </div>
      <div class="wm-step">
        <div class="wm-step-num">3</div>
        <div>
          <div class="wm-step-title">🔎 Search by concept</div>
          <div class="wm-step-body">Type any concept in the search box — <code>"auth"</code>, <code>"payment"</code>, <code>"error handler"</code>. The TF-IDF engine finds semantically related code and highlights it in the graph.</div>
        </div>
      </div>
      <div class="wm-step">
        <div class="wm-step-num">4</div>
        <div>
          <div class="wm-step-title">🎛️ Filter by type</div>
          <div class="wm-step-body">Use the pills in the top bar to toggle node types on/off. Hide noise, focus on what matters — just Screens, or just Services and Controllers.</div>
        </div>
      </div>
    </div>

    <div class="wm-actions">
      <button class="btn-primary" onclick="closeWelcome()">Explore the Graph →</button>
      <button class="btn-secondary" onclick="closeWelcome()">I know how this works</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     HEADER
══════════════════════════════════════════════════════════════════════════════ -->
<div id="header">
  <a href="https://prmargas.com/projects/rn-token-optimizer/" target="_blank" class="logo" style="text-decoration:none">
    <div class="logo-icon">🧠</div>
    <span class="logo-name">rn-token-optimizer</span>
  </a>
  <span class="logo-sep">›</span>
  <span class="logo-proj" id="project-name">Loading…</span>
  <div id="stat-pills" style="display:flex;gap:6px;"></div>

  <div id="header-right">
    <button class="hdr-btn" onclick="document.getElementById('welcome-overlay').classList.remove('hidden')" title="Show getting started guide">❓ How to use</button>
    <button class="hdr-btn" onclick="toggleLegend()" id="legend-btn">📖 Legend</button>
    <a href="https://prmargas.com/projects/rn-token-optimizer/" target="_blank" style="text-decoration:none">
      <button class="hdr-btn primary">🌐 Project Site</button>
    </a>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     WHAT IS THIS BAR
══════════════════════════════════════════════════════════════════════════════ -->
<div id="explainer-bar">
  <span class="tag">WHAT IS THIS?</span>
  <span>
    Each <strong>coloured dot</strong> = a code symbol (function, class, screen, hook…) in your project.
    Each <strong>line</strong> = a call/import relationship.
    <strong>Click any dot</strong> to see its source code and who calls it. Use <strong>search</strong> to find code by concept.
  </span>
  <span style="margin-left:auto;color:var(--text-dim);font-size:11px" id="loading-msg">⏳ Loading graph…</span>
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     FILTER BAR
══════════════════════════════════════════════════════════════════════════════ -->
<div id="filter-bar">
  <span class="fb-label">Show:</span>
  <!-- pills injected by JS -->
</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     MAIN
══════════════════════════════════════════════════════════════════════════════ -->
<div id="main">

  <!-- ── LEFT SIDEBAR ────────────────────────────────────────────────────── -->
  <div id="sidebar">

    <!-- Search -->
    <div class="sidebar-section">
      <div class="sidebar-section-header">
        <div class="dot" style="background:var(--teal)"></div>
        Concept Search
      </div>
      <div id="search-wrap">
        <input id="search-input" type="text" placeholder='e.g. "auth", "payment", "error"' autocomplete="off" spellcheck="false" />
      </div>
      <div class="search-hint-text">Type any concept — finds semantically related code using TF-IDF matching. Matching nodes glow in the graph.</div>
    </div>

    <!-- Search Results -->
    <div id="search-results" style="flex:1;overflow-y:auto;border-bottom:1px solid var(--border)">
      <div class="no-results" id="search-placeholder">
        <div style="font-size:28px;margin-bottom:8px">🔍</div>
        <div style="margin-bottom:6px">Search above to find code by concept.</div>
        <div>Or click any node in the graph to inspect it.</div>
      </div>
    </div>

    <!-- Legend (collapsible) -->
    <div id="legend-section" class="sidebar-section" style="display:none">
      <div class="sidebar-section-header">
        <div class="dot" style="background:var(--grad-coral)"></div>
        Node Types (What each dot means)
      </div>
      <div class="legend-body" id="legend-nodes"></div>
      <div class="legend-edge-section">
        <div class="legend-edge-title">Line Types (What each connection means)</div>
        <div class="legend-edge-item">
          <div class="legend-edge-line" style="background:rgba(34,211,238,0.5)"></div>
          <div><strong style="font-size:11px">CALLS</strong> <span style="font-size:10px;color:var(--text-dim)">— Function A calls Function B</span></div>
        </div>
        <div class="legend-edge-item">
          <div class="legend-edge-line" style="background:rgba(251,146,60,0.5)"></div>
          <div><strong style="font-size:11px">RENDERS</strong> <span style="font-size:10px;color:var(--text-dim)">— Component renders another</span></div>
        </div>
        <div class="legend-edge-item">
          <div class="legend-edge-line" style="background:rgba(167,139,250,0.5)"></div>
          <div><strong style="font-size:11px">IMPORTS</strong> <span style="font-size:10px;color:var(--text-dim)">— File imports another module</span></div>
        </div>
        <div class="legend-edge-item">
          <div class="legend-edge-line" style="background:rgba(74,222,128,0.5)"></div>
          <div><strong style="font-size:11px">INJECTS</strong> <span style="font-size:10px;color:var(--text-dim)">— Dependency injection (.NET)</span></div>
        </div>
      </div>
    </div>

    <!-- How to use this in other projects -->
    <div id="howto-section" class="sidebar-section">
      <div class="sidebar-section-header">
        <div class="dot" style="background:var(--grad-purple)"></div>
        Use in Your Project
      </div>
      <div class="howto-body">
        <div class="howto-step">
          <div class="howto-num">1</div>
          <div class="howto-text"><strong>Install globally:</strong><br><code>npm install -g rn-token-optimizer</code></div>
        </div>
        <div class="howto-step">
          <div class="howto-num">2</div>
          <div class="howto-text"><strong>Go to your project:</strong><br><code>cd /your/project</code></div>
        </div>
        <div class="howto-step">
          <div class="howto-num">3</div>
          <div class="howto-text"><strong>Index it:</strong><br><code>rn-token-optimizer graph index</code></div>
        </div>
        <div class="howto-step">
          <div class="howto-num">4</div>
          <div class="howto-text"><strong>Open this explorer:</strong><br><code>rn-token-optimizer graph ui</code></div>
        </div>
        <div class="howto-step">
          <div class="howto-num">5</div>
          <div class="howto-text"><strong>Connect to your IDE:</strong><br><code>rn-token-optimizer install</code><br>→ Cursor, Kiro, Claude Desktop</div>
        </div>
      </div>
    </div>

  </div><!-- #sidebar -->

  <!-- ── GRAPH CANVAS ────────────────────────────────────────────────────── -->
  <div id="canvas-wrap">
    <svg id="graph-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arr-default" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="rgba(255,255,255,0.2)" />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-selected">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g id="graph-root">
        <g id="edges-layer"></g>
        <g id="nodes-layer"></g>
      </g>
    </svg>

    <div id="empty-state" style="display:none">
      <div class="empty-icon">📭</div>
      <div class="empty-title">No graph index found</div>
      <div class="empty-sub">
        Run the following command inside your project to build the knowledge graph:
      </div>
      <div class="empty-cmd">rn-token-optimizer graph index</div>
      <div class="empty-sub" style="margin-top:12px">Then restart this server.</div>
    </div>

    <div id="canvas-hint">🖱️ Scroll to zoom · Drag to pan · Click any dot to inspect it</div>
  </div>

  <!-- ── RIGHT DETAIL PANEL ──────────────────────────────────────────────── -->
  <div id="detail-panel">
    <div id="detail-head">
      <div id="detail-head-row1">
        <div id="detail-label-badge"></div>
        <div id="detail-name">—</div>
        <div id="detail-close" title="Close panel">×</div>
      </div>
      <div id="detail-what-is"></div>
    </div>
    <div id="detail-body"><div class="spinner"></div></div>
  </div>

</div><!-- #main -->

<!-- Tooltip -->
<div id="tooltip">
  <div class="tt-label" id="tt-label"></div>
  <div class="tt-name"  id="tt-name"></div>
  <div class="tt-file"  id="tt-file"></div>
  <div class="tt-sig"   id="tt-sig"></div>
  <div class="tt-hint">Click to inspect →</div>
</div>

<script>
// ════════════════════════════════════════════════════════════════════════════
// rn-token-optimizer — Code Graph Explorer
// Rebuilt for clarity & learnability
// ════════════════════════════════════════════════════════════════════════════

// ── Node type metadata (human-readable descriptions) ─────────────────────────
const NODE_META = {
  Screen:      { color: '#22d3ee', desc: 'A React Native screen component (a full page/view)' },
  Hook:        { color: '#a78bfa', desc: 'A React custom hook (reusable stateful logic)' },
  Function:    { color: '#94a3b8', desc: 'A regular TypeScript/JavaScript function' },
  Class:       { color: '#fbbf24', desc: 'A TypeScript or C# class' },
  Navigator:   { color: '#60a5fa', desc: 'A React Navigation navigator (stack, tab, drawer)' },
  Provider:    { color: '#fb923c', desc: 'A React Context provider' },
  Component:   { color: '#34d399', desc: 'A React component (not a full screen)' },
  Slice:       { color: '#4ade80', desc: 'A Redux Toolkit slice (state + reducers)' },
  Controller:  { color: '#22d3ee', desc: 'An ASP.NET MVC/Web API controller' },
  Service:     { color: '#34d399', desc: 'A .NET service class (business logic)' },
  Repository:  { color: '#60a5fa', desc: 'A .NET data access repository' },
  Middleware:  { color: '#f472b6', desc: 'ASP.NET middleware or Express middleware' },
  ApiEndpoint: { color: '#fbbf24', desc: 'An HTTP endpoint / route handler' },
  Interface:   { color: '#64748b', desc: 'A TypeScript interface or C# interface' },
  Type:        { color: '#64748b', desc: 'A TypeScript type alias' },
  Namespace:   { color: '#475569', desc: 'A C# namespace' },
};
const DEFAULT_COLOR = '#94a3b8';

function nodeColor(label) { return (NODE_META[label] || {}).color || DEFAULT_COLOR; }
function nodeDesc(label)  { return (NODE_META[label] || {}).desc  || 'A code symbol'; }

// ── State ────────────────────────────────────────────────────────────────────
let graphData      = null;
let simNodes       = [];
let simEdges       = [];
let activeLabels   = new Set();
let highlightIds   = new Set();
let selectedNodeId = null;
let tx = 0, ty = 0, scale = 1;
let isDragging = false, lastX = 0, lastY = 0;
let dragNode = null, dragOffX = 0, dragOffY = 0;

const svg        = document.getElementById('graph-svg');
const graphRoot  = document.getElementById('graph-root');
const edgesLayer = document.getElementById('edges-layer');
const nodesLayer = document.getElementById('nodes-layer');
const tooltip    = document.getElementById('tooltip');

// ── Welcome modal ────────────────────────────────────────────────────────────
function closeWelcome() {
  document.getElementById('welcome-overlay').classList.add('hidden');
  localStorage.setItem('rn-graph-welcomed', '1');
}
// Don't show again if already seen
if (localStorage.getItem('rn-graph-welcomed')) {
  document.getElementById('welcome-overlay').classList.add('hidden');
}

// ── Legend toggle ─────────────────────────────────────────────────────────────
let legendVisible = false;
function toggleLegend() {
  legendVisible = !legendVisible;
  document.getElementById('legend-section').style.display = legendVisible ? 'block' : 'none';
  document.getElementById('legend-btn').textContent = legendVisible ? '📖 Hide Legend' : '📖 Legend';
}

// Build legend nodes
function buildLegend(labelCounts) {
  const container = document.getElementById('legend-nodes');
  container.innerHTML = '';
  const labels = Object.keys(labelCounts).filter(l => l !== 'File');
  for (const label of labels) {
    const meta = NODE_META[label] || { color: DEFAULT_COLOR, desc: 'Code symbol' };
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = \`
      <div class="legend-dot" style="background:\${meta.color}"></div>
      <div>
        <div class="legend-name" style="color:\${meta.color}">\${label} <span style="color:var(--text-dim);font-weight:400;font-size:10px">(\${labelCounts[label]})</span></div>
        <div class="legend-desc">\${meta.desc}</div>
      </div>\`;
    container.appendChild(item);
  }
}

// ── Filter pills ─────────────────────────────────────────────────────────────
function buildFilterPills(labelCounts) {
  const bar = document.getElementById('filter-bar');
  [...bar.querySelectorAll('.filter-pill')].forEach(p => p.remove());

  const labels = Object.entries(labelCounts)
    .filter(([l]) => l !== 'File')
    .sort((a, b) => b[1] - a[1]);

  for (const [label, count] of labels) {
    activeLabels.add(label);
    const color = nodeColor(label);
    const pill = document.createElement('div');
    pill.className = 'filter-pill active';
    pill.dataset.label = label;
    pill.title = nodeDesc(label);
    pill.style.background = \`\${color}15\`;
    pill.style.borderColor = \`\${color}40\`;
    pill.style.color = color;
    pill.innerHTML = \`<span class="dot" style="background:\${color}"></span>\${label}<span class="pill-count">\${count}</span>\`;
    pill.addEventListener('click', () => {
      if (activeLabels.has(label)) { activeLabels.delete(label); pill.classList.replace('active','inactive'); }
      else                         { activeLabels.add(label);    pill.classList.replace('inactive','active'); }
      renderGraph();
    });
    bar.appendChild(pill);
  }
}

// ── Physics simulation ────────────────────────────────────────────────────────
const REPULSION  = 3200;
const SPRING_LEN = 120;
const SPRING_K   = 0.022;
const DAMPING    = 0.80;
const CENTER_K   = 0.006;
let animFrame = null;

function initSim(nodes, edges) {
  const w = svg.clientWidth  || 900;
  const h = svg.clientHeight || 600;
  const cx = w / 2, cy = h / 2;

  simNodes = nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2;
    const r = Math.min(w, h) * 0.30;
    return { ...n, x: cx + r * Math.cos(a) + (Math.random()-.5)*50,
                   y: cy + r * Math.sin(a) + (Math.random()-.5)*50,
                   vx:0, vy:0, pinned:false };
  });

  const byId = {};
  for (const n of simNodes) byId[n.id] = n;
  simEdges = edges.map(e => ({ ...e, source: byId[e.sourceId], target: byId[e.targetId] }))
                  .filter(e => e.source && e.target);

  tx=0; ty=0; scale=1; applyTransform();

  if (animFrame) cancelAnimationFrame(animFrame);
  let ticks=0;
  const step = () => {
    stepSim(); renderGraph();
    if (++ticks < 250) animFrame = requestAnimationFrame(step);
    else animFrame = null;
  };
  animFrame = requestAnimationFrame(step);
}

function stepSim() {
  const vis = simNodes.filter(n => activeLabels.has(n.label));
  const cx = (svg.clientWidth||900)/2, cy=(svg.clientHeight||600)/2;

  for (let i=0;i<vis.length;i++) {
    const a=vis[i]; if(a.pinned) continue;
    for (let j=i+1;j<vis.length;j++) {
      const b=vis[j];
      const dx=a.x-b.x||0.01, dy=a.y-b.y||0.01;
      const d2=dx*dx+dy*dy, d=Math.sqrt(d2)||1;
      const f=REPULSION/d2;
      const fx=(dx/d)*f, fy=(dy/d)*f;
      a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy;
    }
  }
  for (const e of simEdges) {
    const {source:a,target:b}=e;
    if (!activeLabels.has(a.label)||!activeLabels.has(b.label)) continue;
    const dx=b.x-a.x, dy=b.y-a.y;
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    const f=(d-SPRING_LEN)*SPRING_K;
    const fx=(dx/d)*f, fy=(dy/d)*f;
    if(!a.pinned){a.vx+=fx;a.vy+=fy;}
    if(!b.pinned){b.vx-=fx;b.vy-=fy;}
  }
  for (const n of vis) {
    if(n.pinned) continue;
    n.vx+=(cx-n.x)*CENTER_K; n.vy+=(cy-n.y)*CENTER_K;
    n.vx*=DAMPING; n.vy*=DAMPING; n.x+=n.vx; n.y+=n.vy;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';
function mkSvg(tag,attrs={}) {
  const el=document.createElementNS(SVG_NS,tag);
  for(const[k,v] of Object.entries(attrs)) el.setAttribute(k,v);
  return el;
}

function renderGraph() { renderEdges(); renderNodes(); }

function renderEdges() {
  const vis = simEdges.filter(e => activeLabels.has(e.source.label) && activeLabels.has(e.target.label));
  const existing = [...edgesLayer.children];
  while (existing.length > vis.length) edgesLayer.removeChild(existing.pop());

  vis.forEach((e,i) => {
    let line = existing[i];
    if (!line) { line = mkSvg('line',{class:'edge-line','marker-end':'url(#arr-default)'}); edgesLayer.appendChild(line); }
    const hi = highlightIds.has(e.source.id)||highlightIds.has(e.target.id);
    const sel = e.source.id===selectedNodeId||e.target.id===selectedNodeId;
    line.setAttribute('x1',e.source.x); line.setAttribute('y1',e.source.y);
    line.setAttribute('x2',e.target.x); line.setAttribute('y2',e.target.y);
    line.setAttribute('stroke', sel ? nodeColor(e.source.label) : hi ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.15)');
    line.setAttribute('stroke-width', sel ? '1.5' : hi ? '1.2' : '0.7');
  });
}

const nodeCache = new Map();

function renderNodes() {
  const vis = simNodes.filter(n => activeLabels.has(n.label));
  const visIds = new Set(vis.map(n=>n.id));
  for (const [id,els] of nodeCache) { if(!visIds.has(id)){els.g.remove();nodeCache.delete(id);} }

  for (const n of vis) {
    const color   = nodeColor(n.label);
    const hilit   = highlightIds.has(n.id);
    const sel     = selectedNodeId===n.id;
    const dim     = highlightIds.size>0&&!hilit&&!sel;
    const r       = sel ? 15 : hilit ? 12 : 8;

    let els = nodeCache.get(n.id);
    if (!els) {
      const g      = mkSvg('g',{class:'node-group'});
      const circle = mkSvg('circle',{class:'node-circle'});
      const text   = mkSvg('text',{class:'node-text'});
      g.appendChild(circle); g.appendChild(text);
      nodesLayer.appendChild(g);

      g.addEventListener('mouseenter', ev => showTip(ev,n));
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('click', () => selectNode(n.id));
      g.addEventListener('mousedown', ev => startNodeDrag(ev,n));

      els = {g,circle,text};
      nodeCache.set(n.id,els);
    }

    const {g,circle,text}=els;
    g.setAttribute('transform',\`translate(\${n.x},\${n.y})\`);
    g.style.opacity = dim ? '0.15' : '1';

    circle.setAttribute('r', r);
    circle.setAttribute('fill', sel ? '#ffffff' : color);
    circle.setAttribute('stroke', sel ? color : hilit ? '#14b8a6' : 'rgba(0,0,0,0.4)');
    circle.setAttribute('stroke-width', sel||hilit ? '2' : '0.5');
    if (sel)   circle.setAttribute('filter','url(#glow-selected)');
    else if (hilit) circle.setAttribute('filter','url(#glow)');
    else       circle.removeAttribute('filter');

    // Show full name when highlighted or selected, truncate otherwise
    const fullName = n.name;
    const dispName = (sel||hilit) ? fullName : (fullName.length>14 ? fullName.slice(0,12)+'…' : fullName);
    text.textContent = dispName;
    text.setAttribute('y', r+10);
    text.style.fill = sel ? '#fff' : 'rgba(255,255,255,0.65)';
    text.style.fontSize = (sel||hilit) ? '11px' : '10px';
  }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
function showTip(ev,n) {
  const color = nodeColor(n.label);
  document.getElementById('tt-label').textContent = n.label;
  document.getElementById('tt-label').style.color = color;
  document.getElementById('tt-name').textContent = n.name;
  document.getElementById('tt-file').textContent = n.filePath + ':' + n.lineStart;
  document.getElementById('tt-sig').textContent  = n.signature || '';
  tooltip.classList.add('visible');
  moveTip(ev);
}
function hideTip() { tooltip.classList.remove('visible'); }
function moveTip(ev) {
  tooltip.style.left=(ev.clientX+16)+'px';
  tooltip.style.top =(ev.clientY-10)+'px';
}
svg.addEventListener('mousemove', ev => { if(tooltip.classList.contains('visible')) moveTip(ev); });

// ── Node drag ─────────────────────────────────────────────────────────────────
function startNodeDrag(ev,n) {
  ev.stopPropagation();
  dragNode=n; n.pinned=true;
  const pt=svgPt(ev); dragOffX=n.x-pt.x; dragOffY=n.y-pt.y;
  const onMove=e=>{
    const p=svgPt(e); dragNode.x=p.x+dragOffX; dragNode.y=p.y+dragOffY; renderGraph();
    if(!animFrame){let t=0;const run=()=>{stepSim();renderGraph();if(++t<40)animFrame=requestAnimationFrame(run);else animFrame=null;};animFrame=requestAnimationFrame(run);}
  };
  const onUp=()=>{dragNode=null;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
  window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp);
}

// ── Pan + zoom ────────────────────────────────────────────────────────────────
svg.addEventListener('mousedown', ev=>{
  if(['svg','g'].includes(ev.target.tagName)&&!dragNode){isDragging=true;lastX=ev.clientX;lastY=ev.clientY;svg.style.cursor='grabbing';}
});
window.addEventListener('mousemove',ev=>{
  if(!isDragging||dragNode) return;
  tx+=ev.clientX-lastX; ty+=ev.clientY-lastY; lastX=ev.clientX; lastY=ev.clientY; applyTransform();
});
window.addEventListener('mouseup',()=>{isDragging=false;svg.style.cursor='grab';});

svg.addEventListener('wheel',ev=>{
  ev.preventDefault();
  const d=ev.deltaY<0?1.1:0.91;
  const rect=svg.getBoundingClientRect();
  const mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
  tx=mx-(mx-tx)*d; ty=my-(my-ty)*d; scale*=d; applyTransform();
},{passive:false});

function applyTransform(){ graphRoot.setAttribute('transform',\`translate(\${tx},\${ty}) scale(\${scale})\`); }
function svgPt(ev){const r=svg.getBoundingClientRect();return{x:(ev.clientX-r.left-tx)/scale,y:(ev.clientY-r.top-ty)/scale};}

// ── Select node ───────────────────────────────────────────────────────────────
async function selectNode(id) {
  if(selectedNodeId===id){selectedNodeId=null;closeDetail();renderGraph();return;}
  selectedNodeId=id; renderGraph(); openDetail(); await loadDetail(id);

  // Highlight related nodes
  const node=simNodes.find(n=>n.id===id);
  if(node){
    const related=new Set([id]);
    simEdges.filter(e=>e.source.id===id||e.target.id===id)
            .forEach(e=>{related.add(e.source.id);related.add(e.target.id);});
    highlightIds=related; renderGraph();
  }
}

function openDetail(){
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-body').innerHTML='<div class="spinner"></div>';
}
function closeDetail(){
  document.getElementById('detail-panel').classList.remove('open');
  selectedNodeId=null; highlightIds=new Set(); renderGraph();
}
document.getElementById('detail-close').addEventListener('click',closeDetail);

async function loadDetail(id) {
  try {
    const r=await fetch(\`/api/node/\${encodeURIComponent(id)}\`);
    const d=await r.json();
    renderDetail(d);
  } catch(e) {
    document.getElementById('detail-body').innerHTML=\`<div style="color:#f87171;padding:12px">Error: \${e.message}</div>\`;
  }
}

function renderDetail({node,callers,callees,snippet}) {
  const color=nodeColor(node.label);

  // header
  const badge=document.getElementById('detail-label-badge');
  badge.textContent=node.label;
  badge.style.background=\`\${color}20\`;
  badge.style.color=color;
  badge.style.border=\`1px solid \${color}40\`;
  badge.style.borderRadius='20px'; badge.style.padding='2px 8px'; badge.style.fontSize='10px'; badge.style.fontWeight='700';
  document.getElementById('detail-name').textContent=node.name;
  document.getElementById('detail-what-is').textContent=nodeDesc(node.label);

  let h='';

  // location
  h+=\`<div class="detail-sec">
    <div class="detail-sec-title">📍 Location <span class="tip">where to find it in code</span></div>
    <div class="detail-meta">\${esc(node.filePath)}<strong style="color:var(--teal)">:\${node.lineStart}</strong>–\${node.lineEnd}</div>
    \${node.signature?'<div class="detail-meta" style="margin-top:3px;color:var(--text-dim)">'+esc(node.signature)+'</div>':''}
    \${node.async?'<span style="background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;border-radius:10px;padding:1px 7px;font-size:10px">async</span>':''}
    \${node.exported?'<span style="background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.25);color:var(--teal);border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">exported</span>':''}
  </div>\`;

  // callers
  if(callers.length>0){
    h+=\`<div class="detail-sec">
      <div class="detail-sec-title">← Callers (\${callers.length}) <span class="tip">who calls this</span></div>
      \${callers.slice(0,8).map(c=>\`<div class="rel-item" onclick="selectNode('\${c.id}')">
        <span class="rel-label" style="color:\${nodeColor(c.label)}">\${c.label}</span>
        <span class="rel-name">\${esc(c.name)}</span>
      </div>\`).join('')}
      \${callers.length>8?'<div style="font-size:10px;color:var(--text-dim);padding:2px 4px">+\${callers.length-8} more…</div>':''}
    </div>\`;
  } else {
    h+=\`<div class="detail-sec">
      <div class="detail-sec-title">← Callers</div>
      <div class="detail-meta" style="color:var(--text-dim)">Nothing calls this — it may be an entry point or dead code.</div>
    </div>\`;
  }

  // callees
  if(callees.length>0){
    h+=\`<div class="detail-sec">
      <div class="detail-sec-title">→ Calls / Uses (\${callees.length}) <span class="tip">what this calls</span></div>
      \${callees.slice(0,8).map(c=>\`<div class="rel-item" onclick="selectNode('\${c.id}')">
        <span class="rel-label" style="color:\${nodeColor(c.label)}">\${c.label}</span>
        <span class="rel-name">\${esc(c.name)}</span>
        <span class="rel-edge">\${c.edgeType.toLowerCase()}</span>
      </div>\`).join('')}
      \${callees.length>8?'<div style="font-size:10px;color:var(--text-dim);padding:2px 4px">+\${callees.length-8} more…</div>':''}
    </div>\`;
  }

  // source snippet
  if(snippet){
    h+=\`<div class="detail-sec">
      <div class="detail-sec-title">📄 Source Code <span class="tip">from \${esc(node.filePath)}</span></div>
      <div id="snippet-box">
        <div id="snippet-title">\${esc(node.filePath)}:\${node.lineStart}–\${node.lineEnd}</div>
        <pre id="snippet-code">\${esc(snippet)}</pre>
      </div>
    </div>\`;
  }

  document.getElementById('detail-body').innerHTML=h;
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Search ────────────────────────────────────────────────────────────────────
let searchTimer=null;
document.getElementById('search-input').addEventListener('input',ev=>{
  clearTimeout(searchTimer);
  const q=ev.target.value.trim();
  if(!q){
    highlightIds=new Set(); renderGraph();
    document.getElementById('search-results').innerHTML='';
    document.getElementById('search-placeholder').style.display='block';
    return;
  }
  document.getElementById('search-placeholder').style.display='none';
  searchTimer=setTimeout(()=>doSearch(q),280);
});

async function doSearch(q) {
  const box=document.getElementById('search-results');
  box.innerHTML='<div class="spinner"></div>';
  try{
    const r=await fetch(\`/api/search?q=\${encodeURIComponent(q)}&limit=15\`);
    const d=await r.json();
    highlightIds=new Set(d.results.map(r=>r.id));
    renderGraph();
    renderSearchResults(d.results);
  }catch{
    box.innerHTML='<div class="no-results" style="color:#f87171">Search failed — is the server still running?</div>';
  }
}

function renderSearchResults(results) {
  const box=document.getElementById('search-results');
  if(!results.length){box.innerHTML='<div class="no-results">No matches found.<br>Try a different concept or keyword.</div>';return;}
  box.innerHTML=results.map(r=>{
    const color=nodeColor(r.label);
    const pct=Math.round(r.score*100);
    return \`<div class="result-item" data-id="\${r.id}" onclick="selectNode('\${r.id}')">
      <span class="result-label" style="color:\${color}">[\${r.label}]</span>
      <span class="result-name" style="color:\${color}">\${esc(r.name)}</span>
      <span class="result-file">\${esc(r.filePath)}:\${r.lineStart}</span>
      <span class="result-score">relevance \${pct}%</span>
    </div>\`;
  }).join('');
}

// ── Header stats ──────────────────────────────────────────────────────────────
function renderStats(project,labelCounts) {
  document.getElementById('project-name').textContent=project.name||'Project';
  const pills=document.getElementById('stat-pills');
  pills.innerHTML=\`
    <div class="stat-pill"><span class="val">\${project.nodeCount}</span> functions &amp; classes</div>
    <div class="stat-pill"><span class="val">\${project.edgeCount}</span> call relationships</div>
    <div class="stat-pill"><span class="val">\${labelCounts['File']||0}</span> source files</div>\`;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async()=>{
  try{
    const data=await fetch('/api/graph').then(r=>{
      if(!r.ok){
        if(r.status===404) document.getElementById('empty-state').style.display='flex';
        throw new Error('Graph not found');
      }
      return r.json();
    });
    graphData=data;
    document.getElementById('loading-msg').textContent='✅ Graph loaded';
    setTimeout(()=>{ document.getElementById('loading-msg').style.display='none'; },2000);

    renderStats(data.project,data.labelCounts);
    buildFilterPills(data.labelCounts);
    buildLegend(data.labelCounts);
    initSim(data.nodes,data.edges);
  }catch(e){
    document.getElementById('loading-msg').textContent='⚠ '+e.message;
  }
})();
</script>
</body>
</html>`;
}
