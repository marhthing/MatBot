import { instagramGetUrl } from 'instagram-url-direct';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

function generateUniqueFilename(prefix = 'ig', extension = 'jpg') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

function validateInstagramUrl(url) {
  const igUrlRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
  if (!url || typeof url !== 'string') return null;
  
  const cleanUrl = url.trim();
  const match = igUrlRegex.exec(cleanUrl);
  
  if (match) {
    let normalizedUrl = cleanUrl;
    if (!cleanUrl.startsWith('http')) {
      normalizedUrl = 'https://' + cleanUrl;
    }
    
    return {
      url: normalizedUrl,
      shortcode: match[1]
    };
  }
  
  return null;
}

function extractInstagramUrlFromObject(obj) {
  const igUrlRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(igUrlRegex);
      if (match) return match[0].replace(/[.,;!?"]+$/, '');
    } else if (typeof obj[key] === 'object') {
      const found = extractInstagramUrlFromObject(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

async function getFileSize(url) {
  try {
    const head = await axios.head(url, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
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
  name: 'instagram',
  description: 'Instagram media downloader with quality selection',
  version: '2.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'ig',
      aliases: ['instagram', 'insta'],
      description: 'Download Instagram media (post/reel/video)',
      usage: '.ig <url>',
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
              url = extractInstagramUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide an Instagram URL\n\nUsage: .ig <url>\n\nSupported: Posts, Reels, Videos');
          }

          const validatedUrl = validateInstagramUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid Instagram URL (post/reel/video)');
          }

          if (shouldReact()) await ctx.react('⏳');

          try {
            const data = await instagramGetUrl(validatedUrl.url);
            
            if (!data || !data.url_list || data.url_list.length === 0) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('Could not fetch media. The post may be private or unavailable.');
            }

            const mediaCount = data.results_number || data.url_list.length;
            
            if (mediaCount === 1) {
              const mediaDetail = data.media_details?.[0];
              const mediaUrl = data.url_list[0];
              const isVideo = mediaDetail?.type === 'video';
              
              const size = await getFileSize(mediaUrl);
              const mediaBuffer = await downloadMediaToBuffer(mediaUrl);

              if (isVideo) {
                if (size > VIDEO_MEDIA_LIMIT) {
                  await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                    type: 'document',
                    mimetype: 'video/mp4',
                    caption: `Instagram video (${formatFileSize(size)})`
                  });
                } else {
                  await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                    type: 'video',
                    mimetype: 'video/mp4'
                  });
                }
                if (shouldReact()) await ctx.react('✅');
              } else {
                await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                  type: 'image',
                  mimetype: 'image/jpeg'
                });
                if (shouldReact()) await ctx.react('✅');
              }

            } else {
              const qualities = [];
              let idx = 1;

              for (let i = 0; i < Math.min(mediaCount, 10); i++) {
                const mediaDetail = data.media_details?.[i];
                const mediaUrl = data.url_list[i];
                const isVideo = mediaDetail?.type === 'video';
                const size = await getFileSize(mediaUrl);
                
                qualities.push({
                  label: `${idx} - ${isVideo ? 'Video' : 'Image'} #${i + 1}${size ? ` (${formatFileSize(size)})` : ''}`,
                  url: mediaUrl,
                  isVideo
                });
                idx++;
              }

              qualities.push({
                label: `${idx} - Download All`,
                url: 'all',
                isVideo: false
              });

              let prompt = `Found ${mediaCount} media items. Select option:\n`;
              prompt += qualities.map(q => q.label).join('\n');
              
              const sentMsg = await ctx.reply(prompt);
              
              pendingActions.set(ctx.chatId, sentMsg.key.id, {
                type: 'instagram_quality',
                userId: ctx.senderId,
                data: { qualities, allMedia: data.url_list, mediaDetails: data.media_details },
                match: (text) => {
                  if (typeof text !== 'string') return false;
                  const n = parseInt(text.trim(), 10);
                  return n >= 1 && n <= qualities.length;
                },
                handler: async (replyCtx, pending) => {
                  const choice = parseInt(replyCtx.text.trim(), 10);
                  const selected = pending.data.qualities[choice - 1];
                  await replyCtx.react('⏳');
                  
                  try {
                    if (selected.url === 'all') {
                      const maxItems = Math.min(pending.data.allMedia.length, 10);
                      for (let i = 0; i < maxItems; i++) {
                        const mediaUrl = pending.data.allMedia[i];
                        const mediaDetail = pending.data.mediaDetails?.[i];
                        const isVideo = mediaDetail?.type === 'video';
                        
                        const mediaBuffer = await downloadMediaToBuffer(mediaUrl);
                        
                        if (isVideo) {
                          await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                            type: 'video',
                            mimetype: 'video/mp4'
                          });
                        } else {
                          await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                            type: 'image',
                            mimetype: 'image/jpeg'
                          });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                      }
                      await replyCtx.react('✅');
                    } else {
                      const mediaBuffer = await downloadMediaToBuffer(selected.url);
                      
                      if (selected.isVideo) {
                        await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                          type: 'video',
                          mimetype: 'video/mp4'
                        });
                      } else {
                        await replyCtx._adapter.sendMedia(replyCtx.chatId, mediaBuffer, {
                          type: 'image',
                          mimetype: 'image/jpeg'
                        });
                      }
                      await replyCtx.react('✅');
                    }
                  } catch (error) {
                    console.error('Instagram download error:', error);
                    await replyCtx.react('❌');
                    await replyCtx.reply('Failed to download selected media.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              await ctx.react('');
            }

          } catch (error) {
            console.error('Instagram download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'This post may be private.';
            } else if (error.message?.includes('not found')) {
              errorMsg += 'Post not found or deleted.';
            } else {
              errorMsg += 'Please try again later or check if the post is available.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          console.error('Instagram command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the Instagram media');
        }
      }
    }
  ]
};
