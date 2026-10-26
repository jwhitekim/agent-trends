---
name: company-profile
description: Use when the user asks about one specific company — "업스테이지 조사해줘", "카카오 에이전트 뭐 하고 있어?", "이 회사 취업처로 어때?". Queries every source with that company's name and writes a one-page summary.
---

# 기업 하나 조사

1. trend-collect 절차로 모든 소스를 `--query <기업명>`으로 조회한다(뉴스는 `--mode articles`).
2. trend-verify 절차로 그 기업과 무관한 기사를 뺀다.
3. 한 장으로 요약한다: 무엇을 하나 / 근거(논문·기사 수와 기간) / 최근 소식 3개 / 확인하지 못한 것.
