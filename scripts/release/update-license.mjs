import { readFile, writeFile } from "node:fs/promises";

const [, , version, releaseDate] = process.argv;

if (!version) {
  fail("Usage: node scripts/release/update-license.mjs <version> <release-date>");
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`Invalid version "${version}". Expected a semver-like version such as 0.2.0.`);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate ?? "")) {
  fail(`Invalid release date "${releaseDate ?? ""}". Expected YYYY-MM-DD.`);
}

const parsedReleaseDate = new Date(`${releaseDate}T00:00:00.000Z`);
if (Number.isNaN(parsedReleaseDate.getTime()) || parsedReleaseDate.toISOString().slice(0, 10) !== releaseDate) {
  fail(`Invalid release date "${releaseDate}". Expected a real YYYY-MM-DD date.`);
}

const changeDate = addYearsUtc(parsedReleaseDate, 4).toISOString().slice(0, 10);

await updatePackageJson("package.json", (pkg) => {
  pkg.version = version;
});

await updateLicense(version, releaseDate, changeDate);
await updateDockerfileLabel(changeDate);

console.log(`Updated Dibao license metadata for ${version}.`);
console.log(`Release Date: ${releaseDate}`);
console.log(`Change Date: ${changeDate}`);

async function updatePackageJson(path, update) {
  const raw = await readFile(path, "utf8");
  const pkg = JSON.parse(raw);
  update(pkg);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

async function updateLicense(nextVersion, nextReleaseDate, nextChangeDate) {
  const path = "LICENSE.md";
  let text = await readFile(path, "utf8");
  text = replaceLine(text, "- Licensed Work:", `- Licensed Work: Dibao ${nextVersion}`);
  text = replaceLine(text, "- Release Date:", `- Release Date: ${nextReleaseDate}`);
  text = replaceLine(text, "- Change Date:", `- Change Date: ${nextChangeDate}`);
  await writeFile(path, text);
}

async function updateDockerfileLabel(nextChangeDate) {
  const path = "Dockerfile";
  let text = await readFile(path, "utf8");
  text = text.replace(
    /com\.dibao\.license\.change-date="[^"]+"/,
    `com.dibao.license.change-date="${nextChangeDate}"`
  );
  await writeFile(path, text);
}

function replaceLine(text, prefix, replacement) {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}.*$`, "m");
  if (!pattern.test(text)) {
    fail(`Could not find "${prefix}" in LICENSE.md.`);
  }
  return text.replace(pattern, replacement);
}

function addYearsUtc(date, years) {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
