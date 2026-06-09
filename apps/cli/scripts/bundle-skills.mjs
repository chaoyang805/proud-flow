import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsSourceRoot = path.join(cliRoot, "skills");
const distSkillsRoot = path.join(cliRoot, "dist", "package-skills");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function generateSkillsManifest({
  skillsRoot: root,
  outputPath,
  cliVersion = "0.1.0",
}) {
  const skillNames = (
    await readdir(root, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const skills = [];
  for (const skillName of skillNames) {
    const skillDir = path.join(root, skillName);
    const metadata = JSON.parse(
      await readFile(path.join(skillDir, "skill.json"), "utf8"),
    );
    const files = {};
    const entries = await readdir(skillDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      const content = await readFile(path.join(skillDir, entry.name));
      files[entry.name] = sha256(content);
    }
    skills.push({
      name: metadata.name ?? skillName,
      version: metadata.version ?? "0.0.0",
      files,
    });
  }

  const manifest = {
    version: cliVersion,
    cliVersionRange: `>=${cliVersion}`,
    skills,
  };
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function copySkillSourcesToDist() {
  await mkdir(path.join(cliRoot, "dist"), { recursive: true });
  await rm(distSkillsRoot, { recursive: true, force: true });
  await mkdir(distSkillsRoot, { recursive: true });

  const entries = await readdir(skillsSourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await cp(
      path.join(skillsSourceRoot, entry.name),
      path.join(distSkillsRoot, entry.name),
      { recursive: true, force: true },
    );
  }
}

export async function bundleSkills() {
  const cliPackage = JSON.parse(
    await readFile(path.join(cliRoot, "package.json"), "utf8"),
  );
  await copySkillSourcesToDist();
  return generateSkillsManifest({
    skillsRoot: distSkillsRoot,
    outputPath: path.join(distSkillsRoot, "manifest.json"),
    cliVersion: cliPackage.version,
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const manifest = await bundleSkills();
  console.log(
    `Bundled ${manifest.skills.length} skills → ${distSkillsRoot}`,
  );
}
