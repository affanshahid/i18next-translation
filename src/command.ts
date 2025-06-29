import { buildCommand } from '@stricli/core';
import type { LocalContext } from './context';

interface Flags {
  sourceLanguage: string;
  provider: 'AWS' | 'OpenAI' | 'Anthropic';
  only: string;
}

function translate(this: LocalContext, flags: Flags, dictsPath: string) {}

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
      },
    },

    aliases: {
      s: 'sourceLanguage',
      p: 'provider',
      o: 'only',
    },
  },

  docs: {
    brief: 'Translate keys from a source language to all target languages',
  },
});
