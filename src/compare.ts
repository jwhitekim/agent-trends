/** output/의 같은 이름 결과 파일 중 최근 2개(또는 --from/--to)를 비교. */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ALIASES, LABELS, helpText, IO_OPTIONS, parseOptions, preview } from "./common.ts";
import * as output from "./output.ts";
import type { Option, Row } from "./types.ts";

export const description = "지난 결과와 비교 (기업별 증감 또는 새 항목). 결과는 저장하지 않음";
const NUM_COLS = ["papers", "articles", "count"];

export const options: Option[] = [
  { name: "name", type: "string", help: "논문|뉴스|해외뉴스|동향 (또는 openalex 등 영문명)" },
  { name: "from", type: "string", help: "이전 파일" },
  { name: "to", type: "string", help: "현재 파일" },
];

// ---- CSV/JSON 읽기 ----
function parseCsv(text: string): Row[] {
  const recs: string[][] = [];
  let rec: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { rec.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      rec.push(f); recs.push(rec); rec = []; f = "";
    } else f += c;
  }
  if (f || rec.length) { rec.push(f); recs.push(rec); }
  const rows = recs.filter((r) => !(r.length === 1 && r[0] === ""));
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function load(path: string): Row[] {
  output.assertOutputPath(path);
  try {
    const text = readFileSync(path, "utf8").replace(/^﻿/, "");
    const rows = path.endsWith(".json") ? JSON.parse(text) : parseCsv(text);
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw new Error();
    return rows;
  } catch { throw new Error("비교 파일을 읽을 수 없거나 올바른 행 목록이 아닙니다."); }
}

const num = (v: unknown) => {
  const n = Math.trunc(Number(v));
  return v === undefined || v === null || v === "" || Number.isNaN(n) ? 0 : n;
};

/** 순위형(company 열)이면 기업별 증감, 목록형이면 새 항목만. */
export function diff(old: Row[], cur: Row[]): ["companies" | "articles", Row[]] {
  if ((cur.length && "company" in cur[0]) || (old.length && "company" in old[0])) {
    const sample = (cur.length ? cur : old)[0];
    const col = NUM_COLS.find((c) => c in sample);
    const o = new Map(old.map((r) => [String(r.company), num(col && r[col])]));
    const n = new Map(cur.map((r) => [String(r.company), num(col && r[col])]));
    const rows: Row[] = [];
    for (const name of [...n.keys(), ...[...o.keys()].filter((k) => !n.has(k))]) {
      const prev = o.get(name), now = n.get(name);
      rows.push({ company: name, before: prev ?? "", after: now ?? "", change: (now ?? 0) - (prev ?? 0),
        status: prev === undefined ? "신규" : now === undefined ? "사라짐" : "" });
    }
    const k1 = (r: Row) => (r.after !== "" ? -Number(r.after) : 1);
    rows.sort((a, b) => k1(a) - k1(b) || -Math.abs(Number(a.change)) + Math.abs(Number(b.change)));
    return ["companies", rows];
  }
  const key = (r: Row) => String(r.link || r.identifier || r.title);
  const seen = new Set(old.map(key));
  return ["articles", cur.filter((r) => !seen.has(key(r)))];
}

// ---- 실행 조건 기록(<파일>.meta.json) ----
export const metaPath = (path: string) => path + ".meta.json";

function sortKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

/** 결과 파일 옆에 실행 조건(명령·옵션)을 <파일>.meta.json으로 저장. */
export function writeMeta(path: string, command: string, opts: Record<string, unknown>): void {
  const options = sortKeys(Object.fromEntries(Object.entries(opts).filter(([k]) => !["format", "out", "input"].includes(k) && !k.startsWith("_"))));
  if (options.review) options.review = options["review-sha256"] ?? createHash("sha256").update(readFileSync(String(options.review))).digest("hex");
  delete options["review-sha256"];
  writeFileSync(metaPath(path), JSON.stringify({ schemaVersion: 2, command, options, collection: opts._collection }), { encoding: "utf8", flag: "wx" });
}

function readMeta(path: string): { schemaVersion?: number; command: string; options: Record<string, unknown> } | null {
  try {
    return JSON.parse(readFileSync(metaPath(path), "utf8"));
  } catch {
    return null;
  }
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a && typeof a === "object" && !Array.isArray(a) ? sortKeys(a as Record<string, unknown>) : a) ===
  JSON.stringify(b && typeof b === "object" && !Array.isArray(b) ? sortKeys(b as Record<string, unknown>) : b);

function sameMeta(a: ReturnType<typeof readMeta>, b: ReturnType<typeof readMeta>): boolean {
  return !!a && !!b && a.schemaVersion === 2 && b.schemaVersion === 2 && a.command === b.command && same(a.options, b.options);
}

