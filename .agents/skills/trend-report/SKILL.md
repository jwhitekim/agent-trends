---
name: trend-report
description: Use when asked to investigate or report on LLM agent industry trends — "동향 보고해줘", "요즘 에이전트 뜨는 기업 알려줘", "이번 주 에이전트 동향 정리해줘". Entry point that runs trend-collect, trend-verify, trend-compare in order and writes a Korean report. For a single company use company-profile.
---

# 동향 보고 (상위 진입점)

1. trend-collect로 수집한다.
2. trend-verify로 검증한다.
3. trend-compare로 지난 결과와 비교한다.
4. 단서(처음 보는 기업, 급증 기업)는 이미 수집한 기사 목록에서 먼저 확인한다. 추가 조회는 AGENTS.md의 소스별 한도 안에서만 하고, 해외뉴스는 재실행하지 않는다.
5. `AGENTS.md`의 "보고 형식"대로 쓴다. 저장 요청 시 `reports/<주제>_<YYYYMMDD>.md`.
