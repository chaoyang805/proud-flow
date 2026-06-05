import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const skillNames = ["tech-design", "case-rundown", "development"];
const version = "0.1.0";
const outDir = path.join(root, "skills", "dist");

await mkdir(outDir, { recursive: true });

const manifest = {
  version,
  cliVersionRange: ">=0.1.0",
  skills: [],
};

for (const name of skillNames) {
  const skillDir = path.join(root, "skills", name);
  const files = [];
  for (const fileName of ["SKILL.md", "skill.json"]) {
    files.push({
      path: fileName,
      content: await readFile(path.join(skillDir, fileName), "utf8"),
    });
  }
  const pkg = { name, version, files };
  const bytes = Buffer.from(JSON.stringify(pkg));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = `${name}-${version}.skillpkg.json`;
  await writeFile(path.join(outDir, fileName), bytes);
  manifest.skills.push({
    name,
    version,
    downloadUrl: `https://static.proud-flow.example/skills/${fileName}`,
    sha256,
  });
}

await writeFile(
  path.join(root, "skills", "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
