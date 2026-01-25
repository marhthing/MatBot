import { getFbVideoInfo } from 'fb-downloader-scrapper';
import axios from 'axios';
import pendingActions from '../utils/pendingActions.js';
import fs from 'fs';
import path from 'path';
import { shouldReact } from '../utils/pendingActions.js';

const FACEBOOK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Connection': 'keep-alive',
};

function validateFacebookUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  const cleanUrl = url.trim();
  
  if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
    let normalizedUrl = cleanUrl;
    if (!cleanUrl.startsWith('http')) {
      normalizedUrl = 'https://' + cleanUrl;
    }
    return { url: normalizedUrl };
  }
  
  return null;
}

function extractFacebookUrlFromObject(obj) {
  const fbUrlRegex = /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:watch\/\?v=|.*\/videos\/|.*\/posts\/|.*\/reel\/|share\/r\/[a-zA-Z0-9._-]+|video\.php\?v=|reel|watch|video|story|\w+)(?:\/[a-zA-Z0-9._-]+)*(?:\?[^\s]*)?|https?:\/\/fb\.watch\/[a-zA-Z0-9_-]+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(fbUrlRegex);
      if (match) return match[0].replace(/[.,;!?\s]+$/, '');
    } else if (typeof obj[key] === 'object') {
      const found = extractFacebookUrlFromObject(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

async function downloadMediaToBuffer(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 120000,
    headers: FACEBOOK_HEADERS
  });
  return Buffer.from(response.data);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, unitIndex);
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default {
  name: 'facebook',
  description: 'Facebook video downloader',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'fb',
      aliases: ['facebook'],
      description: 'Download Facebook video',
      usage: '.fb <url>',
      category: 'download',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          let url = ctx.args.join(' ').trim();
          
          // Check quoted message
          if (!url) {
            const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMessage) {
              url = extractFacebookUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a Facebook video URL\n\nUsage: .fb <url>\n\nSupported: Videos, Reels, Watch');
          }

          const validatedUrl = validateFacebookUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid Facebook video URL');
          }
          
          if (shouldReact()) await ctx.react('⏳');

          try {
            const data = await getFbVideoInfo(validatedUrl.url);
            
            if (!data || (!data.sd && !data.hd && !data.fhd)) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('Could not fetch video. The video may be private, unavailable, or not a video post.');
            }

            // Build dynamic quality options with file size
            const qualities = [];
            const qualityMap = [
              { key: 'sd', label: '360p' },
              { key: 'hd', label: '720p' },
              { key: 'fhd', label: '1080p' }
            ];
            
            let idx = 1;
            for (const q of qualityMap) {
              if (data[q.key]) {
                let sizeStr = '';
                try {
                  const head = await axios.head(data[q.key], { timeout: 10000 });
                  const size = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;
                  sizeStr = size ? ` (${formatFileSize(size)})` : '';
                } catch (e) {
                  sizeStr = '';
                }
                qualities.push({ label: `${idx} - ${q.label}${sizeStr}`, url: data[q.key] });
                idx++;
              }
            }
            
            // Fallback: if no known keys, add any other keys that look like a URL
            if (qualities.length === 0) {
              idx = 1;
              for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && value.startsWith('http')) {
                  let sizeStr = '';
                  try {
                    const head = await axios.head(value, { timeout: 10000 });
                    const size = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;
                    sizeStr = size ? ` (${formatFileSize(size)})` : '';
                  } catch (e) {
                    sizeStr = '';
                  }
                  qualities.push({ label: `${idx} - ${key}${sizeStr}`, url: value });
                  idx++;
                }
              }
            }

            if (qualities.length > 1) {
              // Prompt user for quality selection
              let prompt = 'Select video quality by replying with the number:\n';
              prompt += qualities.map(q => q.label).join('\n');
              const sentMsg = await ctx.reply(prompt);
              console.log('[facebook.js] Quality prompt sent. messageId:', sentMsg?.key?.id, 'chatId:', ctx.chatId, 'userId:', ctx.senderId);
              
              // Store pending download state
              pendingActions.set(ctx.chatId, sentMsg.key.id, {
                type: 'facebook_quality',
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
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'video',
                      mimetype: 'video/mp4'
                    });
                    if (shouldReact()) await replyCtx.react('✅');
                  } catch (error) {
                    console.error('Facebook download error:', error);
                    if (shouldReact()) await replyCtx.react('❌');
                    await replyCtx.reply('Failed to download selected quality.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              if (shouldReact()) await ctx.react('');
              return;
            }

            // Only one quality, download directly
            const videoUrl = qualities[0].url;
            const videoBuffer = await downloadMediaToBuffer(videoUrl);

            await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
              type: 'video',
              mimetype: 'video/mp4'
            });

            if (shouldReact()) await ctx.react('✅');
            
          } catch (error) {
            console.error('Facebook download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'This video may be private.';
            } else if (error.message?.includes('not found')) {
              errorMsg += 'Video not found or deleted.';
            } else if (error.message?.includes('timeout')) {
              errorMsg += 'Download timed out. The video may be too large.';
            } else {
              errorMsg += 'Please try again later or check if the video is available.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          console.error('Facebook command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the Facebook video');
        }
      }
    }
  ]
};
