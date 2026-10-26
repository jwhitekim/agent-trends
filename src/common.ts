/** cli·compare·mcp가 함께 쓰는 이름표, 기본 저장 경로, 미리보기, 옵션 파싱. */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Option, Row } from "./types.ts";
import { seoulDate } from "./dates.ts";

// 쉬운 한글 이름 -> 소스 명령명
export const ALIASES: Record<string, string> = { "논문": "openalex", "뉴스": "news", "해외뉴스": "gnews", "동향": "itfind" };
export const LABELS: Record<string, string> = { openalex: "논문", news: "뉴스", gnews: "해외뉴스", itfind: "동향" };

export const GUIDE = `agent_trends - LLM 에이전트 동향 수집

  agent_trends 전체        모든 자료를 한 번에 모아 output/ 폴더에 저장
  agent_trends 논문        논문 많이 낸 기업 순위 (글로벌)
  agent_trends 뉴스        국내 뉴스에 많이 나온 기업 순위
  agent_trends 해외뉴스    해외 뉴스에 많이 나온 기업 순위
  agent_trends 동향        ICT 동향 보고서 목록
  agent_trends 비교 논문   지난번 결과와 비교 (늘어난 기업, 새 항목)

결과는 output/<이름>_<날짜>.csv 로 저장되고, 상위 10개를 화면에 보여 줍니다.
세부 옵션: agent_trends 논문 --help`;

// 한글 등 전각 문자는 터미널에서 두 칸
const w = (t: string) => [...t].reduce((n, ch) => n + (ch.codePointAt(0)! > 0x1100 ? 2 : 1), 0);

/** 상위 n행을 터미널 표로 출력 (긴 칸은 자름). */
export function preview(rows: Row[], n = 10, width = 30): void {
  if (!rows.length) {
    console.log("  결과 없음");
    return;
  }
  const cols = Object.keys(rows[0]).filter((c) => !/(link|_id|identifier)$/.test(c)).slice(0, 5);
  const cut = (v: unknown) => {
    const s = [...String(v ?? "")];
    return s.length > width ? s.slice(0, width - 1).join("") + "…" : s.join("");
  };
  const table = [cols, ...rows.slice(0, n).map((r) => cols.map((c) => cut(r[c])))];
  const widths = cols.map((_, i) => Math.max(...table.map((row) => w(row[i]))));
  table.forEach((row, j) => {
    console.log("  " + row.map((v, i) => v + " ".repeat(widths[i] - w(v))).join("  "));
    if (j === 0) console.log("  " + widths.map((x) => "-".repeat(x)).join("  "));
  });
  if (rows.length > n) console.log(`  … 외 ${rows.length - n}행`);
}

/** output/<이름>_<YYYYMMDD>.<fmt>, 이미 있으면 _<HHMM>을 붙여 덮어쓰기 방지. */
export function defaultPath(label: string, fmt: string): string {
  const d = new Date();
  const day = seoulDate(d).replaceAll("-", "");
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(":", "");
  let out = `output/${label}_${day}.${fmt}`;
  const stem = `output/${label}_${day}_${time}`;
  for (let i = 0; existsSync(out) || existsSync(out + ".meta.json"); i++)
    out = `${stem}${i ? `_${i}` : ""}.${fmt}`;
  return out;
}

/** 옵션 기본값으로 채운 opts. */
export function defaults(options: Option[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const op of options) if (op.default !== undefined) o[op.name] = op.default;
  return o;
}

/** 값 하나를 옵션 타입에 맞게 변환·검사. 틀리면 Error. */
export function coerce(op: Option, v: unknown): unknown {
  if (op.type === "integer") {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isInteger(n)) throw new Error(`--${op.name}: 정수가 아닙니다: ${String(v)}`);
    v = n;
  } else if (op.type === "boolean") {
    v = v === true || v === "true";
  } else if (op.type === "string[]") {
    v = (Array.isArray(v) ? v : [v]).map(String);
  } else v = String(v);
  const vals = Array.isArray(v) ? v : [v];
  if (op.choices && vals.some((x) => !op.choices!.includes(String(x))))
    throw new Error(`--${op.name}: ${op.choices.join("|")} 중 하나여야 합니다: ${vals.join(",")}`);
  return v;
}

/** options 정의로 node:util parseArgs를 돌려 opts(키 = 플래그명)와 positional을 만든다. */
export function parseOptions(options: Option[], argv: string[], allowPositionals = false) {
  const spec: Record<string, { type: "string" | "boolean"; multiple: boolean; short?: string }> = {};
  for (const op of options)
    spec[op.name] = { type: op.type === "boolean" ? "boolean" : "string", multiple: op.type === "string[]" };
  spec.help = { type: "boolean", multiple: false, short: "h" };
  const { values, positionals } = parseArgs({ args: argv, options: spec, strict: true, allowPositionals });
  const opts = defaults(options);
  for (const op of options) if (values[op.name] !== undefined) opts[op.name] = coerce(op, values[op.name]);
  return { opts, positionals, help: Boolean(values.help) };
}

/** <명령> --help 문구. */
export function helpText(prog: string, desc: string, options: Option[]): string {
  const lines = [`사용법: ${prog} [옵션]`, "", desc, "", "옵션:"];
  for (const op of options) {
    const meta = op.type === "boolean" ? "" : op.choices ? ` {${op.choices.join(",")}}` : op.type === "integer" ? " N" : " 값";
    const extra = [op.help, op.type === "string[]" ? "여러 번 지정 가능" : "",
      op.default !== undefined && op.default !== "" && !(Array.isArray(op.default) && !op.default.length) ? `기본: ${Array.isArray(op.default) ? op.default.join(", ") : op.default}` : ""]
      .filter(Boolean).join(" / ");
    lines.push(`  --${op.name}${meta}`.padEnd(30) + " " + extra);
  }
  lines.push("  -h, --help".padEnd(30) + " 이 도움말");
  return lines.join("\n");
}

export const IO_OPTIONS: Option[] = [
  { name: "format", type: "string", choices: ["csv", "json"], default: "csv" },
  { name: "out", type: "string", default: "", help: "저장 파일 (기본: output/<이름>_<날짜>.csv, -: 터미널에 출력)" },
];
