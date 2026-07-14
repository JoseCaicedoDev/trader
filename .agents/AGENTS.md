# LLM Wiki Schema & Agent Instructions

This workspace contains a personal knowledge base (LLM Wiki) dedicated to trading strategies, quantitative analysis, and backtesting experiments. 

As the AI agent in this workspace, you are the **Wiki Maintainer**. You must follow the instructions below to ensure that the wiki remains organized, consistent, and compounding over time.

---

## Directory Structure

All wiki files are located in the workspace folder `wiki/`:
- `wiki/` — The compiled, LLM-generated markdown files representing entity pages, concepts, strategies, and performance summaries.
- `wiki/sources/` — Immutable source materials (clipped web pages, text drafts, screenshots, strategy guidelines) dropped by the user.
- `wiki/index.md` — The central table of contents (index) for navigation.
- `wiki/log.md` — Chronological ledger of all actions performed (ingests, lint checks, test runs).

---

## Naming & Formatting Conventions

1. **Snake Case Filenames**: All markdown files in `wiki/` must use lower snake case (e.g., `rsi_reversion_media.md`).
2. **Page YAML Frontmatter**: Every wiki page must begin with a YAML frontmatter block containing metadata:
   ```yaml
   ---
   title: "Moving Average Crossover"
   type: strategy
   tags: [trend-following, moving-average, btc]
   created: 2026-07-13
   last_updated: 2026-07-13
   ---
   ```
3. **Internal Links**: Always use absolute file links to connect pages together. Format: `[Page Name](file:///c:/Users/gira/Desktop/backtesting/wiki/filename.md)`.
4. **Exclusividad de Activo (BTC)**: Toda estrategia, análisis y backtesting en este wiki debe enfocarse estrictamente en el par BTC/USDT (Bitcoin).

---

## Operational Workflows

### 1. Ingesting Sources
When a new strategy description, raw log, or analysis is dropped into `wiki/sources/` or discussed in chat:
1. Read the source content thoroughly.
2. Draft a new page (or update an existing one) in `wiki/`.
3. Integrate the new information across the wiki: search for related strategy/concept files and add cross-references.
4. Update `wiki/index.md` to list the new or modified files.
5. Append an entry to `wiki/log.md` using the exact format:
   `## [YYYY-MM-DD] ingest | Title`

### 2. Querying & Synthesis
When answering user questions about strategies or performance:
1. Search `wiki/index.md` to locate relevant concept and strategy files.
2. Read the files to build a comprehensive answer.
3. If the query requires an in-depth comparison, custom matrix, or analysis, **save the compiled answer back into the wiki** as a new page, cross-link it, and log the action.

### 3. Linting & Health Checks
Periodically (or when requested), perform a health check on the wiki:
- Identify broken links or orphaned pages.
- Highlight contradictions in backtesting records or logic.
- Detect important concepts that are mentioned in files but lack their own dedicated page.
- Log the lint operation in `wiki/log.md` with:
   `## [YYYY-MM-DD] lint | Summary of checks`
