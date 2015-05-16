var assert = require('assert');
var validate = require('har-validator');
var phantomjs = require('phantomjs');
var pkg = require('../package.json');
var server = require('./server');
var haribo = require('../');


describe('haribo', function () {

  this.timeout(30 * 1000);

  before(function (done) {
    this.server = server.start(done);
  });

  after(function (done) {
    this.server.stop(done);
  });

  it('should throw when URL not a string', function () {
    assert.throws(function () {
      haribo();
    }, function (err) {
      return err instanceof TypeError && /URL must be a string/i.test(err.message);
    });
  });

  it('should produce HAR with _failures when page fails to load', function (done) {
    haribo({ url: 'foo' })
      .on('error', console.error)
      .on('failure', function (page) {
        assert.equal(page.id, 'foo');
      })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 0);
        assert.equal(har.log.entries.length, 0);
        assert.equal(har.log._failures.length, 1);
        assert.equal(har.log._failures[0].id, 'foo');
      })
      .on('end', done);
  });

  it('should create default 1 page HAR (simple site)', function (done) {
    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    haribo({ url: baseurl })
      .on('har', function (har) {
        validate(har, function (err, valid) {
          assert.ok(!err);
          assert.ok(valid);
          assert.equal(har.log.version, '1.2');
          assert.equal(har.log.creator.name, pkg.name);
          assert.equal(har.log.creator.version, pkg.version);
          assert.equal(har.log.creator.comment, pkg.description);
          assert.equal(har.log.browser.name, 'PhantomJS');
          assert.equal(har.log.browser.version, phantomjs.version);

          var pages = har.log.pages;
          assert.equal(pages.length, 1);
          var page = pages[0];
          assert.equal(page.id, baseurl);
          assert.equal(typeof page.startedDateTime, 'string');
          assert.equal(page.title, 'Site 1');
          assert.equal(typeof page.pageTimings.onContentLoad, 'number');
          assert.equal(typeof page.pageTimings.onLoad, 'number');
          assert.equal(typeof page._renderedSource, 'string');
          assert.equal(page._links.length, 2);

          var link1 = page._links[0];
          var link2 = page._links[1];
          assert.equal(link1.id, baseurl + 'about.html');
          assert.equal(link1.count, 1);
          assert.equal(link1.internal, true);
          assert.equal(link1.instances[0].text, 'About Us');
          assert.equal(link1.instances[0].href, baseurl + 'about.html');
          assert.equal(link2.id, 'https://twitter.com/lupomontero');
          assert.equal(link2.count, 1);
          assert.equal(link2.internal, false);
          assert.equal(link2.instances[0].text, 'Me on Twitter!');
          assert.equal(link2.instances[0].href, 'https://twitter.com/lupomontero');

          assert.equal(har.log.entries.length, 2);
          har.log.entries.forEach(function (entry) {
            assert.equal(entry.pageref, baseurl);
            assert.equal(typeof entry.startedDateTime, 'string');
            assert.equal(typeof entry.time, 'number');
            assert.equal(entry.cache.beforeRequest, null);
            assert.equal(entry.cache.afterRequest, null);
            assert.equal(entry.connection, '');

            assert.equal(entry.request.method, 'GET');
            assert.equal(typeof entry.request.url, 'string');
            assert.equal(entry.request.httpVersion, 'HTTP/1.1');
            assert.equal(typeof entry.request.headers.length, 'number');
            assert.equal(entry.request.queryString.length, 0);
            assert.equal(entry.request.cookies.length, 0);
            assert.equal(entry.request.headersSize, -1);
            assert.equal(entry.request.bodySize, 0);

            assert.equal(entry.response.status, 200);
            assert.equal(entry.response.statusText, 'OK');
            assert.equal(entry.response.httpVersion, 'HTTP/1.1');
            assert.equal(entry.response.cookies.length, 0);
            assert.ok(entry.response.headers.length > 0);
            assert.equal(entry.response.redirectURL, '');
            assert.equal(entry.response.headersSize, -1);
            assert.ok(entry.response.bodySize > 0);
            assert.equal(typeof entry.response.content.size, 'number');
            assert.equal(typeof entry.response.content.mimeType, 'string');

            assert.equal(typeof entry.timings.blocked, 'number');
            assert.equal(typeof entry.timings.dns, 'number');
            assert.equal(typeof entry.timings.connect, 'number');
            assert.equal(typeof entry.timings.send, 'number');
            assert.equal(typeof entry.timings.wait, 'number');
            assert.equal(typeof entry.timings.receive, 'number');
            assert.equal(typeof entry.timings.ssl, 'number');
          });
        });
      })
      .on('end', done);
  });

  it('should create 2 page HAR (simple site)', function (done) {
    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 2);
      })
      .on('end', done);
  });

  it('should handle 403 on baseurl', function (done) {
    var baseurl = 'http://127.0.0.1:12345/02-forbidden/';

    // This URL returns a 403 as there is no index file and directory listing is
    // not enabled.

    haribo({ url: baseurl })
      .on('har', function (har) {
        var page = har.log.pages[0];
        assert.equal(page.id, baseurl);
        assert.equal(page.pageTimings.onContentLoad, -1);

        assert.equal(har.log.entries.length, 1);
        var entry = har.log.entries[0];
        assert.equal(entry.pageref, page.id);
        assert.equal(entry.request.url, page.id);
        assert.equal(entry.response.status, 403);
      })
      .on('end', done);
  });

  it('should follow broken link and report it', function (done) {
    var baseurl = 'http://127.0.0.1:12345/03-broken-link/';

    haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 2);
        assert.equal(har.log.pages[0].id, baseurl);
        assert.equal(har.log.pages[1].id, baseurl + 'about.html');
        assert.equal(har.log.entries.length, 2);
        assert.equal(har.log.entries[0].pageref, baseurl);
        assert.equal(har.log.entries[0].request.url, baseurl);
        assert.equal(har.log.entries[0].response.status, 200);
        assert.equal(har.log.entries[1].pageref, baseurl + 'about.html');
        assert.equal(har.log.entries[1].request.url, baseurl + 'about.html');
        assert.equal(har.log.entries[1].response.status, 404);
      })
      .on('end', done);
  });

  it.skip('should handle internal redirect on baseurl', function (done) {
    var baseurl = 'http://127.0.0.1:12345/_internal_redirect';
    haribo({ url: baseurl }).on('har', function (har) {
      console.log(har.log);
    }).on('end', done);
  });

  it('should handle internal redirect on pages');

  it.skip('should handle external redirect?', function (done) {
    //var baseurl = 'http://127.0.0.1:12345/_external_redirect';
    //haribo({ url: });
  });

  it('should handle resource errors');
  it('should handle resource timeout');

});

