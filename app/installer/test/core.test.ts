import {
  buildEnvContent, extractAppSecret, generateAppSecret, databaseUrl, composeArgs, validateConfig,
  defaultConfig, parseEnv, configFromEnv, extractClaudeToken,
  type InstallerConfig,
} from '../src/core.js';

/** Minimal tsx test harness — no framework dependency. */
let pass = 0, fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const base: InstallerConfig = {
  projectName: 'EliteFlow Nebula',
  timezone: 'Asia/Bangkok',
  workspacePath: 'C:\\ef\\workspace',
  sourceRepoPath: 'C:\\ef\\product',
  postgresUser: 'agentflow',
  postgresPassword: 'pw!secret',
  postgresDb: 'agentflow',
  postgresPort: '5432',
  webPort: '3000',
  claudeModel: 'claude-opus-4-8',
  cycleCron: '*/30 * * * *',
  maxRunsPerCycle: '12',
  authKind: 'oauth_token',
  oauthToken: 'tok-abc',
  apiKey: '',
  antigravityToken: 'ag-xyz',
  appSecret: 'deadbeef',
};

// databaseUrl uses the compose service name + internal 5432, NOT the host port.
ok('databaseUrl internal', databaseUrl({ ...base, postgresPort: '5544' }) === 'postgres://agentflow:pw!secret@postgres:5432/agentflow');

// buildEnvContent: oauth token populated, api key blank, antigravity stored.
const env = buildEnvContent(base);
ok('env has APP_SECRET', env.includes('\nAPP_SECRET=deadbeef\n'));
ok('env oauth set', env.includes('\nCLAUDE_CODE_OAUTH_TOKEN=tok-abc\n'));
ok('env api key blank', env.includes('\nANTHROPIC_API_KEY=\n'));
ok('env antigravity stored', env.includes('\nANTIGRAVITY_TOKEN=ag-xyz\n'));
ok('env DATABASE_URL', env.includes('postgres://agentflow:pw!secret@postgres:5432/agentflow'));
ok('env trailing newline', env.endsWith('\n'));
// oauth installs enforce subscription-only via the OAUTH_ONLY guard.
ok('env oauth_only enforced', env.includes('\nOAUTH_ONLY=true\n'));

// api_key auth flips which credential line is populated.
const envApi = buildEnvContent({ ...base, authKind: 'api_key', apiKey: 'sk-ant-1' });
ok('env api mode key set', envApi.includes('\nANTHROPIC_API_KEY=sk-ant-1\n'));
ok('env api mode oauth blank', envApi.includes('\nCLAUDE_CODE_OAUTH_TOKEN=\n'));
// api-key installs must NOT enforce OAUTH_ONLY (else the orchestrator would refuse to start).
ok('env api mode oauth_only blank', envApi.includes('\nOAUTH_ONLY=\n'));

// extractAppSecret: round-trips the value the installer wrote, ignores other lines.
ok('extract secret', extractAppSecret('FOO=bar\nAPP_SECRET=abc123\nWEB_PORT=3000') === 'abc123');
ok('extract secret crlf', extractAppSecret('APP_SECRET=xyz\r\nWEB_PORT=3000') === 'xyz');
ok('extract secret missing', extractAppSecret('FOO=bar') === null);
ok('extract secret blank ignored', extractAppSecret('APP_SECRET=\nFOO=bar') === null);
ok('roundtrip secret', extractAppSecret(buildEnvContent(base)) === 'deadbeef');

// generateAppSecret: 64 hex chars, fresh each call.
const s1 = generateAppSecret(), s2 = generateAppSecret();
ok('secret 64 hex', /^[0-9a-f]{64}$/.test(s1));
ok('secret unique', s1 !== s2);

// composeArgs: the clean-vs-keep-data branch.
ok('compose up', composeArgs('up', 'infra/docker-compose.yml').join(' ') === 'compose -f infra/docker-compose.yml up -d --build');
ok('compose start', composeArgs('start', 'f').join(' ') === 'compose -f f up -d');
ok('compose stop (keep data)', composeArgs('stop', 'f').join(' ') === 'compose -f f down');
ok('compose down-clean (wipe)', composeArgs('down-clean', 'f').join(' ') === 'compose -f f down -v');

// validateConfig: clean config passes; bad fields are reported.
ok('valid config ok', validateConfig(base).length === 0);
ok('missing token flagged', validateConfig({ ...base, oauthToken: '' }).some((e) => /token/i.test(e)));
ok('bad port flagged', validateConfig({ ...base, webPort: 'abc' }).some((e) => /web port/i.test(e)));
ok('api mode needs key', validateConfig({ ...base, authKind: 'api_key', apiKey: '' }).some((e) => /api key/i.test(e)));

// defaultConfig: fresh install gets a generated secret + standard defaults.
const def = defaultConfig();
ok('default secret generated', /^[0-9a-f]{64}$/.test(def.appSecret));
ok('default oauth kind', def.authKind === 'oauth_token');
ok('default cron', def.cycleCron === '*/30 * * * *');

// parseEnv: key=value map, trims, handles CRLF, ignores junk.
const parsed = parseEnv('PROJECT_NAME=My App\r\nWEB_PORT=3001\nnot a line\nEMPTY=');
ok('parseEnv value', parsed.PROJECT_NAME === 'My App');
ok('parseEnv crlf', parsed.WEB_PORT === '3001');
ok('parseEnv empty kept', parsed.EMPTY === '');
ok('parseEnv junk skipped', !('not a line' in parsed));

// configFromEnv round-trips a buildEnvContent output (update mode prefill).
const rt = configFromEnv(parseEnv(buildEnvContent(base)));
ok('configFromEnv project', rt.projectName === base.projectName);
ok('configFromEnv workspace', rt.workspacePath === base.workspacePath);
ok('configFromEnv preserves secret', rt.appSecret === 'deadbeef');
ok('configFromEnv infers oauth', rt.authKind === 'oauth_token');
ok('configFromEnv keeps antigravity', rt.antigravityToken === 'ag-xyz');

// configFromEnv infers api_key when only the key is present.
const apiEnv = parseEnv(buildEnvContent({ ...base, authKind: 'api_key', apiKey: 'sk-ant-9', oauthToken: '' }));
ok('configFromEnv infers api_key', configFromEnv(apiEnv).authKind === 'api_key');

// extractClaudeToken: pulls the token line out of CLI output.
ok('extract token', extractClaudeToken('Visit https://... to authorize\n\nsk-ant-oat01-AbC_123.def-456\n') === 'sk-ant-oat01-AbC_123.def-456');
ok('extract token none', extractClaudeToken('just some prose here with spaces') === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
