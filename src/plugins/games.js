import pendingActions, { shouldReact } from '../utils/pendingActions.js';
import ai from '../utils/ai.js';

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
  { question: "What is the hardest natural substance on Earth?", answer: "diamond", options: ["Gold", "Iron", "Diamond", "Platinum"] },
  { question: "What is the capital of Japan?", answer: "tokyo", options: ["Kyoto", "Tokyo", "Osaka", "Nagoya"] },
  { question: "How many hearts does an octopus have?", answer: "3", options: ["1", "2", "3", "4"] },
  { question: "What is the longest river in the world?", answer: "nile", options: ["Amazon", "Nile", "Yangtze", "Mississippi"] },
  { question: "Who invented the telephone?", answer: "bell", options: ["Edison", "Bell", "Tesla", "Marconi"] },
  { question: "What is the currency of the UK?", answer: "pound", options: ["Euro", "Pound", "Dollar", "Franc"] },
  { question: "How many players are on a soccer team?", answer: "11", options: ["9", "10", "11", "12"] },
  { question: "What is the capital of Australia?", answer: "canberra", options: ["Sydney", "Melbourne", "Canberra", "Perth"] },
  { question: "What year did the Titanic sink?", answer: "1912", options: ["1905", "1912", "1920", "1898"] },
  { question: "What is the smallest planet in our solar system?", answer: "mercury", options: ["Mars", "Mercury", "Pluto", "Venus"] },
  { question: "How many rings does Saturn have?", answer: "7", options: ["3", "5", "7", "9"] },
  { question: "What is the most spoken language in the world?", answer: "mandarin", options: ["English", "Spanish", "Mandarin", "Hindi"] },
  { question: "What is the tallest mountain in the world?", answer: "everest", options: ["K2", "Everest", "Kilimanjaro", "Denali"] },
  { question: "Who wrote Harry Potter?", answer: "rowling", options: ["Tolkien", "Rowling", "King", "Martin"] },
  { question: "What is the largest desert in the world?", answer: "sahara", options: ["Gobi", "Sahara", "Arabian", "Kalahari"] },
  { question: "How many teeth does an adult human have?", answer: "32", options: ["28", "30", "32", "34"] },
  { question: "What is the capital of Brazil?", answer: "brasilia", options: ["Rio de Janeiro", "Sao Paulo", "Brasilia", "Salvador"] },
  { question: "What year was the first iPhone released?", answer: "2007", options: ["2005", "2006", "2007", "2008"] },
  { question: "What is the largest bird in the world?", answer: "ostrich", options: ["Eagle", "Ostrich", "Condor", "Albatross"] },
  { question: "How many colors are in a rainbow?", answer: "7", options: ["5", "6", "7", "8"] },
  { question: "What is the capital of Canada?", answer: "ottawa", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"] },
  { question: "What is the atomic number of carbon?", answer: "6", options: ["4", "6", "8", "12"] },
  { question: "Who discovered gravity?", answer: "newton", options: ["Einstein", "Newton", "Galileo", "Hawking"] },
  { question: "What is the hottest planet in our solar system?", answer: "venus", options: ["Mercury", "Venus", "Mars", "Jupiter"] },
  { question: "How many sides does a hexagon have?", answer: "6", options: ["5", "6", "7", "8"] },
  { question: "What is the largest organ in the human body?", answer: "skin", options: ["Liver", "Heart", "Skin", "Brain"] },
  { question: "What year did the Berlin Wall fall?", answer: "1989", options: ["1985", "1987", "1989", "1991"] },
  { question: "What is the fastest land animal?", answer: "cheetah", options: ["Lion", "Cheetah", "Leopard", "Tiger"] },
  { question: "How many chromosomes do humans have?", answer: "46", options: ["42", "44", "46", "48"] },
  { question: "What is the capital of Egypt?", answer: "cairo", options: ["Alexandria", "Cairo", "Luxor", "Giza"] },
  { question: "Who painted The Starry Night?", answer: "van gogh", options: ["Monet", "Van Gogh", "Picasso", "Dali"] },
  { question: "What is the freezing point of water in Celsius?", answer: "0", options: ["-10", "0", "10", "32"] },
  { question: "How many strings does a standard guitar have?", answer: "6", options: ["4", "5", "6", "8"] },
  { question: "What is the capital of South Korea?", answer: "seoul", options: ["Busan", "Seoul", "Incheon", "Daegu"] },
  { question: "What year did World War I begin?", answer: "1914", options: ["1910", "1912", "1914", "1916"] },
  { question: "What is the boiling point of water in Celsius?", answer: "100", options: ["90", "100", "110", "212"] }
];

