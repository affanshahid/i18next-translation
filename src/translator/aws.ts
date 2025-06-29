import {
  ListLanguagesCommand,
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import type { Translator } from './base';

export class AwsTranslator implements Translator {
  private readonly client: TranslateClient;

  constructor() {
    this.client = new TranslateClient({});
  }

  async validateConfiguration(): Promise<null | string> {
    try {
      const command = new ListLanguagesCommand({});
      await this.client.send(command);
      return null;
    } catch (error: any) {
      return error.message;
    }
  }

  async translate(
    sources: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<Record<string, string>> {
    const outputEntries = await Promise.all(
      Object.entries(sources).map(async ([key, value]) => {
        const input = {
          Text: value,
          SourceLanguageCode: sourceLanguage,
          TargetLanguageCode: targetLanguage,
        };
        const command = new TranslateTextCommand(input);
        const response = await this.client.send(command);
        return [key, response.TranslatedText!] as const;
      }),
    );

    return Object.fromEntries(outputEntries);
  }
}
