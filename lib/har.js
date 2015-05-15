var _ = require('lodash');
var validate = require('har-validator');
var pkg = require('../package.json');


var defaults = {
  version: '1.2',
  creator: {
    name: pkg.name,
    version: pkg.version,
    comment: pkg.description
  },
  browser: {
    name: 'PhantomJS',
    version: '',
    comment: ''
  },
  pages: [],
  entries: [],
  comment: ''
};


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
    log: _.extend({}, defaults, {
      pages: pages,
      entries: entries.filter(function (entry) {
        return entry.response && entry._ignore !== true;
      }),
      _failures: attrs.failures
    })
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

