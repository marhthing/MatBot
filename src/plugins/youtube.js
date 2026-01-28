import youtubedl from 'youtube-dl-exec';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const execAsync = promisify(exec);
const VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
const VIDEO_MEDIA_LIMIT = 30 * 1024 * 1024;
const AUDIO_SIZE_LIMIT = 100 * 1024 * 1024;

(async () => {
  try {
    await execAsync('yt-dlp -U 2>/dev/null || pip install --upgrade yt-dlp 2>/dev/null || true');
  } catch (e) {}
})();

function generateUniqueFilename(prefix = 'yt', extension = 'mp4') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

function validateYouTubeUrl(url) {
  const ytIdExtractRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  if (!url || typeof url !== 'string') return null;
  
  const cleanUrl = url.trim().replace(/[;&|`$(){}\[\]"'\\]/g, '');
  
  try {
    const urlObj = new URL(cleanUrl);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(urlObj.hostname)) {
      return null;
    }
    
    const match = ytIdExtractRegex.exec(cleanUrl);
    if (match && match[1]) {
      return {
        url: cleanUrl,
        videoId: match[1]
      };
    }
  } catch {
    return null;
  }
  
  return null;
}

function extractYouTubeUrlFromObject(obj) {
  const ytUrlRegex = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i;
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const match = obj[key].match(ytUrlRegex);
      if (match) return match[0];
    } else if (typeof obj[key] === 'object') {
      const found = extractYouTubeUrlFromObject(obj[key]);
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

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(count) {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

const commonOptions = {
  noWarnings: true,
  noCheckCertificates: true,
  preferFreeFormats: true,
  noPlaylist: true,
  retries: 3,
  socketTimeout: 30,
  addHeader: [
    'referer:youtube.com',
    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'accept-language:en-US,en;q=0.9'
  ]
};

async function getVideoFormats(url) {
  const info = await youtubedl(url, {
    ...commonOptions,
    dumpSingleJson: true
  });
  
  const formats = [];
  const seenQualities = new Set();
  
  if (info.formats) {
    for (const format of info.formats) {
      if (format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none') {
        const height = format.height || 0;
        let quality = '';
        
        if (height >= 1080) quality = '1080p';
        else if (height >= 720) quality = '720p';
        else if (height >= 480) quality = '480p';
        else if (height >= 360) quality = '360p';
        else if (height >= 240) quality = '240p';
        else if (height > 0) quality = `${height}p`;
        
        if (quality && !seenQualities.has(quality)) {
          seenQualities.add(quality);
          const size = format.filesize || format.filesize_approx || 0;
          formats.push({
            quality,
            height,
            format_id: format.format_id,
            size,
            formatString: `best[height<=${height}][ext=mp4]/bestvideo[height<=${height}]+bestaudio/best[ext=mp4]/best`
          });
        }
      }
    }
    
    if (formats.length === 0) {
      for (const format of info.formats) {
        if (format.vcodec && format.vcodec !== 'none') {
          const height = format.height || 0;
          let quality = '';
          
          if (height >= 1080) quality = '1080p';
          else if (height >= 720) quality = '720p';
          else if (height >= 480) quality = '480p';
          else if (height >= 360) quality = '360p';
          else if (height >= 240) quality = '240p';
          else if (height > 0) quality = `${height}p`;
          
          if (quality && !seenQualities.has(quality)) {
            seenQualities.add(quality);
            const size = format.filesize || format.filesize_approx || 0;
            formats.push({
              quality,
              height,
              format_id: format.format_id,
              size,
              formatString: `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
            });
          }
        }
      }
    }
  }
  
  formats.sort((a, b) => b.height - a.height);
  
  return {
    formats: formats.slice(0, 5),
    title: info.title,
    duration: info.duration
  };
}

