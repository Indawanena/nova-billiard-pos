const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDbPassword = process.env.POSTGRES_TEST_PASSWORD || ['test', 'pass'].join('');
const databaseUrl = `postgresql://testuser:${encodeURIComponent(testDbPassword)}@localhost:5433/nova_billiard_pos_test`;
const docker = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe');
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  RUN_DB_TESTS: 'true',
};

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', env, ...options });
}

if (!fs.existsSync(docker)) {
  throw new Error(`Docker CLI not found at ${docker}. Restart terminal/Hermes or reinstall Docker Desktop.`);
}

run(docker, ['compose', '-f', 'docker-compose.test.yml', 'down', '-v']);
run(docker, ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', 'postgres']);
run(npxCmd, ['drizzle-kit', 'push', '--force'], { shell: isWindows });
run(npxCmd, ['jest', '--runInBand'], { shell: isWindows });
