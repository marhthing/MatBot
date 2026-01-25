# MATDEV Universal Bot

A professional, lightweight multi-platform bot for WhatsApp and Telegram with a modular plugin system.

## ✨ Features

- 🔌 **Multi-Platform**: Works on both WhatsApp and Telegram simultaneously
- 🧩 **Modular Plugin System**: Easy to extend with custom commands
- ⚡ **Fast & Lightweight**: Efficient event-driven architecture
- 🛡️ **Built-in Security**: Permission system, rate limiting, cooldowns
- 📝 **Clean Logging**: Structured logging with Pino
- 🔄 **Hot Reload**: Reload plugins without restarting the bot

## 📋 Requirements

- Node.js 18+ (required for ES modules and latest features)
- WhatsApp account (for WhatsApp bot)
- Telegram bot token from @BotFather (for Telegram bot)

## 🚀 Installation

1. **Clone or download this project**

2. **Install dependencies**
```bash
npm install
```

3. **Configure the bot**
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
```env
BOT_NAME=MATDEV
PREFIX=.
OWNER_NUMBER=your_whatsapp_number  # Without + or spaces
ENABLE_WHATSAPP=true
ENABLE_TELEGRAM=true
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

4. **Start the bot**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## 📱 Platform Setup

### WhatsApp Setup
1. Set `ENABLE_WHATSAPP=true` in `.env`
2. Add your WhatsApp number (without + or spaces) to `OWNER_NUMBER`
3. Run the bot
4. Scan the QR code with WhatsApp on your phone
5. Done! The bot is connected

### Telegram Setup
1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token
4. Set `ENABLE_TELEGRAM=true` in `.env`
5. Add the token to `TELEGRAM_BOT_TOKEN`
6. Run the bot
7. Start chatting with your bot!

## 🔌 Creating Plugins

Plugins are located in `src/plugins/`. Here's a simple example:

```javascript
export default {
  name: 'my-plugin',
  description: 'My awesome plugin',
  
  commands: [
    {
      name: 'hello',
      description: 'Say hello',
      usage: '.hello',
      
      async execute(ctx) {
        await ctx.reply('Hello from my plugin!');
      }
    }
  ]
};
```

### Plugin Structure

Each plugin exports:
- `name`: Plugin identifier
- `description`: What the plugin does
- `commands`: Array of command objects

Each command has:
- `name`: Command trigger (after prefix)
- `aliases`: Alternative names (optional)
- `description`: Command description
- `usage`: Usage example
- `category`: Command category
- `ownerOnly`: Only owner can use (default: false)
- `adminOnly`: Only admins can use (default: false)
- `groupOnly`: Only works in groups (default: false)
- `cooldown`: Seconds between uses (default: 3)
- `execute(ctx)`: The function that runs

### MessageContext API

The `ctx` parameter in `execute()` provides:

**Properties:**
- `ctx.platform` - 'whatsapp' or 'telegram'
- `ctx.text` - Full message text
- `ctx.command` - Command name
- `ctx.args` - Command arguments array
- `ctx.senderId` - Sender's ID
- `ctx.senderName` - Sender's name
- `ctx.chatId` - Chat/Group ID
- `ctx.isGroup` - Is this a group chat?
- `ctx.isOwner` - Is sender the bot owner?
- `ctx.isAdmin` - Is sender a group admin?
- `ctx.media` - Media object (if any)
- `ctx.quoted` - Quoted/replied message (if any)

**Methods:**
- `await ctx.reply(text)` - Reply to the message
- `await ctx.send(text)` - Send without quoting
- `await ctx.react(emoji)` - React with emoji
- `await ctx.delete()` - Delete the message
- `await ctx.sendMedia(buffer, options)` - Send media
- `await ctx.downloadMedia()` - Download media from message

## 📁 Project Structure

```
matdev-universal-bot/
├── src/
│   ├── index.js                 # Entry point
│   ├── core/
│   │   ├── Bot.js              # Main bot engine
│   │   ├── CommandRegistry.js  # Command management
│   │   ├── PluginLoader.js     # Plugin system
│   │   └── MessageContext.js   # Unified message format
│   ├── adapters/
│   │   ├── BaseAdapter.js      # Adapter interface
│   │   ├── WhatsAppAdapter.js  # WhatsApp implementation
│   │   └── TelegramAdapter.js  # Telegram implementation
│   ├── plugins/
│   │   └── _example.js         # Example plugin (rename to activate)
│   ├── utils/
│   │   └── logger.js           # Logging utility
│   └── config/
│       └── default.js          # Configuration
├── session/                     # Session files (auto-created)
├── storage/                     # Persistent data (auto-created)
├── tmp/                        # Temporary files (auto-created)
├── .env                        # Your configuration
├── .env.example                # Configuration template
├── package.json
└── README.md
```

## 🛠️ Advanced Usage

### Reloading Plugins
Plugins can be reloaded without restarting:
```javascript
bot.getPluginLoader().reload('plugin-name');
```

### Accessing Adapters
```javascript
const whatsapp = bot.getAdapter('whatsapp');
const telegram = bot.getAdapter('telegram');
```

### Custom Event Handlers
```javascript
bot.on('message', (ctx) => {
  console.log('Message received:', ctx.text);
});

bot.on('platform:ready', (platform) => {
  console.log(`${platform} is ready!`);
});
```

## 🐛 Troubleshooting

**Bot doesn't respond to commands:**
- Check that the prefix matches (default is `.`)
- Make sure the plugin file doesn't start with `_`
- Check logs for errors

**WhatsApp disconnects frequently:**
- This can happen with unofficial libraries
- Check your internet connection
- Session files are stored in `session/whatsapp/`

**Telegram bot not working:**
- Verify your bot token is correct
- Make sure you've started a chat with your bot
- Check that `ENABLE_TELEGRAM=true`

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

---

**Built with ❤️ by MATDEV**