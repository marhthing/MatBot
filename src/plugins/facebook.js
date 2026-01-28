import fbDownloader from '@mrnima/facebook-downloader';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const { facebook } = fbDownloader;

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

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
    maxContentLength: 100 * 1024 * 1024,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Referer': 'https://www.facebook.com/'
    }
  });
  return Buffer.from(response.data);
}

async function fetchWithMrnima(url) {
  try {
    const result = await facebook(url);
    
    if (!result || !result.status || !result.result) {
      return null;
    }
    
    const data = result.result;
    const links = [];
    
    if (data.links) {
      if (data.links.HD) {
        links.push({ quality: 'HD', url: data.links.HD, format: 'mp4' });
      }
      if (data.links.SD) {
        links.push({ quality: 'SD', url: data.links.SD, format: 'mp4' });
      }
    }
    
    if (links.length === 0) return null;
    
    return {
      title: 'Facebook Video',
      thumbnail: data.thumbnail || '',
      duration: data.duration || '',
      links,
      source: '@mrnima/facebook-downloader'
    };
  } catch (error) {
    // console.log('[FB] @mrnima/facebook-downloader failed:', error.message);
    return null;
  }
}

async function fetchFromFDownloader(url, timeout = 60000) {
  try {
    const endpoint = 'https://v3.fdownloader.net/api/ajaxSearch?lang=en';
    
    const response = await axios.post(
      endpoint,
      new URLSearchParams({
        k_exp: '',
        k_token: '',
        q: url,
        lang: 'en',
        web: 'fdownloader.net',
        v: 'v2',
        w: ''
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': getRandomUserAgent(),
          'Accept': '*/*',
          'Origin': 'https://fdownloader.net',
          'Referer': 'https://fdownloader.net/'
        },
        timeout
      }
    );

    if (!response.data?.data) {
      return null;
    }

    const $ = cheerio.load(response.data.data);
    const links = [];

    $('a.btn').each((_, el) => {
      const href = $(el).attr('href');
      const title = $(el).attr('title') || $(el).text().trim();
      
      if (href && href.startsWith('http')) {
        let quality = 'SD';
        if (title.toLowerCase().includes('hd') || title.toLowerCase().includes('720')) {
          quality = 'HD';
        } else if (title.toLowerCase().includes('sd') || title.toLowerCase().includes('360')) {
          quality = 'SD';
        } else if (title.toLowerCase().includes('audio')) {
          quality = 'Audio';
        }
        
        links.push({ quality, url: href, format: quality === 'Audio' ? 'mp3' : 'mp4' });
      }
    });

    if (links.length === 0) return null;

    const title = $('.lib-title').text().trim() || 'Facebook Video';
    const thumbnail = $('.lib-thumbnail img').attr('src') || '';
    const duration = $('.lib-time').text().trim() || '';

    return { title, thumbnail, duration, links, source: 'fdownloader.net' };
  } catch (error) {
    // console.log('[FB] fdownloader.net failed:', error.message);
    return null;
  }
}

async function fetchFromGetFvid(url, timeout = 60000) {
  try {
    const response = await axios.get(`https://www.getfvid.com/downloader`, {
      params: { url },
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.getfvid.com/'
      },
      timeout
    });

    const $ = cheerio.load(response.data);
    const links = [];

    $('a.btn-download').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().toLowerCase();
      
      if (href && href.includes('fbcdn')) {
        let quality = 'SD';
        if (text.includes('hd')) quality = 'HD';
        else if (text.includes('sd')) quality = 'SD';
        
        links.push({ quality, url: href, format: 'mp4' });
      }
    });

    if (links.length === 0) return null;

    return { title: 'Facebook Video', links, source: 'getfvid.com' };
  } catch (error) {
    // console.log('[FB] getfvid.com failed:', error.message);
    return null;
  }
}

export default {
  name: 'facebook',
  description: 'Facebook video downloader with quality selection',
  version: '2.1.0',
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

          if (shouldReact()) await ctx.react('⏳');

          let videoData = null;
          const methods = [
            { name: '@mrnima/facebook-downloader', fn: () => fetchWithMrnima(url) },
            { name: 'fdownloader.net', fn: () => fetchFromFDownloader(url) },
            { name: 'getfvid.com', fn: () => fetchFromGetFvid(url) }
          ];

          for (const method of methods) {
            try {
              // console.log(`[FB] Trying ${method.name}...`);
              const result = await method.fn();
              
              if (result && result.links && result.links.length > 0) {
                // console.log(`[FB] ${method.name} succeeded with ${result.links.length} links`);
                videoData = result;
                break;
              }
            } catch (error) {
              // console.log(`[FB] ${method.name} failed:`, error.message);
            }
          }

          if (!videoData || !videoData.links || videoData.links.length === 0) {
            if (shouldReact()) await ctx.react('❌');
            return await ctx.reply('Could not extract video. The video might be private, unavailable, or the link format is not supported.');
          }

          const qualities = [];
          let idx = 1;

          for (const link of videoData.links) {
            const size = await getFileSize(link.url);
            qualities.push({
              label: `${idx} - ${link.quality}${size ? ` (${formatFileSize(size)})` : ''}`,
              url: link.url,
              quality: link.quality,
              format: link.format
            });
            idx++;
          }

          if (qualities.length === 1) {
            const quality = qualities[0];
            try {
              const videoBuffer = await downloadMediaToBuffer(quality.url);
              const size = videoBuffer.length;
              
              if (size > VIDEO_SIZE_LIMIT) {
                if (shouldReact()) await ctx.react('❌');
                return await ctx.reply(`Video too large (${formatFileSize(size)}). Limit is 100MB.`);
              }
              
              if (quality.format === 'mp3') {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'audio',
                  mimetype: 'audio/mpeg'
                });
              } else if (size > VIDEO_MEDIA_LIMIT) {
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
            } catch (error) {
              // console.error('[FB] Download failed:', error);
              if (shouldReact()) await ctx.react('❌');
              await ctx.reply('Failed to download video. Please try again.');
            }
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
            data: { qualities, videoData },
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
                  return await replyCtx.reply(`Video too large (${formatFileSize(size)}). Limit is 100MB.`);
                }
                
                if (selected.format === 'mp3') {
                  await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                    type: 'audio',
                    mimetype: 'audio/mpeg'
                  });
                } else if (size > VIDEO_MEDIA_LIMIT) {
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
              } catch (error) {
                // console.error('[FB] Download error:', error);
                if (shouldReact()) await replyCtx.react('❌');
                await replyCtx.reply('Failed to download selected quality. Please try again.');
              }
            },
            timeout: 10 * 60 * 1000
          });
          
          if (shouldReact()) await ctx.react('');

        } catch (error) {
          // console.error('[FB] Command error:', error);
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the Facebook video. Please try again.');
        }
      }
    }
  ]
};
