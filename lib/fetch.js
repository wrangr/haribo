var url = require('url');
var Nightmare = require('nightmare');
var normalize = require('normalizeurl');
var $ = require('cheerio');
var _ = require('lodash');
var HTTP_STATUS_CODES = require('http').STATUS_CODES;


function href2url($html, page, href) {
  var base = $html('base').attr('href');
  var pageUrlObj = url.parse(page.id);

  if (!base) {
    base = pageUrlObj.protocol + '//' + pageUrlObj.host;
  }

  if (/^\/\//.test(href)) {
    href = pageUrlObj.protocol + href;
  } else if (/^\//.test(href)) {
    href = base + href;
  } else if (!/^(http|https)/.test(href)) {
    href = base + pageUrlObj.path + href;
  }

  var hrefUrlObj = url.parse(href);
  if (!hrefUrlObj.host) { hrefUrlObj.host = pageUrlObj.host; }

  // If there is a fragment we remove it as we are not interested...
  if (hrefUrlObj.hash) { delete hrefUrlObj.hash; }

  return url.format(hrefUrlObj);
}


function isExternal(page, href) {
  var pageUrlObj = url.parse(page.id);
  var hrefUrlObj = url.parse(href);
  return (pageUrlObj.host !== hrefUrlObj.host);
}


function extractLinks($html, page) {
  var links = { internal: [], external: [] };

  $html('a').map(function (i, a) {
    var $a = $(a);
    var href = $a.attr('href');
    var link = {
      text: $a.text().replace('\n', ' '),
      href: href,
      title: $a.attr('title'),
      target: $a.attr('target')
    };

    if (!href || /^(#|mailto)/.test(href)) { return; }

    link.url = href2url($html, page, href);

    if (isExternal(page, link.url)) {
      links.external.push(link);
    } else {
      links.internal.push(link);
    }
  });

  return links;
}


//
// Parse given URL to get protocol and domain.
//
function createEntry(page, request) {
  //console.log(request);
  var urlObj = url.parse(request.url, true);
  var entry = {
    pageref: page.id,
    startedDateTime: request.time,
    time: -1,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      headers: request.headers,
      queryString: _.map(urlObj.query, function (v, k) {
        return { name: k, value: k };
      }),
      cookies: [],
      //postData: {},
      headersSize: -1,
      bodySize: 0, // only for POST requests, why here?...
      comment: ''
    },
    response: null,
    cache: {
      beforeRequest: null,
      afterRequest: null
    },
    timings: {},
    //serverIPAddress: '',
    connection: '',
    comment: '',
    _protocol: null,
    _domain: null,
    _query: null,
    _isSSL: false,
    _isBase64: false,
  };

  if (request.url.indexOf('data:') === 0) {
    entry._isBase64 = true;
    return entry;
  }

  var parsed = url.parse(request.url, true);

  entry._protocol = parsed.protocol.replace(':', '');
  entry._domain = parsed.hostname;
  entry._query = parsed.query;

  if (entry._protocol === 'https') {
    entry._isSSL = true;
  }

  return entry;
}


function processEntry(entry) {
  var request = entry.request;
  var startReply = entry._startReply;
  var endReply = entry._endReply;

  if (!request || !startReply || !endReply) {
    //console.log('ignoring ', request.url);
    entry._ignore = true;
    return;
  }

  var requestTime = new Date(entry.startedDateTime);
  var startReplyTime = new Date(startReply.time);
  var endReplyTime = new Date(endReply.time);
  var bodySize = endReply.bodySize || startReply.bodySize || -1;

  //delete entry._startReply;
  //delete entry._endReply;

  entry.response = {
    status: endReply.status,
    statusText: endReply.statusText || HTTP_STATUS_CODES[endReply.status],
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: endReply.headers,
    redirectURL: '',
    headersSize: -1,
    bodySize: bodySize,
    comment: ''
  };

  if (endReply.contentType) {
    entry.response.content = {};
    entry.response.content.size = bodySize;
    entry.response.content.mimeType = endReply.contentType;
  }

  entry.time = endReplyTime - requestTime;
  entry.timings = {
    blocked: 0,
    dns: -1,
    connect: -1,
    send: 0,
    wait: startReplyTime - requestTime,
    receive: endReplyTime - startReplyTime,
    ssl: -1
  };
}


module.exports = function (uri, cb) {

  var nightmare = new Nightmare();
  var page = { id: uri, comment: '' };
  var entries = [];
  var exit;

  nightmare.on('urlChanged', function (targetUrl) {
    page.id = targetUrl;
  });

  nightmare.on('loadStarted', function () {
    page.startedDateTime = new Date();
  });

  nightmare.on('resourceRequested', function (request) {
    entries[request.id] = createEntry(page, request);
  });

  nightmare.on('resourceReceived', function (response) {
    var entry = entries[response.id];

    if (response.stage === 'start') {
      entry._startReply = response;
    } else if (response.stage === 'end') {
      entry._endReply = response;
      processEntry(entry);
    }

    if (normalize(response.url) === normalize(page.id)) {
      page._status = response.status;
    };
  });

  nightmare.on('resourceError', function (resourceError) {
    // TODO: Handle resource errors?
    console.error('resourceError', resourceError);
  });

  nightmare.on('consoleMessage', function (msg, line, sourceId) {
    if (!page._consoleMessages) { page._consoleMessages = []; }
    page._consoleMessages.push({ message: msg, line: line, sourceId: sourceId }); 
  });

  nightmare.on('error', function (msg, trace) {
    if (!page._errors) { page._errors = []; }
    page._errors.push({ message: msg, trace: trace }); 
  });

  //nightmare.on('timeout', function (msg) {});

  nightmare.on('exit', function (code, signal) {
    exit = { code: code, signal: signal };
  });

  nightmare.goto(uri);

  nightmare.evaluate(function () {
    var titleNode = document.getElementsByTagName('title')[0] || {};
    return {
      title: titleNode.innerHTML || 'Untitled',
      _source: document.documentElement.outerHTML
    };
  }, function (props) {
    _.extend(page, props);
  });

  function onRunComplete(err) {
    // Wait until PhantomJS has exitted, otherwise we end up having lots of
    // zombie processes.
    if (!exit) { return setTimeout(onRunComplete.bind(null, err), 100); }

    if (err) {
      err.exit = exit;
      return cb(err);
    }

    if (exit.code > 0) {
      console.error('PhantomJS exitted with an error', exit);
    }

    page._exit = exit;

    page.pageTimings = {
      onContentLoad: -1,
      onLoad: new Date() - page.startedDateTime,
      comment: ''
    };

    entries = _.compact(entries);

    // If request automatically followed a redirect to an external URL we ignore
    // the page.
    var resUrlObj = url.parse(page.id);
    var reqUrlObj = url.parse(uri);
    if (reqUrlObj.hostname !== resUrlObj.hostname) {
      // TODO: Handle external redirects before issuing request??
      return cb(null, page, entries);
    }

    if (page._status !== 200) { return cb(null, page, entries); }

    // Extract stuff from dom...
    var $html = $.load(page._source);
    page._links = extractLinks($html, page);

    cb(null, page, entries);
  }

  nightmare.run(onRunComplete);
};

