import fs from 'fs';
import path from 'path';

const storagePath = path.join(process.cwd(), 'storage', 'storage.json');

// Helper to read storage
const getStorage = () => {
    if (!fs.existsSync(storagePath)) return {};
    return JSON.parse(fs.readFileSync(storagePath, 'utf8'));
};

// Helper to save storage
const saveStorage = (data) => {
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
};

// State for spam detection (memory only, reset on restart)
const messageHistory = new Map(); 
const SPAM_WINDOW = 5000; // 5 seconds
const MAX_MESSAGES = 5; // Max 5 messages in 5 seconds

export default {
    name: 'moderation',
    description: 'Anti-link and Anti-spam for groups',
    version: '1.0.0',
    async init(ctx) {
        // This runs once when the plugin is loaded
    },
    commands: [
        {
            name: 'antilink',
            description: 'Turn anti-link on or off',
            category: 'admin',
            adminOnly: true,
            groupOnly: true,
            async execute(ctx) {
                const arg = ctx.args[0]?.toLowerCase();
                const storage = getStorage();
                const groupJid = ctx.chatId;

                if (!groupJid || !groupJid.endsWith('@g.us')) {
                    return ctx.reply('❌ This command can only be used in groups.');
                }

                if (!storage.antilink) storage.antilink = [];

                if (arg === 'on') {
                    if (!storage.antilink.includes(groupJid)) {
                        storage.antilink.push(groupJid);
                        saveStorage(storage);
                    }
                    return ctx.reply('✅ Anti-link enabled for this group.');
                } else if (arg === 'off') {
                    storage.antilink = (storage.antilink || []).filter(id => id && id !== groupJid);
                    saveStorage(storage);
                    return ctx.reply('❌ Anti-link disabled for this group.');
                } else {
                    return ctx.reply('Usage: .antilink on/off');
                }
            }
        },
        {
            name: 'antispam',
            description: 'Turn anti-spam on or off',
            category: 'admin',
            adminOnly: true,
            groupOnly: true,
            async execute(ctx) {
                const arg = ctx.args[0]?.toLowerCase();
                const storage = getStorage();
                const groupJid = ctx.chatId;

                if (!groupJid || !groupJid.endsWith('@g.us')) {
                    return ctx.reply('❌ This command can only be used in groups.');
                }

                if (!storage.antispam) storage.antispam = [];

                if (arg === 'on') {
                    if (!storage.antispam.includes(groupJid)) {
                        storage.antispam.push(groupJid);
                        saveStorage(storage);
                    }
                    return ctx.reply('✅ Anti-spam enabled for this group.');
                } else if (arg === 'off') {
                    storage.antispam = (storage.antispam || []).filter(id => id && id !== groupJid);
                    saveStorage(storage);
                    return ctx.reply('❌ Anti-spam disabled for this group.');
                } else {
                    return ctx.reply('Usage: .antispam on/off');
                }
            }
        }
    ],
    // Handle every incoming message for moderation
    async onMessage(ctx) {
        if (!ctx.isGroup) return;

        const storage = getStorage();
        const sender = ctx.sender;
        const groupJid = ctx.from;

        // Skip if sender is admin or owner
        if (ctx.isAdmin || ctx.isOwner) return;

        // --- Anti-Link Logic ---
        if (storage.antilink?.includes(groupJid)) {
            const linkPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
            if (linkPattern.test(ctx.body || '')) {
                console.log(`[Moderation] Link detected from ${sender} in ${groupJid}. Deleting...`);
                await ctx.delete();
                return ctx.reply(`⚠️ @${sender.split('@')[0]}, links are not allowed in this group!`, { mentions: [sender] });
            }
        }

        // --- Anti-Spam Logic ---
        if (storage.antispam?.includes(groupJid)) {
            const now = Date.now();
            if (!messageHistory.has(sender)) {
                messageHistory.set(sender, []);
            }

            const timestamps = messageHistory.get(sender);
            timestamps.push(now);

            // Keep only timestamps within the window
            const recentTimestamps = timestamps.filter(ts => now - ts < SPAM_WINDOW);
            messageHistory.set(sender, recentTimestamps);

            if (recentTimestamps.length > MAX_MESSAGES) {
                console.log(`[Moderation] Spam detected from ${sender} in ${groupJid}.`);
                // Clear history to avoid immediate re-trigger
                messageHistory.set(sender, []);
                
                await ctx.delete();
                return ctx.reply(`⚠️ @${sender.split('@')[0]}, please stop spamming!`, { mentions: [sender] });
            }
        }
    }
};
