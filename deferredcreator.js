function createDeferred(runNext, promises) {
  'use strict';
  function Deferred() {
    this.promise = new promises.Promise(this.onResolved.bind(this));
    this.notificationvalues = [];
  }
  Deferred.prototype.resolve = function (value) {
    var p;
    if (this.promise instanceof promises.Promise) {
      if (this.notificationvalues.length>0) {
        runNext(this.resolve.bind(this, value));
        return;
      }
      p = this.promise.resolveForChain(value);
      if (p) {
        this.promise = p;
      }
    }
  };
  Deferred.prototype.reject = function (value) {
    if (this.promise instanceof promises.Promise) {
      if (this.notificationvalues.length>0) {
        runNext(this.reject.bind(this, value));
        return;
      }
      this.promise.reject(value);
      this.promise = new promises.RejectedPromise(value);
    }
  };
  Deferred.prototype.notify = function (value) {
    if (this.promise instanceof promises.Promise) {
      this.notificationvalues.push(value);
      if (this.notificationvalues.length===1) {
        runNext(this.fireNotifications.bind(this));
      }
      value = null;
    }
  };
  Deferred.prototype.fireNotifications = function () {
    var nvs = this.notificationvalues;
    this.notificationvalues = [];
    nvs.forEach(this.promise.notify.bind(this.promise));
  };
  Deferred.prototype.onResolved = function (promise) {
    this.promise = promise;
  };

  return Deferred;
}

module.exports = createDeferred;
