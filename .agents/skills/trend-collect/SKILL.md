---
name: trend-collect
description: Use when agent-trends data must be gathered before analysis — "뉴스 모아줘", "논문 순위 뽑아줘", "동향 자료 수집해줘", or as step 1 of trend-report. Runs the collection tools with the right options and logs failures.
---

# 수집

규칙·한도·도구 표는 `AGENTS.md`의 "규칙"과 "동향 조사·보고" 절이 원본이다.

1. 질문에 맞는 소스를 고른다(뉴스 > 해외뉴스 > 논문 > 동향 순으로 우선).
2. MCP 도구(agent-trends)가 있으면 쓰고, 없으면 `node src/cli.ts <명령> --format json --out -`로 받는다.
   비교 기준선이 필요하면 MCP의 `save: true` 또는 CLI의 `--out <새 파일>`로 저장한다. 화면으로만 받은 경우에는 기준선을 저장했다고 보고하지 않는다.
3. 뉴스는 `--days`를 명시해 기간을 고정한다.
4. 동향은 조사당 1~2회, 해외뉴스는 1회만 실행한다.
5. 실패한 소스는 건너뛰고 "확인하지 못한 것"에 적을 사유를 남긴다.

옵션 예시는 같은 폴더 `commands.md`.
