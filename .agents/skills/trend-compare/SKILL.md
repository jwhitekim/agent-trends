---
name: trend-compare
description: Use when the user asks what changed since last time — "이번 주 뭐 바뀌었어?", "지난번이랑 비교해줘", "새로 뜬 기업 있어?", or as step 3 of trend-report. Compares the latest two saved results.
---

# 비교

1. 비교할 결과 이름마다 MCP 도구 `compare` 또는 `node src/cli.ts 비교 <이름>`을 실행한다.
2. 신규·증감·사라짐 기업을 뽑는다. 기간이 다른 두 결과면 그 사실을 함께 적는다.
3. 같은 조건(`<파일>.meta.json`) 결과끼리만 비교한다. 조건 불일치·기록 부재로 중단되면 증감을 보고하지 않고 새 기준선이 필요하다고 적는다.
4. 이전 결과가 없다는 안내가 나오면 비교하지 않는다. 실제 파일을 저장한 경우에만 "기준선 저장(같은 조건으로 한 번 더 수집한 뒤 비교)"으로 보고하고, 저장하지 않았다면 "기준선 저장 필요"로 적는다.
