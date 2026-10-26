import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { newsPeriod, NEWS_DATE_POLICY } from "../src/dates.ts";
import { pubDate, source } from "../src/sources/naver_news.ts";
import { write } from "../src/output.ts";
import { writeMeta } from "../src/compare.ts";

test("최근 7일은 한국 시간 오늘 포함 7개 날짜이며 1일·0일·윤년 경계도 처리한다", () => {
  const now = new Date("2026-10-25T15:00:00Z");
  assert.equal(newsPeriod(7, now).period, "2026-10-20~2026-10-26");
  assert.equal(newsPeriod(1, now).period, "2026-10-26~2026-10-26");
  assert.equal(newsPeriod(0, now).period, "전체");
  assert.equal(newsPeriod(2, new Date("2024-03-01T03:00:00Z")).since, "2024-02-29");
  assert.throws(() => newsPeriod(-1, now));
  assert.throws(() => newsPeriod(0.5, now));
});

test("기사가 UTC나 다른 오프셋이어도 한국 날짜로 정규화한다", () => {
  assert.equal(pubDate("Sun, 25 Oct 2026 15:00:00 +0000"), "2026-10-26");
  assert.equal(pubDate("Sun, 25 Oct 2026 14:59:59 +0000"), "2026-10-25");
  assert.equal(pubDate("Sun, 25 Oct 2026 23:00:00 -0700"), "2026-10-26");
  assert.throws(() => pubDate("invalid"), /발행 시각/);
});

test("호스트 시간대를 바꿔도 집계 기간이 같다", () => {
  const url = new URL("../src/dates.ts", import.meta.url).href;
  for (const TZ of ["UTC", "America/Los_Angeles", "Asia/Seoul"]) {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e",
      `import {newsPeriod} from ${JSON.stringify(url)}; console.log(newsPeriod(7,new Date("2026-10-25T16:00:00Z")).period);`],
    { env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "2026-10-20~2026-10-26");
  }
});

test("시작 경계는 포함하고 이전 날짜와 수집 시각 이후 기사는 제외한다", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-26T01:00:00Z") });
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  process.env.NAVER_CLIENT_ID = "test"; process.env.NAVER_CLIENT_SECRET = "test";
  t.after(() => {
    if (id === undefined) delete process.env.NAVER_CLIENT_ID; else process.env.NAVER_CLIENT_ID = id;
    if (secret === undefined) delete process.env.NAVER_CLIENT_SECRET; else process.env.NAVER_CLIENT_SECRET = secret;
  });
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ items:
    ["Mon, 26 Oct 2026 11:00:00 +0900", "Mon, 26 Oct 2026 09:00:00 +0900",
      "Mon, 19 Oct 2026 15:00:00 +0000", "Mon, 19 Oct 2026 14:59:59 +0000"].map((pubDate, i) =>
      ({ pubDate, title: "SKT AI 에이전트", description: "", originallink: `https://example.test/${i}` }))
  })));
  const opts: Record<string, unknown> = { query: ["AI"], max: 100, days: 7, mode: "articles" };
  const rows = await source.fetch(opts);
  assert.deepEqual(rows.map((r) => r.date), ["2026-10-26", "2026-10-20"]);
  assert.equal((opts._collection as { requests: number }).requests, 1);
});

test("저장한 원본 재집계는 API 없이 원본 기간·수집 시각과 검색 조건을 보존한다", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "news-snapshot-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "raw.json");
  const collection = newsPeriod(7, new Date("2026-10-26T01:00:00Z"));
  write([{ date: "2026-10-26", title: "SKT AI 에이전트", link: "https://example.test/a", companies: "SK",
    match_evidence: "[]", period: collection.period }], "json", path);
  writeMeta(path, "news", { mode: "articles", review: "", query: ["AI"], max: 100, days: 7,
    "date-policy": NEWS_DATE_POLICY, _collection: collection });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("API를 호출하면 안 됨"); });
  const opts: Record<string, unknown> = { input: path, mode: "companies", days: 30 };
  const rows = await source.fetch(opts);
  assert.equal(rows[0].articles, 1);
  assert.equal(rows[0].period, collection.period);
  assert.equal(opts.days, 7);
  assert.equal((opts._collection as { collectedAt: string }).collectedAt, collection.collectedAt);
  assert.equal((opts._collection as { inputSha256: string }).inputSha256.length, 64);
});
