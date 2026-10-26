function checkNode(version = process.versions.node) {
  if (Number(version.split('.')[0]) >= 24) return true;
  console.error('Node.js 24 이상이 필요합니다. AGENTS.md의 설치 절차를 따르고 node --version으로 확인하세요.');
  return false;
}
module.exports = checkNode;
if (require.main === module) process.exitCode = checkNode() ? 0 : 1;
