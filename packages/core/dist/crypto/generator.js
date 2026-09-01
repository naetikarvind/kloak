"use strict";
/**
 * Kloak Core — Password & EFF Passphrase Generator
 * Cryptographically secure generation with entropy & strength analysis.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EFF_WORDLIST = void 0;
exports.generatePassword = generatePassword;
exports.generatePassphrase = generatePassphrase;
exports.evaluatePasswordStrength = evaluatePasswordStrength;
const crypto = __importStar(require("node:crypto"));
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS_CHARS = '0O1lI|[]{}()/\'"`~,;:.<>';
/**
 * Curated high-entropy EFF Long Wordlist sample (subset of 7776 EFF words).
 */
exports.EFF_WORDLIST = [
    'abacus', 'abdomen', 'abdominal', 'abide', 'abiding', 'ability', 'ablaze', 'able', 'abnormal', 'abrasion',
    'abrasive', 'abreast', 'abroad', 'abrupt', 'absence', 'absent', 'absolute', 'absorb', 'abstract', 'absurd',
    'abundant', 'abuse', 'academic', 'academy', 'accelerate', 'accent', 'accented', 'accept', 'access', 'accessible',
    'accident', 'acclaim', 'acclimate', 'accompany', 'accomplish', 'accord', 'account', 'accused', 'acerbic', 'achieve',
    'acid', 'acorn', 'acoustic', 'acquaint', 'acquire', 'acre', 'acrobat', 'acronym', 'across', 'acting',
    'action', 'activate', 'active', 'activism', 'activity', 'actor', 'actress', 'actual', 'acuity', 'acute',
    'adamant', 'adapt', 'adaptive', 'add', 'addict', 'addition', 'address', 'adequate', 'adhesive', 'adjacent',
    'adjoin', 'adjust', 'admin', 'admire', 'admission', 'admit', 'adobe', 'adopt', 'adoptive', 'adorable',
    'adorn', 'adult', 'advance', 'advent', 'adventure', 'adverse', 'advertise', 'advice', 'adviser', 'advocate',
    'aeration', 'aerial', 'aerobic', 'aerospace', 'aesthetic', 'affair', 'affect', 'affection', 'affidavit', 'affiliate',
    'affine', 'affirm', 'afflict', 'affluent', 'afford', 'affront', 'afloat', 'afraid', 'afterglow', 'afterlife',
    'afternoon', 'aftertaste', 'afterward', 'agate', 'age', 'aged', 'agency', 'agenda', 'agent', 'aggression',
    'agile', 'agility', 'aging', 'agitate', 'agonize', 'agony', 'agree', 'agreement', 'ahead', 'aid',
    'aide', 'aim', 'aimless', 'air', 'airborne', 'aircraft', 'airdrop', 'airfare', 'airfield', 'airgun',
    'airline', 'airmail', 'airman', 'airplane', 'airplay', 'airport', 'airship', 'airtight', 'airway', 'airy',
    'aisle', 'alarm', 'alarming', 'albatross', 'albedo', 'album', 'alcohol', 'alcove', 'alder', 'alert',
    'algebra', 'algorithm', 'alias', 'alibi', 'alien', 'align', 'alignment', 'alike', 'alimony', 'alive',
    'alkali', 'allay', 'allegation', 'allege', 'allegro', 'allergy', 'alliance', 'allied', 'alligator', 'allocate',
    'allot', 'allow', 'alloy', 'allude', 'allure', 'allusion', 'almanac', 'almond', 'almost', 'alms',
    'aloft', 'aloha', 'alone', 'along', 'alongside', 'aloof', 'aloud', 'alpha', 'alphabet', 'alpine',
    'already', 'alright', 'also', 'altar', 'alter', 'alternate', 'altitude', 'alto', 'aluminum', 'alumni',
    'always', 'amalgam', 'amass', 'amateur', 'amaze', 'amazon', 'amber', 'ambiance', 'ambiguity', 'ambition',
    'amble', 'ambulance', 'ambush', 'amenable', 'amend', 'amendment', 'amenity', 'amiable', 'amicable', 'amid',
    'amigo', 'amino', 'amiss', 'ammo', 'ammonia', 'amnesia', 'amnesty', 'amoeba', 'amok', 'among',
    'amorphous', 'amount', 'amp', 'ample', 'amplifier', 'amplify', 'amplitude', 'amputate', 'amuse', 'amusing',
    'anaconda', 'anagram', 'analog', 'analogy', 'analysis', 'analyze', 'anchor', 'anchovy', 'ancient', 'android',
    'anecdote', 'anemone', 'angel', 'angelic', 'anger', 'angle', 'angora', 'angry', 'anguish', 'animal',
    'animate', 'animation', 'animosity', 'animus', 'anise', 'ankle', 'annex', 'announce', 'annoy', 'annual',
    'anomaly', 'anonymous', 'another', 'answer', 'ant', 'antacid', 'anteater', 'antelope', 'antenna', 'anthem',
    'anthology', 'antibody', 'antic', 'antidote', 'antifreeze', 'antigen', 'antique', 'antiquity', 'antler', 'antonym',
    'anvil', 'anxiety', 'anxious', 'anybody', 'anyhow', 'anymore', 'anyone', 'anyplace', 'anything', 'anytime',
    'anyway', 'anywhere', 'aorta', 'apache', 'apart', 'apartment', 'apathy', 'apex', 'aphid', 'aplomb',
    'apology', 'apostle', 'appalled', 'apparel', 'appeal', 'appear', 'appearance', 'appease', 'appendix', 'appetite',
    'applaud', 'applause', 'apple', 'appliance', 'applicant', 'apply', 'appoint', 'appraise', 'appreciate', 'approach',
    'approval', 'approve', 'apricot', 'april', 'apron', 'aptitude', 'aquarium', 'aquatic', 'aqueduct', 'arbitrary',
    'arcade', 'arch', 'archaeology', 'archer', 'archetype', 'archipelago', 'architect', 'archive', 'ardent', 'ardor',
    'arena', 'argon', 'arguable', 'argue', 'argument', 'arid', 'arise', 'arm', 'armada', 'armadillo',
    'armband', 'armchair', 'armor', 'armory', 'armpit', 'army', 'aroma', 'arose', 'around', 'arouse',
    'arrange', 'array', 'arrest', 'arrival', 'arrive', 'arrogance', 'arrow', 'arsenal', 'arsenic', 'arson',
    'art', 'artery', 'artful', 'article', 'artisan', 'artist', 'artistic', 'artwork', 'asbestos', 'ascend',
    'ascent', 'ascertain', 'ascribe', 'ash', 'ashamed', 'ashen', 'ashes', 'ashy', 'aside', 'ask',
    'askew', 'asleep', 'asparagus', 'aspect', 'asphalt', 'aspire', 'aspirin', 'assailant', 'assassin', 'assault',
    'assemble', 'assembly', 'assert', 'assess', 'asset', 'assign', 'assist', 'assistant', 'associate', 'assortment',
    'assume', 'assurance', 'assure', 'asteroid', 'astonish', 'astound', 'astral', 'astrology', 'astronaut', 'astronomy',
    'astute', 'asylum', 'athlete', 'athletic', 'atlas', 'atmosphere', 'atom', 'atomic', 'atonement', 'atrium',
    'attach', 'attack', 'attain', 'attempt', 'attend', 'attention', 'attitude', 'attorney', 'attract', 'attraction',
    'attribute', 'auction', 'audacity', 'audience', 'audio', 'audit', 'auditorium', 'augment', 'august', 'aunt',
    'aura', 'aural', 'aurora', 'author', 'authority', 'authorize', 'autism', 'auto', 'automate', 'automotive',
    'autonomy', 'autopsy', 'autumn', 'auxiliary', 'avail', 'avalanche', 'avatar', 'avenue', 'average', 'aversion',
    'avert', 'aviation', 'aviator', 'avid', 'avocado', 'avoid', 'await', 'awake', 'awaken', 'award',
    'aware', 'awareness', 'away', 'awesome', 'awful', 'awkward', 'awning', 'awoke', 'axe', 'axiom',
    'axis', 'axle', 'azalea', 'azure', 'babble', 'baboon', 'baby', 'bachelor', 'backbone', 'backdrop',
    'backer', 'backfire', 'backgammon', 'background', 'backhand', 'backing', 'backlash', 'backlog', 'backpack', 'backrest',
    'backseat', 'backside', 'backspace', 'backstage', 'backtrack', 'backup', 'backward', 'backyard', 'bacon', 'bacteria',
    'bacterium', 'badge', 'badger', 'badly', 'baffle', 'bag', 'bagel', 'baggage', 'bagpipe', 'baguette',
    'bail', 'bait', 'bake', 'baker', 'bakery', 'balance', 'balcony', 'bald', 'bale', 'ball',
    'ballad', 'ballast', 'ballerina', 'balloon', 'ballot', 'ballroom', 'bamboo', 'banana', 'band', 'bandage',
    'bandana', 'bandit', 'bandwidth', 'bane', 'bang', 'bangle', 'banish', 'banister', 'banjo', 'bank',
    'banker', 'banking', 'bankrupt', 'banner', 'banquet', 'banshee', 'barbecue', 'barbell', 'barber', 'bare',
    'barefoot', 'barely', 'bargain', 'barge', 'baritone', 'bark', 'barley', 'barn', 'barometer', 'baron',
    'barrack', 'barrel', 'barrier', 'barter', 'base', 'baseball', 'basement', 'bashful', 'basic', 'basin',
    'basis', 'basket', 'basketball', 'bass', 'bassoon', 'bastion', 'batch', 'bath', 'bathe', 'bathhouse',
    'bathrobe', 'bathroom', 'bathtub', 'baton', 'battery', 'battle', 'battleship', 'bauble', 'bay', 'bayonet',
    'bayou', 'bazaar', 'beacon', 'bead', 'beagle', 'beak', 'beam', 'bean', 'bear', 'beard',
    'beast', 'beat', 'beautician', 'beautiful', 'beauty', 'beaver', 'because', 'become', 'bed', 'bedbug',
    'bedclothes', 'bedcover', 'bedding', 'bedpan', 'bedpost', 'bedrock', 'bedroom', 'bedside', 'bedspread', 'bedtime',
    'beech', 'beef', 'beefsteak', 'beehive', 'beep', 'beer', 'beet', 'beetle', 'before', 'beggar',
    'begin', 'beginner', 'beginning', 'begonia', 'behalf', 'behave', 'behavior', 'behead', 'behind', 'behold',
    'beige', 'being', 'belch', 'belfry', 'belief', 'believer', 'belittle', 'bell', 'bellhop', 'bellow',
    'belly', 'belong', 'belongings', 'beloved', 'below', 'belt', 'bemoan', 'bench', 'benchmark', 'bend',
    'beneath', 'benefit', 'benzene', 'beret', 'berry', 'berserk', 'berth', 'beryl', 'beseech', 'beside',
    'besides', 'besiege', 'best', 'bestow', 'bet', 'beta', 'betray', 'betrayal', 'better', 'between',
    'beverage', 'beware', 'bewilder', 'beyond', 'bias', 'bib', 'bible', 'bicycle', 'bid', 'bide',
    'bifocals', 'big', 'bike', 'bikini', 'bilateral', 'billboard', 'billiards', 'billion', 'bin', 'binary',
    'bind', 'binder', 'bingo', 'binoculars', 'biology', 'bionic', 'biopsy', 'biosphere', 'biplane', 'birch',
    'bird', 'birdbath', 'birdcage', 'birdhouse', 'birth', 'birthday', 'birthmark', 'birthplace', 'biscuit', 'bishop',
    'bison', 'bit', 'bite', 'biting', 'bitter', 'bitumen', 'bizarre', 'black', 'blackberry', 'blackbird',
    'blackboard', 'blackcurrant', 'blackhead', 'blackjack', 'blackleg', 'blacklist', 'blackmail', 'blackout', 'blacksmith', 'bladder',
    'blade', 'blame', 'blameless', 'blanch', 'bland', 'blank', 'blanket', 'blast', 'blatant', 'blaze',
    'bleach', 'bleak', 'bleat', 'bleed', 'blemish', 'blend', 'blender', 'bless', 'blessing', 'blight',
    'blind', 'blindfold', 'blindness', 'blink', 'blinker', 'bliss', 'blissful', 'blister', 'blizzard', 'bloat',
    'blob', 'bloc', 'block', 'blockade', 'blockbuster', 'blockhead', 'blockhouse', 'blond', 'blood', 'bloodbath',
    'bloodcurdling', 'bloodhound', 'bloodless', 'bloodline', 'bloodshed', 'bloodshot', 'bloodstain', 'bloodstream', 'bloody', 'bloom',
    'bloomer', 'blossom', 'blot', 'blotch', 'blouse', 'blow', 'blower', 'blowgun', 'blowlamp', 'blowpipe',
    'blowtorch', 'blubber', 'bludgeon', 'blue', 'bluebell', 'blueberry', 'bluebird', 'bluebottle', 'blueprint', 'blues',
    'bluff', 'bluish', 'blunder', 'blunt', 'blur', 'blurt', 'blush', 'bluster', 'boa', 'boar',
    'board', 'boarder', 'boarding', 'boardroom', 'boardwalk', 'boast', 'boastful', 'boat', 'boater', 'boathouse',
    'boatman', 'bob', 'bobbin', 'bobcat', 'bobsled', 'bode', 'bodice', 'body', 'bodyguard', 'bog',
    'bogus', 'boil', 'boiler', 'boiling', 'bold', 'boldface', 'boldly', 'boldness', 'bolero', 'bologna',
    'bolster', 'bolt', 'bomb', 'bombard', 'bombardment', 'bomber', 'bonanza', 'bond', 'bondage', 'bone',
    'bonfire', 'bonnet', 'bonsai', 'bonus', 'bony', 'boo', 'booby', 'book', 'bookcase', 'bookend',
    'bookkeeper', 'booklet', 'bookmark', 'bookseller', 'bookshelf', 'bookshop', 'bookstore', 'bookworm', 'boom', 'boomerang'
];
/**
 * Generates a cryptographically random integer in [0, max).
 */
