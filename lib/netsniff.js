var webpage = require('webpage');
var system = require('system');


function createHAR(address, title, startTime, resources) {
  var entries = [];

  resources.forEach(function (resource) {
    var request = resource.request;
    var startReply = resource.startReply;
    var endReply = resource.endReply;

    if (!request || !startReply || !endReply) {
      return;
    }

    // Exclude Data URI from HAR file because
    // they aren't included in specification
    if (request.url.match(/(^data:image\/.*)/i)) {
      return;
    }

    entries.push({
      startedDateTime: request.time.toISOString(),
      time: endReply.time - request.time,
      request: {
        method: request.method,
        url: request.url,
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: request.headers,
        queryString: [],
        headersSize: -1,
        bodySize: -1
      },
      response: {
        status: endReply.status,
        statusText: endReply.statusText,
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: endReply.headers,
        redirectURL: "",
        headersSize: -1,
        bodySize: startReply.bodySize,
        content: {
          size: startReply.bodySize,
          mimeType: endReply.contentType
        }
      },
      cache: {},
      timings: {
        blocked: 0,
        dns: -1,
        connect: -1,
        send: 0,
        wait: startReply.time - request.time,
        receive: endReply.time - startReply.time,
        ssl: -1
      },
      pageref: address
    });
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: "PhantomJS",
        version: phantom.version.major + '.' + phantom.version.minor +
          '.' + phantom.version.patch
      },
      pages: [{
        startedDateTime: startTime.toISOString(),
        id: address,
        title: title,
        pageTimings: {
          onContentLoad: page.onContentLoad - page.startTime,
          onLoad: page.endTime - page.startTime
        }
      }],
      entries: entries
    }
  };
}


var page = webpage.create();

// timeout handling http://stackoverflow.com/a/18837957/47573
page.settings.resourceTimeout = 10000; // 10 seconds
page.onResourceTimeout = function (err) {
  done(err);
}



var url = phantom.args[0];

if (!url) {
  done(new Error('A URL is required'));
}

page.address = url;
page.resources = [];

page.onLoadStarted = function () {
  page.startTime = new Date();
};

page.onResourceRequested = function (req) {
  page.resources[req.id] = {
    request: req,
    startReply: null,
    endReply: null
  };
};

page.onResourceReceived = function (res) {
  if (res.stage === 'start') {
    page.resources[res.id].startReply = res;
  }
  if (res.stage === 'end') {
    page.resources[res.id].endReply = res;
  }
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
  page.onContentLoad = new Date();
};

page.onConsoleMessage = function (msg, line, sourceId) {
  //if (!page._consoleMessages) { page._consoleMessages = []; }
  //page._consoleMessages.push({ message: msg, line: line, sourceId: sourceId }); 
};

page.onError = function (msg, trace) {
  //if (!page._errors) { page._errors = []; }
  //page._errors.push({ message: msg, trace: trace }); 
};

page.open(page.address, function (status) {
  if (status !== 'success') {
    return done(new Error('FAIL to load the address'));
  }

  page.endTime = new Date();
  page.title = page.evaluate(function () {
    return document.title;
  });

  var har = createHAR(page.address, page.title, page.startTime, page.resources);
  var strHar = JSON.stringify(har);

  console.log(strHar);
  done();
});


function done(err) {
  var code = 0;

  if (page) { page.close(); }
  if (err) {
    code = 1;
    err.type = 'error';
    console.error(JSON.stringify(err));
  }

  setTimeout(function () { phantom.exit(code); }, 0);
}

