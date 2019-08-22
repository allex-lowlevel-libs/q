var Checks = require('allex_checkslowlevellib'),
  DListBase = require('allex_doublelinkedlistbaselowlevellib'),
  Inherit = require('allex_inheritlowlevellib')(Checks.isFunction,Checks.isString).inherit,
  EventEmitter = require('allex_eventemitterlowlevellib')(DListBase,Inherit,Checks.isFunction,Checks.isArrayOfFunctions),
  DummyFunc = require('allex_functionmanipulationlowlevellib').dummyFunc,
  Fifo = require('allex_fifolowlevellib')(DListBase,Inherit),
  Timeout = require('allex_timeoutlowlevellib')(Checks.isFunction,Fifo),
  q = require('..')(Timeout.runNext,Checks.isArray,Checks.isFunction,Inherit,DummyFunc,EventEmitter),
  //promisesAplusTests = require('papt');
  promisesAplusTests = require('promises-aplus-tests');

var adapter = {
  resolved: function (value) {
    return q(value);
  },
  rejected: function (reason) {
    return q.reject(reason);
  },
  deferred: function () {
    return q.defer();
  }
}

promisesAplusTests(adapter, console.error.bind(console));