function secureRandomInt(max) {
    return crypto.randomInt(0, max);
}
/**
 * Generates a random password conforming to the provided options.
 */
function generatePassword(options = {}) {
    const length = Math.max(4, Math.min(128, options.length ?? 20));
    const useUpper = options.uppercase ?? true;
    const useLower = options.lowercase ?? true;
    const useNumbers = options.numbers ?? true;
    const useSymbols = options.symbols ?? true;
    const avoidAmbiguous = options.avoidAmbiguous ?? false;
    let upperPool = UPPERCASE_CHARS;
    let lowerPool = LOWERCASE_CHARS;
    let numberPool = NUMBER_CHARS;
    let symbolPool = SYMBOL_CHARS;
    if (avoidAmbiguous) {
        upperPool = upperPool.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
        lowerPool = lowerPool.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
        numberPool = numberPool.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
        symbolPool = symbolPool.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }
    const selectedPools = [];
    if (useUpper && upperPool.length > 0)
        selectedPools.push({ pool: upperPool, required: options.minUppercase ?? 1 });
    if (useLower && lowerPool.length > 0)
        selectedPools.push({ pool: lowerPool, required: options.minLowercase ?? 1 });
    if (useNumbers && numberPool.length > 0)
        selectedPools.push({ pool: numberPool, required: options.minNumbers ?? 1 });
    if (useSymbols && symbolPool.length > 0)
        selectedPools.push({ pool: symbolPool, required: options.minSymbols ?? 1 });
    if (selectedPools.length === 0) {
        // Fallback if all disabled
        selectedPools.push({ pool: lowerPool, required: 1 });
    }
    const combinedPool = selectedPools.map(p => p.pool).join('');
    const resultChars = [];
    // Guarantee minimums
    for (const { pool, required } of selectedPools) {
        for (let r = 0; r < required && resultChars.length < length; r++) {
            resultChars.push(pool[secureRandomInt(pool.length)]);
        }
    }
    // Fill remainder
    while (resultChars.length < length) {
        resultChars.push(combinedPool[secureRandomInt(combinedPool.length)]);
    }
    // Cryptographically shuffle
    for (let i = resultChars.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);
        const temp = resultChars[i];
        resultChars[i] = resultChars[j];
        resultChars[j] = temp;
    }
    return resultChars.join('');
}
/**
 * Generates an EFF multi-word passphrase.
 */
