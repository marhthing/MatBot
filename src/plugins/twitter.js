import { TwitterDL } from 'twitter-downloader';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://twitter.com/',
};

function generateUniqueFilename(prefix = 'twitter', extension = 'mp4') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

function validateTwitterUrl(url) {
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:\w+)\/status\/(\d+)/;
  if (!url || typeof url !== 'string') return null;
  
  const cleanUrl = url.trim();
  const match = twitterUrlRegex.exec(cleanUrl);
  
  if (match) {
    let normalizedUrl = cleanUrl;
    if (!cleanUrl.startsWith('http')) {
      normalizedUrl = 'https://' + cleanUrl;
    }
    normalizedUrl = normalizedUrl.replace('x.com', 'twitter.com');
    
    return {
      url: normalizedUrl,
      tweetId: match[1]
    };
  }
  
  return null;
}

function extractTwitterUrlFromObject(obj) {
  const twitterUrlRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(twitterUrlRegex);
      if (match) return match[0].replace(/[.,;!?"]+$/, '');
    } else if (typeof obj[key] === 'object') {
      const found = extractTwitterUrlFromObject(obj[key]);
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
      headers: HEADERS
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
    headers: HEADERS
  });
  return Buffer.from(response.data);
}

export default {
  name: 'twitter',
  description: 'Twitter/X video and image downloader with quality selection',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'twitter',
      aliases: ['tw', 'x', 'tweet'],
      description: 'Download Twitter/X media',
      usage: '.twitter <url>',
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
              url = extractTwitterUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a Twitter/X URL\n\nUsage: .twitter <url> or .x <url>');
          }

          const validatedUrl = validateTwitterUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid Twitter/X URL');
          }

          if (shouldReact()) await ctx.react('⏳');

          try {
            const result = await TwitterDL(validatedUrl.url);
            
            if (!result || result.status !== 'success' || !result.result) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('Could not fetch media. The tweet may be private or unavailable.');
            }

            const data = result.result;
            const media = data.media || [];
            
            if (media.length === 0) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('No media found in this tweet.');
            }

            const videos = media.filter(m => m.type === 'video' || m.type === 'gif');
            const images = media.filter(m => m.type === 'photo');

            if (videos.length > 0) {
              const video = videos[0];
              const variants = video.videos || [];
              
              if (variants.length === 0) {
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply('No downloadable video found.');
              }

              const sortedVariants = variants
                .filter(v => v.bitrate !== undefined)
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

              if (sortedVariants.length === 0) {
                const videoUrl = variants[0]?.url;
                if (!videoUrl) {
                  await ctx.react('❌');
                  return await ctx.reply('No downloadable video found.');
                }
                
                const videoBuffer = await downloadMediaToBuffer(videoUrl);
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
                if (shouldReact()) await ctx.react('✅');
                return;
              }

              const qualities = [];
              let idx = 1;
              
              for (const variant of sortedVariants) {
                const size = await getFileSize(variant.url);
                let qualityLabel = 'Standard';
                
                if (variant.bitrate >= 2000000) qualityLabel = '1080p HD';
                else if (variant.bitrate >= 1000000) qualityLabel = '720p HD';
                else if (variant.bitrate >= 500000) qualityLabel = '480p';
                else if (variant.bitrate >= 200000) qualityLabel = '360p';
                else qualityLabel = 'Low';
                
                qualities.push({
                  label: `${idx} - ${qualityLabel}${size ? ` (${formatFileSize(size)})` : ''}`,
                  url: variant.url,
                  bitrate: variant.bitrate
                });
                idx++;
              }

              if (qualities.length > 1) {
                let prompt = '';
                if (data.description) {
                  prompt += `*${data.description.substring(0, 100)}${data.description.length > 100 ? '...' : ''}*\n\n`;
                }
                prompt += 'Select video quality by replying with the number:\n';
                prompt += qualities.map(q => q.label).join('\n');
                
                const sentMsg = await ctx.reply(prompt);
                
                pendingActions.set(ctx.chatId, sentMsg.key.id, {
                  type: 'twitter_quality',
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
                      
                      if (size > VIDEO_MEDIA_LIMIT) {
                        await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                          type: 'document',
                          mimetype: 'video/mp4',
                          caption: 'Twitter video'
                        });
                      } else {
                        await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                          type: 'video',
                          mimetype: 'video/mp4'
                        });
                      }
                      if (shouldReact()) await replyCtx.react('✅');
                    } catch (error) {
                      console.error('Twitter download error:', error);
                      if (shouldReact()) await replyCtx.react('❌');
                      await replyCtx.reply('Failed to download selected quality.');
                    }
                  },
                  timeout: 10 * 60 * 1000
                });
                if (shouldReact()) await ctx.react('');
                
              } else {
                const videoBuffer = await downloadMediaToBuffer(qualities[0].url);
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
                if (shouldReact()) await ctx.react('✅');
              }

            } else if (images.length > 0) {
              if (images.length === 1) {
                const imageUrl = images[0].url;
                const imageBuffer = await downloadMediaToBuffer(imageUrl);
                await ctx._adapter.sendMedia(ctx.chatId, imageBuffer, {
                  type: 'image',
                  mimetype: 'image/jpeg'
                });
                if (shouldReact()) await ctx.react('✅');
              } else {
                const qualities = images.map((img, idx) => ({
                  label: `${idx + 1} - Image #${idx + 1}`,
                  url: img.url
                }));
                
                qualities.push({
                  label: `${images.length + 1} - Download All`,
                  url: 'all'
                });

                let prompt = `Found ${images.length} images. Select option:\n`;
                prompt += qualities.map(q => q.label).join('\n');
                
                const sentMsg = await ctx.reply(prompt);
                
                pendingActions.set(ctx.chatId, sentMsg.key.id, {
                  type: 'twitter_images',
                  userId: ctx.senderId,
                  data: { qualities, allImages: images },
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
                      if (selected.url === 'all') {
                        for (const img of pending.data.allImages) {
                          const imageBuffer = await downloadMediaToBuffer(img.url);
                          await replyCtx._adapter.sendMedia(replyCtx.chatId, imageBuffer, {
                            type: 'image',
                            mimetype: 'image/jpeg'
                          });
                          await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        if (shouldReact()) await replyCtx.react('✅');
                      } else {
                        const imageBuffer = await downloadMediaToBuffer(selected.url);
                        await replyCtx._adapter.sendMedia(replyCtx.chatId, imageBuffer, {
                          type: 'image',
                          mimetype: 'image/jpeg'
                        });
                        if (shouldReact()) await replyCtx.react('✅');
                      }
                    } catch (error) {
                      console.error('Twitter download error:', error);
                      if (shouldReact()) await replyCtx.react('❌');
                      await replyCtx.reply('Failed to download selected media.');
                    }
                  },
                  timeout: 10 * 60 * 1000
                });
                if (shouldReact()) await ctx.react('');
              }
            } else {
              if (shouldReact()) await ctx.react('❌');
              await ctx.reply('No downloadable media found in this tweet.');
            }

          } catch (error) {
            console.error('Twitter download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'This tweet may be private.';
            } else if (error.message?.includes('not found')) {
              errorMsg += 'Tweet not found or deleted.';
            } else {
              errorMsg += 'Please try again later.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          console.error('Twitter command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing Twitter media');
        }
      }
    }
  ]
};
