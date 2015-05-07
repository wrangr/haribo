var path = require('path');
var assert = require('assert');
var Hapi = require('hapi');
var haribo = require('../');


describe('haribo', function () {

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

    haribo({ url: baseurl })
      .on('error', function (err) {
        console.error('error', err);
      })
      .on('harError', function (harError) {
        console.error('harError', harError);
      })
      .on('har', function (har) {
        console.log(har);
        //har.entries.forEach(function (entry) {
        //  console.log(entry);
        //});
      })
      .on('end', done);
  });

});

