function createQ(runNext, isArray, isFunction, inherit, dummyFunc, _EventEmitter) {
  'use strict';
  var promises = require('./promisecreator')(runNext, isArray, isFunction, inherit, dummyFunc, _EventEmitter),
    Deferred = require('./deferredcreator')(runNext, promises);

  function defer() {
    return new Deferred();
  }
  function reject(value) {
    return new promises.RejectedPromise(value);
  }
  function allSettled(promisearry) {
    return new promises.AllSettledMonitor(promisearry);
  }
  function all(promisearry) {
    return new promises.AllMonitor(promisearry);
  }
  function q(value) {
    if (promises.isPromise(value)) {
      return value;
    }
    return new promises.ResolvedPromise(value);
  }
  function nbind (nodemethod, thisarg) {
    if (!nodemethod) {
      console.trace();
      console.error('nodemethod is null?', arguments);
    }
    var superargs = Array.prototype.slice.call(arguments, 2);
    return function () {
      var d = defer(), args = superargs.slice(), i;
      for (i=0; i<arguments.length; i++) {
        args.push(arguments[i]);
      }
      function cb(err, result) {
        if (err) {
          d.reject(err);
        } else {
          d.resolve(result);
        }
        d = null;
      }
      args.push(cb);
      //console.log('applying to nodemethod with', args);
      nodemethod.apply(thisarg, args)
      return d.promise;
    }
  }
  function nfbind (nodemethod) {
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift(null);
    args.unshift(nodemethod);
    return nbind.apply(null, args);
  }
  function nfcall (func) {
    var d;
    if (!isFunction(func)) {
      return reject(Error('Function not provided'));
    }
    d = defer();
    var args = Array.prototype.slice.call(arguments, 1);
    args.push(function (err, res) {
      if (err) {
        d.reject(err);
      } else {
        d.resolve(res);
      }
      d = null;
    });
    func.apply(null, args);
    return d.promise;
  }

  function resolve (value) {
    return q(value);
  }

  function fcall(ftion) {
    ///all required arguments should be binded into ftion in order to avoid messing with arguments
    var ret;
    try {
      ret = resolve(ftion());
    }catch (e) {
      ret = reject(e);
    }
    ftion = null;
    return ret;
  }

  function pfcall (ftion) {
    return fcall.bind(null, ftion);
  }

  function delay(when, value) {
    var d = defer();
    try {
      lib.runNext(d.resolve.bind(d, value), when);
    } catch (e) {
      d.reject(e);
    }
    when = null;
    value = null;
    return d.promise;
  }

  function spread (promisearry, resolver, rejecter, notifier) {
    return all(promisearry).spread (resolver, rejecter, notifier);
  }

  q.defer = defer;
  q.reject = reject;
  q.all = all;
  q.allSettled = allSettled;
  q.isPromise = promises.isPromise;
  q.nbind = nbind;
  q.nfcall = nfcall;
  q.nfbind = nfbind;
  q.resolve = resolve;
  q.fcall = fcall;
  q.pfcall = pfcall;
  q.delay = delay;
  q.spread = spread;

  return q;
}

module.exports = createQ;
