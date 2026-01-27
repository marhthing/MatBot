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
const isRestart = existsSync('.restart_flag');

(async () => {
    if (isRestart) {
        console.log('♻️ Restart flag detected, clearing flag...');
        try { unlinkSync('.restart_flag'); } catch (e) {}
    }

    if (isInitialSetup) {
        console.log('🔧 Setup needed - cloning from GitHub...');
        await cloneAndSetup();
    } else {
        // Start the main bot (src/index.js)
        console.log('🚀 Starting MATBOT...');
        startBot('src/index.js');
    }
})();

async function cloneAndSetup() {
    console.log('📥 Cloning bot from GitHub...');
    console.log('🔗 Repository:', GITHUB_REPO);
    
    const isWindows = process.platform === 'win32';
    
    // Force re-clone because .update now was requested or initial setup
    if (existsSync('temp_clone')) {
        if (isWindows) {
            spawnSync('powershell', ['-Command', 'Remove-Item temp_clone -Recurse -Force'], { stdio: 'inherit' });
        } else {
            spawnSync('rm', ['-rf', 'temp_clone'], { stdio: 'inherit' });
        }
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
        // Move .git folder as well (robocopy needs explicit dot)
        spawnSync('robocopy', ['temp_clone', '.git', '/E', '/MOVE', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' });
    } else {
        spawnSync('bash', ['-c', 'cp -rf temp_clone/* . && cp -rf temp_clone/.git . && rm -rf temp_clone'], { stdio: 'inherit' });
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

    // Ensure .env exists and is populated before starting bot
    const envPath = './src/config/default.js';
    // Import the config file to trigger .env creation/population
    await import(envPath);
    // Now reload environment variables from .env
    await import('dotenv/config');

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

    if (botProcess) {
        console.log('🛑 Ending existing bot process...');
        botProcess.removeAllListeners('exit');
        botProcess.kill('SIGTERM');
        botProcess = null;
    }

    console.log(`🚀 Starting bot: ${entryPoint}`);
    botProcess = spawn('node', [entryPoint], { stdio: 'inherit' });

    botProcess.on('exit', (code, signal) => {
        console.log(`🔄 Bot exited with code ${code}, signal ${signal}`);
        
        if (existsSync('.restart_flag')) {
            console.log('♻️ Restart flag detected - clearing flag and restarting...');
            try { unlinkSync('.restart_flag'); } catch (e) {}
        }

        // Always restart the bot process within the manager
        console.log('♻️ Restarting MATBOT...');
        startBot(entryPoint);
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
