import axios from 'axios';
import * as cheerio from 'cheerio';
import youtubedl from 'youtube-dl-exec';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';
import HttpsProxyAgent from 'https-proxy-agent';

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;

const PROXIES = (process.env.PROXIES || '').split(',').filter(p => p.trim());
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomProxy() {
  return PROXIES.length > 0 ? PROXIES[Math.floor(Math.random() * PROXIES.length)] : null;
}

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function getDownloadOptions(extra = {}) {
  const proxy = getRandomProxy();
  const options = {
    noWarnings: true,
    noCheckCertificates: true,
    retries: 3,
    socketTimeout: 30,
    addHeader: [
      'referer:https://www.facebook.com/',
      `user-agent:${getRandomUserAgent()}`,
      'accept-language:en-US,en;q=0.9'
    ],
    ...extra
  };
  if (proxy) options.proxy = proxy;
  return options;
}

function generateUniqueFilename(prefix = 'fb', extension = 'mp4') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

function isValidFacebookUrl(url) {
  const fbPatterns = [
    /(?:https?:\/\/)?(?:www\.|m\.|web\.|mobile\.)?(?:facebook|fb)\.(?:com|watch)\/(?:watch\/?\?v=|[\w.-]+\/videos\/|video\.php\?v=|.*?\/videos\/|reel\/|share\/[rv]\/)/i,
    /fb\.watch\/[\w-]+/i
  ];
  return fbPatterns.some(pattern => pattern.test(url));
}

