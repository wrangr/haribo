var Assert = require('assert');
var Validate = require('har-validator');
var Phantomjs = require('phantomjs');
var Pkg = require('../package.json');
var Server = require('./server');
var Haribo = require('../');


describe('haribo', function () {

  this.timeout(30 * 1000);

  before(function (done) {

    this.server = Server.start(done);
  });

  after(function (done) {

    this.server.stop(done);
  });

  it('should throw when URL not a string', function () {

    Assert.throws(function () {

      Haribo();
    }, function (err) {

      return err instanceof TypeError && /URL must be a string/i.test(err.message);
    });
  });

  it('should produce HAR with _failures when page fails to load', function (done) {

    Haribo({ url: 'foo' })
      .on('failure', function (page) {

        Assert.equal(page.id, 'foo');
      })
      .on('har', function (har) {

        Assert.equal(har.log.pages.length, 0);
        Assert.equal(har.log.entries.length, 0);
        Assert.equal(har.log._failures.length, 1);
        Assert.equal(har.log._failures[0].id, 'foo');
      })
      .on('end', done);
  });

  it('should create default 1 page HAR (simple site)', function (done) {

    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    Haribo({ url: baseurl })
      .on('har', function (har) {

        Validate(har).then(function (valid) {

          Assert.ok(valid);
          Assert.equal(har.log.version, '1.2');
          Assert.equal(har.log.creator.name, Pkg.name);
          Assert.equal(har.log.creator.version, Pkg.version);
          Assert.equal(har.log.creator.comment, Pkg.description);
          Assert.equal(har.log.browser.name, 'PhantomJS');
          Assert.equal(har.log.browser.version, Phantomjs.version);

          var pages = har.log.pages;
          Assert.equal(pages.length, 1);
          var page = pages[0];
          Assert.equal(page.id, baseurl);
          Assert.equal(typeof page.startedDateTime, 'string');
          Assert.equal(page.title, 'Site 1');
          Assert.equal(typeof page.pageTimings.onContentLoad, 'number');
          Assert.equal(typeof page.pageTimings.onLoad, 'number');
          Assert.equal(typeof page._renderedSource, 'string');
          Assert.equal(page._links.length, 2);

          var link1 = page._links[0];
          var link2 = page._links[1];
          Assert.equal(link1.id, baseurl + 'about.html');
          Assert.equal(link1.count, 1);
          Assert.equal(link1.internal, true);
          Assert.equal(link1.instances[0].text, 'About Us');
          Assert.equal(link1.instances[0].href, baseurl + 'about.html');
          Assert.equal(link2.id, 'https://twitter.com/lupomontero');
          Assert.equal(link2.count, 1);
          Assert.equal(link2.internal, false);
          Assert.equal(link2.instances[0].text, 'Me on Twitter!');
          Assert.equal(link2.instances[0].href, 'https://twitter.com/lupomontero');

          Assert.equal(har.log.entries.length, 2);
          har.log.entries.forEach(function (entry) {

            Assert.equal(entry.pageref, baseurl);
            Assert.equal(typeof entry.startedDateTime, 'string');
            Assert.equal(typeof entry.time, 'number');
            Assert.equal(entry.cache.beforeRequest, null);
            Assert.equal(entry.cache.afterRequest, null);
            Assert.equal(entry.connection, '');

            Assert.equal(entry.request.method, 'GET');
            Assert.equal(typeof entry.request.url, 'string');
            Assert.equal(entry.request.httpVersion, 'HTTP/1.1');
            Assert.equal(typeof entry.request.headers.length, 'number');
            Assert.equal(entry.request.queryString.length, 0);
            Assert.equal(entry.request.cookies.length, 0);
            Assert.equal(entry.request.headersSize, -1);
            Assert.equal(entry.request.bodySize, 0);

            Assert.equal(entry.response.status, 200);
            Assert.equal(entry.response.statusText, 'OK');
            Assert.equal(entry.response.httpVersion, 'HTTP/1.1');
            Assert.equal(entry.response.cookies.length, 0);
            Assert.ok(entry.response.headers.length > 0);
            Assert.equal(entry.response.redirectURL, '');
            Assert.equal(entry.response.headersSize, -1);
            Assert.ok(entry.response.bodySize > 0);
            Assert.equal(typeof entry.response.content.size, 'number');
            Assert.equal(typeof entry.response.content.mimeType, 'string');

            Assert.equal(typeof entry.timings.blocked, 'number');
            Assert.equal(typeof entry.timings.dns, 'number');
            Assert.equal(typeof entry.timings.connect, 'number');
            Assert.equal(typeof entry.timings.send, 'number');
            Assert.equal(typeof entry.timings.wait, 'number');
            Assert.equal(typeof entry.timings.receive, 'number');
            Assert.equal(typeof entry.timings.ssl, 'number');
          });
        });
      })
      .on('end', done);
  });

  it('should create 2 page HAR (simple site)', function (done) {

    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    Haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {

        Assert.equal(har.log.pages.length, 2);
      })
      .on('end', done);
  });

  it('should handle 403 on baseurl', function (done) {

    var baseurl = 'http://127.0.0.1:12345/02-forbidden/';

    // This URL returns a 403 as there is no index file and directory listing is
    // not enabled.

    Haribo({ url: baseurl })
      .on('har', function (har) {

        var page = har.log.pages[0];
        Assert.equal(page.id, baseurl);
        Assert.equal(page.pageTimings.onContentLoad, -1);

        Assert.equal(har.log.entries.length, 1);
        var entry = har.log.entries[0];
        Assert.equal(entry.pageref, page.id);
        Assert.equal(entry.request.url, page.id);
        Assert.equal(entry.response.status, 403);
      })
      .on('end', done);
  });

  it('should follow broken link and report it', function (done) {

    var baseurl = 'http://127.0.0.1:12345/03-broken-link/';

    Haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {

        Assert.equal(har.log.pages.length, 2);
        Assert.equal(har.log.pages[0].id, baseurl);
        Assert.equal(har.log.pages[1].id, baseurl + 'about.html');
        Assert.equal(har.log.entries.length, 2);
        Assert.equal(har.log.entries[0].pageref, baseurl);
        Assert.equal(har.log.entries[0].request.url, baseurl);
        Assert.equal(har.log.entries[0].response.status, 200);
        Assert.equal(har.log.entries[1].pageref, baseurl + 'about.html');
        Assert.equal(har.log.entries[1].request.url, baseurl + 'about.html');
        Assert.equal(har.log.entries[1].response.status, 404);
      })
      .on('end', done);
  });

  it('should ignore data uris', function (done) {

    Haribo({ url: 'http://127.0.0.1:12345/04-data-url' })
      .on('har', function (har) {

        Assert.equal(har.log.pages.length, 1);
        Assert.equal(har.log.entries.length, 1);
      })
      .on('end', done);
  });

  it.skip('should handle internal redirect on baseurl', function (done) {

    //var baseurl = 'http://127.0.0.1:12345/_internal_redirect';
    //Haribo({ url: baseurl }).on('har', function (har) {

      //console.log(har.log);
    //}).on('end', done);
    done();
  });

  it('should handle internal redirect on pages');

  it.skip('should handle external redirect?', function (done) {

    //var baseurl = 'http://127.0.0.1:12345/_external_redirect';
    //Haribo({ url: });
    done();
  });

  it('should handle resource errors');
  it('should handle resource timeout');

});

