/**
 * Letter-Name Alphabetic course: 6 units, 42 word sorts.
 * Each sort groups words under headers (a sound, a blend, a word family or a short vowel).
 * Words are plain strings; sound, meaning and emoji come from WORD_BANK (wordBank.ts).
 */

export type SortMode =
  | 'sort' // drag cards into header columns
  | 'quiz' // review: pick the initial sound of each picture (Sort 14)
  | 'assessment'; // exit check: initial sound + short vowel + final sound (Sort 42)

export interface SortCategory {
  id: string;
  /** What the header shows: "B", "sh", "-at", "Short a" */
  label: string;
  /** Key word for the header picture and audio */
  keyWord: string;
  /** IPA the header teaches, e.g. "/b/", "/æt/" */
  sound: string;
}

export interface WordSort {
  id: string;
  number: number;
  unitId: string;
  title: string;
  focusEs: string;
  mode: SortMode;
  categories: SortCategory[];
  /** word → category id ("oddball" for words that don't fit any header) */
  cards: Array<{ word: string; categoryId: string }>;
}

export interface CourseUnit {
  id: string;
  number: number;
  title: string;
  descriptionEs: string;
  emoji: string;
  color: string;
  sorts: WordSort[];
}

export const ODDBALL_ID = 'oddball';

const cat = (label: string, keyWord: string, sound: string, id = label): SortCategory => ({ id, label, keyWord, sound });
const oddball = (): SortCategory => ({ id: ODDBALL_ID, label: 'Oddball', keyWord: '', sound: '' });

/** Build a sort from { categoryId: [words] } */
function sort(
  number: number,
  unitId: string,
  title: string,
  focusEs: string,
  categories: SortCategory[],
  groups: Record<string, string[]>,
  mode: SortMode = 'sort'
): WordSort {
  return {
    id: `sort-${number}`,
    number,
    unitId,
    title,
    focusEs,
    mode,
    categories,
    cards: Object.entries(groups).flatMap(([categoryId, words]) => words.map((word) => ({ word, categoryId }))),
  };
}

// Initial consonants: one key word per letter, reused by the contrast sorts
const C = {
  B: cat('B', 'bat', '/b/'), M: cat('M', 'moon', '/m/'), R: cat('R', 'ring', '/r/'), S: cat('S', 'sun', '/s/'),
  T: cat('T', 'top', '/t/'), G: cat('G', 'gate', '/g/'), N: cat('N', 'nest', '/n/'), P: cat('P', 'pig', '/p/'),
  C: cat('C', 'cat', '/k/'), H: cat('H', 'hat', '/h/'), F: cat('F', 'fish', '/f/'), D: cat('D', 'dog', '/d/'),
  L: cat('L', 'leaf', '/l/'), K: cat('K', 'kite', '/k/'), J: cat('J', 'jar', '/dʒ/'), W: cat('W', 'web', '/w/'),
  Y: cat('Y', 'yarn', '/j/'), Z: cat('Z', 'zipper', '/z/'), V: cat('V', 'vase', '/v/'), Q: cat('Q', 'queen', '/kw/'),
};
/** Same consonant with a different key word, for contrast sorts whose cards include the usual key word */
const alt = (base: SortCategory, keyWord: string): SortCategory => ({ ...base, keyWord });

const U1 = 'unit-1';
const U2 = 'unit-2';
const U3 = 'unit-3';
const U4 = 'unit-4';
const U5 = 'unit-5';
const U6 = 'unit-6';

