var assert = require('assert');
var har = require('../lib/har');
var pkg = require('../package.json');


describe('haribo/har', function () {

  it('should throw when no args', function () {
    assert.throws(function () {
      har();
    }, function (err) {
      assert.ok(err instanceof TypeError);
      assert.ok(/must be a callback/i.test(err.message));
      return true;
    });
  });

  it('should throw when no callback', function () {
    assert.throws(function () {
      har({});
    }, function (err) {
      assert.ok(err instanceof TypeError);
      assert.ok(/must be a callback/i.test(err.message));
      return true;
    });
  });

  it('should throw when attrs.pages is not an array', function () {
    assert.throws(function () {
      har({ pages: 1 }, function () {});
    }, function (err) {
      assert.ok(err instanceof TypeError);
      assert.ok(/must be arrays/i.test(err.message));
      return true;
    });
  });

  it('should create empty HAR when no pages nor entries', function () {
    har({}, function (err, json) {
      assert.ok(!err);
      assert.equal(json.log.version, '1.2');
      assert.equal(json.log.creator.name, pkg.name);
      assert.equal(json.log.creator.version, pkg.version);
      assert.equal(json.log.creator.comment, pkg.description);
      assert.equal(json.log.browser.name, 'PhantomJS');
      assert.equal(json.log.browser.version, '');
      assert.equal(json.log.browser.comment, '');
      assert.deepEqual(json.log.pages, []);
      assert.deepEqual(json.log.entries, []);
      assert.equal(json.log.comment, '');
    });
  });

  it('should ignore entries with _ignore prop', function () {
    har({ entries: [ { foo: 'bar', _ignore: true } ] }, function (err, json) {
      assert.ok(!err);
      assert.deepEqual(json.log.entries, []);
    });
  });

  it('should fail on validation errors', function () {
    var entry = { foo: 'bar' };
    har({ entries: [ entry ] }, function (err, json) {
      assert.equal(err.name, 'ValidationError');
      assert.ok(err.errors.length > 0);
      err.errors.forEach(function (error) {
        assert.equal(typeof error.field, 'string');
        assert.equal(typeof error.message, 'string');
        assert.deepEqual(error.value, entry);
      });
    });
  });

});

