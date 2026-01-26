import axios from 'axios';
import pendingActions from '../utils/pendingActions.js';
import { shouldReact } from '../utils/pendingActions.js';
import * as cheerio from 'cheerio';

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
    headers: FACEBOOK_HEADERS,
    maxRedirects: 5
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

// ====== WORKING API METHODS ======

async function method1_FdownloaderNet(url) {
  console.log('[Method 1] Trying fdownloader.net...');
  try {
    // Step 1: POST to get token
    const postRes = await axios.post('https://v3.fdownloader.net/api/ajaxSearch?lang=en', 
      `q=${encodeURIComponent(url)}&vt=facebook`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': FACEBOOK_HEADERS['User-Agent'],
          'Origin': 'https://fdownloader.net',
          'Referer': 'https://fdownloader.net/'
        },
        timeout: 30000
      }
    );

    if (postRes.data && postRes.data.data) {
      const $ = cheerio.load(postRes.data.data);
      const links = {};
      
      // Extract download links
      $('a[href*="download"]').each((i, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase();
        
        if (href && href.startsWith('http')) {
          if (text.includes('hd') || text.includes('high')) {
            links.hd = href;
          } else if (text.includes('sd') || text.includes('low') || text.includes('normal')) {
            links.sd = href;
          } else if (!links.sd) {
            links.sd = href;
          }
        }
      });

      if (links.hd || links.sd) {
        return links;
      }
    }
    return null;
  } catch (error) {
    console.error('[Method 1] Failed:', error.message);
    return null;
  }
}

async function method2_FdownNet(url) {
  console.log('[Method 2] Trying fdown.net...');
  try {
    const apiUrl = 'https://v3.fdown.net/api/ajaxSearch?lang=en';
    
    const res = await axios.post(apiUrl, 
      `q=${encodeURIComponent(url)}&vt=facebook`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': FACEBOOK_HEADERS['User-Agent'],
          'Origin': 'https://fdown.net',
          'Referer': 'https://fdown.net/'
        },
        timeout: 30000
      }
    );

    if (res.data && res.data.data) {
      const $ = cheerio.load(res.data.data);
      const links = {};
      
      $('a').each((i, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase();
        
        if (href && href.includes('facebook')) {
          if (text.includes('hd') || text.includes('high quality')) {
            links.hd = href;
          } else if (text.includes('sd') || text.includes('normal quality')) {
            links.sd = href;
          }
        }
      });

      if (links.hd || links.sd) {
        return links;
      }
    }
    return null;
  } catch (error) {
    console.error('[Method 2] Failed:', error.message);
    return null;
  }
}

async function method3_GetMyFB(url) {
  console.log('[Method 3] Trying getmyfb.com...');
  try {
    const apiUrl = 'https://getmyfb.com/process';
    
    const res = await axios.post(apiUrl, 
      { id: url },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': FACEBOOK_HEADERS['User-Agent']
        },
        timeout: 30000
      }
    );

    if (res.data && (res.data.hd || res.data.sd)) {
      return {
        hd: res.data.hd,
        sd: res.data.sd
      };
    }
    return null;
  } catch (error) {
    console.error('[Method 3] Failed:', error.message);
    return null;
  }
}

async function method4_SnapSaveApp(url) {
  console.log('[Method 4] Trying snapsave.app...');
  try {
    const apiUrl = 'https://snapsave.app/action.php?lang=en';
    
    const res = await axios.post(apiUrl, 
      `url=${encodeURIComponent(url)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://snapsave.app',
          'Referer': 'https://snapsave.app/',
          'User-Agent': FACEBOOK_HEADERS['User-Agent']
        },
        timeout: 30000
      }
    );

    const html = res.data;
    const $ = cheerio.load(html);
    const links = {};
    
    $('a.download-link, a[href*=".mp4"]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().toLowerCase();
      
      if (href && href.startsWith('http')) {
        if (text.includes('hd') || text.includes('high')) {
          links.hd = href;
        } else if (text.includes('sd') || !links.sd) {
          links.sd = href;
        }
      }
    });

    if (links.hd || links.sd) {
      return links;
    }
    return null;
  } catch (error) {
    console.error('[Method 4] Failed:', error.message);
    return null;
  }
}

async function method5_FbVideoDown(url) {
  console.log('[Method 5] Trying fbvideodown...');
  try {
    const apiUrl = `https://www.fbvideodown.com/api/v1/fetch?url=${encodeURIComponent(url)}`;
    
    const res = await axios.get(apiUrl, {
      headers: FACEBOOK_HEADERS,
      timeout: 30000
    });

    if (res.data && res.data.data) {
      const data = res.data.data;
      return {
        hd: data.hd || data.sd,
        sd: data.sd || data.hd
      };
    }
    return null;
  } catch (error) {
    console.error('[Method 5] Failed:', error.message);
    return null;
  }
}

async function method6_SimpleScraper(url) {
  console.log('[Method 6] Trying simple video extraction...');
  try {
    // Try to get the page directly and extract video URLs
    const res = await axios.get(url, {
      headers: FACEBOOK_HEADERS,
      timeout: 30000
    });

    const html = res.data;
    
    // Look for common video URL patterns
    const hdMatch = html.match(/"(?:hd_src|hd_src_no_ratelimit)":"([^"]+)"/);
    const sdMatch = html.match(/"(?:sd_src|sd_src_no_ratelimit)":"([^"]+)"/);
    
    if (hdMatch || sdMatch) {
      return {
        hd: hdMatch ? hdMatch[1].replace(/\\/g, '') : null,
        sd: sdMatch ? sdMatch[1].replace(/\\/g, '') : null
      };
    }
    return null;
  } catch (error) {
    console.error('[Method 6] Failed:', error.message);
    return null;
  }
}