const unit1: WordSort[] = [
  sort(1, U1, 'B, M, R, S', 'Match each picture to the sound it starts with.', [C.B, C.M, C.R, C.S], {
    B: ['ball', 'bear', 'bed', 'boat'], M: ['man', 'map', 'mop', 'milk'], R: ['rain', 'rug', 'rope', 'rat'], S: ['sock', 'seal', 'soap', 'sink'],
  }),
  sort(2, U1, 'T, G, N, P', 'Listen to the first sound of each word.', [C.T, C.G, C.N, C.P], {
    T: ['tub', 'tire', 'tent', 'table'], G: ['goat', 'gum', 'girl', 'ghost'], N: ['net', 'nut', 'needle', 'nail'], P: ['pan', 'pen', 'pie', 'pot'],
  }),
  sort(3, U1, 'C, H, F, D', 'The C in "cat" sounds like /k/.', [C.C, C.H, C.F, C.D], {
    C: ['car', 'cup', 'cow', 'cap'], H: ['hen', 'horse', 'hand', 'house'], F: ['fan', 'foot', 'fox', 'fork'], D: ['duck', 'deer', 'door', 'doll'],
  }),
  sort(4, U1, 'L, K, J, W', 'J sounds like /dʒ/, as in "jam".', [C.L, C.K, C.J, C.W], {
    L: ['lock', 'lamb', 'log', 'light'], K: ['key', 'kangaroo', 'king'], J: ['jam', 'jug', 'jet', 'juice'], W: ['wagon', 'watch', 'worm', 'wing'],
  }),
  sort(5, U1, 'Y, Z, V, Q (qu)', 'Q always comes with U and sounds like /kw/.', [C.Y, C.Z, C.V, C.Q], {
    Y: ['yo-yo', 'yak', 'yell'], Z: ['zoo', 'zebra', 'zero'], V: ['vest', 'vine', 'van', 'volcano'], Q: ['quilt', 'quail', 'quick', 'question'],
  }),
  sort(6, U1, 'B, D, P', 'Don\'t mix up b, d and p: they look and sound alike.', [C.B, C.D, alt(C.P, 'pan')], {
    B: ['bird', 'bell', 'bus'], D: ['duck', 'dog', 'desk'], P: ['pie', 'pin', 'pig'],
  }),
  sort(7, U1, 'M, N, W', 'Nose sounds /m/ and /n/ vs. /w/.', [C.M, C.N, alt(C.W, 'wing')], {
    M: ['monkey', 'mouse', 'map'], N: ['nose', 'nine', 'net'], W: ['water', 'watch', 'web'],
  }),
  sort(8, U1, 'T, D, F', '/t/ and /d/ are made the same way; /d/ makes your throat buzz.', [C.T, alt(C.D, 'duck'), C.F], {
    T: ['turtle', 'tie', 'tent'], D: ['door', 'deer', 'dice'], F: ['feet', 'fish', 'fox'],
  }),
  sort(9, U1, 'S, C (hard), K', 'Hard C and K sound the same: /k/.', [C.S, C.C, C.K], {
    S: ['saw', 'soap', 'seal'], C: ['cup', 'coat', 'cap'], K: ['kite', 'kid', 'key'],
  }),
  sort(10, U1, 'G, J, H', 'G as in "gate" (/g/) vs. J (/dʒ/).', [alt(C.G, 'goat'), C.J, alt(C.H, 'horse')], {
    G: ['gate', 'girl', 'gum'], J: ['jar', 'jet', 'jeep'], H: ['heart', 'hat', 'home'],
  }),
  sort(11, U1, 'L, R, W', '/l/, /r/ and /w/ are easy to mix up.', [alt(C.L, 'lamb'), C.R, C.W], {
    L: ['leg', 'leaf', 'lion'], R: ['rabbit', 'rake', 'rug'], W: ['window', 'worm', 'wave'],
  }),
  sort(12, U1, 'F, V, W', 'For /f/ and /v/ you bite your lip; /v/ buzzes. For /w/ you round your lips.', [alt(C.F, 'fan'), C.V, C.W], {
    F: ['feather', 'fork', 'five'], V: ['violin', 'van', 'vine'], W: ['wood', 'wing', 'well'],
  }),
  sort(13, U1, 'P, T, C/K', 'Three quiet popping sounds.', [alt(C.P, 'pig'), C.T, { ...C.C, id: 'CK', label: 'C/K', keyWord: 'cow' }], {
    P: ['pan', 'pop', 'pencil'], T: ['toe', 'ten', 'tub'], CK: ['car', 'cat', 'kite'],
  }),
  // Sort 14: quiz built at runtime from the cards of Sorts 1–5 (one picture per consonant)
  sort(14, U1, 'Initial consonant review', 'Quick check: what sound does each picture start with?', [], {}, 'quiz'),
];