const wordList = [
  "apple", "beach", "cloud", "dance", "eagle", "flame", "grape", "heart", "ivory", "joker",
  "knife", "lemon", "mango", "night", "ocean", "piano", "queen", "river", "storm", "tiger",
  "unity", "vivid", "water", "xerox", "yacht", "zebra", "amber", "blaze", "coral", "daisy",
  "frost", "ghost", "honey", "juice", "karma", "lunar", "magic", "noble", "oasis", "pearl",
  "quest", "reign", "solar", "tribe", "ultra", "valor", "wrist", "youth", "zesty", "angel",
  "brave", "charm", "drift", "ember", "fable", "glory", "haste", "ideal", "jolly", "knack",
  "logic", "maple", "nerve", "orbit", "pride", "quiet", "royal", "shade", "tempo", "urban",
  "vital", "wealth", "zenith", "bloom", "crest", "dwell", "epoch", "flare", "gleam", "hover",
  "inbox", "jumpy", "kraft", "lyric", "moral", "nexus", "omega", "prism", "quota", "realm",
  "spine", "token", "unity", "venom", "whirl", "xylon", "yearn", "zonal", "acute", "brisk"
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
  { emoji: "🧲🧔", answer: "magneto", hint: "X-Men villain" },
  { emoji: "🌊🧜‍♀️", answer: "little mermaid", hint: "Disney underwater princess" },
  { emoji: "🏰🧝‍♀️👠", answer: "cinderella", hint: "Glass slipper story" },
  { emoji: "🍫🏭", answer: "charlie and the chocolate factory", hint: "Willy Wonka story" },
  { emoji: "👦🧙‍♂️⚡", answer: "harry potter", hint: "Boy wizard" },
  { emoji: "🚢❄️💑", answer: "titanic", hint: "Ship disaster romance" },
  { emoji: "🤖❤️🌱", answer: "wall-e", hint: "Lonely robot movie" },
  { emoji: "👨‍🚀🌙", answer: "apollo 13", hint: "Space mission movie" },
  { emoji: "🐠🔍", answer: "finding nemo", hint: "Lost fish movie" },
  { emoji: "🐷🕷️🕸️", answer: "charlottes web", hint: "Pig and spider friendship" },
  { emoji: "🦈🏊", answer: "jaws", hint: "Shark attack movie" },
  { emoji: "🐀👨‍🍳", answer: "ratatouille", hint: "Rat chef movie" },
  { emoji: "🧸🐯", answer: "winnie the pooh", hint: "Bear and friends in the woods" },
  { emoji: "🦴🐕", answer: "bolt", hint: "Super dog movie" },
  { emoji: "💀🎃🎄", answer: "nightmare before christmas", hint: "Halloween meets Christmas" },
  { emoji: "🐉👦", answer: "how to train your dragon", hint: "Viking and dragon friendship" },
  { emoji: "🎭🎵", answer: "phantom of the opera", hint: "Musical in the opera house" },
  { emoji: "👸🐸💋", answer: "princess and the frog", hint: "Kiss turns prince into frog" },
  { emoji: "🎈🤡", answer: "it", hint: "Scary clown movie" },
  { emoji: "🔥🐉👸", answer: "game of thrones", hint: "Fantasy TV series with dragons" },
  { emoji: "🧟‍♂️🏃", answer: "the walking dead", hint: "Zombie TV series" }
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
  { question: "What is 11 x 11?", answer: "121" },
  { question: "What is 256 / 16?", answer: "16" },
  { question: "What is 33 + 67?", answer: "100" },
  { question: "What is 15 x 15?", answer: "225" },
  { question: "What is 500 - 123?", answer: "377" },
  { question: "What is 72 / 8?", answer: "9" },
  { question: "What is 19 + 24?", answer: "43" },
  { question: "What is 7 x 12?", answer: "84" },
  { question: "What is 1000 - 456?", answer: "544" },
  { question: "What is 169 / 13?", answer: "13" },
  { question: "What is 88 + 77?", answer: "165" },
  { question: "What is 14 x 14?", answer: "196" },
  { question: "What is 300 - 178?", answer: "122" },
  { question: "What is 225 / 15?", answer: "15" },
  { question: "What is 56 + 89?", answer: "145" },
  { question: "What is 13 x 17?", answer: "221" },
  { question: "What is 1024 / 32?", answer: "32" },
  { question: "What is 999 - 111?", answer: "888" },
  { question: "What is 23 x 4?", answer: "92" },
  { question: "What is 441 / 21?", answer: "21" },
  { question: "What is 67 + 48?", answer: "115" }
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
  "Have you ever blamed someone else for something you did?",
  "What's the longest you've gone without showering?",
  "What's your biggest insecurity?",
  "Have you ever stalked someone on social media?",
  "What's the most embarrassing thing you've done in public?",
  "What's a lie you told that got out of control?",
  "What's the worst date you've ever been on?",
  "Have you ever faked being sick to avoid something?",
  "What's the most expensive thing you've broken?",
  "What's your most unpopular opinion?",
  "Have you ever had a crush on a friend's partner?",
  "What's something you've done that you hope no one finds out?",
  "What's the most embarrassing text you've sent to the wrong person?",
  "Have you ever pretended to be busy to avoid someone?",
  "What's the dumbest thing you've ever done for attention?",
  "What's a habit you have that you're ashamed of?",
  "Have you ever lied in this group chat?",
  "What's the worst rumor you've spread about someone?",
  "What's the most cringe thing you've posted on social media?",
  "Have you ever had a secret relationship?",
  "What's something you judge others for but secretly do yourself?"
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
  "Share your battery percentage and don't charge until it dies",
  "Send a voice note laughing for 30 seconds straight",
  "Text your mom 'I have something important to tell you' and wait 5 minutes",
  "Send a photo of what you're wearing right now",
  "Do 20 pushups and send proof",
  "Let someone in the chat post a story on your account",
  "Send the oldest photo in your gallery",
  "Call someone and sing happy birthday to them",
  "Send your most embarrassing saved meme",
  "Type the next 5 messages using only your nose",
  "Send a screenshot of your most recent search history",
  "Send a voice note of you beatboxing",
  "Post a photo without any filter or editing",
  "Send a voice note of you whispering a secret",
  "Text 'we need to talk' to your best friend",
  "Share your Spotify wrapped or most played song",
  "Do a TikTok dance and send the video",
  "Send a photo of your fridge contents",
  "Voice note yourself telling a joke",
  "Change your profile picture to something embarrassing for an hour",
  "Text your ex 'hey stranger' (if applicable)"
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
  { a: "Have a rewind button for life", b: "Have a pause button for life" },
  { a: "Know how you die", b: "Know when you die" },
  { a: "Have a personal chef", b: "Have a personal chauffeur" },
  { a: "Be able to teleport", b: "Be able to time travel" },
  { a: "Win the lottery once", b: "Live twice as long" },
  { a: "Always be stuck in traffic", b: "Always have slow internet" },
  { a: "Have no taste", b: "Have no smell" },
  { a: "Be extremely lucky", b: "Be extremely talented" },
  { a: "Have a photographic memory", b: "Be able to forget anything" },
  { a: "Be famous but poor", b: "Be unknown but rich" },
  { a: "Always say what you think", b: "Never speak again" },
  { a: "Have unlimited sushi", b: "Have unlimited tacos" },
  { a: "Be allergic to pets", b: "Be allergic to sunlight" },
  { a: "Have no eyebrows", b: "Have no fingernails" },
  { a: "Always have a song stuck in your head", b: "Always have an itch you can't scratch" },
  { a: "Be feared by all", b: "Be loved by all" },
  { a: "Control fire", b: "Control water" },
  { a: "Never age physically", b: "Never age mentally" },
  { a: "Know all mysteries of the universe", b: "Know your own future" },
  { a: "Be the best player at any sport", b: "Be the best at any video game" },
  { a: "Have a dragon", b: "Be a dragon" }
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
  { word: "SUNFLOWER", hint: "Tall yellow flower" },
  { word: "HAMBURGER", hint: "Popular fast food item" },
  { word: "BASKETBALL", hint: "Sport with hoops" },
  { word: "MICROWAVE", hint: "Kitchen heating appliance" },
  { word: "WATERFALL", hint: "Water cascading down" },
  { word: "NIGHTMARE", hint: "Scary dream" },
  { word: "CHAMPAGNE", hint: "Celebratory drink" },
  { word: "SNOWFLAKE", hint: "Frozen precipitation" },
  { word: "HALLOWEEN", hint: "Spooky October holiday" },
  { word: "SUBMARINE", hint: "Underwater vessel" },
  { word: "PARACHUTE", hint: "Used for skydiving" },
  { word: "SCIENTIST", hint: "Studies natural world" },
  { word: "PROFESSOR", hint: "University teacher" },
  { word: "MOONLIGHT", hint: "Lunar illumination" },
  { word: "DRAGONFLY", hint: "Insect with four wings" },
  { word: "ECOSYSTEM", hint: "Nature's community" },
  { word: "LONGITUDE", hint: "Geographic coordinate" },
  { word: "BLUEPRINT", hint: "Architectural plan" },
  { word: "QUICKSAND", hint: "Dangerous ground" },
  { word: "XYLOPHONE", hint: "Musical instrument with bars" },
  { word: "GYMNASTICS", hint: "Acrobatic sport" }
];

