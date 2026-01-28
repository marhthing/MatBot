import youtubedl from 'youtube-dl-exec';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.snapchat.com/',
  'DNT': '1',
  'Connection': 'keep-alive'
};

function generateUniqueFilename(username, extension = 'mp4') {
  const sanitize = (str) => str.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  const timestamp = Date.now();
  return `snap_${sanitize(username)}_${timestamp}.${extension}`;
}

async function validateSnapchatUrl(url) {
  const snapchatUrlRegex = /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/(?:@|add\/|t\/|spotlight\/)([a-zA-Z0-9._-]+)(?:\/spotlight\/([a-zA-Z0-9_-]+))?/;
  const shortSnapRegex = /(?:https?:\/\/)?(?:t\.snapchat\.com|story\.snapchat\.com|snapchat\.com\/t\/)\/([a-zA-Z0-9_-]+)/;
  
  if (!url || typeof url !== 'string') return null;
  
  let cleanUrl = url.trim();
  
  try {
    if (shortSnapRegex.test(cleanUrl) || cleanUrl.includes('/t/')) {
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      try {
        const response = await axios.get(cleanUrl, {
          headers: HEADERS,
          maxRedirects: 5,
          validateStatus: () => true
        });
        cleanUrl = response.request.res.responseUrl || cleanUrl;
      } catch (e) {}
    }
    
    const match = snapchatUrlRegex.exec(cleanUrl);
    if (match) {
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://www.snapchat.com/@' + match[1];
      }
      
      return {
        url: cleanUrl,
        username: match[1],
        spotlightId: match[2] || null
      };
    }
    
    if (cleanUrl.includes('snapchat.com')) {
      return {
        url: cleanUrl,
        username: 'snap',
        spotlightId: null
      };
    }
  } catch (error) {
    console.error('URL validation error:', error.message);
  }
  
  return null;
}

function extractSnapchatUrlFromObject(obj) {
  const snapUrlRegex = /https?:\/\/(?:www\.)?snapchat\.com\/(?:@|add\/|t\/|spotlight\/)[a-zA-Z0-9._-]+(?:\/spotlight\/[a-zA-Z0-9_-]+)?|https?:\/\/(?:t\.snapchat\.com|story\.snapchat\.com|snapchat\.com\/t\/)[a-zA-Z0-9_-]+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(snapUrlRegex);
      if (match) return match[0].replace(/[.,;!?"]+$/, '');
    } else if (typeof obj[key] === 'object') {
      const found = extractSnapchatUrlFromObject(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, unitIndex);
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function downloadWithYtDlp(url, tempDir) {
  const uniqueFilename = generateUniqueFilename('snap', 'mp4');
  const outputPath = path.join(tempDir, uniqueFilename);
  
  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true
    });
    
    const formats = [];
    if (info.formats && info.formats.length > 0) {
      const seenQualities = new Set();
      
      for (const format of info.formats) {
        if (format.ext === 'mp4' || format.vcodec !== 'none') {
          const height = format.height || 0;
          let quality = 'Standard';
          
          if (height >= 1080) quality = '1080p HD';
          else if (height >= 720) quality = '720p HD';
          else if (height >= 480) quality = '480p';
          else if (height >= 360) quality = '360p';
          else if (height > 0) quality = `${height}p`;
          
          if (!seenQualities.has(quality)) {
            seenQualities.add(quality);
            formats.push({
              quality,
              height,
              format_id: format.format_id,
              size: format.filesize || format.filesize_approx || 0,
              formatString: format.format_id
            });
          }
        }
      }
      
      formats.sort((a, b) => b.height - a.height);
    }
    
    return {
      formats: formats.slice(0, 5),
      title: info.title || 'Snapchat Video',
      outputPath,
      url
    };
    
  } catch (error) {
    throw error;
  }
}

async function downloadVideoWithFormat(url, formatId, outputPath) {
  try {
    const options = {
      output: outputPath,
      noWarnings: true,
      noCheckCertificates: true
    };
    
    if (formatId && formatId !== 'best') {
      options.format = formatId;
    } else {
      options.format = 'best[ext=mp4]/best';
    }
    
    await youtubedl(url, options);
    
    if (await fs.pathExists(outputPath)) {
      const stats = await fs.stat(outputPath);
      return {
        path: outputPath,
        size: stats.size,
        isLarge: stats.size > VIDEO_MEDIA_LIMIT
      };
    }
    
    throw new Error('Download failed: file not created');
    
  } catch (error) {
    if (await fs.pathExists(outputPath)) {
      await fs.unlink(outputPath).catch(() => {});
    }
    throw error;
  }
}

