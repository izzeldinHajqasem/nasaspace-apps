// Load the exact browser scoring rules without a DOM or duplicated test implementation.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../src/mission-model.js", import.meta.url),
  "utf8",
);
const model = vm.runInNewContext(
  source + "\n({ candidates, objectives, scoreSite })",
);

export const { candidates, objectives, scoreSite } = model;
