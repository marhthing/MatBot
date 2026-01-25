import pendingActions, { shouldReact } from '../utils/pendingActions.js';

const triviaQuestions = [
  { question: "What is the capital of France?", answer: "paris", options: ["London", "Paris", "Berlin", "Madrid"] },
  { question: "What planet is known as the Red Planet?", answer: "mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
  { question: "How many continents are there?", answer: "7", options: ["5", "6", "7", "8"] },
  { question: "What is the largest ocean?", answer: "pacific", options: ["Atlantic", "Indian", "Arctic", "Pacific"] },
  { question: "What year did World War II end?", answer: "1945", options: ["1943", "1944", "1945", "1946"] },
  { question: "What is the chemical symbol for gold?", answer: "au", options: ["Ag", "Au", "Fe", "Cu"] },
  { question: "Who painted the Mona Lisa?", answer: "da vinci", options: ["Picasso", "Van Gogh", "Da Vinci", "Michelangelo"] },
  { question: "What is the largest mammal?", answer: "blue whale", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"] },
  { question: "How many bones are in the adult human body?", answer: "206", options: ["186", "196", "206", "216"] },
  { question: "What is the speed of light in km/s (approximately)?", answer: "300000", options: ["150,000", "300,000", "450,000", "600,000"] },
  { question: "What is the smallest country in the world?", answer: "vatican", options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"] },
  { question: "Which element has the atomic number 1?", answer: "hydrogen", options: ["Helium", "Hydrogen", "Oxygen", "Carbon"] },
  { question: "What is the largest planet in our solar system?", answer: "jupiter", options: ["Saturn", "Neptune", "Jupiter", "Uranus"] },
  { question: "Who wrote Romeo and Juliet?", answer: "shakespeare", options: ["Dickens", "Shakespeare", "Austen", "Hemingway"] },
  { question: "What is the hardest natural substance on Earth?", answer: "diamond", options: ["Gold", "Iron", "Diamond", "Platinum"] }
];

const wordList = [
  "apple", "beach", "cloud", "dance", "eagle", "flame", "grape", "heart", "ivory", "joker",
  "knife", "lemon", "mango", "night", "ocean", "piano", "queen", "river", "storm", "tiger",
  "unity", "vivid", "water", "xerox", "yacht", "zebra", "amber", "blaze", "coral", "daisy"
];

const emojiPuzzles = [
  { emoji: "🎬🦁👑", answer: "lion king", hint: "Disney animated movie" },
  { emoji: "🕷️🧔", answer: "spiderman", hint: "Marvel superhero" },
  { emoji: "❄️👸", answer: "frozen", hint: "Disney princess movie" },
  { emoji: "🦇🧔", answer: "batman", hint: "DC superhero" },
  { emoji: "🏠🔼", answer: "up", hint: "Pixar movie about a flying house" },
  { emoji: "🧙‍♂️💍", answer: "lord of the rings", hint: "Epic fantasy trilogy" },
  { emoji: "🚗⚡", answer: "cars", hint: "Pixar movie about racing" },
  { emoji: "🦖🌴", answer: "jurassic park", hint: "Dinosaur movie" },
  { emoji: "👻👻👻", answer: "ghostbusters", hint: "Who you gonna call?" },
  { emoji: "🧲🧔", answer: "magneto", hint: "X-Men villain" }
];

const mathProblems = [
  { question: "What is 15 + 27?", answer: "42" },
  { question: "What is 144 / 12?", answer: "12" },
  { question: "What is 8 x 7?", answer: "56" },
  { question: "What is 100 - 37?", answer: "63" },
  { question: "What is 25 x 4?", answer: "100" },
  { question: "What is 81 / 9?", answer: "9" },
  { question: "What is 17 + 28?", answer: "45" },
  { question: "What is 6 x 9?", answer: "54" },
  { question: "What is 200 - 87?", answer: "113" },
  { question: "What is 11 x 11?", answer: "121" }
];

const truthQuestions = [
  "What's your most embarrassing moment?",
  "What's your biggest fear?",
  "Who was your first crush?",
  "What's a secret you've never told anyone?",
  "What's the most childish thing you still do?",
  "What's your guilty pleasure?",
  "Have you ever lied to get out of trouble?",
  "What's the worst thing you've ever done?",
  "What's your biggest regret?",
  "Who do you secretly have a crush on?",
  "What's the most embarrassing thing in your phone?",
  "Have you ever cheated on a test?",
  "What's the meanest thing you've said about someone?",
  "What's your most irrational fear?",
  "What's the weirdest dream you've ever had?",
  "Have you ever pretended to like a gift you hated?",
  "What's something you're glad your parents don't know?",
  "Who in this group would you trust with your deepest secret?",
  "What's the most embarrassing song on your playlist?",
  "Have you ever blamed someone else for something you did?"
];

const dareActions = [
  "Send a voice note singing your favorite song",
  "Send a selfie with a silly face",
  "Text your crush 'I was thinking about you'",
  "Send the last photo in your gallery",
  "Type with your eyes closed for the next 3 messages",
  "Send 10 laughing emojis to the last person who texted you",
  "Change your status to something embarrassing for 1 hour",
  "Send a voice note of you doing your best animal impression",
  "Compliment everyone in the group chat",
  "Send a screenshot of your home screen",
  "Send the 5th photo in your gallery",
  "Record yourself doing 10 jumping jacks and send it",
  "Text your best friend 'I love you' out of nowhere",
  "Share your screen time from today",
  "Send a voice note of you rapping",
  "Post a story and tag 3 random friends",
  "Send your most used emoji 50 times",
  "Text 'I miss you' to someone you haven't talked to in months",
  "Send a voice note of you speaking in an accent",
  "Share your battery percentage and don't charge until it dies"
];

const wouldYouRatherQuestions = [
  { a: "Be able to fly", b: "Be invisible" },
  { a: "Have unlimited money", b: "Have unlimited love" },
  { a: "Live in the past", b: "Live in the future" },
  { a: "Be the smartest person", b: "Be the most attractive person" },
  { a: "Never use social media again", b: "Never watch TV again" },
  { a: "Always be 10 minutes late", b: "Always be 20 minutes early" },
  { a: "Have no phone", b: "Have no friends" },
  { a: "Only eat pizza forever", b: "Never eat pizza again" },
  { a: "Be famous", b: "Be rich" },
  { a: "Live without music", b: "Live without movies" },
  { a: "Have super strength", b: "Have super speed" },
  { a: "Read minds", b: "See the future" },
  { a: "Be a famous musician", b: "Be a famous actor" },
  { a: "Travel back in time", b: "Travel to the future" },
  { a: "Have free WiFi everywhere", b: "Have free coffee everywhere" },
  { a: "Never feel cold", b: "Never feel hot" },
  { a: "Speak all languages", b: "Talk to animals" },
  { a: "Be a kid again", b: "Be an adult now" },
  { a: "Live in space", b: "Live underwater" },
  { a: "Have a rewind button for life", b: "Have a pause button for life" }
];

const hangmanWords = [
  { word: "JAVASCRIPT", hint: "Programming language for web" },
  { word: "WHATSAPP", hint: "Messaging application" },
  { word: "ELEPHANT", hint: "Largest land animal" },
  { word: "CHOCOLATE", hint: "Sweet brown candy" },
  { word: "BUTTERFLY", hint: "Beautiful flying insect" },
  { word: "ADVENTURE", hint: "Exciting experience" },
  { word: "MOUNTAIN", hint: "Very tall landform" },
  { word: "UMBRELLA", hint: "Protection from rain" },
  { word: "DINOSAUR", hint: "Extinct giant reptile" },
  { word: "KEYBOARD", hint: "Computer input device" },
  { word: "RAINBOW", hint: "Colorful arc in the sky" },
  { word: "PENGUIN", hint: "Bird that cannot fly" },
  { word: "HOSPITAL", hint: "Place for sick people" },
  { word: "TREASURE", hint: "Hidden valuable items" },
  { word: "ASTRONAUT", hint: "Person who travels to space" },
  { word: "CROCODILE", hint: "Large reptile with big teeth" },
  { word: "FIREWORKS", hint: "Explosive colorful display" },
  { word: "PINEAPPLE", hint: "Tropical spiky fruit" },
  { word: "TELEPHONE", hint: "Device for calling" },
  { word: "SUNFLOWER", hint: "Tall yellow flower" }
];

const activeGames = {};

function renderTicTacToeBoard(board) {
  const symbols = { 0: '⬜', 1: '❌', 2: '⭕' };
  let display = '';
  for (let i = 0; i < 3; i++) {
    display += board.slice(i * 3, i * 3 + 3).map((cell, idx) => {
      if (cell === 0) return `${i * 3 + idx + 1}️⃣`;
      return symbols[cell];
    }).join('') + '\n';
  }
  return display;
}

function checkTicTacToeWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== 0)) return 'draw';
  return null;
}