/** 조건 비교 경고 문구('' = 같음). */
export function check(oldF: string, newF: string): string {
  const m1 = readMeta(oldF), m2 = readMeta(newF);
  if (!m1 || !m2) return "[비교] 경고: 실행 조건 기록(.meta.json)이 없는 파일이 있어 같은 조건인지 확인하지 못했습니다.";
  if (m1.schemaVersion !== 2 || m2.schemaVersion !== 2) return "[비교] 중단: 집계 기준 버전이 다른 과거 결과입니다. 새 기준선을 수집하세요.";
  if (!sameMeta(m1, m2)) {
    const o1 = m1.options ?? {}, o2 = m2.options ?? {};
    const d = [...new Set([...Object.keys(o1), ...Object.keys(o2)])].sort()
      .filter((k) => !same(o1[k], o2[k]))
      .map((k) => `${k}: ${JSON.stringify(o1[k])}->${JSON.stringify(o2[k])}`).join(", ");
    return `[비교] 경고: 실행 조건이 다릅니다(${d || "명령"}). 증감이 실제 변화가 아닐 수 있습니다.`;
  }
  return "";
}

/** 비교할 (이전, 현재) 파일. 이전 결과가 없으면 null과 안내 문구. */
export function files(opts: Record<string, unknown>): [[string, string] | null, string] {
  const src = opts.from as string | undefined, dst = opts.to as string | undefined;
  if (Boolean(src) !== Boolean(dst)) throw new Error("--from과 --to는 함께 지정하세요.");
  if (src && dst) return [[src, dst], ""];
  const name = opts.name as string | undefined;
  if (!name) throw new Error("비교할 이름(논문|뉴스|해외뉴스|동향) 또는 --from/--to를 지정하세요.");
  const label = LABELS[ALIASES[name] ?? name] ?? name;
  const dir = "output";
  const list = existsSync(dir) ? readdirSync(dir) : [];
  const found = list
    .filter((f) => f.startsWith(label + "_") && /\.(csv|json)$/.test(f) && !f.endsWith(".meta.json")
      && /^\d{8}/.test(f.slice(label.length + 1)))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  if (found.length < 2)
    return [null, `비교할 이전 결과가 없습니다(${label} 파일 ${found.length}개). 같은 조건으로 한 번 더 수집한 뒤 비교하세요.`];
  // 최신 파일과 조건이 같은 가장 최근 이전 파일을 우선 고른다.
  const cur = found[found.length - 1];
  const m = readMeta(cur);
  if (m) for (const f of found.slice(0, -1).reverse()) if (sameMeta(readMeta(f), m)) return [[f, cur], ""];
  return [[found[found.length - 2], cur], ""];
}

/** MCP 등 도구용: 비교 결과 행 목록(이전 결과가 없으면 안내 한 행). */
export async function fetch(opts: Record<string, unknown>): Promise<Row[]> {
  const [pair, note] = files(opts);
  if (!pair) return [{ note }];
  for (const f of pair) if (!existsSync(f)) throw new Error(`파일이 없습니다: ${f}`);
  const warn = check(...pair);
  if (warn) throw new Error(warn + " 비교를 중단했습니다.");
  return diff(load(pair[0]), load(pair[1]))[1];
}

/** CLI: agent_trends 비교 <이름> [--from --to] [--format --out]. 종료 코드 반환. */
export function main(argv: string[]): number {
  const all = [...options, ...IO_OPTIONS.map((o) => (o.name === "out" ? { ...o, help: "저장 파일 (-: 터미널에 출력, 기본: 화면 표만)" } : o))];
  let parsed;
  try {
    parsed = parseOptions(all, argv, true);
  } catch (e) {
    console.error(`agent_trends 비교: 오류: ${(e as Error).message}`);
    return 2;
  }
  const { opts, positionals, help } = parsed;
  if (help) {
    console.log(helpText("agent_trends 비교 [논문|뉴스|해외뉴스|동향]", description, all));
    return 0;
  }
  opts.name = opts.name || positionals[0];
  let pair, note;
  try {
    [pair, note] = files(opts);
  } catch (e) {
    console.error(`agent_trends 비교: 오류: ${(e as Error).message}`);
    return 2;
  }
  if (!pair) {
    console.error(note);
    return 0;
  }
  const [oldF, newF] = pair;
  for (const f of pair) if (!existsSync(f)) {
    console.error(`[비교] 실패: 파일이 없습니다: ${f}`);
    return 1;
  }
  console.error(`[비교] ${oldF} -> ${newF}`);
  const warn = check(oldF, newF);
  if (warn) { console.error(warn + " 비교를 중단했습니다."); return 1; }
  const [kind, rows] = diff(load(oldF), load(newF));
  const out = String(opts.out ?? ""), fmt = String(opts.format);
  if (out) {
    output.write(rows, fmt, out === "-" ? "" : out);
    if (out === "-") return 0;
  }
  if (kind === "companies") {
    const changed = rows.filter((r) => r.change || r.status);
    console.log(`기업 ${rows.length}곳 중 변동 ${changed.length}곳 (신규 ${rows.filter((r) => r.status === "신규").length},`
      + ` 사라짐 ${rows.filter((r) => r.status === "사라짐").length})`);
  } else console.log(`새로 추가된 항목 ${rows.length}개`);
  preview(rows);
  return 0;
}
