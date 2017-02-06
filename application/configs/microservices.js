'use strict';

const co = require('../common');

module.exports = {
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'http://deckservice'
  },
  'pdf': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_PDF)) ? process.env.SERVICE_URL_PDF : 'http://pdfservice'
  },
  'platform':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_PLATFORM)) ? process.env.SERVICE_URL_PLATFORM : 'http://platform'
  }
};