const unit2: WordSort[] = [
  sort(15, U2, 'Digraphs ch, sh, th, wh', 'Two letters, one sound.', [
    cat('ch', 'chair', '/tʃ/'), cat('sh', 'shoe', '/ʃ/'), cat('th', 'thumb', '/θ/'), cat('wh', 'wheel', '/w/'),
  ], {
    ch: ['chip', 'chick', 'cheese', 'chin'], sh: ['ship', 'shirt', 'shell', 'sheep'],
    th: ['thin', 'thimble', 'thermos', 'thorn'], wh: ['whistle', 'whale', 'whip', 'whiskers'],
  }),
  sort(16, U2, 'S-Blends: sp, st, sk/sc', 'You hear both sounds, close together.', [
    cat('sp', 'spoon', '/sp/'), cat('st', 'star', '/st/'), cat('sk/sc', 'skate', '/sk/', 'sk'),
  ], {
    sp: ['spider', 'spill', 'spot', 'space'], st: ['stop', 'stamp', 'stem', 'stairs'], sk: ['skirt', 'skeleton', 'scale', 'scarecrow'],
  }),
  sort(17, U2, 'S-Blends: sm, sn, sl, sw', '/s/ joins another consonant.', [
    cat('sm', 'smoke', '/sm/'), cat('sn', 'snake', '/sn/'), cat('sl', 'slide', '/sl/'), cat('sw', 'swing', '/sw/'),
  ], {
    sm: ['smile', 'smell', 'smash'], sn: ['snail', 'snap', 'snow'], sl: ['slip', 'sled', 'slug', 'sleep'], sw: ['sweet', 'swim', 'swan', 'switch'],
  }),
  sort(18, U2, 'L-Blends: bl, cl, fl, gl, pl, sl', 'Consonant + L at the start.', [
    cat('bl', 'block', '/bl/'), cat('cl', 'clock', '/kl/'), cat('fl', 'flag', '/fl/'), cat('pl', 'plane', '/pl/'),
    cat('gl', 'globe', '/gl/'), cat('sl', 'sleeve', '/sl/'),
  ], {
    bl: ['blanket', 'blow', 'blind'], cl: ['clown', 'claw', 'cloud'], fl: ['flower', 'fly', 'flute'], pl: ['plate', 'plant', 'plug'],
    gl: ['glue', 'glass'], sl: ['slipper', 'slide'],
  }),
  sort(19, U2, 'R-Blends: br, cr, dr, fr, gr, tr, pr', 'Consonant + R at the start.', [
    cat('br', 'broom', '/br/'), cat('cr', 'crab', '/kr/'), cat('dr', 'drum', '/dr/'), cat('tr', 'tree', '/tr/'),
    cat('fr', 'frog', '/fr/'), cat('gr', 'grapes', '/gr/'), cat('pr', 'prize', '/pr/'),
  ], {
    br: ['brush', 'bread', 'brick'], cr: ['crow', 'crib', 'crown'], dr: ['dress', 'dragon', 'drill'], tr: ['truck', 'train', 'trash'],
    fr: ['fruit', 'fridge'], gr: ['grass', 'green'], pr: ['present', 'pretzel'],
  }),
];

