import {
  getDashboardSnapshot,
} from "../server/services/getDashboardSnapshot.js";


const result =
  getDashboardSnapshot();

console.dir(
  result,
  {
    depth: null,
  },
);