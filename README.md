# i18next-translation

Automatically translate your i18next dictionaries using AI-powered translation services.

[![npm version](https://badge.fury.io/js/i18next-translation.svg)](https://badge.fury.io/js/i18next-translation)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`i18next-translation` is a CLI tool that automatically translates your i18next dictionaries from a source language to multiple target languages. It supports multiple translation providers including AWS Translate, OpenAI GPT-4, and Anthropic Claude, and works with JSON, YAML, and TOML file formats.

## Features

- 🌍 **Multiple Translation Providers**: AWS Translate, OpenAI GPT-4, and Anthropic Claude
- 📄 **Multiple File Formats**: JSON, YAML, and TOML
- 🔄 **Incremental Updates**: Only translate missing keys, preserving existing translations
- 🧹 **Strict Mode**: Remove unused keys from target dictionaries
- 🔍 **Translation Diagnosis**: Verify all keys are properly translated after translation
- 🔧 **i18next Compatible**: Preserves placeholder syntax

## Requirements

- Node.js >= 20
- An account with one of the supported translation providers

## Installation

### Global Installation

```bash
npm install -g i18next-translation
```

### Local Installation (Recommended)

```bash
npm install --save-dev i18next-translation
```

### Using without Installation

```bash
npx i18next-translation [options] <dicts-path>
```

## Usage

### Basic Usage

```bash
i18next-translation -l en-US ./locales
```

This will translate all dictionaries from `en-US` to all other language directories found in `./locales`.

### Directory Structure

Your locales directory should be structured like this:

```
locales/
├── en-US/
│   ├── common.json
│   ├── auth.json
│   └── dashboard.yaml
├── es/
├── fr/
└── de/
```

Language directories must follow ISO language codes (e.g., `en`, `es`, `fr`, `de`, `en-US`, `zh-CN`).

### Advanced Usage

#### Specify Translation Provider

```bash
# Use AWS (default -- must configure AWS credentials)
i18next-translation -l en-US -p AWS ./locales

# Use OpenAI (must set OPENAI_API_KEY)
i18next-translation -l en-US -p OpenAI ./locales

# Use Anthropic (must set ANTHROPIC_API_KEY)
i18next-translation -l en-US -p Anthropic ./locales
```

#### Translate Specific Namespace

```bash
# Only translate the 'auth' namespace
i18next-translation -l en-US --only "auth:*" ./locales
```

#### Translate Specific Keys

```bash
# Translate specific key
i18next-translation -l en-US --only "common:welcome" ./locales

# Translate keys with prefix
i18next-translation -l en-US --only "common:error.*" ./locales
```

#### Control Concurrency

```bash
# Process 5 keys simultaneously (default: 20)
i18next-translation -l en-US --concurrency 5 ./locales
```

#### Strict Mode

```bash
# Remove keys that don't exist in source language
i18next-translation -l en-US -s ./locales
```

#### Diagnosis Mode

```bash
# Check translation completeness after translation
i18next-translation -l en-US -d ./locales
```

## Command Line Options

| Option              | Alias | Description                                                    | Default |
| ------------------- | ----- | -------------------------------------------------------------- | ------- |
| `--source-language` | `-l`  | Source language code (required)                                | -       |
| `--provider`        | `-p`  | Translation provider (`AWS`, `OpenAI`, `Anthropic`)            | `AWS`   |
| `--only`            | `-o`  | Specific namespace:key to translate (supports wildcards)       | -       |
| `--concurrency`     | `-c`  | Number of concurrent translations                              | `20`    |
| `--strict`          | `-s`  | Remove keys not present in source dictionary                   | `false` |
| `--diagnose`        | `-d`  | Check if all keys are detected as translated after translation | `false` |
| `--help`            | `-h`  | Show help                                                      | -       |
| `--version`         |       | Show version                                                   | -       |

## Setup

### AWS Translate

Configure AWS credentials using one of these methods:

1. **AWS CLI**: Run `aws configure`
2. **Environment Variables**:
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1
   ```
3. **IAM Roles** (for EC2/Lambda environments)

Required IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["translate:TranslateText", "translate:ListLanguages"],
      "Resource": "*"
    }
  ]
}
```

### OpenAI

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your_openai_api_key
```

### Anthropic

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Environment Variables

You can also use a `.env` file for configuration. Create a `.env` file in your project root:

```bash
# AWS (if not using AWS CLI/IAM)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Integration with Build Tools

### npm scripts

```json
{
  "scripts": {
    "translate": "i18next-translation -l en-US ./src/locales"
  }
}
```

### Pre-commit Hook

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "i18next-translation -l en-US -s ./locales"
    }
  }
}
```

## Troubleshooting

### Configuration Issues

If you see configuration errors:

1. **AWS**: Verify AWS credentials and region settings
2. **OpenAI**: Check that `OPENAI_API_KEY` is set correctly
3. **Anthropic**: Ensure `ANTHROPIC_API_KEY` is valid

### Language Code Issues

The tool validates language codes against ISO standards. If a directory is skipped:

- Use standard codes like `en`, `es`, `fr`, `de`
- For locales, use format like `en-US`, `zh-CN`
- Avoid custom codes like `eng` or `english`

## Examples

### Complete Workflow

```bash
# 1. Initial translation setup
i18next-translation -l en-US ./locales

# 2. Add new keys to English files
echo '{"newFeature": "New Feature"}' > locales/en/features.json

# 3. Translate only new keys
i18next-translation -l en-US ./locales

# 4. Translate specific namespace with OpenAI
i18next-translation -l en-US -p OpenAI --only "marketing:*" ./locales

# 5. Clean up unused keys
i18next-translation -l en-US -s ./locales

# 6. Diagnose translation completeness
i18next-translation -l en-US -d ./locales
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Affan Shahid](https://affanshahid.dev)

## Support

- 🐛 [Report Issues](https://github.com/affanshahid/i18next-translation/issues)
- 📧 [Email](mailto:affan.shahid.94@gmail.com)
