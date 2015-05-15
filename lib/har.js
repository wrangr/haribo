var _ = require('lodash');
var validate = require('har-validator');
var phantomjs = require('phantomjs');
var pkg = require('../package.json');


module.exports = function (attrs, cb) {

  attrs = attrs || {};

  var pages = attrs.pages || [];
  var entries = attrs.entries || [];

  if (!_.isArray(pages) || !_.isArray(entries)) {
    throw new TypeError('Attributes "pages" and "entries" must be arrays');
  }

  if (!_.isFunction(cb)) {
    throw new TypeError('Second argument to har() must be a callback');
  }

  var har = {
    log: {
      version: '1.2',
      creator: {
        name: pkg.name,
        version: pkg.version,
        comment: pkg.description
      },
      browser: {
        name: 'PhantomJS',
        version: phantomjs.version,
        //comment: ''
      },
      pages: pages,
      entries: entries.filter(function (entry) {
        return entry.response && entry._ignore !== true;
      }),
      _failures: attrs.failures
      //comment: ''
    }
  };

  var stringified = JSON.stringify(har);
  var parsed = JSON.parse(stringified);

  validate(parsed, function (err, valid) {
    if (err) {
      cb(err);
    } else if (!valid) {
      cb(new Error('Invalid HAR format'));
    } else {
      cb(null, parsed);
    }
  });

};

