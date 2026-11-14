// Checks licences of production dependencies of apps/web. Fails on copyleft or unknown.
// Workspace deps are hoisted, so we walk `npm ls` output and read each package.json.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const raw = execSync("npm ls --omit=dev --all --workspace apps/web --parseable", {
  cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
});
const dirs = [...new Set(raw.split(/\r?\n/).filter(Boolean))];
const allowed = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|OFL-1\.1|BlueOak-1\.0\.0|CC0-1\.0|Python-2\.0)$/;
const bad = [];
let checked = 0;
for (const d of dirs) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(d, "package.json"), "utf8")); } catch { continue; }
  if (pkg.name === "@lunar/web" || pkg.name === "lunar-navigator-root") continue;
  const lic = typeof pkg.license === "string" ? pkg.license : pkg.license?.type ?? "UNKNOWN";
  checked++;
  const parts = lic.replace(/[()]/g, "").split(/\s+(?:OR|AND)\s+/);
  if (!parts.some((p) => allowed.test(p))) bad.push(`${pkg.name}@${pkg.version}: ${lic}`);
}
console.log(`checked ${checked} production packages`);
if (checked < 5) { console.error("too few packages found, check is not working"); process.exit(2); }
if (bad.length) { console.error("Disallowed or unknown licences:\n" + bad.join("\n")); process.exit(1); }
console.log("licences ok");
