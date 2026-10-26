import { existsSync } from "node:fs";
import { defaultPath } from "./common.ts";
import { writeMeta } from "./compare.ts";
import * as output from "./output.ts";
import type { Row } from "./types.ts";

/** 자동 저장은 동시 실행에도 기존 파일을 덮어쓰지 않는다. */
export function saveResult(rows: Row[], fmt: string, label: string, command: string, opts: Record<string, unknown>, explicit = ""): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const path = explicit || defaultPath(label, fmt);
    if (existsSync(path + ".meta.json")) {
      if (!explicit) continue;
      throw new Error("실행 조건 파일이 이미 존재합니다.");
    }
    output.assertOutputPath(path);
    try { output.write(rows, fmt, path); }
    catch (e) {
      if (!explicit && (e as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw e;
    }
    writeMeta(path, command, opts);
    return path;
  }
  throw new Error("저장 경로가 계속 충돌합니다. 잠시 후 다시 실행하세요.");
}
