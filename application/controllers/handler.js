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
  rp = require('request-promise-native'),
  Microservices = require('../configs/microservices'),
  zip = require('adm-zip'),
  ePub = require('epub-gen'),
  scraper = require('website-scraper');
  //Reveal = require('reveal');

module.exports = {

  getOfflineHTML: function(request, reply) {
    let req_path = '/exportReveal/' + request.params.id + '?fullHTML=true';
    if (request.query.theme) {
      let theme = request.query.theme;
      req_path = req_path + '&theme=' + theme;
    }
    req_path = Microservices.pdf.uri + req_path;
    console.log(req_path);

    scraper.scrape({
      urls: [
        {url: Microservices.platform.uri + '/assets/images/cursor_bring_to_front.png', filename: 'cursor_bring_to_front.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_drag_arrow.png', filename: 'cursor_drag_arrow.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_remove.png', filename: 'cursor_remove.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_resize_arrow.png', filename: 'cursor_resize_arrow.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_send_to_back.png', filename: 'cursor_send_to_back.png'},
        {url: Microservices.platform.uri + '/assets/images/logo_full.png', filename: 'logo_full.png'},
        req_path
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
      ],
      request:{
        followRedirect: true,
        followAllRedirects: true
      }

    }).then(function (result) {
      //console.log(result);
      let filename = 'slidewiki-deck-' + request.params.id + '.zip';
      let folderName = 'exportedOfflineHTML-' + request.params.id;

      // Sync:
      try {
        fs.copySync(folderName+'/img/cursor_bring_to_front.png', folderName+'/img/cursor_bring_to_front_1.png');
        fs.copySync(folderName+'/img/cursor_drag_arrow.png', folderName+'/img/cursor_drag_arrow_1.png');
        fs.copySync(folderName+'/img/cursor_remove.png', folderName+'/img/cursor_remove_1.png');
        fs.copySync(folderName+'/img/cursor_resize_arrow.png', folderName+'/img/cursor_resize_arrow_1.png');
        fs.copySync(folderName+'/img/cursor_send_to_back.png', folderName+'/img/cursor_send_to_back_1.png');
        fs.copySync(folderName+'/img/logo_full.png', folderName+'/img/logo_full_1.png');
        //console.log('success!');
      } catch (err) {
        console.error(err);
      }

      let zipFile = new zip();
      zipFile.addLocalFolder(folderName);
      //zipFile.writeZip(filename);
      zipFile.toBuffer(function(buffer){
        reply(buffer).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/zip');

      }, function(failure) {
        console.log(failure);
      }
    );
    //  reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/zip');
    }).catch(function(err){
      console.log(err);
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
          let slideContent = {
            data: slide.content
          };
          slides.push(slideContent);
        }
      }
      let css = 'div {' +
          '    font-size: 12pt!important;' +
          '}' +
          'span {' +
          '    font-size: 12pt!important;' +
          '}' +
          'div font {' +
          '    font-size: inherit;' +
          '}' +
          '.epub-author {' +
          '    color: #555;' +
          '}' +
          '.epub-link {' +
          '    margin-bottom: 30px;' +
          '}' +
          '.epub-link a {' +
          '    color: #666;' +
          '    font-size: 90%;' +
          '}' +
          '.toc-author {' +
          '    font-size: 90%;' +
          '    color: #555;' +
          '}' +
          '.toc-link {' +
          '    color: #999;' +
          '    font-size: 85%;' +
          '    display: block;' +
          '}' +
          'hr {' +
          '    border: 0;' +
          '    border-bottom: 1px solid #dedede;' +
          '    margin: 60px 10%;' +
          '}';
      var option = {
        title: 'SlideWiki Deck ' + request.params.id, // *Required, title of the book.
        author: 'SlideWiki Author', // *Required, name of the author.
        css: css,
        includeDTDEvenInVersion3: true,
        content: slides
      };
      let filename = 'slidewiki-deck-' + request.params.id + '.epub';

      new ePub(option, filename).promise.then(function() {
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
    let theme = request.query.theme ? request.query.theme : '';
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
      if (deckTree.theme && theme === '') {
        theme = deckTree.theme;
        //console.log('theme: ' + theme);
      }
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
        '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/theme/' + theme + '.css">\n' +
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
          '    var pptxwidth = 0;' +
          '    var pptxheight = 0;' +
          '    var elements = document.getElementsByClassName(\'pptx2html\');' +
          '    for (var i=0; i < elements.length; i++) {' +
          '     var eltWidth=parseInt(elements[i].style.width.replace(\'px\', \'\'));' +
          '     var eltHeight=parseInt(elements[i].style.height.replace(\'px\', \'\'));' +
          '     if (eltWidth > pptxwidth) {' +
          '       pptxwidth = eltWidth;' +
          '     }' +
          '     if (eltHeight > pptxheight) {' +
          '       pptxheight = eltHeight;' +
          '     }' +
          '    }' +
          '    if (pptxwidth !== 0 && pptxheight !== 0) {' +
          '     Reveal.initialize({' +
          '       width: pptxwidth,' +
          '       height: pptxheight,' +
          '       controls: false,' +
          '       progress: false,' +
          '     });' +
          '    } else {' +
          '     Reveal.initialize();' +
          '    }' +
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

  //Get SCORM version
  getSCORM: function(request, reply) {
    let offline = false;
    let format = 'xml';
    let version = '1.2';
    if (request.query) {
      offline = request.query.offline ? request.query.offline : false;
      format = request.query.format ? request.query.format : 'xml';
      version = request.query.version ? request.query.version : '1.2';
    }
    let id = request.params.id;
    let template = '';
    let scormFile = 'scormtemplates/imsmanifest1.xml';
    if(version === '1.2'){
      scormFile = 'scormtemplates/imsmanifest1.xml';
    }
    if(version === '2'){
      scormFile = 'scormtemplates/imsmanifest2.xml';
    }
    if(version === '3'){
      scormFile = 'scormtemplates/imsmanifest3.xml';
    }
    if(version === '4'){
      scormFile = 'scormtemplates/imsmanifest4.xml';
    }

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
          if (revisions[i].id === revision_count) {
            title = revisions[i].title;
          }
        }
        let presentation_uri = 'index.html';
          //template = template.replace(/SLIDEWIKI_PRESENTATION_URL/g, presentation_uri).replace(/SLIDEWIKI_TITLE/g, title).replace(/SLIDEWIKI_DESCRIPTION/g, description);
        fs.readFile(scormFile, function(err, data) {
          template = data+'\n\t\t\t<title>'+title+'</title>';
        });

        let outputFilename = 'slidewiki-scorm-deck-' + id + '.zip';
        let zipURI = Microservices.pdf.uri + '/exportOfflineHTML/' + id;
        let file = fs.createWriteStream(outputFilename);
        let zipReq = rp(zipURI).on('error', function (err) {
          fs.unlink(outputFilename); // Delete the file async. (But we don't check the result)
          reply(boom.badImplementation());
        }).pipe(file);
        file.on('finish', function() {
          file.close(function() {
            let zfile1 = new zip(outputFilename);
            zfile1.extractAllTo('exportedOfflineHTML-temp-' + id, /*overwrite*/true);
            let zfile = new zip();
            zfile.addLocalFolder('exportedOfflineHTML-temp-' +id );
            let zipEntries = zfile.getEntries();
            let index=0;
            zipEntries.forEach(function(zipEntry) {
              template +=
              '\n\t\t\t<item identifier=”I_SC'+index+'" identifierref=”SC'+index+'" isvisible=”true”>'+
                '\n\t\t\t\t<title>'+zipEntry.entryName+'</title>'+
                '\n\t\t\t</item>';
              index++;
            });

            template +='\n\t\t</organization>\n\t</organizations>\n\t<resources>';
            index=0;
            zipEntries.forEach(function(zipEntry) {
              template +=
              '\n\t\t<resource identifier="r'+index+'" type="webcontent" adlcp:scormtype="sco" href="'+zipEntry.entryName+'">'+
              '\n\t\t\t<file href="'+zipEntry.entryName+'"/>'+
                '\n\t\t</resource>';
              index++;
            });
            template +='\n\t</resources>\n</manifest>';
              //console.log("template="+template);
            zfile.addFile('imsmanifest.xml', template);

            if(version === '1.2')
              zfile.addLocalFolder('scorm1.2');
            if(version === '2')
              zfile.addLocalFolder('scorm2');
            if(version === '3')
              zfile.addLocalFolder('scorm3');
            if(version === '4')
              zfile.addLocalFolder('scorm4');

            zfile.toBuffer( function(buffer) {
              reply(buffer).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/zip');
            }, function(failure) {
              reply(boom.badImplementation());
            });
          });
        });
      }).catch(function(error) { // Handle errors
        console.log(error);
        fs.unlink('temp' + outputFilename); // Delete the file async. (But we don't check the result)
        reply(boom.badImplementation());
      });
    }).catch(function(error) {
      request.log(error);
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
        //let filename = 'slidewiki-deck-' + id + '.zip';//md5sum.digest('base64') + '.pdf';
        //fs.unlinkSync(filename);
        fs.removeSync('exportedOfflineHTML-' + id);
      }
      if (request.path.includes('exportSCORM')) {
        let filename = 'slidewiki-scorm-deck-' + id + '.zip';
        fs.unlinkSync(filename);
        fs.removeSync('exportedOfflineHTML-temp-' + id);
      }
      if (request.path.includes('exportEPub')) {
        let filename = 'slidewiki-deck-' + id + '.epub';
        fs.unlinkSync(filename);
      }

    }
  }
};
