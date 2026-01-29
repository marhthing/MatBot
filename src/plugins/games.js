import pendingActions, { shouldReact } from '../utils/pendingActions.js';
import ai from '../utils/ai.js';

const triviaQuestions = [
  { question: "What is the capital of France?", answer: "paris", options: ["London", "Paris", "Berlin", "Madrid"] },
  { question: "What planet is known as the Red Planet?", answer: "mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] }
];

const wordList = [
  "apple", "beach"
];

const emojiPuzzles = [
  { emoji: "🎬🦁👑", answer: "lion king", hint: "Disney animated movie" },
  { emoji: "🕷️🧔", answer: "spiderman", hint: "Marvel superhero" }
];

const mathProblems = [
  { question: "What is 15 + 27?", answer: "42" },
  { question: "What is 144 / 12?", answer: "12" }
];

const truthQuestions = [
  "What's your most embarrassing moment?",
  "What's your biggest fear?"
];

const dareActions = [
  "Send a voice note singing your favorite song",
  "Send a selfie with a silly face"
];

const wouldYouRatherQuestions = [
  { a: "Be able to fly", b: "Be invisible" },
  { a: "Have unlimited money", b: "Have unlimited love" }
];

const hangmanWords = [
  { word: "JAVASCRIPT", hint: "Programming language for web" },
  { word: "WHATSAPP", hint: "Messaging application" }
];

const riddles = [
  { riddle: "What has keys but no locks?", answer: "piano", hint: "Musical instrument" },
  { riddle: "What has hands but can't clap?", answer: "clock", hint: "Tells time" }
];

const capitals = [
  { country: "Germany", capital: "Berlin" },
  { country: "Italy", capital: "Rome" }
];

const flagQuiz = [
  { emoji: "🇺🇸", answer: "usa", alt: ["united states", "america"] },
  { emoji: "🇬🇧", answer: "uk", alt: ["united kingdom", "britain", "england"] }
];

const typingChallenges = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs"
];

// Helper functions
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderTicTacToeBoard(board) {
  const symbols = board.map(v => v === 0 ? '⬜' : (v === 1 ? '❌' : '⭕'));
  return `1️⃣ ${symbols[0]} | 2️⃣ ${symbols[1]} | 3️⃣ ${symbols[2]}\n4️⃣ ${symbols[3]} | 5️⃣ ${symbols[4]} | 6️⃣ ${symbols[5]}\n7️⃣ ${symbols[6]} | 8️⃣ ${symbols[7]} | 9️⃣ ${symbols[8]}`;
}

function checkTicTacToeWinner(board) {
  const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of wins) {
    if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.includes(0) ? null : 'draw';
}

function renderHangman(wrong) {
  const stages = [
    '   +---+\n   |   |\n       |\n       |\n       |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n       |\n       |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n   |   |\n       |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n  /|   |\n       |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n       |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  /    |\n       |\n=========',
    '   +---+\n   |   |\n   O   |\n  /|\\  |\n  / \\  |\n       |\n========='
  ];
  return '```' + stages[wrong] + '```';
}

