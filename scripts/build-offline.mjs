import { readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(async (d) =>
        d.isDirectory() ? files(`${dir}/${d.name}`) : [`${dir}/${d.name}`],
      ),
    )
  ).flat();
}
const assets = (await files("dist"))
  .filter((p) => !p.endsWith("sw.js"))
  .map((p) => `${process.env.GITHUB_ACTIONS ? "/torneig-futboli/" : "/"}${p.slice(5)}`);
const base = process.env.GITHUB_ACTIONS ? "/torneig-futboli/" : "/";
const hash = createHash("sha256")
  .update(await readFile("dist/index.html"))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='futboli-${hash}';const BASE=${JSON.stringify(base)};const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('futboli-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(BASE+'index.html')));return;}e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});`,
);
console.log(`Offline cache: ${assets.length} local assets`);
