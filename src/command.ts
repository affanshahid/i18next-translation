import { buildCommand, numberParser } from '@stricli/core';
import chalk from 'chalk';
import { flatten, unflatten } from 'flat';
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import chunk from 'lodash.chunk';
import ora from 'ora';
import { extname, join } from 'path';
import * as toml from 'smol-toml';
import * as yaml from 'yaml';
import type { LocalContext } from './context';
import { AwsTranslator } from './translator/aws';
import type { Translator } from './translator/base';

interface Flags {
  sourceLanguage: string;
  provider: 'AWS' | 'OpenAI' | 'Anthropic';
  only?: string;
  concurrency: number;
}

type Parser = (raw: string) => any;
type Serializer = (obj: any) => string;

const REGEX_LANGUAGE_CODE = /^(?:[a-zA-Z]{2,4}|[a-zA-Z]{2}-[a-zA-Z]{2})$/;

interface TranslateNamespaceParams {
  translator: Translator;
  concurrency: number;
  ns: any;
  sourceLanguage: string;
  targetLanguage: string;
  existing?: any;
}

async function translateNamespace({
  translator,
  concurrency,
  ns,
  sourceLanguage,
  targetLanguage,
  existing,
}: TranslateNamespaceParams): Promise<any> {
  const flattened = flatten<any, Record<string, string>>(ns);
  let ret = existing ? flatten<any, Record<string, string>>(existing) : {};

  const sources = Object.entries(flattened).filter(([key]) => !ret[key]);

  const chunks = chunk(sources, concurrency);
  for (const currentChunk of chunks) {
    const resp = await translator.translate(
      Object.fromEntries(currentChunk),
      sourceLanguage,
      targetLanguage,
    );

    ret = {
      ...ret,
      ...resp,
    };
  }

  return unflatten(ret, { object: false });
}

async function translate(this: LocalContext, flags: Flags, dictsPath: string) {
  const potentialTargets = await readdir(dictsPath);
  const potentialTargetStats = await Promise.all(
    potentialTargets.map(
      async (p) => [p, await stat(join(dictsPath, p))] as const,
    ),
  );
  const targets = potentialTargetStats
    .filter(([, s]) => s.isDirectory())
    .filter(([path]) => {
      const result = REGEX_LANGUAGE_CODE.test(path);
      if (!result)
        console.log(chalk.yellow(`Skipping invalid language code: ${path}`));

      return result;
    })
    .map(([path]) => path);

  const sources = await readdir(join(dictsPath, flags.sourceLanguage));

  let translator: Translator;
  switch (flags.provider) {
    case 'AWS':
      translator = new AwsTranslator();
      break;
    default:
      throw new Error(`Unsupported provider: ${flags.provider}`);
  }

  const validationError = await translator.validateConfiguration();
  if (validationError) {
    console.log('Translator configuration invalid:', validationError);
    this.process.exit(1);
  }

  const spinner = ora('Translating').start();
  try {
    for (const source of sources) {
      spinner.text = source;
      const ext = extname(source);

      let parse: Parser;
      let serialize: Serializer;

      switch (ext) {
        case '.json':
          parse = JSON.parse;
          serialize = (obj) => JSON.stringify(obj, null, 2);
          break;

        case '.yaml':
        case '.yml':
          parse = yaml.parse;
          serialize = (obj) => yaml.stringify(obj, { indent: 2 });
          break;

        case '.toml':
          parse = toml.parse;
          serialize = (obj) => toml.stringify(obj);
          break;
        default:
          throw new Error(`Unsupported file extension: ${ext}`);
      }

      const ns = parse(
        await readFile(join(dictsPath, flags.sourceLanguage, source), 'utf-8'),
      );

      for (const target of targets) {
        const targetPath = join(dictsPath, target, source);
        const existing = await readFile(targetPath, 'utf-8')
          .then((t) => parse(t))
          .catch(() => undefined);

        const translation = await translateNamespace({
          translator,
          concurrency: flags.concurrency,
          ns,
          targetLanguage: target,
          sourceLanguage: flags.sourceLanguage,
          existing,
        });
        await writeFile(targetPath, serialize(translation) + '\n');
      }
    }
  } finally {
    spinner.stop();
  }
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
      sourceLanguage: {
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
        parse: String,
        optional: true,
      },
      concurrency: {
        kind: 'parsed',
        brief: 'Parallelization factor',
        parse: numberParser,
        default: '10',
      },
    },

    aliases: {
      s: 'sourceLanguage',
      p: 'provider',
      o: 'only',
      c: 'concurrency',
    },
  },

  docs: {
    brief: 'Translate keys from a source language to all target languages',
  },
});
