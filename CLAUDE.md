@AGENTS.md

# Claude Code 전용 맥락

마지막 업데이트: 2026-10-26

- 동향 조사는 `trend-report`, 기업 하나 조사는 `company-profile` 스킬로 시작한다(스킬 목록·규칙은 AGENTS.md).
- 범위가 넓은 조사는 서로 독립인 조회를 서브에이전트에 나눠 맡긴다.

## 소스별 상태
| 명령 | 상태 |
|---|---|
| 논문(openalex) | Python 버전에서 검증됨. TypeScript 버전 재검증 필요 |
| 뉴스(news) | Python 버전에서 검증됨. TypeScript 버전 재검증 필요 |
| 동향(itfind) | Python 버전에서 검증됨. TypeScript 버전 재검증 필요 |
| 해외뉴스(gnews) | GDELT 429 차단으로 미검증 |

## 환경
- Node.js 24 필요. 이 PC 시스템 Node는 v20이라 업그레이드 필요.
- 실행: `node src/cli.ts <명령>`, MCP: `npm run mcp`.

## TODO
1. 실행 결과를 보고 `src/companies.ts` 기업명 사전 보강
2. data.go.kr 신청 완료된 두 API 연결: 한국연구재단_연구결과보고서 정보(15036875), 한국연구재단_ICT통계간행물 정보(15036876) — 엔드포인트/오퍼레이션명 확인부터
3. 기업명 정규화(그룹사 합산) + 소스 통합 표 (기업 | 국가 | 논문 | 기사 | 대표 제품 | 출처)
4. (취업 용도) 공식 채용 API가 있는 채용공고 소스 검토
5. (선택) 월별 언급 추이, DART, GitHub
