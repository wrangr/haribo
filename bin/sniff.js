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


var minimist = require('minimist');
var webpage = require('webpage').create();
var url = require('../lib/url');
var har = require('../lib/har');
var pkg = require('../package.json');


var defaults = {
  out: null,
  max: 1,
  include: [],
  exclude: []
};


function main(argv) {
  if (argv.v || argv.version) {
    console.log(pkg.version);
    return exit(0);
  } else if (argv.h || argv.help) {
    console.log([
      'Usage: ' + pkg.name + ' [ options ] <url>',
      '',
      'Options:',
      '',
      '--out=</path/to/file>  Write HAR file to given path.',
      '--max=<int>            Maximum number of pages to fetch.',
      '--include=<pattern>    Include URLs matching given pattern.',
      '--exclude=<pattern>    Exclude URLs matching given pattern.',
      '-h, --help             Show this help.',
      '-v, --version          Show version.',
      '',
      pkg.author.name + ' ' + (new Date()).getFullYear()
    ].join('\n'));
    return exit(0);
  }

  var options = Object.keys(defaults).reduce(function (memo, key) {
    if (argv.hasOwnProperty(key)) { memo[key] = argv[key]; }
    return memo;
  }, defaults);

  var uri = argv._.shift();
  //var matches = /^([a-z0-9+\.\-]+):/i.exec(uri);
  //if (!matches || matches.length < 2) {
  //  uri = 'http://' + uri;
  //} else if ([ 'http', 'https' ].indexOf(matches[1]) === -1) {
  //  return done(new Error('Unsupported scheme: ' + matches[1]));
  //}

  //var urlObj = url.parse(uri, true);
  //if (!urlObj.hostname) {
  //  return done(new Error('Invalid URL'));
  //}

  //options.url = url.format(urlObj);

  options.url = uri;
  sniff(options, done);
}


// Start the action...
main(minimist(phantom.args));


function sniff(options, cb) {
  var page = { id: options.url };
  var entries = [];

  webpage.onUrlChanged = function (targetUrl) {
    if (!page._redirects) { page._redirects = []; }
    page._redirects.push(page.id);
    page.id = targetUrl;
  };

  webpage.onLoadStarted = function () {
    page.startedDateTime = new Date();
  };

  webpage.onResourceRequested = function (req) {
    entries[req.id - 1] = har.createEntry(page, req);
  };

  webpage.onResourceReceived = function (res) {
    var entry = entries[res.id - 1];

    if (res.stage === 'start') {
      entry._startReply = res;
    } else if (res.stage === 'end') {
      entry._endReply = res;
      har.processEntry(entry);
      emit('entry', entry);
    }
  };

  // timeout handling http://stackoverflow.com/a/18837957/47573
  webpage.settings.resourceTimeout = 10000; // 10 seconds
  webpage.onResourceTimeout = function (err) {
    var entry = entries[err.id -1];
    entry._errorReply = err;
    har.processEntry(entry);
    emit('entry', entry);
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
    if (!page._consoleMessages) { page._consoleMessages = []; }
    page._consoleMessages.push({ message: msg, line: line, sourceId: sourceId }); 
  };

  webpage.onError = function (msg, trace) {
    if (!page._errors) { page._errors = []; }
    page._errors.push({ message: msg, trace: trace }); 
  };

  webpage.open(options.url, function (status) {
    if (status !== 'success') {
      emit('failure', page);
      return cb();
    }

    page._endTime = new Date();

    page.title = webpage.evaluate(function () {
      return document.title;
    });

    page._renderedSource = webpage.evaluate(function () {
      return document.documentElement.outerHTML;
    });

    page._links = webpage.evaluate(function () {
      var nodeList = document.getElementsByTagName('a');
      var nodeArray = Array.prototype.slice.call(nodeList);
      return nodeArray.reduce(function (memo, node) {
        var href = node.href;
        if (!href || /^(#|mailto)/.test(href)) { return memo; }
        var link = { href: href, text: node.innerHTML.replace(/\n/g, '') };
        if (node.title) { link.title = node.title; }
        if (node.target) { link.target = node.target; }
        memo.push(link);
        return memo;
      }, []);
    });

    page.pageTimings = {
      onContentLoad: -1,
      onLoad: page._endTime - page.startedDateTime
    };

    if (page._onContentLoad) {
      page.pageTimings.onContentLoad = page._onContentLoad - page.startedDateTime;
    }

    emit('page', page);

    // Before fetching subpages we filter out based on the base url.
    var r = new RegExp('^' + options.url);
    var subpages = page._links.filter(function (link) {
      return r.test(link.href);
    });
    if (!subpages.length) { return cb(); }
    //log(subpages);
    cb();
    //fetchSubPages(subpages, cb);
  });
}



// ***** //

var hasEmitted = false;
var isDone = false;


function log(val) {
  console.log(JSON.stringify(val, null, 2));
}


function exit(code) {
  setTimeout(function () { phantom.exit(code); }, 0);
}


function emit(name, data) {
  if (isDone) { return; }
  if (!hasEmitted) {
    hasEmitted = true;
    console.log('[');
  } else {
    console.log(',');
  }
  console.log(JSON.stringify({ name: name, data: data }));
}


function done(err) {
  if (isDone) { return; }

  var code = 0;
  if (webpage) { webpage.close(); }
  if (err) {
    code = 1;
    emit('error', err);
  }

  console.log(']');
  isDone = true;
  setTimeout(function () { phantom.exit(code); }, 0);
}

