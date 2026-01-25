import axios from 'axios';

export default {
  name: 'translate',
  description: 'Translate text between different languages',
  version: '1.0.0',
  author: 'MATDEV',
  
  commands: [
    {
      name: 'translate',
      aliases: ['tr', 'trans'],
      description: 'Translate text to another language',
      usage: '.translate <to_language> <text> OR .translate languages',
      category: 'utility',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      
      // Language codes mapping
      languages: {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
        'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese',
        'ar': 'Arabic', 'hi': 'Hindi', 'tr': 'Turkish', 'pl': 'Polish', 'nl': 'Dutch',
        'sv': 'Swedish', 'da': 'Danish', 'no': 'Norwegian', 'fi': 'Finnish', 'cs': 'Czech',
        'hu': 'Hungarian', 'ro': 'Romanian', 'bg': 'Bulgarian', 'hr': 'Croatian', 'sk': 'Slovak',
        'sl': 'Slovenian', 'et': 'Estonian', 'lv': 'Latvian', 'lt': 'Lithuanian', 'mt': 'Maltese'
      },
      
      async execute(ctx) {
        try {
          const args = ctx.args;
          
          // No arguments - show help
          if (args.length < 1) {
            return await ctx.reply(
              '🌐 *Translation Tool*\n\n' +
              '*Usage:*\n' +
              '• .translate <to_language> <text>\n' +
              '• .translate languages (or lg)\n\n' +
              '*Examples:*\n' +
              '• .translate spanish Hello world\n' +
              '• .translate fr Good morning\n' +
              '• .translate zh How are you?\n' +
              '• .translate languages'
            );
          }

          // Check if requesting language list
          const firstArg = args[0].toLowerCase();
          if (firstArg === 'languages' || firstArg === 'lg') {
            const langList = Object.entries(this.languages)
              .map(([code, name]) => `*${code}* - ${name}`)
              .join('\n');

            return await ctx.reply(
              `🌐 *Available Languages*\n\n${langList}\n\n` +
              '*Usage:* .translate <code> <text>\n' +
              '*Example:* .translate es Hello world'
            );
          }

          // Handle translation
          if (args.length < 2) {
            return await ctx.reply(
              '🌐 *Usage:* .translate <to_language> <text>\n\n' +
              '*Examples:*\n' +
              '• .translate spanish Hello world\n' +
              '• .translate fr Good morning\n\n' +
              'Use .translate languages to see available language codes'
            );
          }

          const toLang = args[0].toLowerCase();
          const text = args.slice(1).join(' ');

          // Validate text length
          if (text.length > 500) {
            return await ctx.reply('❌ Text too long! Maximum 500 characters for translation.');
          }

          // Convert language name to code
          const toLangCode = this.getLanguageCode(toLang);
          if (!toLangCode) {
            return await ctx.reply(
              `❌ Language "${toLang}" not supported.\n\n` +
              'Use .translate languages to see available options'
            );
          }

          // Show loading message
          await ctx.reply('🔄 Translating...');

          // Perform translation
          const result = await this.translateText(text, toLangCode);
          
          if (result.success) {
            const fromLangName = this.languages[result.fromLang] || result.fromLang;
            const toLangName = this.languages[toLangCode];
            
            return await ctx.reply(
              `🌐 *Translation*\n\n` +
              `*From:* ${fromLangName}\n` +
              `*To:* ${toLangName}\n\n` +
              `*Original:*\n${text}\n\n` +
              `*Translation:*\n${result.text}`
            );
          } else {
            return await ctx.reply(`❌ ${result.error}`);
          }
        } catch (error) {
          console.error('Translate command error:', error);
          return await ctx.reply('❌ An unexpected error occurred while processing your translation request.');
        }
      },

      // Helper method to translate text
      async translateText(text, toLang) {
        try {
          // Try Google Translate free API with auto-detection
          const response = await axios.post(
            'https://translate.googleapis.com/translate_a/single',
            null,
            {
              params: {
                client: 'gtx',
                sl: 'auto', // Auto-detect source language
                tl: toLang,
                dt: 't',
                q: text
              },
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }
          );

          if (response.data && response.data[0] && response.data[0][0] && response.data[0][0][0]) {
            const detectedLang = response.data[2] || 'auto';
            return {
              success: true,
              text: response.data[0][0][0],
              fromLang: detectedLang
            };
          }

          throw new Error('Google Translate API returned invalid response');

        } catch (error) {
          console.error('Google Translate error:', error.message);
          
          // Try LibreTranslate as backup
          try {
            const libreResponse = await axios.post(
              'https://libretranslate.de/translate',
              {
                q: text,
                source: 'auto',
                target: toLang,
                format: 'text'
              },
              {
                timeout: 10000,
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );

            if (libreResponse.data && libreResponse.data.translatedText) {
              return {
                success: true,
                text: libreResponse.data.translatedText,
                fromLang: libreResponse.data.detectedLanguage?.language || 'auto'
              };
            }
          } catch (libreError) {
            console.error('LibreTranslate error:', libreError.message);
          }

          // Try Lingva Translate as final backup
          try {
            const lingvaResponse = await axios.get(
              `https://lingva.ml/api/v1/auto/${toLang}/${encodeURIComponent(text)}`,
              {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              }
            );

            if (lingvaResponse.data && lingvaResponse.data.translation) {
              return {
                success: true,
                text: lingvaResponse.data.translation,
                fromLang: lingvaResponse.data.info?.detectedSource || 'auto'
              };
            }
          } catch (lingvaError) {
            console.error('Lingva error:', lingvaError.message);
          }

          return {
            success: false,
            error: 'Translation service temporarily unavailable. Please try again later.'
          };
        }
      },

      // Helper method to get language code
      getLanguageCode(input) {
        const lower = input.toLowerCase();
        
        // Check if it's already a valid code
        if (this.languages[lower]) {
          return lower;
        }
        
        // Check if it's a language name
        for (const [code, name] of Object.entries(this.languages)) {
          if (name.toLowerCase() === lower) {
            return code;
          }
        }
        
        return null;
      }
    }
  ]
};