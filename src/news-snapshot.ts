import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { NEWS_DATE_POLICY } from "./dates.ts";
import { assertOutputPath } from "./output.ts";
import type { Row } from "./types.ts";
import { COMPANIES, COMPANY_DICTIONARY_VERSION, evidence } from "./companies.ts";

/** 이미 수집한 기사 목록과 메타 파일을 읽는다. API는 호출하지 않는다. */
export function readNewsSnapshot(path: string, opts: Record<string, unknown>): Row[] {
  assertOutputPath(path);
  let rows, meta, content: string;
  try {
    content = readFileSync(path, "utf8");
    rows = JSON.parse(content.replace(/^\uFEFF/, ""));
    meta = JSON.parse(readFileSync(path + ".meta.json", "utf8"));
  } catch { throw new Error("원본 기사 JSON과 실행 조건 파일을 읽을 수 없습니다."); }
  if (meta?.schemaVersion !== 2 || meta.command !== "news" || meta.options?.mode !== "articles"
    || meta.options["date-policy"] !== NEWS_DATE_POLICY || meta.options.review
    || typeof meta.collection?.collectedAt !== "string" || typeof meta.collection?.period !== "string"
    || !Array.isArray(rows) || rows.some((r) => !r || ["date", "title", "link", "companies", "match_evidence"].some((k) => typeof r[k] !== "string")
      || "description" in r || r.period !== meta.collection.period))
    throw new Error("현재 날짜 정책으로 수집한 미검토 원본 기사 목록만 --input으로 재집계할 수 있습니다.");
  // 검색 조건과 수집 시각은 원본에서 복원한다. 출력 방식과 이번 검토 파일은 유지한다.
  for (const key of ["query", "max", "days", "date-policy"]) {
    if (meta.options[key] !== undefined) opts[key] = meta.options[key]; else delete opts[key];
  }
  opts._collection = { ...meta.collection, input: path, inputSha256: createHash("sha256").update(content).digest("hex") };
  const descriptionDictionary = meta.options["description-dictionary"] ?? meta.options["company-dictionary"] ?? "legacy-unknown";
  opts["company-dictionary"] = COMPANY_DICTIONARY_VERSION;
  opts["description-dictionary"] = descriptionDictionary;
  (opts._collection as Record<string, unknown>).matchingCoverage = descriptionDictionary === COMPANY_DICTIONARY_VERSION
    ? "title+description-current" : "title-current;description-historical";
  // 같은 사전이면 수집 당시 설명 문맥으로 검증된 제목 매칭도 그대로 보존한다.
  if (meta.options["company-dictionary"] === COMPANY_DICTIONARY_VERSION)
    return rows.map((r: Row) => ({ ...r, matching_coverage: (opts._collection as Record<string, string>).matchingCoverage }));
  return rows.map((r: Row) => {
    let historical;
    try { historical = JSON.parse(String(r.match_evidence)); }
    catch { throw new Error("원본 기사 매칭 근거가 올바른 JSON이 아닙니다."); }
    if (!Array.isArray(historical) || historical.some((e) => !e || typeof e.company !== "string" || typeof e.alias !== "string" || !["title", "description"].includes(e.field)))
      throw new Error("원본 기사 매칭 근거의 형식이 잘못됐습니다.");
    const matches = [...evidence(String(r.title)), ...historical.filter((e) => e.field === "description" && e.company in COMPANIES)];
    const names = new Set(matches.map((e) => e.company));
    return { ...r, companies: Object.keys(COMPANIES).filter((c) => names.has(c)).join(";"),
      match_evidence: JSON.stringify(matches), matching_coverage: (opts._collection as Record<string, string>).matchingCoverage };
  });
}
