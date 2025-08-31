import { buildCommand, numberParser } from '@stricli/core';
import chalk from 'chalk';
import { readdir, stat } from 'fs/promises';
import ora from 'ora';
import { join } from 'path';
import type { LocalContext } from './context';
import { Namespace, TranslationKey } from './namespace';
import {
  AnthropicTranslator,
  AwsTranslator,
  OpenAiTranslator,
  type Translator,
} from './translator';
import type { TranslationUnit } from './translator/base';

const REGEX_LANGUAGE_CODE = /^(?:[a-zA-Z]{2,4}|[a-zA-Z]{2}-[a-zA-Z]{2})$/;

interface OnlySpec {
  prefixMatch: boolean;
  key: TranslationKey;
}

interface Flags {
  sourceLocale: string;
  provider: 'AWS' | 'OpenAI' | 'Anthropic';
  only?: OnlySpec;
  concurrency?: number;
  strict: boolean;
}

function getTranslator(provider: Flags['provider']): Translator {
  switch (provider) {
    case 'AWS':
      return new AwsTranslator();
    case 'OpenAI':
      return new OpenAiTranslator();
    case 'Anthropic':
      return new AnthropicTranslator();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function translate(this: LocalContext, flags: Flags, dictsPath: string) {
  const spinner = ora().start();
  process.on('SIGINT', () => {
    spinner.stop();
    process.exit(1);
  });

  const potentialTargets = await readdir(dictsPath);
  const potentialTargetStats = await Promise.all(
    potentialTargets.map(
      async (p) => [p, await stat(join(dictsPath, p))] as const,
    ),
  );
  const targetLocales = potentialTargetStats
    .filter(([, s]) => s.isDirectory())
    .filter(([path]) => {
      const result = REGEX_LANGUAGE_CODE.test(path);
      if (!result)
        console.log(chalk.yellow(`Skipping invalid language code: ${path}`));

      return result;
    })
    .map(([path]) => path)
    .filter((p) => p !== flags.sourceLocale);

  let sourceFiles = await readdir(join(dictsPath, flags.sourceLocale));

  const translator = getTranslator(flags.provider);
  const validationError = await translator.validateConfiguration();
  if (validationError) {
    console.log(
      chalk.redBright('Translator configuration invalid:', validationError),
    );
    this.process.exit(1);
  }

  try {
    const translationUnits: TranslationUnit[] = [];

    for (const source of sourceFiles) {
      spinner.text = `Checking ${source}`;

      if (flags.only && !flags.only.key.matchesFilename(source)) continue;

      const ns = await Namespace.fromFile(
        join(dictsPath, flags.sourceLocale, source),
      );

      for (const target of targetLocales) {
        spinner.text = `Checking ${source} for ${target}`;
        const targetPath = join(dictsPath, target, source);
        const existing = await Namespace.fromFile(targetPath).catch(
          () => new Namespace(),
        );

        let units: TranslationUnit[] = ns.entries.map((e) => ({
          sourceLocale: flags.sourceLocale,
          targetLocale: target,
          key: e.key,
          sourceText: e.value,
        }));

        const only = flags.only;
        if (only) {
          units = units.filter((u) =>
            only?.prefixMatch
              ? u.key.toString().startsWith(only.key.toString())
              : u.key.toString() === only.key.toString(),
          );
        } else {
          units = units.filter((u) => !existing.has(u.key));
        }

        translationUnits.push(...units);
      }
    }

    spinner.succeed(`Found ${translationUnits.length} keys to translate`);

    spinner.start('Translating');
    const translations = await translator.translate(
      translationUnits,
      flags.concurrency,
    );
    spinner.succeed('Translated');

    spinner.start('Saving');
    for (const source of sourceFiles) {
      const filtered = translations.filter((t) =>
        t.unit.key.matchesFilename(source),
      );
      if (filtered.length === 0) continue;

      spinner.text = `Saving ${source}`;
      const ns = await Namespace.fromFile(
        join(dictsPath, flags.sourceLocale, source),
      );

      for (const target of targetLocales) {
        const localeFiltered = filtered.filter(
          (t) => t.unit.targetLocale === target,
        );
        if (localeFiltered.length === 0) continue;

        spinner.text = `Saving ${source} for ${target}`;

        const targetPath = join(dictsPath, target, source);

        const existing = await Namespace.fromFile(targetPath).catch(
          () => new Namespace(),
        );
        const translated = new Namespace(
          localeFiltered.map((t) => t.toNamespaceEntry()),
        );
        const result = existing.merge(translated);

        if (flags.strict) {
          const sourceKeys = ns.keys();

          result
            .keys()
            .filter((key) => !sourceKeys.includes(key))
            .forEach((key) => result.remove(key));
        }

        await result.writeToFile(targetPath);
      }
    }

    spinner.succeed('Saved');
  } catch (err: any) {
    spinner.fail();
    console.log(err);
  }
}

function parseOnly(only: string): OnlySpec {
  const prefixMatch = only.endsWith('*');
  const key = TranslationKey.fromString(prefixMatch ? only.slice(0, -1) : only);
  return {
    prefixMatch,
    key,
  };
}

export const translateCommand = buildCommand({
  func: translate,
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          parse: String,
          brief: 'Path to folder containing dictionaries.',
          placeholder: 'dicts-path',
        },
      ],
    },

    flags: {
      sourceLocale: {
        kind: 'parsed',
        parse: String,
        brief: 'Source language',
      },
      provider: {
        kind: 'enum',
        values: ['AWS', 'OpenAI', 'Anthropic'],
        brief: 'Provider for translations.',
        default: 'AWS',
      },
      only: {
        kind: 'parsed',
        brief:
          'Specific key to (re-)translate. Supports JSON paths and wildcards using *.',
        parse: parseOnly,
        optional: true,
      },
      concurrency: {
        kind: 'parsed',
        brief: 'Parallelization factor',
        parse: numberParser,
        optional: true,
      },
      strict: {
        kind: 'boolean',
        brief: 'Only keep keys present in the source dictionary',
      },
    },

    aliases: {
      s: 'sourceLocale',
      p: 'provider',
      o: 'only',
      c: 'concurrency',
    },
  },

  docs: {
    brief: 'Translate keys from a source language to all target languages',
  },
});