const riddles = [
  { riddle: "What has keys but no locks?", answer: "piano", hint: "Musical instrument" },
  { riddle: "What has hands but can't clap?", answer: "clock", hint: "Tells time" },
  { riddle: "What has a head and a tail but no body?", answer: "coin", hint: "Used for payment" },
  { riddle: "What can you catch but not throw?", answer: "cold", hint: "An illness" },
  { riddle: "What has teeth but cannot bite?", answer: "comb", hint: "Used on hair" },
  { riddle: "What gets wetter the more it dries?", answer: "towel", hint: "Found in bathroom" },
  { riddle: "What can travel around the world while staying in a corner?", answer: "stamp", hint: "Goes on mail" },
  { riddle: "What has a neck but no head?", answer: "bottle", hint: "Holds liquid" },
  { riddle: "What can you break without touching it?", answer: "promise", hint: "A commitment" },
  { riddle: "What goes up but never comes down?", answer: "age", hint: "We all have it" },
  { riddle: "What has an eye but cannot see?", answer: "needle", hint: "Used for sewing" },
  { riddle: "What can fill a room but takes no space?", answer: "light", hint: "Opposite of dark" },
  { riddle: "What is always in front of you but can't be seen?", answer: "future", hint: "What's coming" },
  { riddle: "What has words but never speaks?", answer: "book", hint: "You read it" },
  { riddle: "What runs but never walks?", answer: "water", hint: "H2O" },
  { riddle: "What has a thumb and fingers but is not alive?", answer: "glove", hint: "Worn on hands" },
  { riddle: "What belongs to you but others use it more?", answer: "name", hint: "Your identity" },
  { riddle: "What goes through cities and fields but never moves?", answer: "road", hint: "You drive on it" },
  { riddle: "What can be cracked, made, told, and played?", answer: "joke", hint: "Makes you laugh" },
  { riddle: "What has many rings but no fingers?", answer: "phone", hint: "Communication device" }
];

const capitals = [
  { country: "Germany", capital: "Berlin" },
  { country: "Italy", capital: "Rome" },
  { country: "Spain", capital: "Madrid" },
  { country: "Russia", capital: "Moscow" },
  { country: "India", capital: "New Delhi" },
  { country: "China", capital: "Beijing" },
  { country: "Mexico", capital: "Mexico City" },
  { country: "Argentina", capital: "Buenos Aires" },
  { country: "Poland", capital: "Warsaw" },
  { country: "Sweden", capital: "Stockholm" },
  { country: "Norway", capital: "Oslo" },
  { country: "Denmark", capital: "Copenhagen" },
  { country: "Netherlands", capital: "Amsterdam" },
  { country: "Belgium", capital: "Brussels" },
  { country: "Portugal", capital: "Lisbon" },
  { country: "Greece", capital: "Athens" },
  { country: "Turkey", capital: "Ankara" },
  { country: "Thailand", capital: "Bangkok" },
  { country: "Vietnam", capital: "Hanoi" },
  { country: "Indonesia", capital: "Jakarta" },
  { country: "Malaysia", capital: "Kuala Lumpur" },
  { country: "Singapore", capital: "Singapore" },
  { country: "Philippines", capital: "Manila" },
  { country: "South Africa", capital: "Pretoria" },
  { country: "Nigeria", capital: "Abuja" },
  { country: "Kenya", capital: "Nairobi" },
  { country: "Morocco", capital: "Rabat" },
  { country: "Chile", capital: "Santiago" },
  { country: "Colombia", capital: "Bogota" },
  { country: "Peru", capital: "Lima" }
];

const flagQuiz = [
  { emoji: "🇺🇸", answer: "usa", alt: ["united states", "america"] },
  { emoji: "🇬🇧", answer: "uk", alt: ["united kingdom", "britain", "england"] },
  { emoji: "🇫🇷", answer: "france", alt: [] },
  { emoji: "🇩🇪", answer: "germany", alt: [] },
  { emoji: "🇯🇵", answer: "japan", alt: [] },
  { emoji: "🇨🇳", answer: "china", alt: [] },
  { emoji: "🇧🇷", answer: "brazil", alt: [] },
  { emoji: "🇮🇹", answer: "italy", alt: [] },
  { emoji: "🇪🇸", answer: "spain", alt: [] },
  { emoji: "🇨🇦", answer: "canada", alt: [] },
  { emoji: "🇦🇺", answer: "australia", alt: [] },
  { emoji: "🇲🇽", answer: "mexico", alt: [] },
  { emoji: "🇰🇷", answer: "south korea", alt: ["korea"] },
  { emoji: "🇮🇳", answer: "india", alt: [] },
  { emoji: "🇷🇺", answer: "russia", alt: [] },
  { emoji: "🇳🇱", answer: "netherlands", alt: ["holland"] },
  { emoji: "🇸🇪", answer: "sweden", alt: [] },
  { emoji: "🇳🇴", answer: "norway", alt: [] },
  { emoji: "🇩🇰", answer: "denmark", alt: [] },
  { emoji: "🇵🇱", answer: "poland", alt: [] },
  { emoji: "🇦🇷", answer: "argentina", alt: [] },
  { emoji: "🇿🇦", answer: "south africa", alt: [] },
  { emoji: "🇹🇷", answer: "turkey", alt: [] },
  { emoji: "🇪🇬", answer: "egypt", alt: [] },
  { emoji: "🇬🇷", answer: "greece", alt: [] }
];

const typingChallenges = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "The five boxing wizards jump quickly",
  "Sphinx of black quartz, judge my vow",
  "Two driven jocks help fax my big quiz",
  "The job requires extra pluck and zeal",
  "Crazy Frederick bought many very exquisite opal jewels",
  "We promptly judged antique ivory buckles for the next prize",
  "A wizard's job is to vex chumps quickly in fog"
];

