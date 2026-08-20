import { db } from "../server/db/database.js";

import {
  ingestResearchUpdate,
} from "../server/services/ingestResearchUpdate.js";


const result = ingestResearchUpdate({

  sources: [
    {
      client_ref: "meeting_today",

      title:
        "导师讨论：decoder gradient",

      status: "recorded",

      source_type:
        "advisor_chat",

      source_date:
        "2026-08-20",

      summary:
        "讨论 decode loss 是否可能主要训练 B，而不是迫使 A latent 学到足够的 reasoning information。",
    },
  ],


  hypotheses: [
    {
      client_ref:
        "h_decoder_bypass",

      title:
        "Decoder bypass hypothesis",

      status:
        "active",

      statement:
        "Decode loss 可能使 B 自己学习 textual CoT，从而降低 A latent representation 承载推理信息的训练压力。",

      confidence:
        "medium",

      rationale:
        "如果 B 可以直接通过自身参数降低 textual CoT reconstruction loss，则 decode loss 不一定充分监督 A 的 latent representation。",
    },
  ],


  experiments: [],


  findings: [],


  decisions: [
    {
      client_ref:
        "d_freeze_b",

      title:
        "Freeze B during decode training",

      status:
        "active",

      decision_text:
        "下一版实验冻结 B，只允许与 latent pathway 有关的梯度更新 A。",

      reason:
        "避免 decoder objective 主要通过修改 B 来降低 loss。",
    },
  ],


  actions: [
    {
      client_ref:
        "a_freeze_b_exp",

      title:
        "Freeze-B comparison",

      status:
        "planned",

      task:
        "运行 freeze-B 与当前训练方案的对照实验。",

      priority:
        "high",
    },

    {
      client_ref:
        "a_latent_delete",

      title:
        "Latent deletion ablation",

      status:
        "planned",

      task:
        "进行 latent token deletion ablation，验证 decoder 是否真正依赖 latent representation。",

      priority:
        "high",
    },
  ],


  papers: [],

  concepts: [],


  relations: [
    {
      source_ref:
        "meeting_today",

      relation_type:
        "introduces",

      target_ref:
        "h_decoder_bypass",
    },

    {
      source_ref:
        "h_decoder_bypass",

      relation_type:
        "motivates",

      target_ref:
        "d_freeze_b",
    },

    {
      source_ref:
        "d_freeze_b",

      relation_type:
        "leads_to",

      target_ref:
        "a_freeze_b_exp",
    },

    {
      source_ref:
        "d_freeze_b",

      relation_type:
        "leads_to",

      target_ref:
        "a_latent_delete",
    },
  ],
});


console.log("\n=== INGEST RESULT ===");

console.dir(
  result,
  {
    depth: null,
  },
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