const unit3: WordSort[] = [
  sort(20, U3, 'Short A: -at, -an, -ad', 'Whole words that rhyme with the same vowel.', [
    cat('-at', 'cat', '/æt/'), cat('-an', 'pan', '/æn/'), cat('-ad', 'dad', '/æd/'),
  ], {
    '-at': ['bat', 'hat', 'mat', 'rat', 'sat', 'fat'], '-an': ['can', 'fan', 'man', 'ran', 'tan', 'van'], '-ad': ['bad', 'had', 'mad', 'pad', 'sad', 'glad'],
  }),
  sort(21, U3, 'Short A: -ap, -ag', 'Same vowel, different ending.', [cat('-ap', 'cap', '/æp/'), cat('-ag', 'bag', '/æg/')], {
    '-ap': ['map', 'tap', 'nap', 'lap', 'clap', 'trap'], '-ag': ['tag', 'rag', 'wag', 'flag', 'brag', 'drag'],
  }),
  sort(22, U3, 'Short I: -ip, -in, -ig', 'Short I sounds like /ɪ/.', [cat('-ip', 'lip', '/ɪp/'), cat('-in', 'pin', '/ɪn/'), cat('-ig', 'pig', '/ɪg/')], {
    '-ip': ['tip', 'rip', 'dip', 'sip', 'trip', 'ship'], '-in': ['bin', 'win', 'fin', 'chin', 'skin', 'grin'], '-ig': ['big', 'dig', 'fig', 'wig', 'twig', 'jig'],
  }),
  sort(23, U3, 'Short O: -ot, -op, -og', 'Short O sounds like /ɒ/, with your mouth open.', [cat('-ot', 'pot', '/ɒt/'), cat('-op', 'mop', '/ɒp/'), cat('-og', 'dog', '/ɒg/')], {
    '-ot': ['hot', 'cot', 'dot', 'got', 'not', 'spot'], '-op': ['hop', 'top', 'pop', 'stop', 'drop', 'shop'], '-og': ['frog', 'log', 'fog', 'jog', 'hog', 'clog'],
  }),
  sort(24, U3, 'Short U and E', 'Short U /ʌ/ and short E /ɛ/.', [
    cat('-ug', 'bug', '/ʌg/'), cat('-ut', 'cut', '/ʌt/'), cat('-un', 'sun', '/ʌn/'), cat('-et', 'jet', '/ɛt/'), cat('-en', 'hen', '/ɛn/'), cat('-ed', 'bed', '/ɛd/'),
  ], {
    '-ug': ['hug', 'jug', 'rug', 'mug'], '-ut': ['nut', 'hut'], '-un': ['run', 'fun', 'bun', 'spun'],
    '-et': ['net', 'wet', 'pet', 'set', 'get'], '-en': ['pen', 'ten', 'men'], '-ed': ['red', 'fed'],
  }),
];

