import { anthropic } from "@ai-sdk/anthropic";

export const modell = anthropic(process.env.MODELL ?? "claude-sonnet-5-5");

// Billigare och snabbare modell för enkla uppgifter: sortering och facit-bedömning.
export const lattModell = anthropic(process.env.MODELL_LATT ?? "claude-haiku-5-5");
