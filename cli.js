#!/usr/bin/env node

import { readFile } from 'fs/promises';
import minimist from 'minimist';
import { createHar } from './index.js';

const pkg = JSON.parse(await readFile(
  new URL('./package.json', import.meta.url),
  'utf8',
));

const { _: args, ...opts } = minimist(process.argv.slice(2));

const help = `Usage: haribo <url> [ options ]

Options:

--delay=0              Milliseconds to wait after page loads to get rendered
                       source and screenshots. (Defaul: \`0\`)
--screenshots          Include screenshots. (Defaul: \`false\`)
-h, --help             Show this help.
-v, --version          Show version.`;

if (args[0] === 'help' || opts.h || opts.help) {
  console.log(help);
  process.exit(0);
}

if (opts.v || opts.version) {
  console.log(pkg.version);
  process.exit(0);
}

if (!args[0]) {
  console.error(help);
  process.exit(1);
}

createHar(args[0], {
  delay: opts.delay ? parseInt(opts.delay, 10) : 0,
  screenshots: opts.screenshots,
})
  .then(har => console.log(JSON.stringify(har, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
