#!/usr/bin/env node
import checkNode from './check-node.cjs';

if (!checkNode()) process.exitCode = 1;
else {
  const mcp = process.argv[2] === 'mcp';
  if (mcp) process.argv.splice(2, 1);
  await import(mcp ? '../src/mcp.ts' : '../src/cli.ts');
}
