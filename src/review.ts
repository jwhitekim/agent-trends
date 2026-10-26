import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Row } from "./types.ts";

export interface Exclusion { link: string; company: string; reason: string; }

/** 제외는 기사·기업 조합에만 적용한다. 같은 기사 속 다른 기업은 유지한다. */
export function applyReview(rows: Row[], exclusions: Exclusion[]): Row[] {
  for (const e of exclusions) {
    if (!rows.some((r) => r.link === e.link && String(r.companies).split(";").includes(e.company)))
      throw new Error("검토 기록에 현재 수집 결과와 일치하지 않는 기사·기업 조합이 있습니다.");
  }
  return rows.map((r) => {
    const removed = exclusions.filter((e) => e.link === r.link);
    return { ...r, companies: String(r.companies).split(";").filter((c) => !removed.some((e) => e.company === c)).join(";"),
      excluded_companies: removed.map((e) => e.company).join(";"),
      exclusion_reasons: JSON.stringify(removed) };
  });
}

export function readReview(path: string): { exclusions: Exclusion[]; digest: string } {
  let value: unknown;
  let content: string;
  try { content = readFileSync(path, "utf8"); value = JSON.parse(content.replace(/^\uFEFF/, "")); }
  catch { throw new Error("검토 파일을 읽을 수 없거나 올바른 JSON이 아닙니다."); }
  if (!Array.isArray(value) || value.some((e) => !e || ["link", "company", "reason"].some((k) => typeof e[k] !== "string" || !e[k].trim())))
    throw new Error("검토 파일은 link, company, reason 문자열을 가진 객체 배열이어야 합니다.");
  return { exclusions: value, digest: createHash("sha256").update(content).digest("hex") };
}