const unit4: WordSort[] = [
  sort(25, U4, 'Mixed vowels: -at, -ot, -it', 'The vowel changes, the final T stays.', [cat('-at', 'cat', '/æt/'), cat('-ot', 'pot', '/ɒt/'), cat('-it', 'sit', '/ɪt/')], {
    '-at': ['hat', 'bat', 'mat', 'rat', 'fat', 'sat', 'flat'], '-ot': ['hot', 'cot', 'dot', 'got', 'not', 'lot', 'spot'], '-it': ['fit', 'hit', 'bit', 'lit', 'pit', 'kit', 'quit'],
  }),
  sort(26, U4, 'Mixed vowels: -an, -in, -en, -un', 'Four vowels with final N.', [cat('-an', 'can', '/æn/'), cat('-in', 'pin', '/ɪn/'), cat('-en', 'ten', '/ɛn/'), cat('-un', 'sun', '/ʌn/')], {
    '-an': ['fan', 'man', 'ran', 'pan', 'plan', 'than'], '-in': ['thin', 'skin', 'win', 'chin', 'grin', 'fin'],
    '-en': ['then', 'pen', 'hen', 'when', 'men', 'den'], '-un': ['run', 'fun', 'bun', 'spun', 'gun', 'nun'],
  }),
  sort(27, U4, 'Mixed vowels: -ad, -ed, -id, -od, -ud', 'All five short vowels with final D.', [
    cat('-ad', 'bad', '/æd/'), cat('-ed', 'red', '/ɛd/'), cat('-id', 'kid', '/ɪd/'), cat('-od', 'pod', '/ɒd/'), cat('-ud', 'mud', '/ʌd/'),
  ], {
    '-ad': ['dad', 'had', 'mad', 'sad', 'glad', 'pad'], '-ed': ['bed', 'fed', 'led', 'sled', 'wed'], '-id': ['hid', 'lid', 'did', 'grid', 'slid', 'rid'],
    '-od': ['rod', 'cod', 'nod', 'plod'], '-ud': ['bud', 'dud', 'thud'],
  }),
  sort(28, U4, 'Mixed vowels: -ag, -eg, -ig, -og, -ug', 'All five short vowels with final G.', [
    cat('-ag', 'bag', '/æg/'), cat('-eg', 'leg', '/ɛg/'), cat('-ig', 'pig', '/ɪg/'), cat('-og', 'dog', '/ɒg/'), cat('-ug', 'bug', '/ʌg/'),
  ], {
    '-ag': ['tag', 'rag', 'wag', 'flag', 'drag', 'brag'], '-eg': ['peg', 'beg', 'keg'], '-ig': ['big', 'dig', 'fig', 'wig', 'twig', 'jig'],
    '-og': ['frog', 'log', 'fog', 'jog', 'hog', 'clog'], '-ug': ['hug', 'jug', 'mug', 'plug', 'rug', 'tug', 'slug'],
  }),
  sort(29, U4, 'Mixed vowels: -ap, -ip, -op, -up', 'Four vowels with final P.', [cat('-ap', 'cap', '/æp/'), cat('-ip', 'lip', '/ɪp/'), cat('-op', 'mop', '/ɒp/'), cat('-up', 'cup', '/ʌp/')], {
    '-ap': ['map', 'tap', 'nap', 'clap', 'trap', 'snap', 'flap'], '-ip': ['tip', 'rip', 'dip', 'ship', 'trip', 'slip', 'drip', 'skip'],
    '-op': ['hop', 'top', 'pop', 'drop', 'stop', 'shop', 'chop'], '-up': ['pup', 'sup'],
  }),
  sort(30, U4, 'Mixed vowels: -am, -em, -im, -om, -um', 'All five short vowels with final M. Watch out for oddballs.', [
    cat('-am', 'jam', '/æm/'), cat('-em', 'hem', '/ɛm/'), cat('-im', 'swim', '/ɪm/'), cat('-om', 'mom', '/ɒm/'), cat('-um', 'gum', '/ʌm/'), oddball(),
  ], {
    '-am': ['ham', 'ram', 'slam', 'clam', 'yam', 'swam'], '-em': ['stem', 'gem'], '-im': ['him', 'rim', 'slim', 'trim', 'skim', 'dim'],
    '-om': ['prom'], '-um': ['drum', 'hum', 'plum', 'sum', 'chum'], [ODDBALL_ID]: ['from', 'bomb'],
  }),
];

