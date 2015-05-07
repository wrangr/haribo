var path = require('path');
var assert = require('assert');
var Hapi = require('hapi');
var pages = require('../');


describe('pages', function () {

  this.timeout(30 * 1000);

  before(function (done) {
    var server = this.server = new Hapi.Server();
    server.connection({ port: 12345 });
    server.route({
      method: 'GET',
      path: '/{p*}',
      handler: {
        directory: {
          path: path.join(__dirname, 'sites/1')
        }
      }
    });
    server.start(done);
  });

  after(function (done) {
    this.server.stop(done);
  });

  it('should...', function (done) {
    var baseurl = 'http://127.0.0.1:12345/';
    var results = [];

    pages(baseurl, { max: 2 })
      .on('page', function (page) {
        results.push(page);
      })
      .on('end', function () {
        //assert.equal(results.length, 2);
        results.forEach(function (page) {
          console.log(page);
          //assert.equal(typeof page.url, 'string');
        });
        done();
      });
  });

});

