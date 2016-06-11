function createDeferred(runNext, promises) {
  'use strict';
  function Deferred() {
    this.promise = new promises.Promise(this.onResolved.bind(this));
  }
  Deferred.prototype.resolve = function (value) {
    var p;
    if (this.promise instanceof promises.Promise) {
      p = this.promise.resolveForChain(value);
      if (p) {
        this.promise = p;
      }
    }
  };
  Deferred.prototype.reject = function (value) {
    if (this.promise instanceof promises.Promise) {
      this.promise.reject(value);
      this.promise = new promises.RejectedPromise(value);
    }
  };
  Deferred.prototype.notify = function (value) {
    if (this.promise instanceof promises.Promise) {
      runNext(this.promise.notify.bind(this.promise, value));
      value = null;
    }
  };
  Deferred.prototype.onResolved = function (promise) {
    this.promise = promise;
  };

  return Deferred;
}

module.exports = createDeferred;
