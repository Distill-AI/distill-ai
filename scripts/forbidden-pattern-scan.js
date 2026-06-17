#!/usr/bin/env node
'use strict';

/**
 * Cross-platform pre-commit / pre-push security scan.
 * Checks for Lazarus 'Contagious Interview' / BeaverTail IOCs across
 * config files, entry points, and source files tracked by git.
 *
 * Exits 0 (clean) or 1 (blocked pattern found).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());

// Each entry is checked with a separate git grep call so the label is precise.
const PATTERNS = [
  { pattern: "global['!']",       label: 'Lazarus global[!] marker' },
  { pattern: 'atob(process.env.', label: 'base64-decoded env var execution (dropper)' },
  { pattern: 'AUTH_API_KEY',      label: 'known dropper env var (AUTH_API_KEY)' },
  { pattern: '_$_1e42',           label: '_$_1e42 obfuscation marker' },
  { pattern: 'api.trongrid.io',   label: 'TRON RPC C2 endpoint' },
  { pattern: 'bsc-dataseed',      label: 'BSC RPC C2 endpoint' },
  { pattern: '166.88.54.158',     label: 'known C2 IP' },
  { pattern: '198.105.127.210',   label: 'known C2 IP' },
  { pattern: '23.27.202.27',      label: 'known C2 IP' },
  { pattern: '154.91.0.103',      label: 'known C2 IP' },
];

const EXCLUDES = [
  ':(exclude).github/',
  ':(exclude)scripts/',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)*.malware-backup-*',
];

let dirty = false;

for (const { pattern, label } of PATTERNS) {
  const list = spawnSync(
    'git',
    ['grep', '-lF', pattern, '--', '.', ...EXCLUDES],
    { cwd: root, encoding: 'utf8' }
  );

  if (list.error) {
    process.stderr.write(`forbidden-pattern-scan: git grep failed: ${list.error.message}\n`);
    process.exit(2);
  }

  // git grep exits 0 when matches are found, 1 when none, 2+ on error
  if (list.status === 0 && list.stdout.trim()) {
    if (!dirty) {
      process.stderr.write('::error::Blocked pattern(s) detected in repository files.\n\n');
    }
    dirty = true;
    process.stderr.write(`  [${label}]\n`);

    const detail = spawnSync(
      'git',
      ['grep', '-nF', pattern, '--', '.', ...EXCLUDES],
      { cwd: root, encoding: 'utf8' }
    );
    if (detail.stdout) {
      detail.stdout.trimEnd().split('\n').forEach(line => {
        process.stderr.write(`    ${line}\n`);
      });
    }
    process.stderr.write('\n');
  }
}

if (dirty) {
  process.stderr.write('Commit blocked. Remove the flagged content and try again.\n');
  process.exit(1);
}

console.log('OK: no blocked patterns found.');
