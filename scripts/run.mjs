#!/usr/bin/env node
import checkNode from './check-node.cjs';

if (!checkNode()) process.exitCode = 1;
else await import('../src/cli.ts');
