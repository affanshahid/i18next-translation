import { flatten, unflatten } from 'flat';
import { readFile, writeFile } from 'fs/promises';
import { basename, extname } from 'path';
import * as toml from 'smol-toml';
import * as yaml from 'yaml';

// Structural representation of a translation key. Encapsulates the namespace and path components.
export class TranslationKey {
  namespace: string;
  path: string;

  constructor(namespace: string, path: string) {
    this.namespace = namespace;
    this.path = path;
  }

  static fromString(str: string): TranslationKey {
    const [namespace, path] = str.split(':');

    if (!namespace || !path) {
      throw new Error('Invalid key format. Expected format: namespace:path');
    }

    return new TranslationKey(namespace, path);
  }

  static createKeyedString(namespace: string, path: string): string {
    return `${namespace}:${path}`;
  }

  toString(): string {
    return TranslationKey.createKeyedString(this.namespace, this.path);
  }

  matchesFilename(filename: string): boolean {
    const ext = extname(filename);
    const name = basename(filename, ext);

    return name === this.namespace;
  }
}

export interface NamespaceEntry {
  key: TranslationKey;
  value: string;
}

type Parser = (raw: string) => any;
type Serializer = (obj: any) => string;

export class Namespace {
  entries: NamespaceEntry[];

  constructor(entries?: NamespaceEntry[]) {
    this.entries = entries ?? [];
  }

  static async fromFile(path: string) {
    const ext = extname(path);
    const name = basename(path, ext);

    let parse: Parser;

    switch (ext) {
      case '.json':
        parse = JSON.parse;
        break;

      case '.yaml':
      case '.yml':
        parse = yaml.parse;
        break;

      case '.toml':
        parse = toml.parse;
        break;
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }

    const obj = parse(await readFile(path, 'utf-8'));
    return Namespace.fromObject(name, obj);
  }

  static fromKeyedObject(obj: Record<string, string>): Namespace {
    const entries = Object.entries(obj).map(([key, value]) => ({
      key: TranslationKey.fromString(key),
      value,
    }));

    return new Namespace(entries);
  }

  static fromObject(name: string, obj: any): Namespace {
    const flattened = flatten<any, Record<string, string>>(obj);
    const entries = Object.entries(flattened).map(([key, val]) => [
      TranslationKey.createKeyedString(name, key),
      val,
    ]);
    const keyedObject = Object.fromEntries(entries);

    return Namespace.fromKeyedObject(keyedObject);
  }

  toObject(): any {
    const obj = Object.fromEntries(
      this.entries.map((e) => [e.key.path, e.value]),
    );

    return unflatten(obj, { object: false, overwrite: true });
  }

  toKeyedObject(): Record<string, string> {
    return Object.fromEntries(
      this.entries.map((e) => [e.key.toString(), e.value]),
    );
  }

  merge(other: Namespace): Namespace {
    const merged = {
      ...this.toKeyedObject(),
      ...other.toKeyedObject(),
    };

    return Namespace.fromKeyedObject(merged);
  }

  hasKey(key: TranslationKey): boolean {
    return this.entries.some(
      (entry) => entry.key.toString() === key.toString(),
    );
  }

  async writeToFile(path: string): Promise<void> {
    const ext = extname(path);

    let serialize: Serializer;

    switch (ext) {
      case '.json':
        serialize = (obj) => JSON.stringify(obj, null, 2);
        break;

      case '.yaml':
      case '.yml':
        serialize = (obj) => yaml.stringify(obj, { indent: 2 });
        break;

      case '.toml':
        serialize = (obj) => toml.stringify(obj);
        break;
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }

    await writeFile(path, serialize(this.toObject()), 'utf-8');
  }
}
