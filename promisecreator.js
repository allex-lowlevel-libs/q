function createPromises(runNext, isArray, isFunction, inherit, dummyFunc, _EventEmitter) {
  'use strict'

  var STATE_RESOLVED = 1,
    STATE_REJECTED = 2;

  function resolve(val) {
    var i;
    if (val instanceof PromiseBase) {
      if (val.isPending()) {
        return val;
      }
      return val.value;
    } else {
      return val;
    }
  }
  function postponeFifoDestruction (fifo, param) {
    if (fifo.length) {
      runNext(runFifo.bind(null, fifo, param));
    } else {
      fifo.destroy();
    }
  }
  function runFifo (fifo, param) {
    fifo.fire(param);
    fifo.destroy();
    fifo = null;
    param = null;
  }

  function PromiseBase() {
  }
  PromiseBase.prototype.then = function (resolver, rejecter, notifier) {
    var fp = new FuturePromise(resolver, rejecter);
    this.done(fp.resolve.bind(fp), fp.reject.bind(fp), notifier);
    return fp;
  };
  function spreader(resolver, resultarry) {
    var ret;
    if (isArray) {
      ret = resolver.apply(null, resultarry);
    } else {
      ret = resolver(resultarry);
    }
    resolver = null;
    return ret;
  }
  PromiseBase.prototype.spread = function (resolver, rejecter, notifier) {
    return this.then(spreader.bind(null, resolver), rejecter, notifier);
  };

  function ResolvedPromise(value) {
    this.value = resolve(value);
  }
  inherit(ResolvedPromise, PromiseBase);
  ResolvedPromise.prototype.destroy = dummyFunc;
  ResolvedPromise.prototype.done = function(resolver, rejecter, notifier) {
    if (resolver) {
      runNext(resolver.bind(null, this.value));
    }
  };
  ResolvedPromise.prototype.inspect = function () {
    return {state: 'fulfilled', value: this.value};
  };
  ResolvedPromise.prototype.isPending = function () {
    return false;
  };
  ResolvedPromise.prototype.catch = dummyFunc;

  function RejectedPromise(value) {
    this.value = value;
  }
  inherit(RejectedPromise, PromiseBase);
  RejectedPromise.prototype.destroy = dummyFunc;
  RejectedPromise.prototype.done = function(resolver, rejecter, notifier) {
    if (rejecter) {
      runNext(rejecter.bind(null, this.value));
    }
  };
  RejectedPromise.prototype.inspect = function () {
    return {state: 'rejected', reason: this.value};
  };
  RejectedPromise.prototype.catch = function (cb) {
    runNext(cb.bind(null, this.value));
  };
  RejectedPromise.prototype.finally = RejectedPromise.prototype.catch;
  RejectedPromise.prototype.fail = RejectedPromise.prototype.catch;
  RejectedPromise.prototype.isPending = function () {
    return false;
  };

  function Promise (resolvedcb) {
    this.resolvedcb = resolvedcb;
    this.resolvers = new _EventEmitter();
    this.rejecters = new _EventEmitter();
    this.notifiers = new _EventEmitter();
    this.value = null;
    this.state = null;
    this.future = null;
  }
  inherit(Promise, PromiseBase);
  Promise.prototype.destroy = function () {
    if (this.future !== null) {
      console.trace();
      console.error(process.pid, 'Cannot have future in destructor');
      throw Error('Cannot have future in destructor');
    }
    if (this.resolvers) {
      if (this.state === STATE_RESOLVED) {
        if (isPromise(this.value) && this.value.isPending()) {
          console.trace();
          console.error('Well, how did I get here?!');
          //process.exit(0);
        }
        postponeFifoDestruction(this.resolvers, resolve(this.value));
      } else {
        this.resolvers.destroy();
      }
      this.resolvers = null;
    }
    if (this.rejecters) {
      if (this.state === STATE_REJECTED) {
        postponeFifoDestruction(this.rejecters, this.value);
      } else {
        this.rejecters.destroy();
      }
      this.rejecters = null;
    }
    runNext(this.purgeNotifiers.bind(this));
    if (this.resolvedcb) {
      if (this.state === STATE_RESOLVED) {
        this.resolvedcb(new ResolvedPromise(this.value));
      }
      if (this.state === STATE_REJECTED) {
        this.resolvedcb(new RejectedPromise(this.value));
      }
    }
    this.resolvedcb = null;
  };
  Promise.prototype.purgeNotifiers = function () {
    if (this.notifiers) {
      this.notifiers.destroy();
      this.notifiers = null;
    }
  };
  Promise.prototype.inspect = function () {
    if (this.state === STATE_RESOLVED) {
      return ResolvedPromise.prototype.inspect.call(this);
    }
    if (this.state === STATE_REJECTED) {
      return RejectedPromise.prototype.inspect.call(this);
    }
    return {state: 'pending'};
  };
  Promise.prototype.isPending = function () {
    return this.state === null;
  };
  Promise.prototype.done = function (resolver, rejecter, notifier) {
    if (!this.resolvers) {
      if (resolver && this.state === STATE_RESOLVED) {
        runNext(resolver.bind(null, resolve(this.value)));
      }
      if (rejecter && this.state === STATE_REJECTED) {
        runNext(rejecter.bind(null, this.value));
      }
      return;
    }
    if (resolver) {
      this.resolvers.attachForSingleShot(resolver);
    }
    if (rejecter) {
      this.rejecters.attachForSingleShot(rejecter);
    }
    if (notifier) {
      this.notifiers.attach(notifier);
    }
  };
  Promise.prototype.catch = function (cb) {
    if (!this.rejecters) {
      if (this.state === STATE_REJECTED) {
        runNext(cb.bind(null, this.value));
      }
      return;
    }
    if (cb) {
      this.rejecters.attachForSingleShot(cb);
    }
  };
  Promise.prototype.finally = Promise.prototype.catch;
  Promise.prototype.fail = Promise.prototype.catch;
  Promise.prototype.resolveForChain = function (value) {
    var v = this.resolve(value);
    if (isPromise(v) && v.isPending()) {
      return null;
    } else {
      return new ResolvedPromise(v);
    }
  };
  Promise.prototype.resolve = function (value) {
    var v;
    if (!this.resolvers) {
      console.trace();
      console.error('Who called me dead?');
      return;
    }
    if (this.future) {
      return this.future;
    }
    v = resolve(value);
    if (isPromise(v) && v.isPending()) {
      this.future = v;
      return v.then(
        this.onFutureResolved.bind(this),
        this.onFutureRejected.bind(this),
        this.notify.bind(this)
      );
    } else {
      this.value = v;
      this.state = STATE_RESOLVED;
      this.destroy();
      return v;
      //return new ResolvedPromise(v);
    }
  };
  Promise.prototype.reject = function (value) {
    if (!this.resolvers) {
      return;
    }
    if (this.future) {
      return;
    }
    this.value = value;
    this.state = STATE_REJECTED;
    this.destroy();
  };
  Promise.prototype.notify = function (value) {
    if (!this.notifiers) {
      console.trace();
      console.log(this, '?!');
      console.log('should have notified with', value);
      return;
    }
    this.notifiers.fire(value);
    value = null;
  };
  Promise.prototype.onFutureResolved = function (value) {
    this.future = null;
    this.resolve(value);
  };
  Promise.prototype.onFutureRejected = function (value) {
    this.future = null;
    this.reject(value);
  };

  function FuturePromise (resolver, rejecter) {
    Promise.call(this);
    this.resolver = resolver;
    this.rejecter = rejecter;
  };
  inherit(FuturePromise, Promise);
  FuturePromise.prototype.destroy = function () {
    this.rejecter = null;
    this.resolver = null;
    Promise.prototype.destroy.call(this);
  };
  FuturePromise.prototype.resolve = function (value) {
    var r;
    if (isPromise(value) && value.isPending()) {
      return Promise.prototype.resolve.call(this, value);
    }
    if (isFunction(this.resolver)) {
      r = this.resolver(resolve(value));
      if (isRejected(r)) {
        return Promise.prototype.reject.call(this, r.value);
      }
      this.resolver = r;
    } else {
      this.resolver = value;
    }
    return Promise.prototype.resolve.call(this, this.resolver);
  };
  FuturePromise.prototype.reject = function (value) {
    if (isFunction(this.rejecter)) {
      return Promise.prototype.reject.call(this, this.rejecter(value));
    } else {
      return Promise.prototype.reject.call(this, value);
    }
  };

  function PromiseArrayMonitor(promisearry) {
    if (!isArray(promisearry)) {
      throw (new Error('NOT_AN_ARRAY'));
    }
    Promise.call(this);
    this.promisecount = 0;
    this.targetcount = promisearry.length;
    this.value = new Array(this.targetcount);
    if (isArray(promisearry) && promisearry.length) {
      promisearry.forEach(this.attachPromise.bind(this));
    } else {
      this.resolve([]);
    }
  }
  inherit(PromiseArrayMonitor, Promise);
  PromiseArrayMonitor.prototype.destroy = function () {
    this.promisecount = null;
    this.targetcount = null;
    Promise.prototype.destroy.call(this);
  };
  PromiseArrayMonitor.prototype.attachPromise = function (promise, promiseindex, promisearry) {
    if (!(promise && promise.inspect)) {
      console.log('wut m8?', promisearry, 'at', promiseindex);
    }
    this.value[promiseindex] = promise.inspect();
    promise.then(
      this.onPromiseResolved.bind(this, promiseindex, promise),
      this.onPromiseRejected.bind(this, promiseindex, promise)
    );
  };
  PromiseArrayMonitor.prototype.ackPromise = function (promiseindex, promise) {
    this.promisecount++;
    this.value[promiseindex] = this.valueOfPromise(promise);
  };
  PromiseArrayMonitor.prototype.onPromiseResolved = function (promiseindex, promise) {
    this.ackPromise(promiseindex, promise);
    if (this.promisecount === this.targetcount) {
      this.resolve(this.value);
    }
    promiseindex = null;
    promise = null;
  };

  function AllSettledMonitor (promisearry) {
    PromiseArrayMonitor.call(this, promisearry);
  }
  inherit(AllSettledMonitor, PromiseArrayMonitor);
  AllSettledMonitor.prototype.onPromiseRejected = function (promiseindex, promise) {
    PromiseArrayMonitor.prototype.onPromiseResolved.call(this, promiseindex, promise);
    promiseindex = null;
    promise = null;
  };
  AllSettledMonitor.prototype.valueOfPromise = function (promise) {
    return promise.inspect();
  };

  function AllMonitor (promisearry) {
    PromiseArrayMonitor.call(this, promisearry);
  }
  inherit(AllMonitor, PromiseArrayMonitor);
  AllMonitor.prototype.onPromiseRejected = function (promiseindex, promise) {
    this.ackPromise(promiseindex, promise);
    this.reject(this.value[promiseindex]);
  };
  AllMonitor.prototype.valueOfPromise = function (promise) {
    return promise.value;
  };

  function isPromise (thingy) {
    return thingy instanceof PromiseBase;
  }

  function isRejected (thingy) {
    return thingy instanceof RejectedPromise;
  }

  return {
    ResolvedPromise: ResolvedPromise,
    RejectedPromise: RejectedPromise,
    Promise: Promise,
    AllSettledMonitor: AllSettledMonitor,
    AllMonitor: AllMonitor,
    isPromise: isPromise
  };
}

module.exports = createPromises;
