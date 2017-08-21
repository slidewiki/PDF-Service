'use strict';

const co = require('../common');

module.exports = {
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'https://deckservice.experimental.slidewiki.org'
  },
  'pdf': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_PDF)) ? process.env.SERVICE_URL_PDF : 'https://pdfservice.experimental.slidewiki.org'
  },
  'user':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_USER)) ? process.env.SERVICE_URL_USER : 'https://userservice.experimental.slidewiki.org'
  },
  'platform':{
    uri: (!co.isEmpty(process.env.SERVICE_URL_PLATFORM)) ? process.env.SERVICE_URL_PLATFORM : 'https://platform.experimental.slidewiki.org'
  }
};
