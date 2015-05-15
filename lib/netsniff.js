//
// This script is to be run with PhantomJS (not Node.js)
//

var webpage = require('webpage');


//
// Create resource entry for new outgoing request.
//
function createEntry(harPage, request) {
  var entry = {
    pageref: harPage.id,
    startedDateTime: request.time,
    time: -1,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      headers: request.headers,
      queryString: [], // This can be added later in node.js?
      cookies: [],
      //postData: {},
      headersSize: -1,
      bodySize: 0, // only for POST requests, why here?...
      //comment: ''
    },
    response: null,
    cache: {
      beforeRequest: null,
      afterRequest: null
    },
    timings: {},
    //serverIPAddress: '',
    connection: '',
    //comment: ''
  };

  //if (request.url.indexOf('data:') === 0) {
  //  entry._isBase64 = true;
  //  return entry;
  //}

  return entry;
}


//
// Compute entry properties once the response has ended.
//
function processEntry(entry) {
  var request = entry.request;
  var startReply = entry._startReply;
  var endReply = entry._endReply;

  // TODO: Handle entries with _errorReply!
  if (!request || !startReply || !endReply) {
    entry._ignore = true;
    return;
  }

  var bodySize = endReply.bodySize || startReply.bodySize || -1;

  //delete entry._startReply;
  //delete entry._endReply;

  entry.response = {
    status: endReply.status,
    statusText: endReply.statusText,
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: endReply.headers,
    redirectURL: '',
    headersSize: -1,
    bodySize: bodySize,
    content: {
      size: bodySize,
      mimeType: endReply.contentType || ''
    },
    //comment: ''
  };

  entry.time = endReply.time - entry.startedDateTime;
  entry.timings = {
    blocked: 0,
    dns: -1,
    connect: -1,
    send: 0,
    wait: startReply.time - entry.startedDateTime,
    receive: endReply.time - startReply.time,
    ssl: -1
  };

  emit('entry', entry);
}


var page = webpage.create();
var harPage = { id: phantom.args[0], /*comment: ''*/ };
var harEntries = [];

if (!harPage.id) {
  done(new Error('A URL is required'));
}


page.onUrlChanged = function (targetUrl) {
  // TODO: Handle redirects?
  //console.log('onUrlChanged', targetUrl);
};


page.onLoadStarted = function () {
  harPage.startedDateTime = new Date();
};


page.onResourceRequested = function (req) {
  harEntries[req.id - 1] = createEntry(harPage, req);
};


page.onResourceReceived = function (res) {
  var entry = harEntries[res.id - 1];

  if (res.stage === 'start') {
    entry._startReply = res;
  }
  if (res.stage === 'end') {
    entry._endReply = res;
    processEntry(entry);
  }
};


// timeout handling http://stackoverflow.com/a/18837957/47573
page.settings.resourceTimeout = 10000; // 10 seconds
page.onResourceTimeout = function (err) {
  var entry = harEntries[err.id -1];
  entry._errorReply = err;
  processEntry(entry);
};


page.onResourceError = function (resourceError) {
  // TODO: Handle resource errors?
  // console.error('resourceError', resourceError);
};


// https://gist.github.com/wangyang0123/2475509#comment-666382
page.onInitialized = function() {
  page.evaluate(function(domContentLoadedMsg) {
    document.addEventListener('DOMContentLoaded', function() {
      window.callPhantom('DOMContentLoaded');
    }, false);
  });
};


page.onCallback = function (data) {
  harPage._onContentLoad = new Date();
};


page.onConsoleMessage = function (msg, line, sourceId) {
  if (!harPage._consoleMessages) { harPage._consoleMessages = []; }
  harPage._consoleMessages.push({ message: msg, line: line, sourceId: sourceId }); 
};


page.onError = function (msg, trace) {
  if (!harPage._errors) { harPage._errors = []; }
  harPage._errors.push({ message: msg, trace: trace }); 
};


page.open(harPage.id, function (status) {
  if (status !== 'success') {
    var err = new Error('FAIL to load the address');
    err.status = status;
    err.page = harPage;
    return done(err);
  }

  harPage._endTime = new Date();

  harPage.title = page.evaluate(function () {
    return document.title;
  });

  harPage._renderedSource = page.evaluate(function () {
    return document.documentElement.outerHTML;
  });

  harPage._links = page.evaluate(function () {
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

  harPage.pageTimings = {
    onContentLoad: -1,
    onLoad: harPage._endTime - harPage.startedDateTime,
    //comment: ''
  };

  if (harPage._onContentLoad) {
    harPage.pageTimings.onContentLoad = harPage._onContentLoad - harPage.startedDateTime;
  }

  emit('page', harPage);
  done();
});



var hasEmitted = false;
var isDone = false;

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
  if (page) { page.close(); }
  if (err) {
    code = 1;
    emit('error', err);
  }

  console.log(']');
  isDone = true;
  setTimeout(function () { phantom.exit(code); }, 0);
}