function renderHangman(wrongGuesses) {
  const stages = [
    '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
    '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
  ];
  return stages[Math.min(wrongGuesses, 6)];
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function scrambleWord(word) {
  const letters = word.split('');
  let scrambled = shuffleArray(letters).join('');
  while (scrambled === word) {
    scrambled = shuffleArray(letters).join('');
  }
  return scrambled;
}

export default {
  name: 'games',
  description: 'Fun games to play in chat',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'trivia',
      aliases: ['quiz'],
      description: 'Play a trivia game',
      usage: '.trivia',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const trivia = getRandomItem(triviaQuestions);
          const shuffledOptions = shuffleArray(trivia.options);
          
          let prompt = `*Trivia Question*\n\n${trivia.question}\n\n`;
          shuffledOptions.forEach((opt, idx) => {
            prompt += `${idx + 1}. ${opt}\n`;
          });
          prompt += '\nReply with the number or answer!';
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'trivia_game',
            userId: ctx.senderId,
            data: { answer: trivia.answer, options: shuffledOptions },
            match: (text) => {
              if (typeof text !== 'string') return false;
              const clean = text.trim().toLowerCase();
              const num = parseInt(clean, 10);
              return (num >= 1 && num <= 4) || clean.length > 0;
            },
            handler: async (replyCtx, pending) => {
              const userAnswer = replyCtx.text.trim().toLowerCase();
              const num = parseInt(userAnswer, 10);
              
              let isCorrect = false;
              if (num >= 1 && num <= 4) {
                const selectedOption = pending.data.options[num - 1].toLowerCase();
                isCorrect = selectedOption.includes(pending.data.answer) || pending.data.answer.includes(selectedOption);
              } else {
                isCorrect = userAnswer.includes(pending.data.answer) || pending.data.answer.includes(userAnswer);
              }
              
              if (isCorrect) {
                await replyCtx.reply('Correct! Great job!');
                if (shouldReact()) await replyCtx.react('🎉');
              } else {
                await replyCtx.reply(`Wrong! The correct answer was: ${pending.data.answer}`);
                if (shouldReact()) await replyCtx.react('❌');
              }
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Trivia error:', error);
          await ctx.reply('An error occurred starting the trivia game.');
        }
      }
    },
    {
      name: 'scramble',
      aliases: ['unscramble', 'wordscramble'],
      description: 'Unscramble the word game',
      usage: '.scramble',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const word = getRandomItem(wordList);
          const scrambled = scrambleWord(word);
          
          const prompt = `*Word Scramble*\n\nUnscramble this word:\n\n*${scrambled.toUpperCase()}*\n\nReply with your answer!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'scramble_game',
            userId: ctx.senderId,
            data: { answer: word },
            match: (text) => typeof text === 'string' && text.trim().length > 0,
            handler: async (replyCtx, pending) => {
              const userAnswer = replyCtx.text.trim().toLowerCase();
              
              if (userAnswer === pending.data.answer) {
                await replyCtx.reply(`Correct! The word was *${pending.data.answer}*!`);
                if (shouldReact()) await replyCtx.react('🎉');
              } else {
                await replyCtx.reply(`Wrong! The correct word was: *${pending.data.answer}*`);
                if (shouldReact()) await replyCtx.react('❌');
              }
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Scramble error:', error);
          await ctx.reply('An error occurred starting the scramble game.');
        }
      }
    },
    {
      name: 'guess',
      aliases: ['numberguess', 'guessnumber'],
      description: 'Guess the number game (1-100)',
      usage: '.guess',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const number = Math.floor(Math.random() * 100) + 1;
          
          const prompt = `*Number Guessing Game*\n\nI'm thinking of a number between 1 and 100.\n\nYou have 6 attempts to guess it!\n\nReply with your first guess.`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'guess_game',
            userId: ctx.senderId,
            data: { answer: number, attempts: 0, maxAttempts: 6 },
            match: (text) => {
              if (typeof text !== 'string') return false;
              const num = parseInt(text.trim(), 10);
              return !isNaN(num) && num >= 1 && num <= 100;
            },
            handler: async (replyCtx, pending) => {
              const guess = parseInt(replyCtx.text.trim(), 10);
              pending.data.attempts++;
              
              if (guess === pending.data.answer) {
                await replyCtx.reply(`Correct! The number was *${pending.data.answer}*!\n\nYou got it in ${pending.data.attempts} attempt(s)!`);
                if (shouldReact()) await replyCtx.react('🎉');
                return true;
              }
              
              if (pending.data.attempts >= pending.data.maxAttempts) {
                await replyCtx.reply(`Game over! The number was *${pending.data.answer}*`);
                if (shouldReact()) await replyCtx.react('😢');
                return true;
              }
              
              const remaining = pending.data.maxAttempts - pending.data.attempts;
              const hint = guess < pending.data.answer ? 'higher' : 'lower';
              
              const sentMsg = await replyCtx.reply(`Try ${hint}! ${remaining} attempt(s) remaining.`);
              
              pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
                ...pending,
                match: (text) => {
                  if (typeof text !== 'string') return false;
                  const num = parseInt(text.trim(), 10);
                  return !isNaN(num) && num >= 1 && num <= 100;
                }
              });
              
              return false;
            },
            timeout: 5 * 60 * 1000
          });
          
        } catch (error) {
          console.error('Guess error:', error);
          await ctx.reply('An error occurred starting the guessing game.');
        }
      }
    },
    {
      name: 'emoji',
      aliases: ['emojiquiz', 'emojiguess'],
      description: 'Guess the movie/thing from emojis',
      usage: '.emoji',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const puzzle = getRandomItem(emojiPuzzles);
          
          const prompt = `*Emoji Puzzle*\n\nGuess what this represents:\n\n${puzzle.emoji}\n\nHint: ${puzzle.hint}\n\nReply with your answer!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'emoji_game',
            userId: ctx.senderId,
            data: { answer: puzzle.answer },
            match: (text) => typeof text === 'string' && text.trim().length > 0,
            handler: async (replyCtx, pending) => {
              const userAnswer = replyCtx.text.trim().toLowerCase();
              const correctAnswer = pending.data.answer.toLowerCase();
              
              const isCorrect = userAnswer.includes(correctAnswer) || 
                               correctAnswer.includes(userAnswer) ||
                               userAnswer.split(' ').some(word => correctAnswer.includes(word));
              
              if (isCorrect) {
                await replyCtx.reply(`Correct! The answer was *${pending.data.answer}*!`);
                if (shouldReact()) await replyCtx.react('🎉');
              } else {
                await replyCtx.reply(`Wrong! The answer was: *${pending.data.answer}*`);
                if (shouldReact()) await replyCtx.react('❌');
              }
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Emoji error:', error);
          await ctx.reply('An error occurred starting the emoji game.');
        }
      }
    },
    {
      name: 'math',
      aliases: ['mathquiz', 'calculate'],
      description: 'Quick math challenge',
      usage: '.math',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const problem = getRandomItem(mathProblems);
          
          const prompt = `*Math Challenge*\n\n${problem.question}\n\nReply with your answer! (You have 30 seconds)`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'math_game',
            userId: ctx.senderId,
            data: { answer: problem.answer },
            match: (text) => {
              if (typeof text !== 'string') return false;
              const num = parseInt(text.trim(), 10);
              return !isNaN(num);
            },
            handler: async (replyCtx, pending) => {
              const userAnswer = replyCtx.text.trim();
              
              if (userAnswer === pending.data.answer) {
                await replyCtx.reply(`Correct! Great math skills!`);
                if (shouldReact()) await replyCtx.react('🎉');
              } else {
                await replyCtx.reply(`Wrong! The answer was: ${pending.data.answer}`);
                if (shouldReact()) await replyCtx.react('❌');
              }
            },
            timeout: 30 * 1000
          });
          
        } catch (error) {
          console.error('Math error:', error);
          await ctx.reply('An error occurred starting the math game.');
        }
      }
    },
    {
      name: 'rps',
      aliases: ['rockpaperscissors'],
      description: 'Play Rock Paper Scissors',
      usage: '.rps <rock|paper|scissors>',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const choices = ['rock', 'paper', 'scissors'];
          const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
          
          const userChoice = ctx.args[0]?.toLowerCase();
          
          if (!userChoice || !choices.includes(userChoice)) {
            return await ctx.reply('Please choose: rock, paper, or scissors\n\nUsage: .rps rock');
          }
          
          const botChoice = getRandomItem(choices);
          
          let result;
          if (userChoice === botChoice) {
            result = "It's a tie!";
          } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
          ) {
            result = "You win!";
            if (shouldReact()) await ctx.react('🎉');
          } else {
            result = "You lose!";
            if (shouldReact()) await ctx.react('😢');
          }
          
          await ctx.reply(`You: ${emojis[userChoice]} ${userChoice}\nBot: ${emojis[botChoice]} ${botChoice}\n\n${result}`);
          
        } catch (error) {
          console.error('RPS error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'coinflip',
      aliases: ['flip', 'coin'],
      description: 'Flip a coin',
      usage: '.coinflip',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          if (shouldReact()) await ctx.react('🪙');
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
          const emoji = result === 'Heads' ? '👑' : '🦅';
          
          await ctx.reply(`${emoji} *${result}!*`);
          
        } catch (error) {
          console.error('Coinflip error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'dice',
      aliases: ['roll'],
      description: 'Roll dice',
      usage: '.dice [sides] [count]',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const sides = parseInt(ctx.args[0], 10) || 6;
          const count = Math.min(parseInt(ctx.args[1], 10) || 1, 10);
          
          if (sides < 2 || sides > 100) {
            return await ctx.reply('Dice must have between 2 and 100 sides.');
          }
          
          const rolls = [];
          for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
          }
          
          const total = rolls.reduce((a, b) => a + b, 0);
          
          let response = `*Rolling ${count}d${sides}*\n\n`;
          response += `Results: ${rolls.join(', ')}\n`;
          if (count > 1) {
            response += `Total: ${total}`;
          }
          
          await ctx.reply(response);
          if (shouldReact()) await ctx.react('🎲');
          
        } catch (error) {
          console.error('Dice error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: '8ball',
      aliases: ['eightball', 'magic8ball'],
      description: 'Ask the magic 8-ball',
      usage: '.8ball <question>',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const question = ctx.args.join(' ').trim();
          
          if (!question) {
            return await ctx.reply('Ask a question!\n\nUsage: .8ball Will I be rich?');
          }
          
          const responses = [
            "It is certain.",
            "It is decidedly so.",
            "Without a doubt.",
            "Yes, definitely.",
            "You may rely on it.",
            "As I see it, yes.",
            "Most likely.",
            "Outlook good.",
            "Yes.",
            "Signs point to yes.",
            "Reply hazy, try again.",
            "Ask again later.",
            "Better not tell you now.",
            "Cannot predict now.",
            "Concentrate and ask again.",
            "Don't count on it.",
            "My reply is no.",
            "My sources say no.",
            "Outlook not so good.",
            "Very doubtful."
          ];
          
          const answer = getRandomItem(responses);
          
          await ctx.reply(`*Question:* ${question}\n\n🎱 ${answer}`);
          
        } catch (error) {
          console.error('8ball error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'tictactoe',
      aliases: ['ttt', 'xo'],
      description: 'Play Tic Tac Toe with someone',
      usage: '.tictactoe @user',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: true,
      cooldown: 5,
      async execute(ctx) {
        try {
          const mentioned = ctx.mentionedJids?.[0];
          
          if (!mentioned) {
            return await ctx.reply('Tag someone to play Tic Tac Toe!\n\nUsage: .tictactoe @user');
          }
          
          if (mentioned === ctx.senderId) {
            return await ctx.reply("You can't play against yourself!");
          }
          
          const gameId = `ttt_${ctx.chatId}`;
          
          if (activeGames[gameId]) {
            return await ctx.reply('A game is already in progress in this chat! Wait for it to finish.');
          }
          
          const board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
          const player1 = ctx.senderId;
          const player2 = mentioned;
          
          activeGames[gameId] = {
            board,
            player1,
            player2,
            currentPlayer: player1,
            symbol: { [player1]: 1, [player2]: 2 }
          };
          
          const boardDisplay = renderTicTacToeBoard(board);
          const prompt = `*Tic Tac Toe*\n\n❌ @${player1.split('@')[0]}\n⭕ @${player2.split('@')[0]}\n\n${boardDisplay}\n@${player1.split('@')[0]}'s turn (❌)\n\nReply with a number (1-9) to place your mark!`;
          
          const sentMsg = await ctx._adapter.sendMessage(ctx.chatId, {
            text: prompt,
            mentions: [player1, player2]
          });
          
          const setupTurn = (msgId) => {
            pendingActions.set(ctx.chatId, msgId, {
              type: 'tictactoe_game',
              userId: activeGames[gameId]?.currentPlayer,
              data: { gameId },
              match: (text) => {
                if (typeof text !== 'string') return false;
                const num = parseInt(text.trim(), 10);
                return num >= 1 && num <= 9;
              },
              handler: async (replyCtx, pending) => {
                const game = activeGames[pending.data.gameId];
                if (!game) return;
                
                if (replyCtx.senderId !== game.currentPlayer) {
                  await replyCtx.reply("It's not your turn!");
                  return false;
                }
                
                const pos = parseInt(replyCtx.text.trim(), 10) - 1;
                
                if (game.board[pos] !== 0) {
                  await replyCtx.reply("That position is already taken! Choose another.");
                  return false;
                }
                
                game.board[pos] = game.symbol[game.currentPlayer];
                
                const winner = checkTicTacToeWinner(game.board);
                const boardDisplay = renderTicTacToeBoard(game.board);
                
                if (winner) {
                  delete activeGames[pending.data.gameId];
                  
                  if (winner === 'draw') {
                    await replyCtx._adapter.sendMessage(replyCtx.chatId, {
                      text: `*Tic Tac Toe - Game Over*\n\n${boardDisplay}\n\n🤝 It's a draw!`,
                      mentions: [game.player1, game.player2]
                    });
                  } else {
                    const winnerPlayer = winner === 1 ? game.player1 : game.player2;
                    const symbol = winner === 1 ? '❌' : '⭕';
                    await replyCtx._adapter.sendMessage(replyCtx.chatId, {
                      text: `*Tic Tac Toe - Game Over*\n\n${boardDisplay}\n\n🎉 @${winnerPlayer.split('@')[0]} (${symbol}) wins!`,
                      mentions: [winnerPlayer]
                    });
                  }
                  return true;
                }
                
                game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
                const currentSymbol = game.symbol[game.currentPlayer] === 1 ? '❌' : '⭕';
                
                const newMsg = await replyCtx._adapter.sendMessage(replyCtx.chatId, {
                  text: `*Tic Tac Toe*\n\n❌ @${game.player1.split('@')[0]}\n⭕ @${game.player2.split('@')[0]}\n\n${boardDisplay}\n@${game.currentPlayer.split('@')[0]}'s turn (${currentSymbol})\n\nReply with a number (1-9)!`,
                  mentions: [game.player1, game.player2]
                });
                
                setupTurn(newMsg.key.id);
                return false;
              },
              timeout: 3 * 60 * 1000
            });
          };
          
          setupTurn(sentMsg.key.id);
          
        } catch (error) {
          console.error('TicTacToe error:', error);
          await ctx.reply('An error occurred starting the game.');
        }
      }
    },
    {
      name: 'truthordare',
      aliases: ['tod', 'tord'],
      description: 'Play Truth or Dare',
      usage: '.truthordare',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const prompt = `*Truth or Dare*\n\nChoose your fate:\n\n1️⃣ Truth\n2️⃣ Dare\n\nReply with 1 or 2!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'truthordare_game',
            userId: ctx.senderId,
            data: {},
            match: (text) => {
              if (typeof text !== 'string') return false;
              const clean = text.trim().toLowerCase();
              return ['1', '2', 'truth', 'dare'].includes(clean);
            },
            handler: async (replyCtx, pending) => {
              const choice = replyCtx.text.trim().toLowerCase();
              const isTruth = choice === '1' || choice === 'truth';
              
              if (isTruth) {
                const truth = getRandomItem(truthQuestions);
                await replyCtx.reply(`*Truth* 🤔\n\n${truth}`);
              } else {
                const dare = getRandomItem(dareActions);
                await replyCtx.reply(`*Dare* 😈\n\n${dare}`);
              }
              
              if (shouldReact()) await replyCtx.react(isTruth ? '🤔' : '😈');
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Truth or Dare error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'truth',
      aliases: [],
      description: 'Get a random truth question',
      usage: '.truth',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const truth = getRandomItem(truthQuestions);
          await ctx.reply(`*Truth* 🤔\n\n${truth}`);
        } catch (error) {
          console.error('Truth error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'dare',
      aliases: [],
      description: 'Get a random dare',
      usage: '.dare',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const dare = getRandomItem(dareActions);
          await ctx.reply(`*Dare* 😈\n\n${dare}`);
        } catch (error) {
          console.error('Dare error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'hangman',
      aliases: ['wordguess', 'guessword'],
      description: 'Play Hangman word guessing game',
      usage: '.hangman',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const puzzle = getRandomItem(hangmanWords);
          const word = puzzle.word;
          const guessedLetters = [];
          const wrongGuesses = 0;
          const maxWrong = 6;
          
          const getDisplayWord = (w, guessed) => {
            return w.split('').map(letter => guessed.includes(letter) ? letter : '_').join(' ');
          };
          
          const displayWord = getDisplayWord(word, guessedLetters);
          const hangmanArt = renderHangman(wrongGuesses);
          
          const prompt = `*Hangman*\n\n${hangmanArt}\n\n*Word:* ${displayWord}\n\n*Hint:* ${puzzle.hint}\n\n*Guessed:* None yet\n*Wrong:* 0/${maxWrong}\n\nReply with a letter or guess the full word!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          const setupGuess = (msgId, gameData) => {
            pendingActions.set(ctx.chatId, msgId, {
              type: 'hangman_game',
              userId: ctx.senderId,
              data: gameData,
              match: (text) => {
                if (typeof text !== 'string') return false;
                const clean = text.trim().toUpperCase();
                return clean.length >= 1;
              },
              handler: async (replyCtx, pending) => {
                const input = replyCtx.text.trim().toUpperCase();
                const data = pending.data;
                
                if (input.length > 1) {
                  if (input === data.word) {
                    await replyCtx.reply(`*Hangman - You Win!* 🎉\n\nThe word was: *${data.word}*\n\nCongratulations!`);
                    if (shouldReact()) await replyCtx.react('🎉');
                    return true;
                  } else {
                    data.wrongGuesses++;
                    if (data.wrongGuesses >= data.maxWrong) {
                      const finalArt = renderHangman(data.wrongGuesses);
                      await replyCtx.reply(`*Hangman - Game Over* 💀\n\n${finalArt}\n\nThe word was: *${data.word}*`);
                      if (shouldReact()) await replyCtx.react('💀');
                      return true;
                    }
                    
                    const displayWord = getDisplayWord(data.word, data.guessedLetters);
                    const hangmanArt = renderHangman(data.wrongGuesses);
                    
                    const newMsg = await replyCtx.reply(`*Hangman*\n\n${hangmanArt}\n\n*Word:* ${displayWord}\n\n*Hint:* ${data.hint}\n\n*Guessed:* ${data.guessedLetters.join(', ') || 'None'}\n*Wrong:* ${data.wrongGuesses}/${data.maxWrong}\n\n❌ Wrong guess! Try again.`);
                    setupGuess(newMsg.key.id, data);
                    return false;
                  }
                }
                
                const letter = input[0];
                
                if (data.guessedLetters.includes(letter)) {
                  const displayWord = getDisplayWord(data.word, data.guessedLetters);
                  const hangmanArt = renderHangman(data.wrongGuesses);
                  const newMsg = await replyCtx.reply(`*Hangman*\n\n${hangmanArt}\n\n*Word:* ${displayWord}\n\n*Hint:* ${data.hint}\n\n*Guessed:* ${data.guessedLetters.join(', ')}\n*Wrong:* ${data.wrongGuesses}/${data.maxWrong}\n\n⚠️ Already guessed! Try another letter.`);
                  setupGuess(newMsg.key.id, data);
                  return false;
                }
                
                data.guessedLetters.push(letter);
                
                if (!data.word.includes(letter)) {
                  data.wrongGuesses++;
                }
                
                const displayWord = getDisplayWord(data.word, data.guessedLetters);
                const hangmanArt = renderHangman(data.wrongGuesses);
                
                if (!displayWord.includes('_')) {
                  await replyCtx.reply(`*Hangman - You Win!* 🎉\n\n${hangmanArt}\n\nThe word was: *${data.word}*\n\nCongratulations!`);
                  if (shouldReact()) await replyCtx.react('🎉');
                  return true;
                }
                
                if (data.wrongGuesses >= data.maxWrong) {
                  await replyCtx.reply(`*Hangman - Game Over* 💀\n\n${hangmanArt}\n\nThe word was: *${data.word}*`);
                  if (shouldReact()) await replyCtx.react('💀');
                  return true;
                }
                
                const wasCorrect = data.word.includes(letter);
                const newMsg = await replyCtx.reply(`*Hangman*\n\n${hangmanArt}\n\n*Word:* ${displayWord}\n\n*Hint:* ${data.hint}\n\n*Guessed:* ${data.guessedLetters.join(', ')}\n*Wrong:* ${data.wrongGuesses}/${data.maxWrong}\n\n${wasCorrect ? '✅ Correct!' : '❌ Wrong!'} Keep guessing!`);
                setupGuess(newMsg.key.id, data);
                return false;
              },
              timeout: 5 * 60 * 1000
            });
          };
          
          setupGuess(sentMsg.key.id, {
            word,
            hint: puzzle.hint,
            guessedLetters,
            wrongGuesses,
            maxWrong
          });
          
        } catch (error) {
          console.error('Hangman error:', error);
          await ctx.reply('An error occurred starting the game.');
        }
      }
    },
    {
      name: 'wyr',
      aliases: ['wouldyourather', 'rather'],
      description: 'Would You Rather game',
      usage: '.wyr',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const question = getRandomItem(wouldYouRatherQuestions);
          
          const prompt = `*Would You Rather?* 🤔\n\n🅰️ ${question.a}\n\n*OR*\n\n🅱️ ${question.b}\n\nReply with A or B!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'wyr_game',
            userId: ctx.senderId,
            data: { question },
            match: (text) => {
              if (typeof text !== 'string') return false;
              const clean = text.trim().toLowerCase();
              return ['a', 'b', '1', '2'].includes(clean);
            },
            handler: async (replyCtx, pending) => {
              const choice = replyCtx.text.trim().toLowerCase();
              const isA = choice === 'a' || choice === '1';
              const chosen = isA ? pending.data.question.a : pending.data.question.b;
              
              await replyCtx.reply(`You chose: *${chosen}*\n\nInteresting choice! 🧐`);
              if (shouldReact()) await replyCtx.react(isA ? '🅰️' : '🅱️');
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('WYR error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'akinator',
      aliases: ['aki'],
      description: 'Play 20 questions style guessing game',
      usage: '.akinator',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const prompt = `*20 Questions* 🧞\n\nThink of something (person, animal, object)!\n\nI'll try to guess it in 20 questions.\n\nReply *ready* when you have something in mind!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          const questions = [
            "Is it alive or was it ever alive?",
            "Is it a person?",
            "Is it an animal?",
            "Is it bigger than a car?",
            "Can you hold it in your hand?",
            "Is it found indoors?",
            "Is it used for entertainment?",
            "Is it electronic?",
            "Is it edible?",
            "Is it famous worldwide?",
            "Is it made of metal?",
            "Can it move on its own?",
            "Is it colorful?",
            "Is it found in nature?",
            "Is it expensive?",
            "Do most people own one?",
            "Is it soft?",
            "Can you see it every day?",
            "Is it used for work?",
            "Is it related to sports?"
          ];
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'akinator_start',
            userId: ctx.senderId,
            data: { questionIndex: 0, answers: [] },
            match: (text) => {
              if (typeof text !== 'string') return false;
              return text.trim().toLowerCase() === 'ready';
            },
            handler: async (replyCtx, pending) => {
              const setupQuestion = async (msgId, data) => {
                pendingActions.set(replyCtx.chatId, msgId, {
                  type: 'akinator_game',
                  userId: ctx.senderId,
                  data,
                  match: (text) => {
                    if (typeof text !== 'string') return false;
                    const clean = text.trim().toLowerCase();
                    return ['yes', 'no', 'y', 'n', 'maybe', 'idk'].includes(clean);
                  },
                  handler: async (answerCtx, qPending) => {
                    const answer = answerCtx.text.trim().toLowerCase();
                    qPending.data.answers.push(answer);
                    qPending.data.questionIndex++;
                    
                    if (qPending.data.questionIndex >= 10) {
                      const guesses = [
                        "A smartphone",
                        "A dog",
                        "A famous singer",
                        "A video game",
                        "A book",
                        "The sun",
                        "A car",
                        "Pizza",
                        "A celebrity",
                        "A computer"
                      ];
                      const guess = getRandomItem(guesses);
                      await answerCtx.reply(`*My Guess* 🎯\n\nIs it... *${guess}*?\n\nReply *yes* if I'm right, *no* if I'm wrong!`);
                      return true;
                    }
                    
                    const nextQ = questions[qPending.data.questionIndex];
                    const newMsg = await answerCtx.reply(`*Question ${qPending.data.questionIndex + 1}/10* 🤔\n\n${nextQ}\n\nReply: yes / no / maybe`);
                    setupQuestion(newMsg.key.id, qPending.data);
                    return false;
                  },
                  timeout: 2 * 60 * 1000
                });
              };
              
              const firstQ = questions[0];
              const newMsg = await replyCtx.reply(`*Question 1/10* 🤔\n\n${firstQ}\n\nReply: yes / no / maybe`);
              setupQuestion(newMsg.key.id, pending.data);
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Akinator error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    }
  ]
};
