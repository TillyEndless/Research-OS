import { allocateEntityId } from "../server/db/idAllocator.js";

console.log(allocateEntityId("hypothesis"));
console.log(allocateEntityId("hypothesis"));
console.log(allocateEntityId("experiment"));
console.log(allocateEntityId("decision"));