import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 16 * 1024 * 1024;
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.pinterest.com/',
  'DNT': '1',
  'Connection': 'keep-alive',
};

function generateUniqueFilename(prefix = 'pin', extension = 'jpg') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
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

async function validatePinterestUrl(url) {
  const pinterestUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com\/pin\/|pin\.it\/)([a-zA-Z0-9_-]+)/;
  if (!url || typeof url !== 'string') return null;
  
  let cleanUrl = url.trim();
  
  try {
    if (cleanUrl.includes('pin.it')) {
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const response = await axios.get(cleanUrl, {
        headers: HEADERS,
        maxRedirects: 5,
        validateStatus: () => true
      });
      
      cleanUrl = response.request.res.responseUrl || cleanUrl;
    }
    
    const match = pinterestUrlRegex.exec(cleanUrl);
    if (match) {
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      return {
        url: cleanUrl,
        pinId: match[1]
      };
    }
  } catch (error) {}
  
  return null;
}

function extractAllJsonData(html) {
  const jsonBlocks = [];
  
  const pwsMatch = html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>(.*?)<\/script>/s);
  if (pwsMatch && pwsMatch[1]) {
    try {
      jsonBlocks.push(JSON.parse(pwsMatch[1]));
    } catch (e) {}
  }
  
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/json"[^>]*>(.*?)<\/script>/gs);
  for (const match of scriptMatches) {
    try {
      jsonBlocks.push(JSON.parse(match[1]));
    } catch (e) {}
  }
  
  return jsonBlocks;
}

