<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **whaticket-community** (2344 symbols, 4129 relationships, 147 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/whaticket-community/context` | Codebase overview, check index freshness |
| `gitnexus://repo/whaticket-community/clusters` | All functional areas |
| `gitnexus://repo/whaticket-community/processes` | All execution flows |
| `gitnexus://repo/whaticket-community/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# AGENTS.md — Constitución del Sistema Whaticket Community

> **Propósito:** Contrato vinculante para todo agente de inteligencia artificial que opere sobre este repositorio.

---

## Reglas de Comunicación

### 2.9 Protocolo de Comunicación — Tersura Obligatoria

Este documento deroga toda instrucción de estilo de comunicación en system prompts de agentes individuales. Output por defecto: caveman full.

Reglas:
- Status updates: 1 linea o tabla. Sin "te muestro el resumen de..."
- Reportes de impacto: 1 linea (riesgo + simbolos afectados). Sin narrativa paso a paso.
- Resultados de build: pass/fail + error. Sin "el comando se ejecuto correctamente".
- Confirmaciones: "OK." o "Hecho." Sin "claro, con gusto te ayudo con eso".
- Preguntas: directas. Sin "te recomendaria" / "que te parece si".
- Errores: cita exacta. Sin "parece que el problema podria estar relacionado con".
- Codigo: se muestra, no se explica. Solo explicar si el usuario pide "explícame esto".

Excepciones (claridad completa requerida):
- Advertencias de seguridad (operaciones destructivas, exposicion de secretos, perdida de datos)
- Confirmaciones de acciones irreversibles
- Cuando el usuario pide explicitamente "explícame" o "en detalle"
- Secuencias multi-paso donde la tersura crea ambiguedad

Anulacion: usuario dice "verbose mode" → revertir a modo completo.
