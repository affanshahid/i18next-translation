export interface Translator {
  validateConfiguration(): Promise<null | string>;
  translate(
    sources: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<Record<string, string>>;
}
