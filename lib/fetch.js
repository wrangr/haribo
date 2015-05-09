var url = require('url');
var path = require('path');
var cp = require('child_process');
//var EventEmitter = require('events').EventEmitter;
var JSONStream = require('JSONStream');
var phantomjs = require('phantomjs');
var script = path.join(__dirname, 'netsniff.js');


function processLinks(page) {
  var pageUrlObj = url.parse(page.id);
  page._links = page._links.map(function (link) {
    link.internal = pageUrlObj.host === url.parse(link.href).host;
    return link;
  });
}


module.exports = function (uri, cb) {

  var page;
  var entries = [];
  var child = cp.spawn(phantomjs.path, [ script, uri ]);
  
  //child.stderr.on('data', function (chunk) {
  //  console.error('STDERR: ' + chunk);
  //});

  var parser = child.stdout.pipe(JSONStream.parse('*'));
  
  parser.on('data', function (obj) {
    if (obj.name === 'page') {
      page = obj.data;
      processLinks(page);
    } else if (obj.name === 'entry') {
      entries.push(obj.data);
    }
  });

  child.on('close', function (code, signal) {
    if (typeof cb !== 'function') { return; }
    cb(null, page, entries);
  });

  return parser;

  /*
  function onRunComplete(err) {
    // If request automatically followed a redirect to an external URL we ignore
    // the page.
    var resUrlObj = url.parse(page.id);
    var reqUrlObj = url.parse(uri);
    if (reqUrlObj.hostname !== resUrlObj.hostname) {
      // TODO: Handle external redirects before issuing request??
      return cb(null, page, entries);
    }

    if (page._status !== 200) { return cb(null, page, entries); }

    cb(null, page, entries);
  }
  */
};