function generatePassphrase(options = {}) {
    const count = Math.max(3, Math.min(12, options.wordsCount ?? 4));
    const separator = options.separator ?? '-';
    const capitalize = options.capitalize ?? 'title';
    const includeNumber = options.includeNumber ?? true;
    const words = [];
    for (let i = 0; i < count; i++) {
        let word = exports.EFF_WORDLIST[secureRandomInt(exports.EFF_WORDLIST.length)];
        if (capitalize === 'title') {
            word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        else if (capitalize === 'upper') {
            word = word.toUpperCase();
        }
        else if (capitalize === 'lower') {
            word = word.toLowerCase();
        }
        else if (capitalize === 'random') {
            word = Math.random() > 0.5 ? word.charAt(0).toUpperCase() + word.slice(1) : word.toLowerCase();
        }
        words.push(word);
    }
    if (includeNumber) {
        const num = secureRandomInt(100);
        const insertIdx = secureRandomInt(words.length);
        words[insertIdx] = `${words[insertIdx]}${num}`;
    }
    return words.join(separator);
}
/**
 * Analyzes password strength and Shannon entropy.
 */
function evaluatePasswordStrength(password) {
    if (!password || password.length === 0) {
        return {
            score: 0,
            entropyBits: 0,
            label: 'Very Weak',
            suggestions: ['Password cannot be blank.'],
            crackTimeDisplay: 'Instant'
        };
    }
    let poolSize = 0;
    if (/[a-z]/.test(password))
        poolSize += 26;
    if (/[A-Z]/.test(password))
        poolSize += 26;
    if (/[0-9]/.test(password))
        poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password))
        poolSize += 33;
    const entropyBits = Math.round(password.length * Math.log2(Math.max(2, poolSize)));
    const suggestions = [];
    if (password.length < 10)
        suggestions.push('Make it at least 12-16 characters long.');
    if (!/[A-Z]/.test(password))
        suggestions.push('Include uppercase letters.');
    if (!/[a-z]/.test(password))
        suggestions.push('Include lowercase letters.');
    if (!/[0-9]/.test(password))
        suggestions.push('Include numbers.');
    if (!/[^a-zA-Z0-9]/.test(password))
        suggestions.push('Include symbols.');
    let score = 0;
    let label = 'Very Weak';
    let crackTimeDisplay = 'Instant';
    if (entropyBits < 28) {
        score = 0;
        label = 'Very Weak';
        crackTimeDisplay = 'Seconds';
    }
    else if (entropyBits < 45) {
        score = 1;
        label = 'Weak';
        crackTimeDisplay = 'Hours to Days';
    }
    else if (entropyBits < 60) {
        score = 2;
        label = 'Fair';
        crackTimeDisplay = 'Months';
    }
    else if (entropyBits < 80) {
        score = 3;
        label = 'Strong';
        crackTimeDisplay = 'Decades';
    }
    else {
        score = 4;
        label = 'Very Strong';
        crackTimeDisplay = 'Centuries / Billions of Years';
    }
    return {
        score,
        entropyBits,
        label,
        suggestions,
        crackTimeDisplay
    };
}
//# sourceMappingURL=generator.js.map