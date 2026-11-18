// DEL RIO entry point (Node 22, standard library only). The game itself is plain
// static files under game/ — an open-world crime game that runs offline in a
// desktop browser from game/index.html. This program hands the entry in: it copies
// game/ and screenshots/ from this repository into the output directory and writes
// /output/dossier.json, the summary the judge reads, using the vendored make.fun
// library. It is deterministic: the same repository always produces the same bytes.
//
// The entry point also refuses to hand in a broken repo: the game must have its
// index.html, its screenshots, and a LICENSE before anything is copied, so a
// half-finished checkout fails loudly here instead of at the gate.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally: node serve.ts, then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse a broken hand-in before copying anything.
const gameEntry = join(repoRoot, 'game', 'index.html');
if (!existsSync(gameEntry)) throw new Error(`DEL RIO: missing game entrypoint ${gameEntry}`);
if (!existsSync(join(repoRoot, 'LICENSE'))) throw new Error('DEL RIO: missing LICENSE');
const shotFiles = existsSync(join(repoRoot, 'screenshots'))
  ? readdirSync(join(repoRoot, 'screenshots')).filter((f) => /\.jpe?g$/i.test(f))
  : [];
if (shotFiles.length < 3) throw new Error(`DEL RIO: need at least 3 screenshots, found ${shotFiles.length}`);

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, from the kit scorer: the text cap shapes the dossier bytes;
// the rest refuse an entry the scorer would refuse (too many or too large
// screenshots; game/ over 993 files or 48 MiB; a game/ path over 1000 bytes).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