export default {
  name: 'snapchat',
  description: 'Snapchat story/spotlight downloader without watermark',
  version: '2.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'snap',
      aliases: ['snapchat', 'sc'],
      description: 'Download Snapchat story/spotlight without watermark',
      usage: '.snap <url>',
      category: 'download',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          let url = ctx.args.join(' ').trim();
          
          if (!url) {
            const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMessage) {
              url = extractSnapchatUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a Snapchat URL\n\nUsage: .snap <url>');
          }

          const validatedUrl = await validateSnapchatUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid Snapchat URL');
          }
          
          const tempDir = path.join(process.cwd(), 'tmp');
          await fs.ensureDir(tempDir);

          if (shouldReact()) await ctx.react('⏳');

          try {
            const { formats, title, outputPath, url: videoUrl } = await downloadWithYtDlp(validatedUrl.url, tempDir);
            
            if (formats.length > 1) {
              const qualities = formats.map((f, idx) => ({
                label: `${idx + 1} - ${f.quality}${f.size ? ` (${formatFileSize(f.size)})` : ''}`,
                formatId: f.format_id
              }));

              let prompt = `*${title}*\n\nSelect video quality by replying with the number:\n`;
              prompt += qualities.map(q => q.label).join('\n');
              
              const sentMsg = await ctx.reply(prompt);
              
              pendingActions.set(ctx.chatId, sentMsg.key.id, {
                type: 'snapchat_quality',
                userId: ctx.senderId,
                data: { qualities, url: videoUrl, outputPath, tempDir },
                match: (text) => {
                  if (typeof text !== 'string') return false;
                  const n = parseInt(text.trim(), 10);
                  return n >= 1 && n <= qualities.length;
                },
                handler: async (replyCtx, pending) => {
                  const choice = parseInt(replyCtx.text.trim(), 10);
                  const formatId = pending.data.qualities[choice - 1].formatId;
                  if (shouldReact()) await replyCtx.react('⏳');
                  
                  try {
                    const newOutputPath = path.join(pending.data.tempDir, generateUniqueFilename('snap', 'mp4'));
                    const result = await downloadVideoWithFormat(pending.data.url, formatId, newOutputPath);
                    
                    if (result.size > VIDEO_SIZE_LIMIT) {
                      await fs.unlink(result.path).catch(() => {});
                      if (shouldReact()) await replyCtx.react('❌');
                      return await replyCtx.reply(`Video too large (${formatFileSize(result.size)}). Limit is 100MB.`);
                    }
                    
                    const mediaBuffer = await fs.readFile(result.path);
                    
                    if (result.isLarge) {
                      await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                        type: 'document',
                        mimetype: 'video/mp4',
                        caption: path.basename(result.path)
                      });
                    } else {
                      await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                        type: 'video',
                        mimetype: 'video/mp4'
                      });
                    }
                    
                    if (shouldReact()) await replyCtx.react('✅');
                    await fs.unlink(result.path).catch(() => {});
                  } catch (error) {
                    console.error('Snapchat download error:', error);
                    if (shouldReact()) await replyCtx.react('❌');
                    await replyCtx.reply('Failed to download selected quality.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              if (shouldReact()) await ctx.react('');
              
            } else {
              const result = await downloadVideoWithFormat(videoUrl, 'best', outputPath);
              
              if (result.size > VIDEO_SIZE_LIMIT) {
                await fs.unlink(result.path).catch(() => {});
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply(`Video too large (${formatFileSize(result.size)}). Limit is 100MB.`);
              }

              const mediaBuffer = await fs.readFile(result.path);

              if (result.isLarge) {
                await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: path.basename(result.path)
                });
              } else {
                await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
              }

              if (shouldReact()) await ctx.react('✅');
              await fs.unlink(result.path).catch(() => {});
            }

          } catch (error) {
            console.error('Snapchat download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('extract')) {
              errorMsg += 'Could not find media. Make sure the story/spotlight is public.';
            } else if (error.message?.includes('not found')) {
              errorMsg += 'Content not found or deleted.';
            } else {
              errorMsg += 'Please try again later.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          console.error('Snapchat command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing Snapchat media');
        }
      }
    }
  ]
};
