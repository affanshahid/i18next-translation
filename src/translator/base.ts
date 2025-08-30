import type { NamespaceEntry, TranslationKey } from '../namespace';

export interface TranslationUnit {
  key: TranslationKey;
  sourceText: string;
  sourceLocale: string;
  targetLocale: string;
}

export class Translation {
  unit: TranslationUnit;
  translation: string;

  constructor(unit: TranslationUnit, translation: string) {
    this.unit = unit;
    this.translation = translation;
  }

  toNamespaceEntry(): NamespaceEntry {
    return {
      key: this.unit.key,
      value: this.translation,
    };
  }
}

export interface Translator {
  validateConfiguration(): Promise<null | string>;
  translate(
    units: TranslationUnit[],
    concurrency?: number,
  ): Promise<Translation[]>;
}