function extractFacebookUrlFromObject(obj) {
  const fbRegex = /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)\/[^\s"'<>]+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(fbRegex);
      if (match) return match[0].replace(/[.,;!?"]+$/, '');
    } else if (typeof obj[key] === 'object') {
      const found = extractFacebookUrlFromObject(obj[key]);
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

async function getVideoFormatsWithYtDlp(url) {
  try {
    const options = getDownloadOptions({ dumpSingleJson: true });
    const info = await youtubedl(url, options);
    
    if (!info) return null;
    
    const formats = [];
    const seenQualities = new Set();
    
    if (info.formats) {
      for (const format of info.formats) {
        if (!format.url && !format.fragments) continue;

        if (format.vcodec && format.vcodec !== 'none') {
          const height = format.height || 0;
          let quality = 'SD';
          
          if (height >= 1080) quality = '1080p HD';
          else if (height >= 720) quality = '720p HD';
          else if (height >= 480) quality = '480p';
          else if (height >= 360) quality = '360p';
          else quality = 'SD';
          
          if (!seenQualities.has(quality)) {
            seenQualities.add(quality);
            const size = format.filesize || format.filesize_approx || 0;
            formats.push({
              quality,
              height,
              format_id: format.format_id,
              size,
              formatString: height > 0 ? `best[height<=${height}][ext=mp4]/best[ext=mp4]/best` : 'best[ext=mp4]/best'
            });
          }
        }
      }
    }
    
    formats.sort((a, b) => b.height - a.height);
    
    return {
      formats: formats.slice(0, 5),
      title: info.title || 'Facebook Video',
      duration: info.duration ? `${Math.floor(info.duration / 60)}:${String(Math.floor(info.duration % 60)).padStart(2, '0')}` : '',
      source: 'yt-dlp'
    };
  } catch (error) {
    return null;
  }
}

async function downloadVideoWithYtDlp(url, formatString, tempDir) {
  const uniqueFilename = generateUniqueFilename('fb_video', 'mp4');
  const outputPath = path.join(tempDir, uniqueFilename);
  
  try {
    const options = getDownloadOptions({
      output: outputPath,
      format: formatString || 'best[ext=mp4]/best'
    });
    await youtubedl(url, options);

    if (await fs.pathExists(outputPath)) {
      const stats = await fs.stat(outputPath);
      
      if (stats.size < 1000) {
        await fs.unlink(outputPath).catch(() => {});
        throw new Error('Downloaded file is too small, likely invalid');
      }
      
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
  name: 'facebook',
  description: 'Facebook video downloader with quality selection',
  version: '3.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'fb',
      aliases: ['facebook', 'fbdl'],
      description: 'Download Facebook videos with quality selection',
      usage: '.fb <url>',
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
              url = extractFacebookUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a Facebook video URL\n\nUsage: .fb <url>\n\nSupported: Videos, Reels, Watch');
          }

          if (!isValidFacebookUrl(url)) {
            return await ctx.reply('Invalid Facebook URL. Please provide a valid Facebook video/reel link.');
          }

          const tempDir = path.join(process.cwd(), 'tmp');
          await fs.ensureDir(tempDir);

          if (shouldReact()) await ctx.react('⏳');

          try {
            const videoData = await getVideoFormatsWithYtDlp(url);

            if (!videoData || !videoData.formats || videoData.formats.length === 0) {
              const result = await downloadVideoWithYtDlp(url, 'best[ext=mp4]/best', tempDir);
              const videoBuffer = await fs.readFile(result.path);
              
              if (result.size > VIDEO_SIZE_LIMIT) {
                await fs.unlink(result.path).catch(() => {});
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply(`Video too large (${formatFileSize(result.size)}). Limit is 100MB.`);
              }
              
              if (result.isLarge) {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: 'Facebook video'
                });
              } else {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
              }
              
              if (shouldReact()) await ctx.react('✅');
              await fs.unlink(result.path).catch(() => {});
              return;
            }

            const qualities = videoData.formats.map((f, idx) => ({
              label: `${idx + 1} - ${f.quality}${f.size ? ` (${formatFileSize(f.size)})` : ''}`,
              formatString: f.formatString,
              quality: f.quality
            }));

            if (qualities.length === 1) {
              const result = await downloadVideoWithYtDlp(url, qualities[0].formatString, tempDir);
              const videoBuffer = await fs.readFile(result.path);
              
              if (result.size > VIDEO_SIZE_LIMIT) {
                await fs.unlink(result.path).catch(() => {});
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply(`Video too large (${formatFileSize(result.size)}). Limit is 100MB.`);
              }
              
              if (result.isLarge) {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: 'Facebook video'
                });
              } else {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
              }
              
              if (shouldReact()) await ctx.react('✅');
              await fs.unlink(result.path).catch(() => {});
              return;
            }

            let prompt = `*Facebook Video Found!*\n\n`;
            prompt += `*Title:* ${videoData.title}\n`;
            if (videoData.duration) prompt += `*Duration:* ${videoData.duration}\n`;
            prompt += `\n*Select quality by replying with the number:*\n`;
            prompt += qualities.map(q => q.label).join('\n');
            
            const sentMsg = await ctx.reply(prompt);
            
            pendingActions.set(ctx.chatId, sentMsg.key.id, {
              type: 'facebook_quality',
              userId: ctx.senderId,
              data: { qualities, url, tempDir },
              match: (text) => {
                if (typeof text !== 'string') return false;
                const n = parseInt(text.trim(), 10);
                return n >= 1 && n <= qualities.length;
              },
              handler: async (replyCtx, pending) => {
                const choice = parseInt(replyCtx.text.trim(), 10);
                const selected = pending.data.qualities[choice - 1];
                
                if (shouldReact()) await replyCtx.react('⏳');
                
                try {
                  const result = await downloadVideoWithYtDlp(pending.data.url, selected.formatString, pending.data.tempDir);
                  const videoBuffer = await fs.readFile(result.path);
                  
                  if (result.size > VIDEO_SIZE_LIMIT) {
                    await fs.unlink(result.path).catch(() => {});
                    if (shouldReact()) await replyCtx.react('❌');
                    return await replyCtx.reply(`Video too large (${formatFileSize(result.size)}). Limit is 100MB.`);
                  }
                  
                  if (result.isLarge) {
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'document',
                      mimetype: 'video/mp4',
                      caption: 'Facebook video'
                    });
                  } else {
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'video',
                      mimetype: 'video/mp4'
                    });
                  }
                  
                  if (shouldReact()) await replyCtx.react('✅');
                  await fs.unlink(result.path).catch(() => {});
                } catch (error) {
                  if (shouldReact()) await replyCtx.react('❌');
                  await replyCtx.reply('Failed to download selected quality. Please try again.');
                }
              },
              timeout: 10 * 60 * 1000
            });
            
            if (shouldReact()) await ctx.react('');

          } catch (error) {
            if (shouldReact()) await ctx.react('❌');
            await ctx.reply('Could not download video. The video might be private, unavailable, or the link format is not supported.');
          }

        } catch (error) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the Facebook video. Please try again.');
        }
      }
    }
  ]
};