function findVideoQualities(obj, depth = 0) {
  if (depth > 10) return [];
  if (!obj || typeof obj !== 'object') return [];
  
  const qualities = [];
  
  if (obj.video_list && typeof obj.video_list === 'object') {
    const qualityOrder = ['V_720P', 'V_480P', 'V_360P', 'V_HLSV4', 'V_HLSV3_MOBILE', 'V_EXP7', 'V_EXP6', 'V_EXP5'];
    
    for (const quality of qualityOrder) {
      if (obj.video_list[quality]?.url) {
        let label = quality.replace('V_', '').replace('P', 'p');
        if (label.includes('HLS')) label = 'HLS Stream';
        if (label.includes('EXP')) label = 'Standard';
        
        qualities.push({
          quality: label,
          url: obj.video_list[quality].url,
          width: obj.video_list[quality].width || 0,
          height: obj.video_list[quality].height || 0
        });
      }
    }
    
    if (qualities.length === 0) {
      for (const key in obj.video_list) {
        if (obj.video_list[key]?.url) {
          qualities.push({
            quality: key.replace('V_', '').replace('P', 'p'),
            url: obj.video_list[key].url,
            width: obj.video_list[key].width || 0,
            height: obj.video_list[key].height || 0
          });
        }
      }
    }
  }
  
  if (qualities.length > 0) return qualities;
  
  for (const key in obj) {
    if (key === 'videos' || key === 'video_list' || key === 'video') {
      const result = findVideoQualities(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const result = findVideoQualities(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  
  return [];
}

function findImageQualities(obj, depth = 0) {
  if (depth > 10) return [];
  if (!obj || typeof obj !== 'object') return [];
  
  const qualities = [];
  
  if (obj.images && typeof obj.images === 'object') {
    const qualityOrder = ['orig', '1200x', '736x', '564x', '474x', '236x', '170x'];
    
    for (const quality of qualityOrder) {
      if (obj.images[quality]?.url) {
        qualities.push({
          quality: quality === 'orig' ? 'Original' : quality,
          url: obj.images[quality].url,
          width: obj.images[quality].width || 0,
          height: obj.images[quality].height || 0
        });
      }
    }
  }
  
  if (qualities.length > 0) return qualities;
  
  for (const key in obj) {
    if (key === 'images' || key === 'image') {
      const result = findImageQualities(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const result = findImageQualities(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  
  return [];
}

function extractPinterestUrlFromObject(obj) {
  const urlRegex = /https?:\/\/(?:www\.)?(?:pinterest\.com\/pin\/|pin\.it\/)[a-zA-Z0-9_-]+/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(urlRegex);
      if (match) return match[0];
    } else if (typeof obj[key] === 'object') {
      const found = extractPinterestUrlFromObject(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

async function getPinterestMediaInfo(url) {
  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 30000
    });

    const html = response.data;
    const jsonBlocks = extractAllJsonData(html);
    
    let videoQualities = [];
    let imageQualities = [];
    
    for (const jsonData of jsonBlocks) {
      videoQualities = findVideoQualities(jsonData);
      if (videoQualities.length > 0) break;
    }
    
    if (videoQualities.length === 0) {
      for (const jsonData of jsonBlocks) {
        imageQualities = findImageQualities(jsonData);
        if (imageQualities.length > 0) break;
      }
    }
    
    if (videoQualities.length === 0 && imageQualities.length === 0) {
      const videoPatterns = [
        /"url":"(https:\/\/[^"]*\.mp4[^"]*)"/,
        /"V_720P":\{"url":"([^"]+)"/,
        /"video_list":[^}]*"url":"([^"]+\.mp4[^"]*)"/
      ];
      
      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const videoUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
          videoQualities.push({ quality: 'Standard', url: videoUrl, width: 0, height: 0 });
          break;
        }
      }
      
      if (videoQualities.length === 0) {
        const imagePatterns = [
          /"url":"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/,
          /"orig":\{"url":"([^"]+)"/
        ];
        
        for (const pattern of imagePatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            const imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
            imageQualities.push({ quality: 'Original', url: imageUrl, width: 0, height: 0 });
            break;
          }
        }
      }
    }

    if (videoQualities.length === 0 && imageQualities.length === 0) {
      throw new Error('Could not extract media URL from Pinterest page');
    }

    return {
      isVideo: videoQualities.length > 0,
      videoQualities,
      imageQualities
    };

  } catch (error) {
    throw error;
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
  name: 'pinterest',
  description: 'Pinterest media downloader with quality selection',
  version: '2.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'pin',
      aliases: ['pinterest'],
      description: 'Download Pinterest media (image/video) with quality selection',
      usage: '.pin <url>',
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
              url = extractPinterestUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a Pinterest URL\n\nUsage: .pin <url>');
          }

          const validatedUrl = await validatePinterestUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid Pinterest URL (pin.it or pinterest.com/pin/)');
          }

          if (shouldReact()) await ctx.react('⏳');

          try {
            const mediaInfo = await getPinterestMediaInfo(validatedUrl.url);
            
            if (mediaInfo.isVideo) {
              const videoQualities = mediaInfo.videoQualities.filter(q => !q.url.includes('.m3u8'));
              
              if (videoQualities.length === 0) {
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply('No downloadable video found (only streaming formats available).');
              }
              
              if (videoQualities.length === 1) {
                const selected = videoQualities[0];
                const videoBuffer = await downloadMediaToBuffer(selected.url);
                const size = videoBuffer.length;
                
                if (size > VIDEO_SIZE_LIMIT) {
                  if (shouldReact()) await ctx.react('❌');
                  return await ctx.reply(`Video too large (${formatFileSize(size)}). Limit is 2GB.`);
                }
                
                if (size > VIDEO_MEDIA_LIMIT) {
                  await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                    type: 'document',
                    mimetype: 'video/mp4',
                    caption: 'Pinterest video'
                  });
                } else {
                  await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                    type: 'video',
                    mimetype: 'video/mp4'
                  });
                }
                
                if (shouldReact()) await ctx.react('✅');
                return;
              }
              
              const qualities = [];
              let idx = 1;
              
              for (const q of videoQualities) {
                const size = await getFileSize(q.url);
                let label = q.quality;
                if (q.height > 0) label = `${q.height}p`;
                
                qualities.push({
                  label: `${idx} - ${label}${size ? ` (${formatFileSize(size)})` : ''}`,
                  url: q.url
                });
                idx++;
              }
              
              let prompt = '*Pinterest Video Found!*\n\nSelect quality by replying with the number:\n';
              prompt += qualities.map(q => q.label).join('\n');
              
              const sentMsg = await ctx.reply(prompt);
              
              pendingActions.set(ctx.chatId, sentMsg.key.id, {
                type: 'pinterest_quality',
                userId: ctx.senderId,
                data: { qualities, isVideo: true },
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
                    const videoBuffer = await downloadMediaToBuffer(selected.url);
                    const size = videoBuffer.length;
                    
                    if (size > VIDEO_SIZE_LIMIT) {
                      if (shouldReact()) await replyCtx.react('❌');
                      return await replyCtx.reply(`Video too large (${formatFileSize(size)}). Limit is 2GB.`);
                    }
                    
                    if (size > VIDEO_MEDIA_LIMIT) {
                      await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                        type: 'document',
                        mimetype: 'video/mp4',
                        caption: 'Pinterest video'
                      });
                    } else {
                      await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                        type: 'video',
                        mimetype: 'video/mp4'
                      });
                    }
                    
                    if (shouldReact()) await replyCtx.react('✅');
                  } catch (error) {
                    if (shouldReact()) await replyCtx.react('❌');
                    await replyCtx.reply('Failed to download selected quality.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              
              if (shouldReact()) await ctx.react('');
              
            } else {
              const imageQualities = mediaInfo.imageQualities;
              
              if (imageQualities.length === 0) {
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply('No downloadable image found.');
              }
              
              if (imageQualities.length === 1) {
                const selected = imageQualities[0];
                const imageBuffer = await downloadMediaToBuffer(selected.url);
                
                await ctx._adapter.sendMedia(ctx.chatId, imageBuffer, {
                  type: 'image',
                  mimetype: 'image/jpeg'
                });
                
                if (shouldReact()) await ctx.react('✅');
                return;
              }
              
              const qualities = [];
              let idx = 1;
              
              for (const q of imageQualities.slice(0, 5)) {
                const size = await getFileSize(q.url);
                let label = q.quality;
                if (q.width > 0 && q.height > 0) label = `${q.width}x${q.height}`;
                else if (q.width > 0) label = `${q.width}px wide`;
                
                qualities.push({
                  label: `${idx} - ${label}${size ? ` (${formatFileSize(size)})` : ''}`,
                  url: q.url
                });
                idx++;
              }
              
              let prompt = '*Pinterest Image Found!*\n\nSelect quality by replying with the number:\n';
              prompt += qualities.map(q => q.label).join('\n');
              
              const sentMsg = await ctx.reply(prompt);
              
              pendingActions.set(ctx.chatId, sentMsg.key.id, {
                type: 'pinterest_quality',
                userId: ctx.senderId,
                data: { qualities, isVideo: false },
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
                    const imageBuffer = await downloadMediaToBuffer(selected.url);
                    
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, imageBuffer, {
                      type: 'image',
                      mimetype: 'image/jpeg'
                    });
                    
                    if (shouldReact()) await replyCtx.react('✅');
                  } catch (error) {
                    if (shouldReact()) await replyCtx.react('❌');
                    await replyCtx.reply('Failed to download selected quality.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              
              if (shouldReact()) await ctx.react('');
            }

          } catch (error) {
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'This pin may be private.';
            } else if (error.message?.includes('not found')) {
              errorMsg += 'Pin not found or deleted.';
            } else if (error.message?.includes('extract')) {
              errorMsg += 'Could not extract media from Pinterest.';
            } else {
              errorMsg += 'Please try again later.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the Pinterest media');
        }
      }
    }
  ]
};
