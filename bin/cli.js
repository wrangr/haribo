#! /usr/bin/env node

var minimist = require('minimist');
var _ = require('lodash');
var pkg = require('../package.json');
var argv = minimist(process.argv.slice(2));
var url = argv._.shift();


if (argv.v || argv.version) {
  console.log(pkg.version);
  process.exit(0);
} else if (!url || argv.h || argv.help) {
  console.log([
    'Usage: ' + pkg.name + ' [ options ] <url>',
    '',
    'Options:',
    '',
    '--max=<int>',
    '--include=<pattern>  ',
    '--exclude=<pattern>  ',
    '-h, --help           Show this help.',
    '-v, --version        Show version.',
    '--no-colors          Diable pretty colours in output.',
    '--json               Output minimised JSON (good for machines).',
    '--jsonpretty         Output human readable JSON.',
    '',
    pkg.author.name + ' ' + (new Date()).getFullYear()
  ].join('\n'));
  process.exit(0);
}


var options = _.extend(_.omit(argv, [ '_' ]), { url: url });

var ee = require('../')(options);

ee.on('error', function (err) {
  console.error(err);
  process.exit(1);
});

ee.on('har', function (har) {
  console.log(JSON.stringify(har, null, 2));
});

ee.on('end', function () {
  process.exit(0);
});

