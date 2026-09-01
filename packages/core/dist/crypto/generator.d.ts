/**
 * Kloak Core — Password & EFF Passphrase Generator
 * Cryptographically secure generation with entropy & strength analysis.
 */
export interface PasswordGeneratorOptions {
    length?: number;
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
    avoidAmbiguous?: boolean;
    minUppercase?: number;
    minLowercase?: number;
    minNumbers?: number;
    minSymbols?: number;
}
export interface PassphraseGeneratorOptions {
    wordsCount?: number;
    separator?: string;
    capitalize?: 'title' | 'lower' | 'upper' | 'random';
    includeNumber?: boolean;
}
export interface PasswordStrengthResult {
    score: 0 | 1 | 2 | 3 | 4;
    entropyBits: number;
    label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
    warning?: string;
    suggestions: string[];
    crackTimeDisplay: string;
}
/**
 * Curated high-entropy EFF Long Wordlist sample (subset of 7776 EFF words).
 */
export declare const EFF_WORDLIST: string[];
/**
 * Generates a random password conforming to the provided options.
 */
export declare function generatePassword(options?: PasswordGeneratorOptions): string;
/**
 * Generates an EFF multi-word passphrase.
 */
export declare function generatePassphrase(options?: PassphraseGeneratorOptions): string;
/**
 * Analyzes password strength and Shannon entropy.
 */
export declare function evaluatePasswordStrength(password: string): PasswordStrengthResult;
//# sourceMappingURL=generator.d.ts.map