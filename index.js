import { spawn, spawnSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let botProcess = null;

console.log('🎯 MATBOT Auto-Manager');
console.log('📍 Working in:', __dirname);

// Your GitHub repository
const GITHUB_REPO = 'https://github.com/marhthing/MatBot.git';

// Check if this is an initial setup, restart, or forced update
const isInitialSetup = !existsSync('src/index.js') || !existsSync('package.json');
const isForcedUpdate = existsSync('.update_flag.json');
const isRestart = existsSync('.restart_flag');

if (isRestart) {
    console.log('♻️ Restart flag detected, clearing flag...');
    try { unlinkSync('.restart_flag'); } catch (e) {}
}

if (isInitialSetup || isForcedUpdate) {
    if (isForcedUpdate) {
        console.log('🔄 Forced update detected - recloning from GitHub...');
    } else {
        console.log('🔧 Initial setup detected - cloning from GitHub...');
    }
    cloneAndSetup();
} else {
    // Start the main bot (src/index.js)
    console.log('🚀 Starting MATBOT...');
    startBot('src/index.js');
}

function cloneAndSetup() {
    console.log('📥 Cloning bot from GitHub...');
    console.log('🔗 Repository:', GITHUB_REPO);
    
    const isWindows = process.platform === 'win32';
    
    // Clean workspace (preserve important files)
    if (isWindows) {
        spawnSync('powershell', ['-Command', 'Get-ChildItem -Exclude index.js,session,.env,node_modules,storage,replit.md | Remove-Item -Recurse -Force'], { stdio: 'inherit' });
    } else {
        spawnSync('bash', ['-c', 'find . -maxdepth 1 ! -name "index.js" ! -name "session" ! -name ".env" ! -name "node_modules" ! -name "storage" ! -name "replit.md" ! -name "." -exec rm -rf {} +'], { stdio: 'inherit' });
    }

    // Clone repository into temp_clone
    const cloneResult = spawnSync('git', ['clone', GITHUB_REPO, 'temp_clone'], { stdio: 'inherit' });
    if (cloneResult.error || cloneResult.status !== 0) {
        console.error('❌ Failed to clone repository!');
        process.exit(1);
    }
    
    // Check if src/index.js exists in temp_clone before copying
    if (!existsSync('temp_clone/src/index.js')) {
        console.error('❌ src/index.js does not exist in temp_clone after cloning!');
        process.exit(1);
    } else {
        console.log('✅ src/index.js found in temp_clone, proceeding to move...');
    }
    
    // Move all files/folders from temp_clone to root (except temp_clone itself)
    if (isWindows) {
        spawnSync('robocopy', ['temp_clone', '.', '/E', '/MOVE', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' });
    } else {
        spawnSync('bash', ['-c', 'cp -rf temp_clone/* . && rm -rf temp_clone'], { stdio: 'inherit' });
    }
    
    // Remove temp_clone if it still exists
    if (existsSync('temp_clone')) {
        if (isWindows) {
            spawnSync('powershell', ['-Command', 'Remove-Item temp_clone -Recurse -Force'], { stdio: 'inherit' });
        } else {
            spawnSync('rm', ['-rf', 'temp_clone'], { stdio: 'inherit' });
        }
    }
    
    console.log('✅ Bot files moved successfully!');
    installDependencies();
    startBot('src/index.js');
}

function installDependencies() {
    if (!existsSync('package.json')) return;
    console.log('📦 Installing dependencies...');
    const installResult = spawnSync('npm', ['install', '--production'], { stdio: 'inherit' });
    if (installResult.error) {
        console.error('❌ Failed to install dependencies:', installResult.error);
        process.exit(1);
    }
    if (installResult.status !== 0) {
        console.error('❌ Failed to install dependencies. Exit code:', installResult.status);
        process.exit(1);
    }
    console.log('✅ Dependencies installed!');
}

function startBot(entryPoint = 'src/index.js') {
    if (!existsSync(entryPoint)) {
        console.error(`❌ Entry point ${entryPoint} not found!`);
        return;
    }
    console.log(`🚀 Starting bot: ${entryPoint}`);
    botProcess = spawn('node', [entryPoint], { stdio: 'inherit' });

    botProcess.on('exit', (code, signal) => {
        console.log(`🔄 Bot exited with code ${code}, signal ${signal}`);
        // Exit the manager process so an external process manager (like PM2) can restart it
        process.exit(0);
    });

    botProcess.on('error', (error) => {
        console.error('❌ Bot start error:', error.message);
    });
    console.log('✅ Bot manager running!');
}

function restartBot() {}
function shutdownBot() {}
function updateBot() {}

process.on('uncaughtException', (error) => {
    console.error('❌ Manager uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Manager unhandled rejection:', reason);
});
