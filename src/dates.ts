/** 뉴스의 모든 날짜 경계는 실행 PC의 시간대와 무관하게 한국 시간이다. */
export const NEWS_DATE_POLICY = "Asia/Seoul-calendar-inclusive-v1";
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

export function seoulDate(date: Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function newsPeriod(days: number, now = new Date()) {
  if (!Number.isSafeInteger(days) || days < 0 || days > 365000)
    throw new Error("days는 0~365000 정수여야 합니다.");
  const today = seoulDate(now);
  const since = days ? new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10) : null;
  return { today, since, period: since ? `${since}~${today}` : "전체", timeZone: "Asia/Seoul", collectedAt: now.toISOString() };
}