export default [
  {
    name: 'trivia',
    aliases: ['quiz'],
    description: 'Play a trivia game',
    usage: '.trivia',
    category: 'games',
    execute: async (ctx) => {
      const q = getRandomItem(triviaQuestions);
      const options = q.options.join('\n• ');
      const sent = await ctx.reply(`*🧠 Trivia Quiz*\n\n${q.question}\n\n• ${options}\n\nReply with the answer!`);
      pendingActions.set(ctx.chatId, sent.key.id, {
        type: 'trivia',
        userId: ctx.senderId,
        data: { answer: q.answer },
        match: (text) => text.toLowerCase().includes(q.answer),
        handler: async (replyCtx) => {
          await replyCtx.reply('✅ Correct!');
          if (shouldReact()) await replyCtx.react('🎉');
        }
      });
    }
  },
  {
    name: '8ball',
    aliases: ['magic8'],
    description: 'Ask the magic 8-ball',
    usage: '.8ball <question>',
    category: 'games',
    execute: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply('Please ask a question!');
      const responses = ['Yes', 'No', 'Maybe', 'Certainly', 'Never'];
      await ctx.reply(`🎱 *Magic 8-Ball*\n\n❓ ${ctx.args.join(' ')}\n\n${getRandomItem(responses)}`);
    }
  },
  {
    name: 'truthordare',
    aliases: ['tod'],
    description: 'Play Truth or Dare',
    usage: '.truthordare',
    category: 'games',
    execute: async (ctx) => {
      const sent = await ctx.reply('*🎭 Truth or Dare*\n\nReply with *truth* or *dare*');
      pendingActions.set(ctx.chatId, sent.key.id, {
        type: 'tod',
        userId: ctx.senderId,
        match: (text) => ['truth', 'dare'].includes(text.toLowerCase()),
        handler: async (replyCtx) => {
          const isTruth = replyCtx.text.toLowerCase() === 'truth';
          const list = isTruth ? truthQuestions : dareActions;
          await replyCtx.reply(`*${isTruth ? '🤔 Truth' : '😈 Dare'}*\n\n${getRandomItem(list)}`);
        }
      });
    }
  },
  {
    name: 'tictactoe',
    aliases: ['ttt'],
    description: 'Play Tic-Tac-Toe',
    usage: '.tictactoe',
    category: 'games',
    execute: async (ctx) => {
      const board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      const sent = await ctx.reply(`*⭕❌ Tic-Tac-Toe*\n\n${renderTicTacToeBoard(board)}\n\nReply with a number (1-9) to place your X!`);
      pendingActions.set(ctx.chatId, sent.key.id, {
        type: 'ttt',
        userId: ctx.senderId,
        data: { board },
        match: (text) => /^[1-9]$/.test(text),
        handler: async (replyCtx, pending) => {
          const pos = parseInt(replyCtx.text) - 1;
          if (pending.data.board[pos] !== 0) {
            await replyCtx.reply('Spot taken!');
            return false;
          }
          pending.data.board[pos] = 1;
          let winner = checkTicTacToeWinner(pending.data.board);
          if (winner) {
            await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n${winner === 'draw' ? 'Draw!' : 'You win!'}`);
            return true;
          }
          const avail = pending.data.board.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
          pending.data.board[getRandomItem(avail)] = 2;
          winner = checkTicTacToeWinner(pending.data.board);
          if (winner) {
            await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n${winner === 'draw' ? 'Draw!' : 'I win!'}`);
            return true;
          }
          const next = await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\nYour turn!`);
          pendingActions.set(replyCtx.chatId, next.key.id, pending);
          return false;
        }
      });
    }
  },
  {
    name: 'hangman',
    aliases: ['hang'],
    description: 'Play Hangman',
    usage: '.hangman',
    category: 'games',
    execute: async (ctx) => {
      const item = getRandomItem(hangmanWords);
      const data = { word: item.word, guessed: [], wrong: 0, hint: item.hint };
      const display = data.word.split('').map(() => '_').join(' ');
      const sent = await ctx.reply(`*🎮 Hangman*\n\n${renderHangman(0)}\n\nWord: ${display}\nHint: ${data.hint}\n\nGuess a letter!`);
      const handler = async (replyCtx, pending) => {
        const char = replyCtx.text.toUpperCase();
        if (pending.data.guessed.includes(char)) return false;
        pending.data.guessed.push(char);
        if (!pending.data.word.includes(char)) pending.data.wrong++;
        const current = pending.data.word.split('').map(l => pending.data.guessed.includes(l) ? l : '_').join(' ');
        if (pending.data.wrong >= 6) {
          await replyCtx.reply(`💀 Game Over! Word: ${pending.data.word}`);
          return true;
        }
        if (!current.includes('_')) {
          await replyCtx.reply(`🎉 You win! Word: ${pending.data.word}`);
          return true;
        }
        const next = await replyCtx.reply(`${renderHangman(pending.data.wrong)}\n\nWord: ${current}\nGuessed: ${pending.data.guessed.join(', ')}`);
        pendingActions.set(replyCtx.chatId, next.key.id, pending);
        return false;
      };
      pendingActions.set(ctx.chatId, sent.key.id, { type: 'hangman', userId: ctx.senderId, data, match: (t) => /^[a-zA-Z]$/.test(t), handler });
    }
  },
  {
    name: 'wyr',
    aliases: ['wouldyourather'],
    description: 'Would You Rather',
    usage: '.wyr',
    category: 'games',
    execute: async (ctx) => {
      const q = getRandomItem(wouldYouRatherQuestions);
      await ctx.reply(`*🤔 Would You Rather*\n\n🅰️ ${q.a}\n\nor\n\n🅱️ ${q.b}`);
    }
  },
  {
    name: 'riddle',
    description: 'Solve a riddle',
    usage: '.riddle',
    category: 'games',
    execute: async (ctx) => {
      const r = getRandomItem(riddles);
      const sent = await ctx.reply(`*🧩 Riddle*\n\n${r.riddle}\n\nHint: ${r.hint}`);
      pendingActions.set(ctx.chatId, sent.key.id, {
        type: 'riddle',
        userId: ctx.senderId,
        match: (t) => t.toLowerCase().includes(r.answer),
        handler: async (replyCtx) => {
          await replyCtx.reply(`✅ Correct! The answer was ${r.answer}`);
        }
      });
    }
  },
  {
    name: 'capital',
    description: 'Guess the capital city',
    usage: '.capital',
    category: 'games',
    execute: async (ctx) => {
      const c = getRandomItem(capitals);
      const sent = await ctx.reply(`*🌍 Capital Quiz*\n\nWhat is the capital of *${c.country}*?`);
      pendingActions.set(ctx.chatId, sent.key.id, {
        type: 'capital',
        userId: ctx.senderId,
        match: (t) => t.toLowerCase().includes(c.capital.toLowerCase()),
        handler: async (replyCtx) => {
          await replyCtx.reply(`✅ Correct! It's ${c.capital}`);
        }
      });
    }
  }
];
