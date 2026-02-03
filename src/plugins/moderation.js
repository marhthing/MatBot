import fs from 'fs';
import path from 'path';

const storagePath = path.join(process.cwd(), 'storage', 'storage.json');

// Helper to read storage
const getStorage = () => {
    if (!fs.existsSync(storagePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    } catch (e) {
        return {};
    }
};

// Helper to save storage
const saveStorage = (data) => {
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
};

// State for spam detection (memory only, reset on restart)
const messageHistory = new Map(); 
const SPAM_WINDOW = 5000; // 5 seconds
const MAX_MESSAGES = 5; // Max 5 messages in 5 seconds

export default {
    name: 'moderation',
    description: 'Anti-link, Anti-spam, Anti-word and Warning system',
    version: '1.1.0',
    async init(ctx) {
        // Initialize storage if needed
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

                if (arg === 'on') {
                    if (!storage.antilink) storage.antilink = [];
                    if (!storage.antilink.includes(groupJid)) {
                        storage.antilink.push(groupJid);
                        saveStorage(storage);
                    }
                    return ctx.reply('✅ Anti-link enabled for this group.');
                } else if (arg === 'off') {
                    storage.antilink = (storage.antilink || []).filter(id => id !== groupJid);
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

                if (arg === 'on') {
                    if (!storage.antispam) storage.antispam = [];
                    if (!storage.antispam.includes(groupJid)) {
                        storage.antispam.push(groupJid);
                        saveStorage(storage);
                    }
                    return ctx.reply('✅ Anti-spam enabled for this group.');
                } else if (arg === 'off') {
                    storage.antispam = (storage.antispam || []).filter(id => id !== groupJid);
                    saveStorage(storage);
                    return ctx.reply('❌ Anti-spam disabled for this group.');
                } else {
                    return ctx.reply('Usage: .antispam on/off');
                }
            }
        },
        {
            name: 'antiword',
            description: 'Manage anti-word list',
            category: 'admin',
            adminOnly: true,
            groupOnly: true,
            async execute(ctx) {
                const sub = ctx.args[0]?.toLowerCase();
                const word = ctx.args[1]?.toLowerCase();
                const storage = getStorage();
                const groupJid = ctx.chatId;

                if (!storage.antiword) storage.antiword = {};
                if (!storage.antiword[groupJid]) storage.antiword[groupJid] = { enabled: false, words: [] };

                if (sub === 'on') {
                    storage.antiword[groupJid].enabled = true;
                    saveStorage(storage);
                    return ctx.reply('✅ Anti-word enabled for this group.');
                } else if (sub === 'off') {
                    storage.antiword[groupJid].enabled = false;
                    saveStorage(storage);
                    return ctx.reply('❌ Anti-word disabled for this group.');
                } else if (sub === 'add' && word) {
                    if (!storage.antiword[groupJid].words.includes(word)) {
                        storage.antiword[groupJid].words.push(word);
                        saveStorage(storage);
                    }
                    return ctx.reply(`✅ Added "${word}" to anti-word list.`);
                } else if (sub === 'remove' && word) {
                    storage.antiword[groupJid].words = storage.antiword[groupJid].words.filter(w => w !== word);
                    saveStorage(storage);
                    return ctx.reply(`❌ Removed "${word}" from anti-word list.`);
                } else {
                    return ctx.reply('Usage:\n.antiword on/off\n.antiword add <word>\n.antiword remove <word>');
                }
            }
        },
        {
            name: 'warn',
            description: 'Manage warning system',
            category: 'admin',
            adminOnly: true,
            groupOnly: true,
            async execute(ctx) {
                const sub = ctx.args[0]?.toLowerCase();
                const storage = getStorage();
                const groupJid = ctx.chatId;

                if (!storage.warnSettings) storage.warnSettings = {};
                if (!storage.warnSettings[groupJid]) storage.warnSettings[groupJid] = { enabled: true, max: 3, action: 'kick' };

                if (sub === 'on') {
                    storage.warnSettings[groupJid].enabled = true;
                    saveStorage(storage);
                    return ctx.reply('✅ Warning system enabled.');
                } else if (sub === 'off') {
                    storage.warnSettings[groupJid].enabled = false;
                    saveStorage(storage);
                    return ctx.reply('❌ Warning system disabled.');
                } else if (sub === 'max' && ctx.args[1]) {
                    const max = parseInt(ctx.args[1]);
                    if (isNaN(max)) return ctx.reply('❌ Invalid number.');
                    storage.warnSettings[groupJid].max = max;
                    saveStorage(storage);
                    return ctx.reply(`✅ Max warnings set to ${max}.`);
                } else if (sub === 'reset' && ctx.quoted) {
                    const target = ctx.quoted.senderId;
                    if (!storage.warnings) storage.warnings = {};
                    if (!storage.warnings[groupJid]) storage.warnings[groupJid] = {};
                    storage.warnings[groupJid][target] = 0;
                    saveStorage(storage);
                    return ctx.reply(`✅ Warnings reset for @${target.split('@')[0]}`, { mentions: [target] });
                } else {
                    return ctx.reply('Usage:\n.warn on/off\n.warn max <number>\n.warn reset (reply to user)');
                }
            }
        }
    ],
    async onMessage(ctx) {
        if (!ctx.isGroup) return;

        const storage = getStorage();
        const sender = ctx.senderId || ctx.sender;
        const groupJid = ctx.chatId;
        const messageText = (ctx.text || ctx.body || '').toLowerCase();

        if (ctx.isAdmin || ctx.isOwner) return;

        const handleViolation = async (type) => {
            const settings = storage.warnSettings?.[groupJid] || { enabled: true, max: 3, action: 'kick' };
            
            // Delete message
            try {
                const messageKey = ctx.messageKey || ctx.raw?.key;
                if (messageKey && ctx._adapter?.client) {
                    await ctx._adapter.client.sendMessage(groupJid, { delete: messageKey });
                }
            } catch (e) {}

            if (!settings.enabled) return;

            if (!storage.warnings) storage.warnings = {};
            if (!storage.warnings[groupJid]) storage.warnings[groupJid] = {};
            
            const currentWarns = (storage.warnings[groupJid][sender] || 0) + 1;
            storage.warnings[groupJid][sender] = currentWarns;
            saveStorage(storage);

            const remaining = settings.max - currentWarns;
            const mention = sender.includes('@') ? sender : `${sender}@s.whatsapp.net`;

            if (currentWarns >= settings.max) {
                await ctx.reply(`🚫 @${sender.split('@')[0]} reached max warnings (${settings.max}) and will be kicked.`, { mentions: [mention] });
                try {
                    await ctx._adapter.client.groupParticipantsUpdate(groupJid, [mention], 'remove');
                } catch (e) {
                    await ctx.reply('❌ Failed to kick user. Make sure I am an admin.');
                }
                storage.warnings[groupJid][sender] = 0;
                saveStorage(storage);
            } else {
                await ctx.reply(`⚠️ @${sender.split('@')[0]}, violation detected (${type}).\nWarnings: ${currentWarns}/${settings.max}\nYou have ${remaining} more grace.`, { mentions: [mention] });
            }
        };

        // Anti-Link
        if (storage.antilink?.includes(groupJid)) {
            const linkPattern = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
            if (linkPattern.test(messageText)) {
                return await handleViolation('Link detected');
            }
        }

        // Anti-Word
        const antiword = storage.antiword?.[groupJid];
        if (antiword?.enabled && antiword.words.length > 0) {
            const found = antiword.words.some(word => messageText.includes(word));
            if (found) {
                return await handleViolation('Banned word detected');
            }
        }

        // Anti-Spam
        if (storage.antispam?.includes(groupJid)) {
            const now = Date.now();
            if (!messageHistory.has(sender)) messageHistory.set(sender, []);
            const timestamps = messageHistory.get(sender);
            
            // Save all message keys to delete them later if spam is detected
            if (!messageHistory.has(sender + '_keys')) messageHistory.set(sender + '_keys', []);
            const keys = messageHistory.get(sender + '_keys');
            keys.push(ctx.messageKey || ctx.raw?.key);

            timestamps.push(now);
            const recentTimestamps = timestamps.filter(ts => now - ts < SPAM_WINDOW);
            messageHistory.set(sender, recentTimestamps);

            if (recentTimestamps.length > MAX_MESSAGES) {
                messageHistory.set(sender, []);
                const spamKeys = [...keys];
                messageHistory.set(sender + '_keys', []);
                
                // Bulk delete
                for (const key of spamKeys) {
                    if (key) {
                        try {
                            await ctx._adapter.client.sendMessage(groupJid, { delete: key });
                        } catch (e) {}
                    }
                }
                return await handleViolation('Spamming');
            }
        }
    }
};
