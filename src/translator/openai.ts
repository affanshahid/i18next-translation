import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Translator } from './base';

const schema = z.object({
  output: z.array(
    z.object({
      key: z.string().describe('Source key'),
      value: z.string().describe('Source text to translate'),
    }),
  ),
});

const systemPrompt = `
Your goal is to help the user translate text in their project which uses i18next.

The user will provide you some text to translate into a target language. The text will be provided \
in the form of a JSON object where the keys are unique and the values are strings intended to be \
translated.

When returning the response you must use the same keys as the input object.

Translation strings may contain placeholders like {{name}} or {{age}} which should be inserted \
into the translated text appropiately.
`;

const userPrompt = (
  sources: Record<string, string>,
  sourceLanguage: string,
  targetLanguage: string,
) => `
Source Language Code : ${sourceLanguage}
Target Language Code : ${targetLanguage}

Translate the following:
'''
${JSON.stringify(sources, null, 2)}
'''
`;

export class OpenAiTranslator implements Translator {
  async validateConfiguration(): Promise<null | string> {
    if (!process.env['OPENAI_API_KEY']) return 'OPENAI_API_KEY is not set';

    return null;
  }

  async translate(
    sources: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<Record<string, string>> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema,
      prompt: userPrompt(sources, sourceLanguage, targetLanguage),
      system: systemPrompt,
    });

    return Object.fromEntries(object.output.map((o) => [o.key, o.value]));
  }
}
