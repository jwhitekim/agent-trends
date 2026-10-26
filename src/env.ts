import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 프로젝트 루트(src/의 상위 폴더). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 현재 폴더, 그다음 프로젝트 루트의 .env를 읽어 환경변수로 설정 (이미 설정된 값은 유지). */
export function loadDotenv(paths: string[] = [join(process.cwd(), ".env"), join(ROOT, ".env")]): void {
  for (const p of paths) if (existsSync(p)) loadFile(p);
}

function loadFile(path: string): void {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
