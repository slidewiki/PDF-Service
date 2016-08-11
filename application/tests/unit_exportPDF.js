/* eslint dot-notation: 0, no-unused-vars: 0 */
'use strict';

//Mocking is missing completely TODO add mocked objects

describe.skip('PDF', () => {
  it('exportPDF', function() {
    throw new Error('fail');
  });
  /*let server;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let hapi = require('hapi');
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      port: 80
    });
    require('../routes.js')(server);
    done();
  });

  let options = {
    method: 'GET',
    url: '/exportPDF/http%3A%2F%2Fartificer.jboss.org%2Fslides%2Fgeneral%2Fopensource-getting-involved.html',
  };

  context('when exporting a Reveal presentation it', () => {
    it('should reply with a PDF', (done) => {
      server.inject(options, (response) => {
        response.statusCode.should.equal(200);
        expect(response).to.have.header('Content-Type', 'application/pdf');
        done();
      });
    });
  });*/
});
