import { buildApplication, buildRouteMap } from '@stricli/core';
import { config } from 'dotenv';
import { description, name, version } from '../package.json';
import { translateCommand } from './command';

config({ quiet: true });

const routes = buildRouteMap({
  defaultCommand: 'translate',
  routes: {
    translate: translateCommand,
  },
  docs: {
    brief: description,
  },
});

export const app = buildApplication(routes, {
  name,
  versionInfo: {
    currentVersion: version,
  },
  scanner: {
    caseStyle: 'allow-kebab-for-camel',
  },
});
