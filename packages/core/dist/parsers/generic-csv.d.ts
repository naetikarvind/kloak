/**
 * Kloak Core — Generic CSV Auto-Detector & Custom Column Mapper
 */
import { ImportResult, CsvRow } from './types.js';
export interface ColumnMapping {
    titleColumn?: string;
    usernameColumn?: string;
    passwordColumn?: string;
    urlColumn?: string;
    notesColumn?: string;
    totpColumn?: string;
    tagsColumn?: string;
}
/**
 * Heuristically identifies columns in a generic CSV file.
 */
export declare function autoDetectColumnMapping(sampleRow: CsvRow): ColumnMapping;
export declare function parseGenericCsv(csvText: string, customMapping?: ColumnMapping): ImportResult;
//# sourceMappingURL=generic-csv.d.ts.map