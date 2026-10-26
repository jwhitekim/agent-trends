#!/usr/bin/env node
/** 사용법: node src/cli.ts <소스|한글이름> [옵션] --format csv|json [--out 파일] */
import { ALIASES, defaults, GUIDE, helpText, IO_OPTIONS, LABELS, parseOptions, preview } from "./common.ts";
import * as compare from "./compare.ts";
import { loadDotenv } from "./env.ts";
import * as output from "./output.ts";
import { SOURCES } from "./sources/index.ts";
import type { Source } from "./types.ts";
import { saveResult } from "./results.ts";

/** 소스 하나를 실행해 저장하고 미리보기. 실패하면 이유를 한 줄로 보여 주고 false. */
async function run(src: Source, opts: Record<string, unknown>): Promise<boolean> {
  if (opts.out && opts.out !== "-") output.assertOutputPath(String(opts.out));
  const label = LABELS[src.name] ?? src.label;
  console.error(`\n[${label}] 수집 중...`);
  let rows;
  try {
    rows = await src.fetch(opts);
  } catch (e) {
    console.error(`[${label}] 실패: ${(e as Error)?.message ?? e}`);
    return false;
  }
  const fmt = String(opts.format ?? "csv"), outOpt = String(opts.out ?? "");
  if (outOpt === "-") {
    output.write(rows, fmt);
    return true;
  }
  const out = saveResult(rows, fmt, label, src.name, opts, outOpt);
  console.log(`[${label}] ${rows.length}행 -> ${out}`);
  preview(rows);
  return true;
}

async function main(): Promise<number> {
  loadDotenv();
  const raw = process.argv.slice(2);
  const argv = [...raw.slice(0, 1).map((a) => ALIASES[a] ?? a), ...raw.slice(1)];
  if (argv[0] === "compare" || argv[0] === "비교") return compare.main(argv.slice(1));
  if (!argv.length || ["-h", "--help", "help", "도움말"].includes(argv[0])) {
    console.log(GUIDE);
    return 0;
  }
  const cmd = argv[0] === "전체" ? "all" : argv[0];
  if (cmd === "all") {
    let parsed;
    try {
      parsed = parseOptions(IO_OPTIONS, argv.slice(1));
    } catch (e) {
      console.error(`agent_trends all: 오류: ${(e as Error).message}`);
      return 2;
    }
    if (parsed.help) {
      console.log(helpText("agent_trends 전체", "모든 소스 실행", IO_OPTIONS));
      return 0;
    }
    if (parsed.opts.out && parsed.opts.out !== "-") throw new Error("전체 명령은 --out - 또는 소스별 기본 저장만 지원합니다.");
    if (parsed.opts.out === "-" && parsed.opts.format !== "json") throw new Error("전체 --out -는 --format json으로 실행하세요.");
    let ok = 0;
    if (parsed.opts.out === "-") {
      const results: Record<string, unknown> = {};
      for (const s of SOURCES) {
        try { results[s.name] = { rows: await s.fetch(defaults(s.options)) }; ok++; }
        catch (e) { results[s.name] = { error: (e as Error).message }; }
      }
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else for (const s of SOURCES) ok += Number(await run(s, { ...defaults(s.options), format: parsed.opts.format, out: "" }));
    console.error(`\n완료: ${SOURCES.length}개 중 ${ok}개 성공.`);
    return ok ? 0 : 1;
  }
  const src = SOURCES.find((s) => s.name === cmd);
  if (!src) {
    console.error(`agent_trends: 알 수 없는 명령: ${argv[0]}\n\n${GUIDE}`);
    return 2;
  }
  const all = [...src.options, ...IO_OPTIONS];
  let parsed;
  try {
    parsed = parseOptions(all, argv.slice(1));
  } catch (e) {
    console.error(`agent_trends ${cmd}: 오류: ${(e as Error).message}`);
    return 2;
  }
  if (parsed.help) {
    console.log(helpText(`agent_trends ${LABELS[cmd] ?? cmd}`, src.description, all));
    return 0;
  }
  return (await run(src, parsed.opts)) ? 0 : 1;
}

try { process.exitCode = await main(); }
catch (e) { console.error(`agent_trends: 오류: ${(e as Error).message}`); process.exitCode = 1; }