const quoteAuthors = [
  { quote: "To be or not to be, that is the question", author: "shakespeare", alt: ["william shakespeare"] },
  { quote: "I have a dream", author: "mlk", alt: ["martin luther king", "martin luther king jr"] },
  { quote: "That's one small step for man, one giant leap for mankind", author: "armstrong", alt: ["neil armstrong"] },
  { quote: "I think, therefore I am", author: "descartes", alt: ["rene descartes"] },
  { quote: "The only thing we have to fear is fear itself", author: "fdr", alt: ["roosevelt", "franklin roosevelt"] },
  { quote: "Float like a butterfly, sting like a bee", author: "muhammad ali", alt: ["ali"] },
  { quote: "Stay hungry, stay foolish", author: "steve jobs", alt: ["jobs"] },
  { quote: "Be the change you wish to see in the world", author: "gandhi", alt: ["mahatma gandhi"] },
  { quote: "In the end, we only regret the chances we didn't take", author: "lewis carroll", alt: ["carroll"] },
  { quote: "Life is what happens when you're busy making other plans", author: "john lennon", alt: ["lennon"] }
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

async function runTriviaTurns(ctx, players) {
  let turnIndex = 0;
  
  const askQuestion = async () => {
    if (turnIndex >= players.length) {
      return ctx.reply('🏆 *Trivia Game Over!* Thank you for playing.');
    }

    const currentPlayer = players[turnIndex];
    const question = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    
    await ctx.reply(`🔔 @${currentPlayer.split('@')[0]}, it's your turn!\n\n❓ *Question:* ${question.question}\n\nOptions:\n${question.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nWait 30s for your answer...`, { mentions: [currentPlayer] });

    const gameId = `trivia_turn_${ctx.chatId}`;
    pendingActions.add(gameId, async (msgCtx) => {
      // Ignore anyone else
      if (msgCtx.senderId !== currentPlayer) {
        return true; // Silent ignore (mark as handled)
      }

      const answer = msgCtx.text.toLowerCase().trim();
      const correctAnswer = question.answer.toLowerCase();
      
      const isCorrect = answer === correctAnswer || 
                        question.options.some((o, i) => (i + 1).toString() === answer && o.toLowerCase() === correctAnswer);

      if (isCorrect) {
        await msgCtx.reply('✅ *Correct!* Well done.');
      } else {
        await msgCtx.reply(`❌ *Incorrect!* The correct answer was: *${question.answer}*`);
      }

      pendingActions.remove(gameId);
      turnIndex++;
      setTimeout(askQuestion, 2000);
      return true;
    }, 30000);
  }

  await askQuestion();
}

export default {
  name: 'games',
  description: 'Fun games to play in chat',
  version: '2.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'trivia',
      aliases: ['quiz'],
      description: 'Start a multi-player trivia game',
      usage: '.trivia',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        const chatId = ctx.chatId;
        const gameId = `trivia_lobby_${chatId}`;
        
        if (pendingActions.has(gameId)) {
          return ctx.reply('A trivia game is already in progress or starting in this chat!');
        }

        const participants = new Set();
        
        // Add bot owner as the first participant (the person starting the game)
        let ownerJid = ctx.config?.ownerNumber;
        if (ownerJid) {
          ownerJid = ownerJid.replace(/[^\d]/g, '') + '@s.whatsapp.net';
        }
        
        if (ownerJid) participants.add(ownerJid);
        
        // Always add the sender as well
        participants.add(ctx.senderId);

        // For private chats, always use senderId for mentions (not chatId)
        let mentionList = Array.from(participants);
        if (!ctx.isGroup) {
          // In private chat, ensure the mention is the owner and the sender (never chatId)
          mentionList = [ownerJid, ctx.senderId].filter(jid => !!jid).filter((v, i, arr) => arr.indexOf(v) === i);
        }

        let timeLeft = 40;
        await ctx.reply(`🎮 *TRIVIA GAME LOBBY*\n\nUser @${ctx.senderId.split('@')[0]} started a trivia game!\n\nType *join* to participate.\n\n⏳ Time left: *${timeLeft}s*\n\n👥 Registered: ${participants.size} players (Bot Owner included)`, { mentions: mentionList });

        // Registration phase
        pendingActions.add(gameId, async (msgCtx) => {
          if (msgCtx.text.toLowerCase() === 'join') {
            const senderJid = msgCtx.senderId;
            if (participants.has(senderJid)) {
              if (senderJid === ownerJid) {
                return msgCtx.reply('The Bot Owner is already a participant in every game!');
              }
              return msgCtx.reply('You are already a participant!');
            }
            participants.add(senderJid);
            await msgCtx.react('✅');
            return true; // Mark as handled
          }
          return false;
        }, 45000);

        // Update at 20 seconds
        setTimeout(async () => {
          timeLeft = 20;
          await ctx.reply(`🎮 *TRIVIA GAME LOBBY*\n\nType *join* to participate.\n\n⏳ Time left: *${timeLeft}s*\n\n👥 Registered: ${participants.size} players`);
        }, 20000);

        // Start game after 40 seconds
        setTimeout(async () => {
          pendingActions.remove(gameId);
          
          if (participants.size === 0) {
            return ctx.reply('Game cancelled: No one joined.');
          }

          const players = Array.from(participants);
          await ctx.reply(`🏁 *TRIVIA GAME STARTING!*\n\nPlayers: ${players.map(p => `@${p.split('@')[0]}`).join(', ')}\n\n*Rules:* First correct answer wins!`, { mentions: players });

          // Start turns
          await runTriviaTurns(ctx, players);
        }, 40000);
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
          
          const prompt = `*🔤 Word Scramble*\n\nUnscramble this word:\n\n*${scrambled.toUpperCase()}*\n\nReply with your answer!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'scramble_game',
            userId: ctx.senderId,
            data: { answer: word, hintsGiven: 0 },
            match: (text) => typeof text === 'string' && text.trim().length > 0,
            handler: async (replyCtx, pending) => {
              const userAnswer = replyCtx.text.trim().toLowerCase();
              
              if (userAnswer === 'hint') {
                pending.data.hintsGiven++;
                const hint = pending.data.answer.substring(0, pending.data.hintsGiven).padEnd(pending.data.answer.length, '_');
                await replyCtx.reply(`*💡 Hint:* ${hint.toUpperCase()}`);
                return false;
              }

              if (userAnswer === pending.data.answer) {
                await replyCtx.reply(`✅ Correct! The word was *${pending.data.answer}*!`);
                if (shouldReact()) await replyCtx.react('🎉');
              } else {
                await replyCtx.reply(`❌ Wrong! The correct word was: *${pending.data.answer}*`);
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
          
          const prompt = `*🔢 Number Guessing Game*\n\nI'm thinking of a number between 1 and 100.\n\nYou have 6 attempts to guess it!\n\nReply with your first guess.`;
          
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
                await replyCtx.reply(`🎉 Correct! The number was *${pending.data.answer}*!\n\nYou got it in ${pending.data.attempts} attempt(s)!`);
                if (shouldReact()) await replyCtx.react('🎉');
                return true;
              }
              
              if (pending.data.attempts >= pending.data.maxAttempts) {
                await replyCtx.reply(`😢 Game over! The number was *${pending.data.answer}*`);
                if (shouldReact()) await replyCtx.react('😢');
                return true;
              }
              
              const remaining = pending.data.maxAttempts - pending.data.attempts;
              const hint = guess < pending.data.answer ? '⬆️ Higher!' : '⬇️ Lower!';
              
              const sentMsg = await replyCtx.reply(`${hint} ${remaining} attempt(s) remaining.`);
              
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
          const sendNextPuzzle = async (replyCtx, score = 0, total = 0) => {
            const puzzle = getRandomItem(emojiPuzzles);
            
            const prompt = `*🎭 Emoji Puzzle*\n\nGuess what this represents:\n\n${puzzle.emoji}\n\nHint: ${puzzle.hint}\n\n📊 Score: ${score}/${total}\n\nReply with your answer!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'emoji_game',
              userId: replyCtx.senderId,
              data: { answer: puzzle.answer, score, total },
              match: (text) => typeof text === 'string' && text.trim().length > 0,
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*🎭 Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const correctAnswer = pending.data.answer.toLowerCase();
                const isCorrect = userAnswer.includes(correctAnswer) || 
                                 correctAnswer.includes(userAnswer) ||
                                 userAnswer.split(' ').some(word => correctAnswer.includes(word));
                
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct! The answer was *${pending.data.answer}*!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! The answer was: *${pending.data.answer}*`);
                }
                
                await sendNextPuzzle(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*🎭 Emoji Puzzle Game Started!*\n\nGuess movies/things from emojis.\nType *stop* anytime to quit.`);
          await sendNextPuzzle(ctx, 0, 0);
          
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
          const sendNextProblem = async (replyCtx, score = 0, total = 0) => {
            const problem = getRandomItem(mathProblems);
            
            const prompt = `*🔢 Math Challenge*\n\n${problem.question}\n\n📊 Score: ${score}/${total}\n\nReply with your answer!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'math_game',
              userId: replyCtx.senderId,
              data: { answer: problem.answer, score, total },
              match: (text) => {
                if (typeof text !== 'string') return false;
                const clean = text.trim().toLowerCase();
                return clean === 'stop' || !isNaN(parseInt(clean, 10));
              },
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*🔢 Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const isCorrect = userAnswer === pending.data.answer;
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! The answer was: ${pending.data.answer}`);
                }
                
                await sendNextProblem(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 60 * 1000
            });
          };
          
          await ctx.reply(`*🔢 Math Challenge Started!*\n\nSolve math problems to earn points.\nType *stop* anytime to quit.`);
          await sendNextProblem(ctx, 0, 0);
          
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
            result = "🤝 It's a tie!";
          } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
          ) {
            result = "🎉 You win!";
            if (shouldReact()) await ctx.react('🎉');
          } else {
            result = "😢 You lose!";
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
          
          await ctx.reply(`🪙 *Coin Flip*\n\n${emoji} *${result}!*`);
          
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
            return await ctx.reply('Please choose between 2 and 100 sides.');
          }
          
          const rolls = [];
          for (let i = 0; i < count; i++) {
            rolls.push(Math.floor(Math.random() * sides) + 1);
          }
          
          const total = rolls.reduce((a, b) => a + b, 0);
          let response = `🎲 *Dice Roll* (d${sides})\n\n`;
          response += `Results: ${rolls.join(', ')}\n`;
          if (count > 1) response += `Total: ${total}`;
          
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
      aliases: ['magic8ball', 'fortune'],
      description: 'Ask the magic 8-ball',
      usage: '.8ball <question>',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const question = ctx.args.join(' ');
          
          if (!question) {
            return await ctx.reply('Please ask a question!\n\nUsage: .8ball Will I pass my exam?');
          }
          
          const responses = [
            "🟢 It is certain.",
            "🟢 It is decidedly so.",
            "🟢 Without a doubt.",
            "🟢 Yes, definitely.",
            "🟢 You may rely on it.",
            "🟢 As I see it, yes.",
            "🟢 Most likely.",
            "🟢 Outlook good.",
            "🟢 Yes.",
            "🟢 Signs point to yes.",
            "🟡 Reply hazy, try again.",
            "🟡 Ask again later.",
            "🟡 Better not tell you now.",
            "🟡 Cannot predict now.",
            "🟡 Concentrate and ask again.",
            "🔴 Don't count on it.",
            "🔴 My reply is no.",
            "🔴 My sources say no.",
            "🔴 Outlook not so good.",
            "🔴 Very doubtful."
          ];
          
          const answer = getRandomItem(responses);
          
          await ctx.reply(`🎱 *Magic 8-Ball*\n\n❓ ${question}\n\n${answer}`);
          
        } catch (error) {
          console.error('8ball error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'tictactoe',
      aliases: ['ttt', 'xo'],
      description: 'Play Tic-Tac-Toe',
      usage: '.tictactoe',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          // Tic-Tac-Toe is normally 2 players: Bot Owner vs Another participant
          const ownerJid = ctx.config.ownerNumber.replace(/[^\d]/g, '') + '@s.whatsapp.net';
          const senderJid = ctx.senderId;
          const isOwnerPlayer = senderJid === ownerJid;
          
          const playerDisplay = isOwnerPlayer ? 'Owner' : `@${senderJid.split('@')[0]}`;
          const opponentDisplay = isOwnerPlayer ? 'Opponent' : 'Owner';

          await ctx.reply(`*⭕❌ Tic-Tac-Toe*\n\nStarting game: ${playerDisplay} vs ${opponentDisplay}`, { mentions: [senderJid, ownerJid] });

          const board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
          
          const prompt = `*⭕❌ Tic-Tac-Toe*\n\nYou are ❌, I am ⭕\n\n${renderTicTacToeBoard(board)}\n\nReply with a number (1-9) to place your X!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'tictactoe_game',
            userId: ctx.senderId,
            data: { board },
            match: (text) => {
              if (typeof text !== 'string') return false;
              const num = parseInt(text.trim(), 10);
              return num >= 1 && num <= 9;
            },
            handler: async (replyCtx, pending) => {
              const pos = parseInt(replyCtx.text.trim(), 10) - 1;
              
              if (pending.data.board[pos] !== 0) {
                await replyCtx.reply('That spot is taken! Choose another.');
                return false;
              }
              
              pending.data.board[pos] = 1;
              
              let winner = checkTicTacToeWinner(pending.data.board);
              if (winner === 1) {
                await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n🎉 You win!`);
                if (shouldReact()) await replyCtx.react('🎉');
                return true;
              }
              if (winner === 'draw') {
                await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n🤝 It's a draw!`);
                return true;
              }
              
              const available = pending.data.board.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
              if (available.length > 0) {
                const botMove = getRandomItem(available);
                pending.data.board[botMove] = 2;
              }
              
              winner = checkTicTacToeWinner(pending.data.board);
              if (winner === 2) {
                await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n😢 I win!`);
                if (shouldReact()) await replyCtx.react('😈');
                return true;
              }
              if (winner === 'draw') {
                await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\n🤝 It's a draw!`);
                return true;
              }
              
              const newMsg = await replyCtx.reply(`${renderTicTacToeBoard(pending.data.board)}\n\nYour turn! (1-9)`);
              
              pendingActions.set(replyCtx.chatId, newMsg.key.id, {
                ...pending,
                match: (text) => {
                  if (typeof text !== 'string') return false;
                  const num = parseInt(text.trim(), 10);
                  return num >= 1 && num <= 9;
                }
              });
              
              return false;
            },
            timeout: 5 * 60 * 1000
          });
          
        } catch (error) {
          console.error('TicTacToe error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'truthordare',
      aliases: ['tod'],
      description: 'Play Truth or Dare',
      usage: '.truthordare',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const prompt = `*🎭 Truth or Dare*\n\nReply with:\n• *truth* - Answer honestly\n• *dare* - Do a challenge`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'tod_game',
            userId: ctx.senderId,
            data: {},
            match: (text) => {
              if (typeof text !== 'string') return false;
              const clean = text.trim().toLowerCase();
              return ['truth', 'dare', 't', 'd'].includes(clean);
            },
            handler: async (replyCtx, pending) => {
              const choice = replyCtx.text.trim().toLowerCase();
              const isTruth = choice === 'truth' || choice === 't';
              
              if (isTruth) {
                let truth = ai.getCachedItem('truth', truthQuestions);
                if (!truth || typeof truth !== 'string') {
                  truth = getRandomItem(truthQuestions);
                }
                await replyCtx.reply(`*🤔 Truth*\n\n${truth}`);
              } else {
                let dare = ai.getCachedItem('dare', dareActions);
                if (!dare || typeof dare !== 'string') {
                  dare = getRandomItem(dareActions);
                }
                await replyCtx.reply(`*😈 Dare*\n\n${dare}`);
              }
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('ToD error:', error);
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
        let truth = ai.getCachedItem('truth', truthQuestions);
        if (!truth || typeof truth !== 'string') {
          truth = getRandomItem(truthQuestions);
        }
        await ctx.reply(`*🤔 Truth*\n\n${truth}`);
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
        let dare = ai.getCachedItem('dare', dareActions);
        if (!dare || typeof dare !== 'string') {
          dare = getRandomItem(dareActions);
        }
        await ctx.reply(`*😈 Dare*\n\n${dare}`);
      }
    },
    {
      name: 'hangman',
      aliases: ['hang'],
      description: 'Play Hangman',
      usage: '.hangman',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const wordData = getRandomItem(hangmanWords);
          const word = wordData.word;
          const guessed = [];
          const wrongGuesses = 0;
          
          const display = word.split('').map(() => '_').join(' ');
          
          const prompt = `*🎮 Hangman*\n\n${renderHangman(wrongGuesses)}\n\nWord: ${display}\nHint: ${wordData.hint}\n\nGuess a letter!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          const setupHangman = (msgId, data) => {
            pendingActions.set(ctx.chatId, msgId, {
              type: 'hangman_game',
              userId: ctx.senderId,
              data,
              match: (text) => {
                if (typeof text !== 'string') return false;
                const clean = text.trim().toLowerCase();
                return (clean.length === 1 && /[a-z]/.test(clean)) || clean.length > 1;
              },
              handler: async (replyCtx, pending) => {
                const guess = replyCtx.text.trim().toUpperCase();
                
                if (guess.length > 1) {
                  if (guess === pending.data.word) {
                    await replyCtx.reply(`🎉 *Correct!* The word was *${pending.data.word}*!`);
                    if (shouldReact()) await replyCtx.react('🎉');
                    return true;
                  } else {
                    pending.data.wrongGuesses++;
                  }
                } else {
                  if (pending.data.guessed.includes(guess)) {
                    const newMsg = await replyCtx.reply(`You already guessed "${guess}"! Try another letter.`);
                    setupHangman(newMsg.key.id, pending.data);
                    return false;
                  }
                  
                  pending.data.guessed.push(guess);
                  
                  if (!pending.data.word.includes(guess)) {
                    pending.data.wrongGuesses++;
                  }
                }
                
                if (pending.data.wrongGuesses >= 6) {
                  await replyCtx.reply(`${renderHangman(6)}\n\n💀 *Game Over!* The word was *${pending.data.word}*`);
                  if (shouldReact()) await replyCtx.react('😢');
                  return true;
                }
                
                const display = pending.data.word.split('').map(l => 
                  pending.data.guessed.includes(l) ? l : '_'
                ).join(' ');
                
                if (!display.includes('_')) {
                  await replyCtx.reply(`${renderHangman(pending.data.wrongGuesses)}\n\nWord: ${display}\n\n🎉 *You won!*`);
                  if (shouldReact()) await replyCtx.react('🎉');
                  return true;
                }
                
                const newMsg = await replyCtx.reply(`${renderHangman(pending.data.wrongGuesses)}\n\nWord: ${display}\nGuessed: ${pending.data.guessed.join(', ') || 'None'}\nWrong: ${pending.data.wrongGuesses}/6\n\nGuess a letter!`);
                
                setupHangman(newMsg.key.id, pending.data);
                return false;
              },
              timeout: 5 * 60 * 1000
            });
          };
          
          setupHangman(sentMsg.key.id, { word, guessed, wrongGuesses, hint: wordData.hint });
          
        } catch (error) {
          console.error('Hangman error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'wyr',
      aliases: ['wouldyourather'],
      description: 'Would You Rather',
      usage: '.wyr',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        try {
          const sendNextQuestion = async (replyCtx, count = 0) => {
            let question = ai.getCachedItem('wouldYouRather', wouldYouRatherQuestions);
            
            if (!question || !question.a || !question.b) {
              question = getRandomItem(wouldYouRatherQuestions);
            }
            
            const prompt = `*🤔 Would You Rather*\n\n🅰️ ${question.a}\n\nor\n\n🅱️ ${question.b}\n\nReply with A or B!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'wyr_game',
              userId: replyCtx.senderId,
              data: { question, count },
              match: (text) => {
                if (typeof text !== 'string') return false;
                const clean = text.trim().toLowerCase();
                return clean === 'stop' || ['a', 'b', '1', '2'].includes(clean);
              },
              handler: async (answerCtx, pending) => {
                const choice = answerCtx.text.trim().toLowerCase();
                
                if (choice === 'stop') {
                  await answerCtx.reply(`*🤔 Game Over!*\n\nYou answered ${pending.data.count} questions!\n\nThanks for playing!`);
                  return true;
                }
                
                const isA = choice === 'a' || choice === '1';
                const chosen = isA ? pending.data.question.a : pending.data.question.b;
                
                await answerCtx.reply(`You chose: *${chosen}* 🧐`);
                if (shouldReact()) await answerCtx.react(isA ? '🅰️' : '🅱️');
                
                await sendNextQuestion(answerCtx, pending.data.count + 1);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*🤔 Would You Rather Game Started!*\n\nType *stop* anytime to quit.`);
          await sendNextQuestion(ctx, 0);
          
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
          const prompt = `*🧞 20 Questions*\n\nThink of something (person, animal, object)!\n\nI'll try to guess it in 20 questions.\n\nReply *ready* when you have something in mind!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          const fallbackQuestions = [
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
            data: { questionIndex: 0, answers: [], questionHistory: [] },
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
                    return ['yes', 'no', 'y', 'n', 'maybe', 'idk', 'probably', 'probably not'].includes(clean);
                  },
                  handler: async (answerCtx, qPending) => {
                    const answer = answerCtx.text.trim().toLowerCase();
                    const lastQuestion = qPending.data.questionHistory[qPending.data.questionHistory.length - 1];
                    if (lastQuestion) {
                      lastQuestion.answer = answer;
                    }
                    qPending.data.answers.push(answer);
                    qPending.data.questionIndex++;
                    
                    if (qPending.data.questionIndex >= 15) {
                      await answerCtx.react('🤔');
                      let guess = await ai.analyzeAkinatorAnswers(qPending.data.answers, qPending.data.questionHistory);
                      
                      if (!guess) {
                        const fallbackGuesses = ["A smartphone", "A dog", "A celebrity", "A car", "Pizza"];
                        guess = getRandomItem(fallbackGuesses);
                      }
                      
                      await answerCtx.reply(`*🎯 My AI Guess*\n\nIs it... *${guess}*?\n\nWas I right? 🧞`);
                      if (shouldReact()) await answerCtx.react('🎯');
                      return true;
                    }
                    
                    let nextQ = await ai.generateAkinatorQuestion(qPending.data.questionHistory, qPending.data.answers);
                    
                    if (!nextQ) {
                      nextQ = fallbackQuestions[qPending.data.questionIndex] || fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
                    }
                    
                    qPending.data.questionHistory.push({ question: nextQ, answer: null });
                    
                    const newMsg = await answerCtx.reply(`*❓ Question ${qPending.data.questionIndex + 1}/15*\n\n${nextQ}\n\nReply: yes / no / maybe`);
                    setupQuestion(newMsg.key.id, qPending.data);
                    return false;
                  },
                  timeout: 2 * 60 * 1000
                });
              };
              
              const firstQ = fallbackQuestions[0];
              pending.data.questionHistory.push({ question: firstQ, answer: null });
              const newMsg = await replyCtx.reply(`*❓ Question 1/15*\n\n${firstQ}\n\nReply: yes / no / maybe`);
              setupQuestion(newMsg.key.id, pending.data);
            },
            timeout: 60 * 1000
          });
          
        } catch (error) {
          console.error('Akinator error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'riddle',
      aliases: ['riddles'],
      description: 'Solve a riddle',
      usage: '.riddle',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const sendNextRiddle = async (replyCtx, score = 0, total = 0) => {
            let riddle = ai.getCachedItem('riddles', riddles);
            
            if (!riddle || !riddle.riddle || !riddle.answer) {
              riddle = getRandomItem(riddles);
            }
            
            const prompt = `*🧩 Riddle*\n\n${riddle.riddle}\n\nHint: ${riddle.hint}\n\n📊 Score: ${score}/${total}\n\nReply with your answer!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'riddle_game',
              userId: replyCtx.senderId,
              data: { answer: riddle.answer, score, total },
              match: (text) => typeof text === 'string' && text.trim().length > 0,
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*🧩 Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const correctAnswer = pending.data.answer.toLowerCase();
                const isCorrect = userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer);
                
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct! The answer was *${pending.data.answer}*!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! The answer was: *${pending.data.answer}*`);
                }
                
                await sendNextRiddle(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*🧩 Riddle Game Started!*\n\nSolve riddles to earn points.\nType *stop* anytime to quit.`);
          await sendNextRiddle(ctx, 0, 0);
          
        } catch (error) {
          console.error('Riddle error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'capital',
      aliases: ['capitals', 'capitalquiz'],
      description: 'Guess the capital city',
      usage: '.capital',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const sendNextQuestion = async (replyCtx, score = 0, total = 0) => {
            const data = getRandomItem(capitals);
            
            const prompt = `*🌍 Capital Quiz*\n\nWhat is the capital of *${data.country}*?\n\n📊 Score: ${score}/${total}\n\nReply with your answer!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'capital_game',
              userId: replyCtx.senderId,
              data: { answer: data.capital.toLowerCase(), score, total },
              match: (text) => typeof text === 'string' && text.trim().length > 0,
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*🌍 Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const isCorrect = userAnswer === pending.data.answer || 
                                 userAnswer.includes(pending.data.answer) ||
                                 pending.data.answer.includes(userAnswer);
                
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct! The capital is *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! The capital is *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*`);
                }
                
                await sendNextQuestion(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*🌍 Capital Quiz Started!*\n\nGuess capitals to earn points.\nType *stop* anytime to quit.`);
          await sendNextQuestion(ctx, 0, 0);
          
        } catch (error) {
          console.error('Capital error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'flag',
      aliases: ['flagquiz', 'flags'],
      description: 'Guess the country from the flag',
      usage: '.flag',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const sendNextQuestion = async (replyCtx, score = 0, total = 0) => {
            const data = getRandomItem(flagQuiz);
            
            const prompt = `*🏳️ Flag Quiz*\n\nWhich country does this flag belong to?\n\n${data.emoji}\n\n📊 Score: ${score}/${total}\n\nReply with your answer!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'flag_game',
              userId: replyCtx.senderId,
              data: { answer: data.answer, alt: data.alt, score, total },
              match: (text) => typeof text === 'string' && text.trim().length > 0,
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*🏳️ Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const isCorrect = userAnswer === pending.data.answer || 
                                 userAnswer.includes(pending.data.answer) ||
                                 pending.data.answer.includes(userAnswer) ||
                                 pending.data.alt.some(a => userAnswer.includes(a) || a.includes(userAnswer));
                
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct! It's *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! It's *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*`);
                }
                
                await sendNextQuestion(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*🏳️ Flag Quiz Started!*\n\nGuess countries from flags to earn points.\nType *stop* anytime to quit.`);
          await sendNextQuestion(ctx, 0, 0);
          
        } catch (error) {
          console.error('Flag error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'typing',
      aliases: ['typerace', 'typingtest'],
      description: 'Typing speed challenge',
      usage: '.typing',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          const sentence = getRandomItem(typingChallenges);
          const startTime = Date.now();
          
          const prompt = `*⌨️ Typing Challenge*\n\nType this sentence as fast as you can:\n\n"${sentence}"\n\nYour time starts now! ⏱️`;
          
          const sentMsg = await ctx.reply(prompt);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'typing_game',
            userId: ctx.senderId,
            data: { sentence: sentence.toLowerCase(), startTime },
            match: (text) => typeof text === 'string' && text.trim().length > 0,
            handler: async (replyCtx, pending) => {
              const endTime = Date.now();
              const userText = replyCtx.text.trim().toLowerCase();
              const correctText = pending.data.sentence;
              
              const timeTaken = ((endTime - pending.data.startTime) / 1000).toFixed(2);
              const wordCount = correctText.split(' ').length;
              const wpm = Math.round((wordCount / timeTaken) * 60);
              
              let correctChars = 0;
              for (let i = 0; i < Math.min(userText.length, correctText.length); i++) {
                if (userText[i] === correctText[i]) correctChars++;
              }
              const accuracy = Math.round((correctChars / correctText.length) * 100);
              
              let response = `*⌨️ Results*\n\n`;
              response += `⏱️ Time: ${timeTaken} seconds\n`;
              response += `📊 Speed: ~${wpm} WPM\n`;
              response += `🎯 Accuracy: ${accuracy}%\n\n`;
              
              if (accuracy === 100) {
                response += `🏆 Perfect typing!`;
                if (shouldReact()) await replyCtx.react('🏆');
              } else if (accuracy >= 90) {
                response += `✅ Great job!`;
                if (shouldReact()) await replyCtx.react('🎉');
              } else if (accuracy >= 70) {
                response += `👍 Good effort!`;
              } else {
                response += `Keep practicing! 💪`;
              }
              
              await replyCtx.reply(response);
            },
            timeout: 2 * 60 * 1000
          });
          
        } catch (error) {
          console.error('Typing error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'quote',
      aliases: ['quotequiz', 'whosaidthis'],
      description: 'Guess who said the famous quote',
      usage: '.quote',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const sendNextQuote = async (replyCtx, score = 0, total = 0) => {
            const data = getRandomItem(quoteAuthors);
            
            const prompt = `*💬 Quote Quiz*\n\nWho said this famous quote?\n\n"${data.quote}"\n\n📊 Score: ${score}/${total}\n\nReply with the person's name!\n_(Type *stop* to quit)_`;
            
            const sentMsg = await replyCtx.reply(prompt);
            
            pendingActions.set(replyCtx.chatId, sentMsg.key.id, {
              type: 'quote_game',
              userId: replyCtx.senderId,
              data: { answer: data.author.toLowerCase(), alt: data.alt, score, total },
              match: (text) => typeof text === 'string' && text.trim().length > 0,
              handler: async (answerCtx, pending) => {
                const userAnswer = answerCtx.text.trim().toLowerCase();
                
                if (userAnswer === 'stop') {
                  await answerCtx.reply(`*💬 Game Over!*\n\nFinal Score: ${pending.data.score}/${pending.data.total}\n\nThanks for playing!`);
                  return true;
                }
                
                const isCorrect = userAnswer === pending.data.answer || 
                                 userAnswer.includes(pending.data.answer) ||
                                 pending.data.answer.includes(userAnswer) ||
                                 pending.data.alt.some(a => userAnswer.includes(a) || a.includes(userAnswer));
                
                const newScore = isCorrect ? pending.data.score + 1 : pending.data.score;
                const newTotal = pending.data.total + 1;
                
                if (isCorrect) {
                  await answerCtx.reply(`✅ Correct! It was *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*!`);
                  if (shouldReact()) await answerCtx.react('🎉');
                } else {
                  await answerCtx.reply(`❌ Wrong! It was *${pending.data.answer.charAt(0).toUpperCase() + pending.data.answer.slice(1)}*`);
                }
                
                await sendNextQuote(answerCtx, newScore, newTotal);
                return false;
              },
              timeout: 2 * 60 * 1000
            });
          };
          
          await ctx.reply(`*💬 Quote Quiz Started!*\n\nGuess who said famous quotes.\nType *stop* anytime to quit.`);
          await sendNextQuote(ctx, 0, 0);
          
        } catch (error) {
          console.error('Quote error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'reaction',
      aliases: ['react', 'quickreact'],
      description: 'Test your reaction time',
      usage: '.reaction',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          await ctx.reply(`*⚡ Reaction Test*\n\nWait for it...\n\nWhen you see "GO!", reply as fast as you can!`);
          
          const delay = Math.floor(Math.random() * 5000) + 2000;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const startTime = Date.now();
          const sentMsg = await ctx.reply(`🟢 *GO GO GO!* 🟢\n\nReply NOW!`);
          
          pendingActions.set(ctx.chatId, sentMsg.key.id, {
            type: 'reaction_game',
            userId: ctx.senderId,
            data: { startTime },
            match: () => true,
            handler: async (replyCtx, pending) => {
              const endTime = Date.now();
              const reactionTime = endTime - pending.data.startTime;
              
              let response = `*⚡ Reaction Time*\n\n`;
              response += `Your reaction: *${reactionTime}ms*\n\n`;
              
              if (reactionTime < 200) {
                response += `🏆 Incredible! Lightning fast!`;
                if (shouldReact()) await replyCtx.react('⚡');
              } else if (reactionTime < 350) {
                response += `🥇 Excellent reflexes!`;
                if (shouldReact()) await replyCtx.react('🎉');
              } else if (reactionTime < 500) {
                response += `🥈 Good reaction time!`;
              } else if (reactionTime < 750) {
                response += `🥉 Not bad!`;
              } else {
                response += `Keep practicing! 💪`;
              }
              
              await replyCtx.reply(response);
            },
            timeout: 10 * 1000
          });
          
        } catch (error) {
          console.error('Reaction error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'slots',
      aliases: ['slot', 'slotmachine'],
      description: 'Play the slot machine',
      usage: '.slots',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        try {
          const symbols = ['🍎', '🍊', '🍋', '🍇', '🍒', '💎', '7️⃣', '🔔', '⭐', '🍀'];
          
          const result = [
            getRandomItem(symbols),
            getRandomItem(symbols),
            getRandomItem(symbols)
          ];
          
          let response = `*🎰 Slot Machine*\n\n`;
          response += `┌─────────────┐\n`;
          response += `│  ${result[0]}  ${result[1]}  ${result[2]}  │\n`;
          response += `└─────────────┘\n\n`;
          
          if (result[0] === result[1] && result[1] === result[2]) {
            if (result[0] === '💎') {
              response += `💎💎💎 *DIAMOND JACKPOT!* 💎💎💎`;
              if (shouldReact()) await ctx.react('💎');
            } else if (result[0] === '7️⃣') {
              response += `7️⃣7️⃣7️⃣ *LUCKY SEVENS!* 7️⃣7️⃣7️⃣`;
              if (shouldReact()) await ctx.react('🎰');
            } else {
              response += `🎉 *THREE ${result[0]}! YOU WIN!* 🎉`;
              if (shouldReact()) await ctx.react('🎉');
            }
          } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
            response += `✨ *Two matching! Small win!*`;
          } else {
            response += `😢 No match. Try again!`;
          }
          
          await ctx.reply(response);
          
        } catch (error) {
          console.error('Slots error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    },
    {
      name: 'fortune',
      aliases: ['fortunecookie', 'cookie'],
      description: 'Get a fortune cookie message',
      usage: '.fortune',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        const fortunes = [
          "A beautiful, smart, and loving person will be coming into your life.",
          "A dubious friend may be an enemy in camouflage.",
          "A faithful friend is a strong defense.",
          "A fresh start will put you on your way.",
          "A golden egg of opportunity falls into your lap this month.",
          "A good time to finish up old tasks.",
          "A lifetime of happiness lies ahead of you.",
          "A light heart carries you through all the hard times.",
          "A new perspective will come with the new year.",
          "A person is never too old to learn.",
          "A pleasant surprise is waiting for you.",
          "A smile is your passport into the hearts of others.",
          "A soft voice may be awfully persuasive.",
          "Adventure can be real happiness.",
          "All the effort you are making will ultimately pay off.",
          "All your hard work will soon pay off.",
          "An important person will offer you support.",
          "Be careful or you could fall for some tricks today.",
          "Believe in yourself and others will too.",
          "Better ask twice than lose yourself once."
        ];
        
        const fortune = getRandomItem(fortunes);
        const luckyNumbers = Array.from({length: 6}, () => Math.floor(Math.random() * 50) + 1);
        
        let response = `*🥠 Fortune Cookie*\n\n`;
        response += `"${fortune}"\n\n`;
        response += `Lucky Numbers: ${luckyNumbers.join(', ')}`;
        
        await ctx.reply(response);
      }
    },
    {
      name: 'wordle',
      aliases: ['wordguess'],
      description: 'Play Wordle - guess the 5 letter word',
      usage: '.wordle',
      category: 'games',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 10,
      async execute(ctx) {
        try {
          const words = ["apple", "beach", "crane", "dream", "eagle", "flame", "grape", "house", "image", "joker",
                        "knife", "lemon", "mango", "noble", "ocean", "piano", "queen", "river", "storm", "tiger",
                        "unity", "vivid", "water", "youth", "zebra", "brain", "chair", "dance", "earth", "frost"];
          
          const word = getRandomItem(words).toUpperCase();
          
          const prompt = `*🟩 Wordle*\n\nGuess the 5-letter word!\nYou have 6 attempts.\n\n🟩 = Correct letter, correct spot\n🟨 = Correct letter, wrong spot\n⬜ = Letter not in word\n\nReply with your first guess!`;
          
          const sentMsg = await ctx.reply(prompt);
          
          const setupWordle = (msgId, data) => {
            pendingActions.set(ctx.chatId, msgId, {
              type: 'wordle_game',
              userId: ctx.senderId,
              data,
              match: (text) => {
                if (typeof text !== 'string') return false;
                const clean = text.trim().toLowerCase();
                return clean.length === 5 && /^[a-z]+$/.test(clean);
              },
              handler: async (replyCtx, pending) => {
                const guess = replyCtx.text.trim().toUpperCase();
                pending.data.attempts++;
                
                let result = '';
                for (let i = 0; i < 5; i++) {
                  if (guess[i] === pending.data.word[i]) {
                    result += '🟩';
                  } else if (pending.data.word.includes(guess[i])) {
                    result += '🟨';
                  } else {
                    result += '⬜';
                  }
                }
                
                pending.data.history.push(`${guess}: ${result}`);
                
                if (guess === pending.data.word) {
                  let response = `*🟩 Wordle*\n\n${pending.data.history.join('\n')}\n\n🎉 *You got it in ${pending.data.attempts} tries!*`;
                  await replyCtx.reply(response);
                  if (shouldReact()) await replyCtx.react('🎉');
                  return true;
                }
                
                if (pending.data.attempts >= 6) {
                  let response = `*🟩 Wordle*\n\n${pending.data.history.join('\n')}\n\n😢 *Game Over!* The word was *${pending.data.word}*`;
                  await replyCtx.reply(response);
                  if (shouldReact()) await replyCtx.react('😢');
                  return true;
                }
                
                const remaining = 6 - pending.data.attempts;
                let response = `*🟩 Wordle*\n\n${pending.data.history.join('\n')}\n\n${remaining} attempts remaining. Guess again!`;
                const newMsg = await replyCtx.reply(response);
                
                setupWordle(newMsg.key.id, pending.data);
                return false;
              },
              timeout: 10 * 60 * 1000
            });
          };
          
          setupWordle(sentMsg.key.id, { word, attempts: 0, history: [] });
          
        } catch (error) {
          console.error('Wordle error:', error);
          await ctx.reply('An error occurred.');
        }
      }
    }
  ]
};
