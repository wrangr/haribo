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


exports.create = function (attrs, cb) {
  var har = {
    log: _.extend({}, defaults, {
      pages: attrs.pages,
      entries: attrs.entries.filter(function (entry) {
        return entry._ignore !== true;
      })
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

