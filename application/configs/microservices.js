'use strict';

const co = require('../common');

module.exports = {
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'http://deckservice.experimental.slidewiki.org'
  },
  'pdf': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_PDF)) ? process.env.SERVICE_URL_PDF : 'http://pdfservice.experimental.slidewiki.org'
  },
  'platform':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_PLATFORM)) ? process.env.SERVICE_URL_PLATFORM : 'http://platform.experimental.slidewiki.org'
  }
};
