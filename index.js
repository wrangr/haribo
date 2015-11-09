'use strict';


const ChildProcess = require('child_process');
const Path = require('path');
const Events = require('events');
const Phantomjs = require('phantomjs');
const JSONStream = require('JSONStream');
const Validate = require('har-validator');
const Pkg = require('./package.json');


const internals = {};


internals.createHar = function (data, cb) {

  const har = {
    log: {
      version: '1.2',
      creator: {
        name: Pkg.name,
        version: Pkg.version,
        comment: Pkg.description
      },
      browser: {
        name: 'PhantomJS',
        version: Phantomjs.version
      },
      pages: [],
      entries: [],
      _failures: []
    }
  };

  data.forEach((obj) => {

    if (obj.data._ignore === true) {
      return;
    }

    if (obj.name === 'page') {
      har.log.pages.push(obj.data);
    }
    else if (obj.name === 'entry') {
      har.log.entries.push(obj.data);
    }
    else if (obj.name === 'failure') {
      har.log._failures.push(obj.data);
    }
  });

  const stringified = JSON.stringify(har);
  const parsed = JSON.parse(stringified);

  Validate(parsed).then((valid) => {

    if (!valid) {
      cb(new Error('Invalid HAR format'));
    }
    else {
      cb(null, parsed);
    }
  }, cb);
};


internals.optionKeys = [
  'exclude',
  'include',
  'max',
  'delay',
  'screenshot',
  'v-width',
  'v-height',
  'user-agent'
];


module.exports = function (options) {

  options = options || {};

  if (typeof options.url !== 'string') {
    throw new TypeError('URL must be a string');
  }

  const script = Path.join(__dirname, 'bin', 'sniff.js');
  const args = [script, options.url];

  internals.optionKeys.forEach((key) => {

    if (!options.hasOwnProperty(key)) {
      return;
    }

    args.push('--' + key);
    args.push('' + options[key]);
  });

  const child = ChildProcess.spawn(Phantomjs.path, args);
  const parser = child.stdout.pipe(JSONStream.parse('*'));
  const ee = new Events.EventEmitter();
  const data = [];

  parser.on('data', (obj) => {

    ee.emit(obj.name, obj.data);
    data.push(obj);
  });

  child.on('close', (code) => {

    if (code > 0) {
      return ee.emit('error', new Error('PhantomJS crashed'));
    }

    internals.createHar(data, (err, json) => {

      if (err) {
        err.data = data;
        return ee.emit('error', err);
      }
      ee.emit('har', json);
      ee.emit('end');
    });
  });

  return ee;

};