const unit5: WordSort[] = [
  sort(31, U5, 'Final digraph -ck: -ack, -ick, -ock, -uck', 'After a short vowel, /k/ is spelled ck.', [
    cat('-ack', 'black', '/æk/'), cat('-ick', 'kick', '/ɪk/'), cat('-ock', 'clock', '/ɒk/'), cat('-uck', 'duck', '/ʌk/'),
  ], {
    '-ack': ['back', 'pack', 'sack', 'track', 'crack', 'shack', 'quack'], '-ick': ['sick', 'pick', 'stick', 'brick', 'trick', 'quick', 'thick'],
    '-ock': ['lock', 'sock', 'rock', 'block', 'shock', 'knock'], '-uck': ['truck', 'luck', 'suck', 'cluck', 'tuck', 'stuck'],
  }),
  sort(32, U5, 'Final digraph -sh: -ash, -ish, -ush', 'The /ʃ/ sound can also come at the end.', [cat('-ash', 'trash', '/æʃ/'), cat('-ish', 'fish', '/ɪʃ/'), cat('-ush', 'brush', '/ʌʃ/')], {
    '-ash': ['cash', 'dash', 'flash', 'mash', 'smash', 'crash', 'splash'], '-ish': ['wish', 'dish', 'swish'], '-ush': ['rush', 'crush', 'flush', 'mush', 'hush', 'blush'],
  }),
  sort(33, U5, 'Final double L: -ell, -ill, -all', 'L is doubled after a short vowel. "-all" sounds like /ɔːl/.', [
    cat('-ell', 'bell', '/ɛl/'), cat('-ill', 'hill', '/ɪl/'), cat('-all', 'ball', '/ɔːl/'), oddball(),
  ], {
    '-ell': ['tell', 'sell', 'well', 'yell', 'smell', 'spell', 'shell'], '-ill': ['fill', 'pill', 'will', 'spill', 'drill', 'chill'],
    '-all': ['fall', 'call', 'tall', 'wall', 'small', 'stall'], [ODDBALL_ID]: ['roll', 'doll'],
  }),
  sort(34, U5, 'Review: -at, -an, -ap, -ag, -ack', 'Mixed check of the short A families.', [
    cat('-at', 'cat', '/æt/'), cat('-an', 'can', '/æn/'), cat('-ap', 'cap', '/æp/'), cat('-ag', 'bag', '/æg/'), cat('-ack', 'black', '/æk/'),
  ], {
    '-at': ['bat', 'flat', 'sat', 'hat'], '-an': ['fan', 'pan', 'man', 'plan'], '-ap': ['map', 'trap', 'clap', 'nap'],
    '-ag': ['tag', 'flag', 'brag', 'rag'], '-ack': ['back', 'pack', 'track', 'sack'],
  }),
];