async function downloadVideoWithFormat(url, formatString, tempDir) {
  const uniqueFilename = generateUniqueFilename('yt_video', 'mp4');
  const outputPath = path.join(tempDir, uniqueFilename);
  
  try {
    await youtubedl(url, {
      output: outputPath,
      format: formatString,
      mergeOutputFormat: 'mp4',
      ...commonOptions
    });

    if (await fs.pathExists(outputPath)) {
      const stats = await fs.stat(outputPath);
      
      if (stats.size > VIDEO_SIZE_LIMIT) {
        await fs.unlink(outputPath).catch(() => {});
        throw new Error(`Video too large (${formatFileSize(stats.size)}). WhatsApp limit is 2GB.`);
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

async function downloadAudioWithYtDlp(url, tempDir) {
  const uniqueFilename = generateUniqueFilename('yt_audio', 'm4a');
  const outputPath = path.join(tempDir, uniqueFilename);
  
  try {
    const info = await youtubedl(url, {
      ...commonOptions,
      dumpSingleJson: true
    });

    await youtubedl(url, {
      output: outputPath,
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: 0,
      ...commonOptions
    });

    if (await fs.pathExists(outputPath)) {
      const stats = await fs.stat(outputPath);
      
      if (stats.size > AUDIO_SIZE_LIMIT) {
        await fs.unlink(outputPath).catch(() => {});
        throw new Error(`Audio too large (${formatFileSize(stats.size)}). WhatsApp limit is 100MB.`);
      }
      
      return {
        path: outputPath,
        size: stats.size,
        title: info.title || 'audio'
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
  name: 'youtube',
  description: 'YouTube video and audio downloader with quality selection',
  version: '2.1.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'ytv',
      aliases: ['ytvideo', 'yt'],
      description: 'Download YouTube video with quality selection',
      usage: '.ytv <url>',
      category: 'download',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 15,
      async execute(ctx) {
        try {
          let url = ctx.args.join(' ').trim();
          
          if (!url) {
            const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMessage) {
              url = extractYouTubeUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a YouTube URL\n\nUsage: .ytv <url>');
          }

          const validatedUrl = validateYouTubeUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid YouTube URL');
          }

          const tempDir = path.join(process.cwd(), 'tmp');
          await fs.ensureDir(tempDir);

          if (shouldReact()) await ctx.react('⏳');

          try {
            const { formats, title, duration } = await getVideoFormats(validatedUrl.url);
            
            if (formats.length === 0) {
              const result = await downloadVideoWithFormat(validatedUrl.url, 'best[ext=mp4]/best', tempDir);
              const videoBuffer = await fs.readFile(result.path);
              
              if (result.isLarge) {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: title || 'YouTube video'
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

            const qualities = formats.map((f, idx) => ({
              label: `${idx + 1} - ${f.quality}${f.size ? ` (${formatFileSize(f.size)})` : ''}`,
              formatString: f.formatString,
              quality: f.quality
            }));

            if (qualities.length === 1) {
              const result = await downloadVideoWithFormat(validatedUrl.url, qualities[0].formatString, tempDir);
              const videoBuffer = await fs.readFile(result.path);
              
              if (result.isLarge) {
                await ctx._adapter.sendMedia(ctx.chatId, videoBuffer, {
                  type: 'document',
                  mimetype: 'video/mp4',
                  caption: title || 'YouTube video'
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

            let prompt = `*${title}*\n`;
            if (duration) prompt += `Duration: ${formatDuration(duration)}\n\n`;
            prompt += 'Select video quality by replying with the number:\n';
            prompt += qualities.map(q => q.label).join('\n');
            
            const sentMsg = await ctx.reply(prompt);
            
            pendingActions.set(ctx.chatId, sentMsg.key.id, {
              type: 'youtube_quality',
              userId: ctx.senderId,
              data: { qualities, url: validatedUrl.url, tempDir, title },
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
                  const result = await downloadVideoWithFormat(pending.data.url, selected.formatString, pending.data.tempDir);
                  const videoBuffer = await fs.readFile(result.path);
                  
                  if (result.isLarge) {
                    await replyCtx._adapter.sendMedia(replyCtx.chatId, videoBuffer, {
                      type: 'document',
                      mimetype: 'video/mp4',
                      caption: pending.data.title || 'YouTube video'
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
                  
                  let errorMsg = 'Failed to download selected quality.';
                  if (error.message?.includes('too large')) {
                    errorMsg = error.message;
                  }
                  await replyCtx.reply(errorMsg);
                }
              },
              timeout: 10 * 60 * 1000
            });
            
            if (shouldReact()) await ctx.react('');

          } catch (error) {
            if (shouldReact()) await ctx.react('❌');
            
            let errorMsg = 'Download failed. ';
            if (error.message?.includes('private')) {
              errorMsg += 'Video is private or unavailable.';
            } else if (error.message?.includes('age')) {
              errorMsg += 'Video is age-restricted.';
            } else if (error.message?.includes('too large')) {
              errorMsg += error.message;
            } else {
              errorMsg += 'Please try again later.';
            }
            
            await ctx.reply(errorMsg);
          }

        } catch (error) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the video');
        }
      }
    },
    {
      name: 'yta',
      aliases: ['ytaudio', 'ytmp3'],
      description: 'Download YouTube audio',
      usage: '.yta <url>',
      category: 'download',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 15,
      async execute(ctx) {
        try {
          let url = ctx.args.join(' ').trim();
          
          if (!url) {
            const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMessage) {
              url = extractYouTubeUrlFromObject(quotedMessage) || '';
            }
          }
          
          if (!url) {
            return await ctx.reply('Please provide a YouTube URL\n\nUsage: .yta <url>');
          }

          const validatedUrl = validateYouTubeUrl(url);
          if (!validatedUrl) {
            return await ctx.reply('Please provide a valid YouTube URL');
          }

          const tempDir = path.join(process.cwd(), 'tmp');
          await fs.ensureDir(tempDir);

          if (shouldReact()) await ctx.react('⏳');

          try {
            const result = await downloadAudioWithYtDlp(validatedUrl.url, tempDir);
            
            const audioBuffer = await fs.readFile(result.path);
            
            await ctx._adapter.sendMedia(ctx.chatId, audioBuffer, {
              type: 'audio',
              mimetype: 'audio/mp4'
            });

            if (shouldReact()) await ctx.react('✅');
            await fs.unlink(result.path).catch(() => {});

          } catch (error) {
            if (shouldReact()) await ctx.react('❌');
            await ctx.reply(`Failed to download audio: ${error.message}`);
          }

        } catch (error) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while processing the audio');
        }
      }
    },
    {
      name: 'yts',
      aliases: ['ytsearch'],
      description: 'Search YouTube videos',
      usage: '.yts <search term>',
      category: 'download',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          const query = ctx.args.join(' ').trim();
          
          if (!query) {
            return await ctx.reply('Please provide a search term\n\nUsage: .yts <search term>');
          }

          if (shouldReact()) await ctx.react('🔍');

          try {
            const results = await youtubedl(`ytsearch5:${query}`, {
              dumpSingleJson: true,
              noWarnings: true,
              flatPlaylist: true
            });

            if (!results || !results.entries || results.entries.length === 0) {
              if (shouldReact()) await ctx.react('❌');
              return await ctx.reply('No videos found for your search');
            }

            let resultText = `*Search Results for "${query}":*\n\n`;
            
            results.entries.slice(0, 5).forEach((video, index) => {
              const duration = video.duration ? formatDuration(video.duration) : 'Unknown';
              const views = video.view_count ? formatViews(video.view_count) : 'No views';
              const url = `https://www.youtube.com/watch?v=${video.id}`;
              
              resultText += `*${index + 1}.* ${video.title}\n`;
              resultText += `${video.uploader || 'Unknown'}\n`;
              resultText += `${duration} | ${views}\n`;
              resultText += `${url}\n\n`;
            });

            resultText += `Use .ytv <url> to download video\n`;
            resultText += `Use .yta <url> to download audio`;

            await ctx.reply(resultText);
            if (shouldReact()) await ctx.react('');

          } catch (error) {
            if (shouldReact()) await ctx.react('❌');
            await ctx.reply('Search failed. Please try again later.');
          }

        } catch (error) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('An error occurred while searching');
        }
      }
    }
  ]
};
