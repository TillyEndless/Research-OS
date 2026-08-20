import {
  getEntity,
} from "../server/services/getEntity.js";


console.log(
  "\n=== GET H001 ==="
);

console.dir(
  getEntity({
    entity_id: "H001",
  }),
  {
    depth: null,
  },
);


console.log(
  "\n=== GET E001 ==="
);

console.dir(
  getEntity({
    entity_id: "E001",
  }),
  {
    depth: null,
  },
);