async function getAllVideoQualities(url) {
  const methods = [
    method1_FdownloaderNet,  // fdownloader.net - Most popular
    method2_FdownNet,         // fdown.net - Alternative
    method3_GetMyFB,          // getmyfb.com - JSON API
    method4_SnapSaveApp,      // snapsave.app
    method5_FbVideoDown,      // fbvideodown.com
    method6_SimpleScraper     // Direct extraction
  ];

  for (const method of methods) {
    try {
      const result = await method(url);
      if (result && (result.sd || result.hd)) {
        console.log(`✓ Success with ${method.name}`);
        return result;
      }
    } catch (error) {
      console.error(`✗ ${method.name} failed:`, error.message);
    }
  }

  throw new Error('All download methods failed. The video may be private, deleted, or region-restricted.');
}

// ====== MAIN COMMAND ======

export default {
  name: 'facebook',
  description: 'Facebook video downloader with 6 fallback methods',
  version: '5.0.0',
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
            // Try all methods with fallbacks
            const data = await getAllVideoQualities(validatedUrl.url);
            
            if (!data) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('Could not fetch video. The video may be private, unavailable, or not a video post.');
            }

            // Build dynamic quality options with file size
            const qualities = [];
            const qualityMap = [
              { key: 'sd', label: '360p (SD)' },
              { key: 'hd', label: '720p (HD)' }
            ];
            
            let idx = 1;
            for (const q of qualityMap) {
              if (data[q.key]) {
                let sizeStr = '';
                try {
                  const head = await axios.head(data[q.key], { 
                    timeout: 10000, 
                    headers: FACEBOOK_HEADERS,
                    maxRedirects: 5 
                  });
                  const size = head.headers['content-length'] ? parseInt(head.headers['content-length'], 10) : 0;
                  sizeStr = size ? ` (${formatFileSize(size)})` : '';
                } catch (e) {
                  sizeStr = '';
                }
                qualities.push({ label: `${idx} - ${q.label}${sizeStr}`, url: data[q.key] });
                idx++;
              }
            }

            if (qualities.length === 0) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('No downloadable video found. The video may be private or unavailable.');
            }

            if (qualities.length > 1) {
              // Prompt user for quality selection
              let prompt = '🎥 *Select video quality* by replying with the number:\n\n';
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
                    await replyCtx.reply('❌ Failed to download selected quality. The link may have expired or the file is too large.');
                  }
                },
                timeout: 10 * 60 * 1000
              });
              if (shouldReact()) await ctx.react('');
              return;
            }

            // Only one quality, download directly
            const videoUrl = qualities[0].url;
            let videoBuffer;
            try {
              videoBuffer = await downloadMediaToBuffer(videoUrl);
            } catch (err) {
              console.error('Direct download failed:', err);
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('❌ Download failed. The file may be too large or the link has expired.');
            }

            await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
              type: 'video',
              mimetype: 'video/mp4'
            });

            if (shouldReact()) await ctx.react('✅');
            
          } catch (error) {
            console.error('Facebook download failed:', error);
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = '❌ Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'This video may be private.';
            } else if (error.message?.includes('not found') || error.message?.includes('deleted')) {
              errorMsg += 'Video not found or deleted.';
            } else if (error.message?.includes('timeout')) {
              errorMsg += 'Download timed out. The video may be too large.';
            } else if (error.message?.includes('region')) {
              errorMsg += 'This video may be region-restricted.';
            } else if (error.message?.includes('All download methods failed')) {
              errorMsg += 'All download methods failed. The video may be private, deleted, or restricted.';
            } else {
              errorMsg += 'Please try again later or check if the video is available.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          console.error('Facebook command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('❌ An error occurred while processing the Facebook video');
        }
      }
    }
  ]
};