const unit6: WordSort[] = [
  sort(35, U6, 'Short a vs. Short o', 'No fixed rhyme now: listen only to the middle vowel.', [cat('Short a', 'cat', '/æ/', 'a'), cat('Short o', 'pot', '/ɒ/', 'o')], {
    a: ['map', 'fan', 'bat', 'sack', 'mad', 'tag', 'cap'], o: ['mop', 'hot', 'box', 'lock', 'rod', 'top', 'fox'],
  }),
  sort(36, U6, 'Short i vs. Short u', 'Listen to the middle vowel.', [cat('Short i', 'pin', '/ɪ/', 'i'), cat('Short u', 'sun', '/ʌ/', 'u')], {
    i: ['pig', 'lip', 'hit', 'sit', 'kick', 'swim', 'kid'], u: ['bug', 'cup', 'mud', 'bus', 'drum', 'rug', 'nut'],
  }),
  sort(37, U6, 'Short e vs. Short a', 'Front-of-the-mouth vowels: /ɛ/ and /æ/.', [cat('Short e', 'red', '/ɛ/', 'e'), cat('Short a', 'bad', '/æ/', 'a')], {
    e: ['bed', 'pen', 'ten', 'leg', 'bell', 'men', 'get'], a: ['dad', 'pan', 'tan', 'tag', 'bag', 'man', 'cat'],
  }),
  sort(38, U6, 'Short e, i, o', 'Tell three vowels apart.', [cat('Short e', 'bed', '/ɛ/', 'e'), cat('Short i', 'pig', '/ɪ/', 'i'), cat('Short o', 'box', '/ɒ/', 'o')], {
    e: ['leg', 'ten', 'web', 'wet', 'hen', 'net'], i: ['wig', 'lip', 'six', 'fin', 'hit', 'kid'], o: ['dog', 'fox', 'top', 'pot', 'lock', 'mop'],
  }),
  sort(39, U6, 'Short a, i, u', 'Three very different vowels.', [cat('Short a', 'bag', '/æ/', 'a'), cat('Short i', 'pig', '/ɪ/', 'i'), cat('Short u', 'bug', '/ʌ/', 'u')], {
    a: ['cat', 'hat', 'fan', 'clap', 'rack', 'mad'], i: ['sit', 'fit', 'pin', 'trip', 'sick', 'hid'], u: ['hut', 'cup', 'run', 'truck', 'duck', 'mud'],
  }),
  sort(40, U6, 'Short e vs. Short i', 'The hardest pair: /ɛ/ opens your mouth wider than /ɪ/.', [cat('Short e', 'pen', '/ɛ/', 'e'), cat('Short i', 'pin', '/ɪ/', 'i')], {
    e: ['ten', 'den', 'hen', 'men', 'bed', 'red', 'fell'], i: ['tin', 'din', 'chin', 'win', 'bid', 'rid', 'fill'],
  }),
  sort(41, U6, 'CVC review: a, e, i, o, u', 'All five short vowels.', [
    cat('a', 'cat', '/æ/'), cat('e', 'bed', '/ɛ/'), cat('i', 'pig', '/ɪ/'), cat('o', 'pot', '/ɒ/'), cat('u', 'sun', '/ʌ/'),
  ], {
    a: ['bat', 'cap', 'mad', 'fast'], e: ['wet', 'leg', 'nest', 'red'], i: ['sit', 'win', 'kick', 'list'], o: ['mop', 'pot', 'drop', 'rock'], u: ['tub', 'run', 'plum', 'jump'],
  }),
  // Sort 42: exit assessment built at runtime (initial sound, short vowel, final sound)
  sort(42, U6, 'Final assessment', 'Checks initial sound, short vowel and final sound before moving on to long vowels (Within Word Pattern).', [], {}, 'assessment'),
];

export const COURSE_UNITS: CourseUnit[] = [
  { id: U1, number: 1, title: 'Initial consonants', descriptionEs: 'Match pictures by the sound they start with.', emoji: '🔤', color: 'from-amber-400 to-orange-500', sorts: unit1 },
  { id: U2, number: 2, title: 'Initial digraphs and blends', descriptionEs: 'Two-letter sounds at the start: ch, sh, th, wh and blends with s, l, r.', emoji: '🧩', color: 'from-pink-400 to-rose-500', sorts: unit2 },
  { id: U3, number: 3, title: 'Word families (same vowel)', descriptionEs: 'Read whole CVC words grouped by the same short vowel.', emoji: '🏠', color: 'from-emerald-400 to-teal-500', sorts: unit3 },
  { id: U4, number: 4, title: 'Mixed-vowel families', descriptionEs: 'Compare short vowels with the same final consonant.', emoji: '🔀', color: 'from-sky-400 to-blue-500', sorts: unit4 },
  { id: U5, number: 5, title: 'Endings -ck, -sh and double consonants', descriptionEs: 'Final digraphs and -ll endings.', emoji: '🔗', color: 'from-violet-400 to-purple-500', sorts: unit5 },
  { id: U6, number: 6, title: 'Short vowels without a fixed rhyme', descriptionEs: 'Find the middle vowel in CVC words.', emoji: '🎯', color: 'from-lime-400 to-green-500', sorts: unit6 },
];

export const ALL_SORTS: WordSort[] = COURSE_UNITS.flatMap((u) => u.sorts);

/** Every word used anywhere in the course (cards and header key words) */
export function courseWords(): string[] {
  const words = new Set<string>();
  for (const s of ALL_SORTS) {
    s.cards.forEach((c) => words.add(c.word));
    s.categories.forEach((c) => c.keyWord && words.add(c.keyWord));
  }
  return [...words].sort();
}
