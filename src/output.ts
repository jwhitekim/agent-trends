import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { Row } from "./types.ts";

function cell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows를 CSV/JSON 문자열로. CSV는 첫 행의 열 순서를 따른다(Python DictWriter와 같음). */
export function render(rows: Row[], fmt: string): string {
  if (fmt === "json") return JSON.stringify(rows, null, 2);
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))]
    .map((l) => l + "\r\n").join("");
}

/** out이 비면 화면(stdout), 있으면 파일(CSV는 UTF-8 BOM, 엑셀 호환). */
export function assertOutputPath(out: string): void {
  const parts = resolve(out).split(sep);
  if (parts.some((p) => /^\.env(?:\.|$)/i.test(p)) || !/\.(csv|json)$/i.test(out))
    throw new Error("출력은 .env 이외의 CSV/JSON 파일만 허용합니다.");
}

export function write(rows: Row[], fmt: string, out = ""): void {
  const text = render(rows, fmt);
  if (!out) {
    process.stdout.write(text + (fmt === "json" ? "\n" : ""));
    return;
  }
  assertOutputPath(out);
  mkdirSync(dirname(out) || ".", { recursive: true });
  writeFileSync(out, (fmt === "csv" ? "﻿" : "") + text, { encoding: "utf8", flag: "wx" });
}
