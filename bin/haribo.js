#! /usr/bin/env node

'use strict';


const Fs = require('fs');
const Path = require('path');
const Util = require('util');
const Minimist = require('minimist');
const _ = require('lodash');
const Pkg = require('../package.json');


const argv = Minimist(process.argv.slice(2));
const url = argv._.shift();


if (argv.v || argv.version) {
  console.log(Pkg.version);
  process.exit(0);
}
else if (!url || argv.h || argv.help) {
  console.log([
    'Usage: ' + Pkg.name + ' [ options ] <url>',
    '',
    'Options:',
    '',
    '--exclude=<pattern>    Exclude URLs mathing given pattern.',
    '--include=<pattern>    Include URLs mathing given pattern.',
    '--max=1                Maximum number of pages to fetch.',
    '--delay=3              How long to wait after page loads to get rendered',
    '                       source and screenshots.',
    '--out=</path/to/file>  Write HAR file to given path.',
    '--screenshot=false     Include screenshots.',
    '--v-width=400          Viewport width.',
    '--v-height=300         Viewport height.',
    '--user-agent=""        User agent string.',
    '-h, --help             Show this help.',
    '-v, --version          Show version.',
    '',
    Pkg.author.name + ' ' + (new Date()).getFullYear()
  ].join('\n'));
  process.exit(0);
}


const options = _.extend(_.omit(argv, ['_', 'out']), { url });
const ee = require('../')(options);

ee.on('error', (err) => {

  console.error(Util.inspect(err, { depth: null }));

  if (err.stack) {
    console.error(err.stack);
  }

  process.exit(1);
});

ee.on('har', (har) => {

  const json = JSON.stringify(har, null, 2);

  if (argv.out) {
    Fs.writeFileSync(Path.resolve(argv.out), json);
  }
  else {
    console.log(json);
  }
});

ee.on('end', () => {

  process.exit(0);
});
