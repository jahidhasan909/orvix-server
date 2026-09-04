import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.resolve(root, "../orvix");

function rewrite(source) {
  return source
    .replaceAll('from "next/server"', 'from "#shims/next-server.js"')
    .replaceAll("from 'next/server'", "from '#shims/next-server.js'")
    .replaceAll('from "next/headers"', 'from "#shims/next-headers.js"')
    .replaceAll("from 'next/headers'", "from '#shims/next-headers.js'")
    .replace(/from ["']@\/lib\/([^"']+)["']/g, (_, spec) => {
      const file = spec.endsWith(".js") ? spec : `${spec}.js`;
      return `from "#lib/${file}"`;
    })
    .replace(/from ["'](\.[^"']+)["']/g, (match, spec) => {
      if (/\.(js|json|mjs|cjs)$/.test(spec)) return match;
      const quote = match.includes("'") ? "'" : '"';
      return `from ${quote}${spec}.js${quote}`;
    });
}

async function copyDir(from, to, { skipDirs = [] } = {}) {
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dest, { skipDirs });
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    if (["api.js", "auth-client.js", "auth.js"].includes(entry.name) && path.basename(from) === "lib") continue;
    const rewritten = rewrite(await readFile(src, "utf8"));
    await writeFile(dest, rewritten);
  }
}

await copyDir(path.join(frontend, "src/lib"), path.join(root, "src/lib"), {
  skipDirs: ["supabase"],
});
await copyDir(path.join(frontend, "src/app/api"), path.join(root, "src/api"), {
  skipDirs: ["auth"],
});
console.log("Synced API modules from orvix");
