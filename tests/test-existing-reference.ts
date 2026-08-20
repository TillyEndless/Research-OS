import { db } from "../server/db/database.js";

import {
  ingestResearchUpdate,
} from "../server/services/ingestResearchUpdate.js";


const result = ingestResearchUpdate({

  sources: [
    {
      client_ref: "meeting_followup",

      title: "导师 follow-up：验证 decoder bypass",

      status: "recorded",

      source_type: "advisor_chat",

      source_date: "2026-08-21",

      summary:
        "继续讨论 decoder bypass hypothesis，并决定通过 freeze-B 对照实验验证。",
    },
  ],


  hypotheses: [
    {
      client_ref: "existing_decoder_bypass",

      // 关键：
      // 明确告诉 ResearchOS：
      // 这不是新的 hypothesis，
      // 而是已有的 H001。
      entity_id: "H001",

      title: "Decoder bypass hypothesis",

      status: "active",

      statement:
        "Decode loss 可能使 B 自己学习 textual CoT，从而降低 A latent representation 承载推理信息的训练压力。",

      confidence: "high",

      rationale:
        "导师 follow-up 认为该机制值得通过冻结 B 的实验进一步验证。",
    },
  ],


  experiments: [
    {
      client_ref: "e_freeze_b",

      title: "Freeze-B controlled experiment",

      status: "planned",

      question:
        "冻结 B 后，decoder supervision 是否会更有效地迫使 A latent 承载 reasoning information？",

      baseline:
        "B trainable",

      variant:
        "B frozen",

      model:
        "current A+B latent reasoning model",

      dataset:
        "current training/evaluation dataset",

      controlled_variables: {
        data: "same",
        optimizer: "same",
        training_steps: "same",
        latent_K_rule: "same"
      }
    },
  ],


  findings: [
    {
      client_ref: "f_expected_discrimination",

      title: "Freeze-B discriminative expectation",

      status: "proposed",

      kind: "interpretation",

      statement:
        "如果 freeze-B 明显改善 latent dependence 或 free-generation performance，则 decoder bypass hypothesis 获得支持；如果没有改善，则该 hypothesis 被削弱。",

      confidence: "medium",
    },
  ],


  decisions: [],

  actions: [],

  papers: [],

  concepts: [],


  relations: [
    {
      source_ref: "meeting_followup",
      relation_type: "discusses",
      target_ref: "H001",
    },

    {
      source_ref: "H001",
      relation_type: "tested_by",
      target_ref: "e_freeze_b",
    },

    {
      source_ref: "e_freeze_b",
      relation_type: "designed_to_evaluate",
      target_ref: "f_expected_discrimination",
    },

    {
      source_ref: "f_expected_discrimination",
      relation_type: "evaluates",
      target_ref: "H001",
    },
  ],
});


console.log("\n=== INGEST RESULT ===");

console.dir(result, {
  depth: null,
});


console.log("\n=== HYPOTHESES ===");

console.table(
  db.prepare(`
    SELECT
      e.id,
      e.title,
      e.status,
      h.confidence,
      h.statement

    FROM entities e

    JOIN hypotheses h
      ON h.entity_id = e.id

    ORDER BY e.id
  `).all(),
);


console.log("\n=== ENTITIES ===");

console.table(
  db.prepare(`
    SELECT
      id,
      type,
      title,
      status

    FROM entities

    ORDER BY id
  `).all(),
);


console.log("\n=== RELATIONS ===");

console.table(
  db.prepare(`
    SELECT
      source_entity_id AS source,
      relation_type,
      target_entity_id AS target

    FROM relations

    ORDER BY id
  `).all(),
);