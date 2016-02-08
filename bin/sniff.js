#! /usr/bin/env phantomjs
//
// This script is to be run with PhantomJS (not Node.js)
//
// This script should produce no output to stderr. All output is written to
// stdout as a JSON array. Each element in the array represents an event and has
// two properties: `name` and `data`.
//
// Events:
//
// * `entry`: Emitted once for every resource loaded by the page.
// * `page` : Emitted only once, when the page has loaded.
// * `failure`: Emitted when the page failed to load.
//

/*eslint no-var:0, prefer-arrow-callback: 0 */

'use strict';


var System = require('system');
var Webpage = require('webpage');
var Minimist = require('minimist');
var Url = require('../lib/url');
var Har = require('../lib/har');
var History = require('../lib/history');


var internals = {};


//
// Default values for `options`.
//
internals.defaults = {
  exclude: [],
  include: [],
  max: 1,
  delay: 3, // in seconds
  screenshot: false,
  'v-width': 320,
  'v-height': 568,
  'user-agent': ''
};


//
// This is where the action begins...
//
internals.main = function (argv) {

  var options = Object.keys(internals.defaults).reduce(function (memo, key) {

    if (argv.hasOwnProperty(key)) {
      memo[key] = argv[key];
    }

    if (typeof internals.defaults[key] === 'number' &&
        typeof memo[key] === 'string') {
      memo[key] = parseInt(memo[key], 10);
    }

    return memo;
  }, internals.defaults);

  var webpage = Webpage.create();
  var cb = internals.done(webpage);

  if (options['user-agent']) {
    webpage.customHeaders = {
      'user-agent': options['user-agent']
    };
  }

  internals.sniff(webpage, argv._.shift(), options, cb);
};


//
// Load given `href` and monitor resulting HTTP traffic (resources).
//
internals.sniff = function (webpage, href, options, cb) {

  var page = { id: href };
  var entries = [];

  webpage.onUrlChanged = function (targetUrl) {

    if (!page._redirects) {
      page._redirects = [];
    }

    page._redirects.push(page.id);
    page.id = targetUrl;
  };

  webpage.onLoadStarted = function () {

    page.startedDateTime = new Date();
  };

  webpage.onResourceRequested = function (req) {

    entries[req.id - 1] = Har.createEntry(page, req);
  };

  webpage.onResourceReceived = function (res) {

    var entry = entries[res.id - 1];
    if (res.stage === 'start') {
      entry._startReply = res;
    }
    else if (res.stage === 'end') {
      entry._endReply = res;
      Har.processEntry(entry);
      internals.emit('entry', entry);
    }
  };

  // timeout handling http://stackoverflow.com/a/18837957/47573
  webpage.settings.resourceTimeout = 10000; // 10 seconds
  webpage.onResourceTimeout = function (err) {

    var entry = entries[err.id - 1];
    entry._errorReply = err;
    Har.processEntry(entry);
    internals.emit('entry', entry);
  };

  webpage.onResourceError = function (resourceError) {

    // TODO: Handle resource errors?
    // console.error('resourceError', resourceError);
  };

  // https://gist.github.com/wangyang0123/2475509#comment-666382
  webpage.onInitialized = function () {

    webpage.evaluate(function (domContentLoadedMsg) {

      document.addEventListener('DOMContentLoaded', function () {

        window.callPhantom('DOMContentLoaded');
      }, false);
    });
  };

  webpage.onCallback = function (data) {

    page._onContentLoad = new Date();
  };

  webpage.onConsoleMessage = function (msg, line, sourceId) {

    if (!page._consoleMessages) {
      page._consoleMessages = [];
    }

    page._consoleMessages.push({ message: msg, line: line, sourceId: sourceId });
  };

  webpage.onError = function (msg, trace) {

    if (!page._errors) {
      page._errors = [];
    }

    page._errors.push({ message: msg, trace: trace });
  };

  webpage.viewportSize = {
    width: options['v-width'],
    height: options['v-height']
  };

  webpage.open(href, function (status) {

    page._endTime = new Date();
    page._urlObj = Url.parse(page.id);
    page._base = internals.base(page._urlObj);

    if (status !== 'success') {
      internals.emit('failure', page);
      return cb();
    }

    page.pageTimings = {
      onContentLoad: -1,
      onLoad: page._endTime - page.startedDateTime
    };

    if (page._onContentLoad) {
      page.pageTimings.onContentLoad = page._onContentLoad - page.startedDateTime;
    }

    window.setTimeout(function () {

      page.title = webpage.evaluate(function () {

        return document.title;
      });

      page._description = webpage.evaluate(function () {

        return document.querySelector('meta[name="description"]').content;
      });

      page._renderedSource = webpage.evaluate(function () {

        return document.documentElement.outerHTML;
      });

      page._links = internals.processLinks(webpage, page);

      if (options.screenshot) {
        page._screenshot = webpage.renderBase64('PNG');
      }

      internals.emit('page', page);

      History.addPage(page);

      if (options.max && options.max <= History.length) {
        return cb();
      }

      var nextLink = History.pickNextLink();
      if (!nextLink) {
        return cb();
      }

      internals.sniff(webpage, nextLink.id, options, cb);
    }, options.delay * 1000);
  });
};


internals.base = function (urlObj) {

  return urlObj.protocol + '//' + urlObj.host + urlObj.path;
};


//
// Extract and classify links from "sniffed" page.
//
internals.processLinks = function (webpage, page) {

  var links = webpage.evaluate(function () {

    var nodeList = document.getElementsByTagName('a');
    var nodeArray = Array.prototype.slice.call(nodeList);
    return nodeArray.reduce(function (memo, node) {

      var href = node.href;
      if (!href || /^(#|mailto)/.test(href)) {
        return memo;
      }

      var link = { href: href, text: node.innerHTML.replace(/\n/g, '') };
      if (node.title) {
        link.title = node.title;
      }
      if (node.target) {
        link.target = node.target;
      }
      memo.push(link);
      return memo;
    }, []);
  });

  // Before fetching subpages we filter out based on the base url.
  var r = new RegExp('^' + page._urlObj.pathname);

  return links.reduce(function (memo, link) {

    link.urlObj = Url.parse(link.href, true);

    var id = internals.base(link.urlObj);

    var found = memo.filter(function (l) {

      return l.id === id;
    }).shift();

    if (found) {
      found.count += 1;
      found.instances.push(link);
    }
    else {
      memo.push({
        id: id,
        count: 1,
        internal: page._urlObj.host === link.urlObj.host,
        subpage: link.internal && r.test(link.urlObj.pathname),
        instances: [link]
      });
    }

    return memo;
  }, []);
};


// ***** //


internals.hasEmitted = false;
internals.isDone = false;


internals.emit = function (name, data) {

  if (internals.isDone) {
    return;
  }

  if (!internals.hasEmitted) {
    internals.hasEmitted = true;
    console.log('[');
  }
  else {
    console.log(',');
  }

  console.log(JSON.stringify({ name: name, data: data }));
};


internals.done = function (webpage) {

  return function (err) {

    var code = 0;

    if (internals.isDone) {
      return;
    }

    internals.isDone = true;

    if (webpage) {
      webpage.close();
    }

    if (err) {
      code = 1;
      internals.emit('error', err);
    }

    console.log(']');

    setTimeout(function () {

      phantom.exit(code);
    }, 0);
  };
};


// Start the action...
internals.main(Minimist(System.args.slice(1)));

