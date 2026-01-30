import ai from '../utils/ai.js';
import { shouldReact } from '../utils/pendingActions.js';
import fs from 'fs';
import path from 'path';

export default {
  name: 'audio',
  description: 'Speech-to-Text and Text-to-Speech features',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'tts',
      description: 'Convert text to speech',
      usage: 'Reply to a message with .tts or use .tts <text>',
      category: 'audio',
      async execute(ctx) {
        try {
          let text = ctx.args.join(' ');
          
          if (!text && ctx.quoted) {
            text = ctx.quoted.text || ctx.quoted.caption;
          }
          
          // Ensure text is a string
          if (typeof text !== 'string') text = String(text ?? '');
          
          if (!text.trim()) {
            return await ctx.reply('Please provide text or reply to a message.\n\nUsage: .tts Hello world');
          }
          
          if (shouldReact()) await ctx.react('🗣️');
          
          const audioBuffer = await ai.textToSpeech(text);

          let oggBuffer = audioBuffer;
          let converted = false;
          let duration = undefined;
          try {
            // Try to convert to OGG/Opus for WhatsApp PTT
            const ffmpegPath = (await import('@ffmpeg-installer/ffmpeg')).path;
            const ffmpeg = (await import('fluent-ffmpeg')).default;
            const tmp = await import('tmp');
            const fs = await import('fs');
            const { promisify } = await import('util');
            const writeFile = promisify(fs.writeFile);
            const readFile = promisify(fs.readFile);
            const unlink = promisify(fs.unlink);
            const tmpIn = tmp.tmpNameSync({ postfix: '.mp3' });
            const tmpOut = tmp.tmpNameSync({ postfix: '.ogg' });
            await writeFile(tmpIn, audioBuffer);
            // Get duration using ffprobe
            duration = await new Promise((resolve) => {
              ffmpeg.ffprobe(tmpIn, (err, data) => {
                if (err || !data || !data.format || !data.format.duration) return resolve(undefined);
                resolve(Math.round(data.format.duration));
              });
            });
            await new Promise((resolve, reject) => {
              ffmpeg(tmpIn)
                .setFfmpegPath(ffmpegPath)
                .audioCodec('libopus')
                .format('ogg')
                .audioBitrate('48k')
                .audioChannels(1)
                .audioFrequency(48000)
                .outputOptions('-vn')
                .save(tmpOut)
                .on('end', resolve)
                .on('error', reject);
            });
            oggBuffer = await readFile(tmpOut);
            converted = true;
            try { await unlink(tmpIn); } catch {}
            try { await unlink(tmpOut); } catch {}
          } catch (e) {
            // If conversion fails, fallback to original buffer
            converted = false;
          }
          await ctx._adapter.sendMedia(ctx.chatId, oggBuffer, {
            type: 'audio',
            mimetype: converted ? 'audio/ogg; codecs=opus' : 'audio/mp4',
            ptt: true,
            fileName: 'voice.ogg',
            seconds: duration
          });
          
          if (shouldReact()) await ctx.react('✅');
        } catch (error) {
          console.error('TTS error:', error);
          await ctx.reply('Failed to convert text to speech. ' + (error.message || ''));
          if (shouldReact()) await ctx.react('❌');
        }
      }
    },
    {
      name: 'stt',
      aliases: ['transcribe'],
      description: 'Convert audio to text',
      usage: 'Reply to an audio/voice note with .stt',
      category: 'audio',
      async execute(ctx) {
        try {
          const message = ctx.quoted || ctx;
          const mimetype = message.mimetype || message.msg?.mimetype || message.message?.audioMessage?.mimetype;
          const isAudio = mimetype?.includes('audio');
          
          if (!isAudio) {
            return await ctx.reply('Please reply to an audio message or voice note with .stt');
          }
          
          if (shouldReact()) await ctx.react('✍️');
          
          const buffer = await ctx._adapter.downloadMedia({ raw: message.raw || message });
          const transcription = await ai.speechToText(buffer, 'audio.mp3');
          
          if (transcription) {
            await ctx.reply(`📝 *Transcription:*\n\n${transcription}`);
            if (shouldReact()) await ctx.react('✅');
          } else {
            await ctx.reply('Could not transcribe audio.');
            if (shouldReact()) await ctx.react('❌');
          }
        } catch (error) {
          console.error('STT error:', error);
          await ctx.reply('Failed to transcribe audio. ' + (error.message || ''));
          if (shouldReact()) await ctx.react('❌');
        }
      }
    }
  ],
  // Auto-transcribe logic could go here if requested, but for now we follow the .tts/reply trigger
    async onMessage(ctx) {
      if (!ctx.body) return;
      const cmd = ctx.body.toLowerCase().trim();
      if (cmd === '.tts' && ctx.quoted) {
        return this.commands.find(c => c.name === 'tts').execute(ctx);
      }
      if (cmd === '.stt' && ctx.quoted) {
        return this.commands.find(c => c.name === 'stt').execute(ctx);
      }
    }
};
