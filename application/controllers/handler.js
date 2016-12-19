/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  //slideDB = require('../database/slideDatabase'), //Database functions specific for slides
  co = require('../common'),
  fs = require('fs-extra'),
  crypto = require('crypto'),
  spawn = require('child_process').spawn,
  rp = require('request-promise'),
  http_request = require('request'),
  Microservices = require('../configs/microservices'),
  zip = require('adm-zip'),
  ePub = require('epub-gen'),
  scraper = require('website-scraper'),
  http = require('http');//,
  //Reveal = require('reveal');



module.exports = {

  getOfflineHTML: function(request, reply) {
    let req_path = '/exportReveal/' + request.params.id + '?fullHTML=true';
    req_path = Microservices.pdf.uri + req_path;
    console.log(req_path);

    scraper.scrape({
      urls: [
        req_path
        //{url: 'http://nodejs.org/about', filename: 'about.html'},
      ],
      directory: 'exportedOfflineHTML-' + request.params.id,
      subdirectories: [
        {directory: 'img', extensions: ['.jpg', '.png', '.svg']},
        {directory: 'js', extensions: ['.js']},
        {directory: 'css', extensions: ['.css']}
      ],
      sources: [
        {selector: 'img', attr: 'src'},
        {selector: 'link[rel="stylesheet"]', attr: 'href'},
        {selector: 'script', attr: 'src'}
      ]

    }).then(function (result) {
      console.log(result);
      let filename = 'slidewiki-deck-' + request.params.id + '.zip';
      let folderName = 'exportedOfflineHTML-' + request.params.id;
      let zipFile = new zip();
      zipFile.addLocalFolder(folderName);
      zipFile.writeZip(filename);
      reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/zip');
    }).catch(function(err){
      console.log(err);
    });


  },


  getSCORM: function(request, reply) {
/*
    let req_path = '/exportReveal/' + request.params.id + '?fullHTML=true';
    req_path = Microservices.pdf.uri + req_path;
    console.log(req_path);
  */
    let offline = false;
    let format = 'xml';
    let id = 1;
    if (request.query) {
      offline = request.query.offline ? request.query.offline : false;
      format = request.query.format ? request.query.format : 'xml';
    }
    if (request.params) {
      id = request.params.id ? request.params.id : 1;
    }

/*
    let template='<?xml version="1.0" encoding="utf-8" ?>\
              <tincan xmlns="http://projecttincan.com/tincan.xsd">\
                <activities>\
                  <activity id="SLIDEWIKI_PRESENTATION_URL" type="http://adlnet.gov/expapi/activities/course">\
                    <name>SLIDEWIKI_TITLE</name>\
                    <description lang="en-US">SLIDEWIKI_DESCRIPTION</description>\
                    <launch lang="en-us">SLIDEWIKI_PRESENTATION_URL</launch>\
                  </activity>\
                </activities>\
              </tincan>';
*/
    let template='<?xml version="1.0" encoding="utf-8" ?>\
              <metadata>\
                <schema>ADL SCORM</schema>\
                <schemaversion>2004 3rd Edition</schemaversion>\
              </metadata>\
              <organizations default="slidewiki_org">\
                <organization identifier="slidewiki_org">\
                  <title>SlideWiki Project</title>\
                  <item identifier="item_1" identifierref="resource_1">\
                    <title>SlideWiki</title>\
                  </item>\
                </organization>\
              </organizations>\
              <resources>\
              <resource identifier="resource_1" type="webcontent" adlcp:scormType="sco" href="shared/launchpage.html">\
              ';

    let req_url = Microservices.deck.uri + '/deck/' + id + '/revisionCount';

    rp(req_url).then(function(body) {
            let revision_count=body;
            let req_url = Microservices.deck.uri + '/deck/' + id;
            rp(req_url).then(function(body) {
              let deck_metadata = JSON.parse(body);
              let description = deck_metadata.description;
              let revisions = deck_metadata.revisions;
              let title = '';
              for (let i = 0; i < revisions.length; i++) {
                if (revisions[i].id == revision_count) {
                  title = revisions[i].title;
                }
              }
              let presentation_uri = '';

              presentation_uri = 'index.html';

              template = template.replace(/SLIDEWIKI_PRESENTATION_URL/g, presentation_uri).replace(/SLIDEWIKI_TITLE/g, title).replace(/SLIDEWIKI_DESCRIPTION/g, description);

              let outputFilename = 'slidewiki-scorm-deck-' + id + '.zip';
              let zipURI = Microservices.pdf.uri + '/exportOfflineHTML/' + id;

              console.log('About to create temp file. ');
              let file = fs.createWriteStream('temp' + outputFilename);
              let zipReq = http.get(zipURI, function(response) {
                response.pipe(file);
                console.log('Got zip file. ');
                file.on('finish', function() {
                  console.log('File finish. ');
                  file.close(function() {
                    console.log('File close.');
                      // extracts everything
                    let zfile1 = new zip('temp' + outputFilename);
                    zfile1.extractAllTo('exportedOfflineHTML-temp-' + id, /*overwrite*/true);

                    let zfile = new zip();
                    zfile.addLocalFolder('exportedOfflineHTML-temp-' +id );


                    /*let zfile = new zip('temp' + outputFilename);
                    console.log('Opening zip file.');*/
                    let zipEntries = zfile.getEntries();
                    console.log('Reading zip file contents.');


                    zipEntries.forEach(function(zipEntry) {
                      template +='<file href="'+zipEntry.entryName+'"/>';
                      console.log('Updating template.');
                    });

                    template +='</resource></resources></manifest>';
                    console.log('Updated template.');


                    zfile.addFile('scorm.xml', template);
                    console.log('Scorm.xml added.');
                    //let buffer = zfile.toBuffer();

                    zfile.toBuffer( function(buffer) {
                                console.log(buffer);
                                console.log('zfile added to buffer.');
                                reply(buffer).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/zip');
                              }, function(failure) {
                                console.log(failure);
                                console.log('Error turning zfile to buffer.')
                                reply(boom.badImplementation());
                              });

                    console.log('zfile added to buffer.');
                    //reply(buffer).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/zip');
                  });  // close() is async, call cb after close completes.
                });
              }).on('error', function(err) { // Handle errors
                fs.unlink('temp' + outputFilename); // Delete the file async. (But we don't check the result)
                reply(boom.badImplementation());
              });

          }).catch(function(error) {
            request.log(error);
            reply(boom.badImplementation());
          });
        }).catch(function(error) {
          request.log(error);
          reply(boom.badImplementation());
        });
      },







  getEPub: function(request, reply) {
    let req_path = '/deck/' + request.params.id + '/slides';
    req_path = Microservices.deck.uri + req_path;

    rp(req_path).then(function(body) {
      let deckTree = JSON.parse(body);
      let slides = [];
      if (deckTree !== '') {
        //console.log('deckTree is non-empty: ' + deckTree.children.length);
        for (let i = 0; i < deckTree.children.length; i++) {
          let slide = deckTree.children[i];
          slideContent = {
            data: slide.content
          };
          slides.push(slideContent);
        }
      }
      var option = {
        title: 'SlideWiki Deck ' + request.params.id, // *Required, title of the book.
        author: 'SlideWiki McSlideWikiFace', // *Required, name of the author.
        content: slides
      };
      let filename = 'slidewiki-deck-' + request.params.id + '.epub';

      new ePub(option, filename).then(function() {
        reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/epub+zip');
      }, function(err) {
        request.log(err);
        reply(boom.badImplementation());
      });
    });
  },




  // Get given deck as reveal.js, or return NOT FOUND
  getReveal: function(request, reply) {
    //console.log('In getReveal');
    let req_path = '/deck/' + request.params.id + '/slides';
    let limit = request.query.limit ? 'limit=' + request.query.limit : '';
    let offset = request.query.offset ? 'offset=' + request.query.offset : '';
    if (limit !== '' && offset !== '') {
      req_path += '?' + limit + '&' + offset;
    } else if (limit !== '') {
      req_path += '?' + limit;
    } else if (offset !== '') {
      req_path += '?' + offset;
    }
    req_path = Microservices.deck.uri + req_path;
    let platform_path = Microservices.platform.uri;
    //console.log('req_path: ' + req_path);

    rp(req_path).then(function(body) {
      let deckTree = JSON.parse(body);
      //request.log(deckTree);
      let slides = [];
      if (deckTree !== '') {
        //console.log('deckTree is non-empty: ' + deckTree.children.length);
        for (let i = 0; i < deckTree.children.length; i++) {
          let slide = deckTree.children[i];
          //console.log(slide);
          let speakerNotes = slide.speakerNotes ? '<aside class="notes">' + slide.speakerNotes + '</aside>': '';
          let content = slide.content + speakerNotes ;
          slides.push('<section key="' + slide.id + '" id="' + slide.id + '">' + content + '</section>');
          //console.log('slide: ' + slides[i]);

        }
      } else {
        slides = '<section/>';
      }
      let defaultCSS = '{' +
        'height: \'100%\',' +
        'position: \'absolute\',' +
        'top: \'0\',' +
      '}';
      let revealSlides = '';
      if (request.query.fullHTML) {
        revealSlides += '<html>\n' +
        '<head>\n' +
        '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/reveal.css">\n' +
        '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/theme/white.css">\n' +
        '</head>\n' +
        '<body>\n';
      }
      revealSlides += '<div>\n'+
      '          <div class="reveal" className="reveal" style=' + defaultCSS + '>\n' +
      '            <div class="slides" className="slides">\n';
      //console.log('revealSlides: ' + revealSlides);
      for (let i = 0; i < slides.length; i++) {
        //console.log('revealSlides: ' + revealSlides);
        revealSlides += '              ' + slides[i] + '\n';
      }
      revealSlides += '            </div>' +
        '          </div>' +
        '          <br style={clear: \'both\'}/>' +
        '        </div>';
      if (request.query.fullHTML) {
        revealSlides += '<script src="' + platform_path +'/custom_modules/reveal.js/js/reveal.js"></script>' +
          '<script>' +
          '    Reveal.initialize();' +
          '</script>' +
          '</body>' +
          '</html>';
      }
      //request.log('revealSlides: ' + revealSlides);
      //console.log(revealSlides);
      reply(revealSlides);
    }).catch(function(error) {
      request.log('error', error);
      //console.log(error);
      reply(boom.badImplementation());
    });
  },

  //Get PDF from URL or return NOT FOUND
  getPDF: function(request, reply) {
    let id = request.params.id;
    let url = Microservices.pdf.uri + '/exportReveal/' + id + '?fullHTML=true';


    //let md5sum = crypto.createHash('md5');
    //md5sum.update(url);
    let filename = 'slidewiki-deck-' + id + '.pdf';//md5sum.digest('base64') + '.pdf';

    let command = request.query.command ? request.query.command : 'reveal';
    let size = request.query.slideSize ? request.query.slideSize : '';
    let slides = request.query.slides ? request.query.slides : '';
    let outputFilename = request.query.pdf ? request.query.pdf : 'slidewiki-deck-' + id + '.pdf';
    let decktapeArgs = ['decktape/decktape.js'];
    if ( size !== '') {
      decktapeArgs.push('--size', size);
    }
    if ( slides !== '') {
      decktapeArgs.push('--slides', slides);
    }
    decktapeArgs.push(command);
    decktapeArgs.push(url);
    decktapeArgs.push(filename);

    let decktape = spawn('decktape/bin/phantomjs', decktapeArgs);
    console.log(decktapeArgs);
    decktape.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    decktape.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    decktape.on('close', (code) => {
      //console.log('FILENAME: ' + filename);
      reply.file(filename).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/pdf');
    });

  },
  getPDFEnd : function(request) {
    if (request.params.id) {
      let id = request.params.id;
      let url = Microservices.pdf.uri + '/exportReveal/' + id + '?fullHTML=true';
      if (request.path.includes('exportPDF')) {
        //let md5sum = crypto.createHash('md5');
        //md5sum.update(url);
        let filename = 'slidewiki-deck-' + id + '.pdf';//md5sum.digest('base64') + '.pdf';
        fs.unlinkSync(filename);
      }
      if (request.path.includes('exportOfflineHTML')) {
        //let md5sum = crypto.createHash('md5');
        //md5sum.update(url);
        let filename = 'slidewiki-deck-' + id + '.zip';//md5sum.digest('base64') + '.pdf';
        fs.unlinkSync(filename);
        fs.removeSync('exportedOfflineHTML-' + id);
      }
      if (request.path.includes('exportEPub')) {
        let filename = 'slidewiki-deck-' + id + '.epub';
        fs.unlinkSync(filename);
      }
    }
  }

};
