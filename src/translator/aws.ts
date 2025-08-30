import {
  ListLanguagesCommand,
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import chunk from 'lodash.chunk';
import { Translation, type TranslationUnit, type Translator } from './base';

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
    units: TranslationUnit[],
    concurrency?: number,
  ): Promise<Translation[]> {
    concurrency = concurrency ?? 20;
    if (concurrency > 20)
      console.warn(
        'AWS Translate does not support concurrency greater than 20. Defaulting to 20',
      );

    const chunks = chunk(units, 20);
    let output: Translation[] = [];

    for (const current of chunks) {
      const results = await Promise.all(
        current.map(async (u) => {
          const input = {
            Text: u.sourceText,
            SourceLanguageCode: u.sourceLocale,
            TargetLanguageCode: u.targetLocale,
          };
          const command = new TranslateTextCommand(input);
          const response = await this.client.send(command);
          return new Translation(u, response.TranslatedText!);
        }),
      );

      output.push(...results);
    }

    return output;
  }
}
