import {
  searchResearchMemory,
} from "../server/services/searchResearchMemory.js";


console.log(
  "\n=== SEARCH 1: decoder bypass ==="
);

console.dir(
  searchResearchMemory({
    query:
      "decoder bypass",

    keywords: [
      "decoder",
      "textual CoT",
      "latent",
    ],

    limit: 10,
  }),
  {
    depth: null,
  },
);


console.log(
  "\n=== SEARCH 2: hypothesis only ==="
);

console.dir(
  searchResearchMemory({
    query:
      "B 自己学习 textual CoT",

    keywords: [
      "textual CoT",
      "latent",
      "decoder",
    ],

    entity_types: [
      "hypothesis",
    ],

    limit: 5,
  }),
  {
    depth: null,
  },
);


console.log(
  "\n=== SEARCH 3: exact entity ID ==="
);

console.dir(
  searchResearchMemory({
    query:
      "H001",

    limit: 5,
  }),
  {
    depth: null,
  },
);