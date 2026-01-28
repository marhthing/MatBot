import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { shouldReact } from '../utils/pendingActions.js';

const VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024; // 2GB
const VIDEO_MEDIA_LIMIT = 16 * 1024 * 1024; // 16MB
const IMAGE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

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

async function validatePinterestUrl(url) {
  const pinterestUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:pinterest\.com\/pin\/|pin\.it\/)([a-zA-Z0-9_-]+)/;
  if (!url || typeof url !== 'string') return null;
  
  let cleanUrl = url.trim();
  
  try {
    // Expand short links
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
  } catch (error) {
    // console.error('URL validation error:', error.message);
  }
  
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

function findVideoUrl(obj, depth = 0) {
  if (depth > 10) return null;
  if (!obj || typeof obj !== 'object') return null;
  
  if (obj.video_list && typeof obj.video_list === 'object') {
    const qualities = ['V_720P', 'V_HLSV4', 'V_HLSV3_MOBILE', 'V_EXP7', 'V_EXP6', 'V_EXP5'];
    
    for (const quality of qualities) {
      if (obj.video_list[quality]?.url) {
        return obj.video_list[quality].url;
      }
    }
    
    for (const key in obj.video_list) {
      if (obj.video_list[key]?.url) {
        return obj.video_list[key].url;
      }
    }
  }
  
  if (obj.url && typeof obj.url === 'string' && obj.url.includes('.mp4')) {
    return obj.url;
  }
  
  for (const key in obj) {
    if (key === 'videos' || key === 'video_list' || key === 'video') {
      const result = findVideoUrl(obj[key], depth + 1);
      if (result) return result;
    }
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const result = findVideoUrl(obj[key], depth + 1);
      if (result) return result;
    }
  }
  
  return null;
}

function findImageUrl(obj, depth = 0) {
  if (depth > 10) return null;
  if (!obj || typeof obj !== 'object') return null;
  
  if (obj.images?.orig?.url) {
    return obj.images.orig.url;
  }
  
  if (obj.url && typeof obj.url === 'string' && 
      (obj.url.includes('pinimg.com') || obj.url.match(/\.(jpg|jpeg|png|webp)/i))) {
    return obj.url;
  }
  
  for (const key in obj) {
    if (key === 'images' || key === 'image') {
      const result = findImageUrl(obj[key], depth + 1);
      if (result) return result;
    }
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      const result = findImageUrl(obj[key], depth + 1);
      if (result) return result;
    }
  }
  
  return null;
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
    
    let videoUrl = null;
    let imageUrl = null;
    
    for (const jsonData of jsonBlocks) {
      videoUrl = findVideoUrl(jsonData);
      if (videoUrl) break;
    }
    
    if (!videoUrl) {
      for (const jsonData of jsonBlocks) {
        imageUrl = findImageUrl(jsonData);
        if (imageUrl) break;
      }
    }
    
    if (!videoUrl && !imageUrl) {
      const videoPatterns = [
        /"url":"(https:\/\/[^"]*\.mp4[^"]*)"/,
        /"V_720P":\{"url":"([^"]+)"/,
        /"video_list":[^}]*"url":"([^"]+\.mp4[^"]*)"/
      ];
      
      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          videoUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
          break;
        }
      }
      
      if (!videoUrl) {
        const imagePatterns = [
          /"url":"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/,
          /"orig":\{"url":"([^"]+)"/
        ];
        
        for (const pattern of imagePatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
            break;
          }
        }
      }
    }

    const finalUrl = videoUrl || imageUrl;
    const isVideo = !!videoUrl;
    
    if (!finalUrl) {
      throw new Error('Could not extract media URL from Pinterest page');
    }

    return {
      url: finalUrl,
      isVideo: isVideo
    };

  } catch (error) {
    throw error;
  }
}

async function downloadMediaFromUrl(mediaUrl, filename, tempDir) {
  await fs.ensureDir(tempDir);
  const tempFile = path.join(tempDir, filename);
  
  try {
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 90000,
      headers: HEADERS
    });

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempFile);
      response.data.pipe(writeStream);
      
      response.data.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    const stats = await fs.stat(tempFile);
    
    return {
      path: tempFile,
      size: stats.size
    };

  } catch (error) {
    await fs.unlink(tempFile).catch(() => {});
    throw error;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, unitIndex);
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default {
  name: 'pinterest',
  description: 'Pinterest media downloader',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'pin',
      aliases: ['pinterest'],
      description: 'Download Pinterest media (image/video)',
      usage: '.pin <url>',
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
              url = extractPinterestUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('❌ Please provide a Pinterest URL\n\nUsage: .pin <url>');
          }

          const validatedUrl = await validatePinterestUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('❌ Please provide a valid Pinterest URL (pin.it or pinterest.com/pin/)');
          }
          
          const tempDir = path.join(process.cwd(), 'tmp');
          await fs.ensureDir(tempDir);

          if (shouldReact()) await ctx.react('⏳');

          try {
            const mediaInfo = await getPinterestMediaInfo(validatedUrl.url);
            
            const extension = mediaInfo.isVideo ? 'mp4' : 'jpg';
            const filename = generateUniqueFilename('pin', extension);
            
            const result = await downloadMediaFromUrl(mediaInfo.url, filename, tempDir);
            
            // Check size limits
            if (mediaInfo.isVideo && result.size > VIDEO_SIZE_LIMIT) {
              await fs.unlink(result.path).catch(() => {});
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply(`❌ Video too large (${formatFileSize(result.size)}). WhatsApp limit is 2GB.`);
            }
            
            if (!mediaInfo.isVideo && result.size > IMAGE_SIZE_LIMIT) {
              await fs.unlink(result.path).catch(() => {});
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply(`❌ Image too large (${formatFileSize(result.size)}). Limit is 5MB.`);
            }

            const mediaBuffer = await fs.readFile(result.path);

            if (mediaInfo.isVideo) {
              if (result.size > VIDEO_MEDIA_LIMIT) {
                await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: filename
                });
              } else {
                await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                  type: 'video',
                  mimetype: 'video/mp4'
                });
              }
            } else {
              await ctx._adapter.sendMedia(ctx.chatId, mediaBuffer, {
                type: 'image',
                mimetype: 'image/jpeg'
              });
            }

            if (shouldReact()) await ctx.react('✅');
            await fs.unlink(result.path).catch(() => {});

          } catch (error) {
            // console.error('Pinterest download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = '❌ Download failed. ';
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
          // console.error('Pinterest command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('❌ An error occurred while processing the Pinterest media');
        }
      }
    }
  ]
};