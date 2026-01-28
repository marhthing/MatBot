import TiktokDL from '@tobyg74/tiktok-api-dl';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const humanDelay = (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

function isValidTikTokUrl(url) {
  const tiktokPatterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w-]+/,
    /vt\.tiktok\.com\/[\w-]+/,
    /tiktok\.com\/t\/[\w-]+/,
    /tiktok\.com\/v\/\d+/
  ];
  
  return tiktokPatterns.some(pattern => pattern.test(url));
}

function extractTikTokUrlFromObject(obj) {
  const tiktokRegex = /https?:\/\/(?:vm\.|vt\.|www\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/[\w-]+|v\/\d+|[\w-]+)/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(tiktokRegex);
      if (match) return match[0];
    } else if (typeof obj[key] === 'object') {
      const found = extractTikTokUrlFromObject(obj[key]);
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

async function getFileSize(url) {
  try {
    const head = await axios.head(url, { 
      timeout: 10000,
      headers: { 'User-Agent': getRandomUserAgent() }
    });
    const size = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;
    return size;
  } catch (e) {
    return 0;
  }
}

async function downloadMediaToBuffer(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Referer': 'https://www.tiktok.com/'
    }
  });
  return Buffer.from(response.data);
}

export default {
  name: 'tiktok',
  description: 'TikTok video downloader with quality selection',
  version: '2.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'tiktok',
      aliases: ['tt', 'tik'],
      description: 'Download TikTok video without watermark',
      usage: '.tiktok <url>',
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
              url = extractTikTokUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a TikTok URL or reply to a message containing one\n\nUsage: .tiktok <url>');
          }
          
          if (!isValidTikTokUrl(url)) {
            return await ctx.reply('Invalid TikTok URL. Please provide a valid TikTok video link.');
          }

          if (shouldReact()) await ctx.react('⏳');
          await humanDelay(800, 1500);

          let videoData = null;
          const versions = ["v2", "v1", "v3"];
          
          for (const version of versions) {
            try {
              await humanDelay(500, 1000);
              const result = await TiktokDL.Downloader(url, { version });
              
              if (result && result.status === "success" && result.result) {
                videoData = result.result;
                break;
              }
            } catch (versionError) {
              continue;
            }
          }

          if (!videoData) {
            if (shouldReact()) await ctx.react('❌');
            return await ctx.reply('Failed to fetch TikTok video. Please try again later.');
          }

          const qualities = [];
          let idx = 1;

          if (videoData.video) {
            if (videoData.video.noWatermark) {
              const size = await getFileSize(videoData.video.noWatermark);
              qualities.push({ 
                label: `${idx} - HD No Watermark${size ? ` (${formatFileSize(size)})` : ''}`, 
                url: videoData.video.noWatermark 
              });
              idx++;
            }
            if (videoData.video.playAddr && videoData.video.playAddr.length > 0) {
              for (const addr of videoData.video.playAddr) {
                const size = await getFileSize(addr);
                qualities.push({ 
                  label: `${idx} - Quality ${idx}${size ? ` (${formatFileSize(size)})` : ''}`, 
                  url: addr 
                });
                idx++;
              }
            }
            if (videoData.video.watermark && qualities.length === 0) {
              const size = await getFileSize(videoData.video.watermark);
              qualities.push({ 
                label: `${idx} - With Watermark${size ? ` (${formatFileSize(size)})` : ''}`, 
                url: videoData.video.watermark 
              });
              idx++;
            }
          }

          if (videoData.video_data) {
            if (videoData.video_data.nwm_video_url_HQ) {
              const size = await getFileSize(videoData.video_data.nwm_video_url_HQ);
              qualities.push({ 
                label: `${idx} - HD No Watermark${size ? ` (${formatFileSize(size)})` : ''}`, 
                url: videoData.video_data.nwm_video_url_HQ 
              });
              idx++;
            }
            if (videoData.video_data.nwm_video_url) {
              const size = await getFileSize(videoData.video_data.nwm_video_url);
              qualities.push({ 
                label: `${idx} - SD No Watermark${size ? ` (${formatFileSize(size)})` : ''}`, 
                url: videoData.video_data.nwm_video_url 
              });
              idx++;
            }
            if (videoData.video_data.wm_video_url && qualities.length === 0) {
              const size = await getFileSize(videoData.video_data.wm_video_url);
              qualities.push({ 
                label: `${idx} - With Watermark${size ? ` (${formatFileSize(size)})` : ''}`, 
                url: videoData.video_data.wm_video_url 
              });
              idx++;
            }
          }

          if (videoData.play) {
            const size = await getFileSize(videoData.play);
            qualities.push({ 
              label: `${idx} - Standard${size ? ` (${formatFileSize(size)})` : ''}`, 
              url: videoData.play 
            });
            idx++;
          }

          if (qualities.length === 0) {
            if (shouldReact()) await ctx.react('❌');
            return await ctx.reply('No downloadable video found.');
          }

          if (qualities.length > 1) {
            let prompt = 'Select video quality by replying with the number:\n';
            prompt += qualities.map(q => q.label).join('\n');
            const sentMsg = await ctx.reply(prompt);
            
            pendingActions.set(ctx.chatId, sentMsg.key.id, {
              type: 'tiktok_quality',
              userId: ctx.senderId,
              data: { qualities },
              match: (text) => {
                if (typeof text !== 'string') return false;
                const n = parseInt(text.trim(), 10);
                return n >= 1 && n <= qualities.length;
              },
              handler: async (replyCtx, pending) => {
                const choice = parseInt(replyCtx.text.trim(), 10);
                const videoUrl = pending.data.qualities[choice - 1].url;
                if (shouldReact()) await replyCtx.react('⏳');
                try {
                  const videoBuffer = await downloadMediaToBuffer(videoUrl);
                  const size = videoBuffer.length;
                  
                  if (size > VIDEO_SIZE_LIMIT) {
                    if (shouldReact()) await replyCtx.react('❌');
                    return await replyCtx.reply(`Video too large (${formatFileSize(size)}). Limit is 100MB.`);
                  }
                  
                  // Telegram: 50MB hard limit for bots
                  const TELEGRAM_FILE_LIMIT = 50 * 1024 * 1024;
                  if (ctx.platform === 'telegram' && size > TELEGRAM_FILE_LIMIT) {
                    if (shouldReact()) await ctx.react('❌');
                    return await ctx.reply('Video too large for Telegram (limit is 50MB).');
                  }

                  if (size > VIDEO_MEDIA_LIMIT) {
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'document',
                      mimetype: 'video/mp4',
                      caption: 'TikTok video'
                    });
                  } else {
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'video',
                      mimetype: 'video/mp4'
                    });
                  }
                  if (shouldReact()) await replyCtx.react('✅');
                } catch (error) {
                  // console.error('TikTok download error:', error);
                  if (shouldReact()) await replyCtx.react('❌');
                  await replyCtx.reply('Failed to download selected quality.');
                }
              },
              timeout: 10 * 60 * 1000
            });
            if (shouldReact()) await ctx.react('');
            return;
          }

          const videoBuffer = await downloadMediaToBuffer(qualities[0].url);
          const size = videoBuffer.length;
          
          if (size > VIDEO_SIZE_LIMIT) {
            if (shouldReact()) await ctx.react('❌');
            return await ctx.reply(`Video too large (${formatFileSize(size)}). Limit is 100MB.`);
          }
          
          // Telegram: 50MB hard limit for bots
          const TELEGRAM_FILE_LIMIT = 50 * 1024 * 1024;
          if (ctx.platform === 'telegram' && size > TELEGRAM_FILE_LIMIT) {
            if (shouldReact()) await ctx.react('❌');
            return await ctx.reply('Video too large for Telegram (limit is 50MB).');
          }

          if (size > VIDEO_MEDIA_LIMIT) {
            await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
              type: 'document',
              mimetype: 'video/mp4',
              caption: 'TikTok video'
            });
          } else {
            await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
              type: 'video',
              mimetype: 'video/mp4'
            });
          }
          if (shouldReact()) await ctx.react('✅');

        } catch (error) {
          console.error('TikTok Telegram error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the TikTok video. Please try again.\n' + (error && error.message ? error.message : error));
        }
      }
    }
  ]
};
