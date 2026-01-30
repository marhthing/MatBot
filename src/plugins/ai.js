import ai from '../utils/ai.js';
import { shouldReact } from '../utils/pendingActions.js';

export default {
  name: 'ai',
  description: 'AI-powered assistant using Groq',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'ai',
      aliases: ['gpt', 'chat'],
      description: 'Ask the AI anything',
      usage: '.ai <your question>',
      category: 'ai',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          let question = ctx.args.join(' ');
          let quotedMsg = null;
          if (!question) {
            quotedMsg = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                        ctx.raw?.message?.imageMessage?.contextInfo?.quotedMessage ||
                        ctx.raw?.message?.videoMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
              question = quotedMsg.conversation ||
                         quotedMsg.extendedTextMessage?.text ||
                         quotedMsg.imageMessage?.caption ||
                         quotedMsg.videoMessage?.caption ||
                         quotedMsg.documentMessage?.caption ||
                         quotedMsg.buttonsMessage?.contentText ||
                         quotedMsg.listMessage?.description || '';
            }
          } else {
            // If both args and quoted, combine them for context
            quotedMsg = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                        ctx.raw?.message?.imageMessage?.contextInfo?.quotedMessage ||
                        ctx.raw?.message?.videoMessage?.contextInfo?.quotedMessage;
          }
          // If both question and quotedMsg, combine for AI context
          if (question && quotedMsg) {
            let quotedText = quotedMsg.conversation ||
                             quotedMsg.extendedTextMessage?.text ||
                             quotedMsg.imageMessage?.caption ||
                             quotedMsg.videoMessage?.caption ||
                             quotedMsg.documentMessage?.caption ||
                             quotedMsg.buttonsMessage?.contentText ||
                             quotedMsg.listMessage?.description || '';
            question = `User asked: "${question}"
Quoted message: "${quotedText}"`;
          }
          if (!question || !question.trim()) {
            return await ctx.reply('Please ask me something!\n\nUsage: .ai What is the meaning of life?');
          }
          
          if (shouldReact()) await ctx.react('🤔');
          
          const response = await ai.askAI(question);
          
          if (response) {
            await ctx.reply(`🤖 *AI Response*\n\n${response}`);
            if (shouldReact()) await ctx.react('✅');
          } else {
            await ctx.reply('Sorry, I couldn\'t generate a response. Please try again.');
            if (shouldReact()) await ctx.react('❌');
          }
          
        } catch (error) {
          console.error('AI command error:', error);
          
          if (error.message?.includes('GROQ_API_KEY')) {
            await ctx.reply('AI is not configured. Please set up the GROQ_API_KEY.');
          } else {
            await ctx.reply('An error occurred while processing your request. Please try again later.');
          }
          if (shouldReact()) await ctx.react('❌');
        }
      }
    },
    {
      name: 'aistatus',
      aliases: ['aicache'],
      description: 'Check AI cache status',
      usage: '.aistatus',
      category: 'ai',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          const cache = ai.loadCache();
          
          let status = '🤖 *AI Cache Status*\n\n';
          status += `📝 Would You Rather: ${cache.wouldYouRather?.length || 0} items\n`;
          status += `❓ Trivia: ${cache.trivia?.length || 0} items\n`;
          status += `🤔 Truth: ${cache.truth?.length || 0} items\n`;
          status += `😈 Dare: ${cache.dare?.length || 0} items\n`;
          status += `🧩 Riddles: ${cache.riddles?.length || 0} items\n`;
          
          const lastUpdated = cache.lastUpdated || {};
          if (Object.keys(lastUpdated).length > 0) {
            status += '\n*Last Updated:*\n';
            for (const [type, time] of Object.entries(lastUpdated)) {
              const date = new Date(time).toLocaleString();
              status += `• ${type}: ${date}\n`;
            }
          }
          
          await ctx.reply(status);
          
        } catch (error) {
          console.error('AI status error:', error);
          await ctx.reply('Error checking AI status.');
        }
      }
    },
    {
      name: 'airefill',
      aliases: ['airefresh'],
      description: 'Refill AI cache with fresh content',
      usage: '.airefill <type>',
      category: 'ai',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 60,
      async execute(ctx) {
        try {
          const type = ctx.args[0]?.toLowerCase();
          const validTypes = ['wouldyourather', 'trivia', 'truth', 'dare', 'riddles'];
          
          if (!type || !validTypes.includes(type)) {
            return await ctx.reply(`Please specify a type to refill:\n\n• wouldyourather\n• trivia\n• truth\n• dare\n• riddles\n\nUsage: .airefill trivia`);
          }
          
          const typeMap = {
            'wouldyourather': 'wouldYouRather',
            'trivia': 'trivia',
            'truth': 'truth',
            'dare': 'dare',
            'riddles': 'riddles'
          };
          
          await ctx.reply(`🔄 Generating new ${type} content... This may take a moment.`);
          await ctx.react('⏳');
          
          const items = await ai.generateBulkContent(typeMap[type], 50);
          
          if (items.length > 0) {
            await ctx.reply(`✅ Generated ${items.length} new ${type} items!`);
            await ctx.react('✅');
          } else {
            await ctx.reply(`❌ Failed to generate ${type} content. Check the API key and try again.`);
            await ctx.react('❌');
          }
          
        } catch (error) {
          console.error('AI refill error:', error);
          await ctx.reply('Error refilling cache.');
          await ctx.react('❌');
        }
      }
    }
  ]
};
