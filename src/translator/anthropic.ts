import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import chunk from 'lodash.chunk';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Translation, type TranslationUnit, type Translator } from './base';

interface UnitWithID extends Omit<TranslationUnit, 'key'> {
  id: string;
}

const schema = z.object({
  output: z.array(
    z.object({
      id: z.string().describe('Source ID'),
      value: z.string().describe('Translated text'),
    }),
  ),
});

const systemPrompt = `
Your goal is to help the user translate text in their project which uses i18next.

The user will provide you multiple text entries to translate. The text will be provided \
inside a JSON array. Each object will include information about the locales involved in the \
required translation along with a unique key.

In the output you must map each ID to the translation you generate.

Translation strings may contain placeholders like {{name}} or {{age}} which should be inserted \
into the translated text appropiately without modifying the label in the braces.
`;

const userPrompt = (units: UnitWithID[]) => `
Translate the following:
'''
${JSON.stringify(units, null, 2)}
'''
`;

export class AnthropicTranslator implements Translator {
  async validateConfiguration(): Promise<null | string> {
    if (!process.env['ANTHROPIC_API_KEY'])
      return 'ANTHROPIC_API_KEY is not set';

    return null;
  }

  async translate(
    units: TranslationUnit[],
    concurrency?: number,
  ): Promise<Translation[]> {
    concurrency = concurrency ?? 100;
    const chunks = chunk(units, concurrency);

    const results: Translation[] = [];
    for (const current of chunks) {
      const translations = await this.translateBatch(current);
      results.push(...translations);
    }

    return results;
  }

  private async translateBatch(
    units: TranslationUnit[],
  ): Promise<Translation[]> {
    const idUnitMap: Record<string, TranslationUnit> = {};
    const unitsWithId: UnitWithID[] = [];

    for (const unit of units) {
      const id = uuidv4();
      unitsWithId.push({
        id,
        sourceLocale: unit.sourceLocale,
        sourceText: unit.sourceText,
        targetLocale: unit.targetLocale,
      });
      idUnitMap[id] = unit;
    }

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-0'),
      schema,
      prompt: userPrompt(unitsWithId),
      system: systemPrompt,
      maxTokens: 64000,
    });

    const result: Translation[] = [];

    for (const entry of object.output) {
      const unit = idUnitMap[entry.id];

      if (!unit) throw new Error('The model skipped a unit in the response');

      result.push(new Translation(unit, entry.value));
    }

    return result;
  }
}
