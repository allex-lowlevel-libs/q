function createPromises(runNext, isArray, isFunction, inherit, dummyFunc, _EventEmitter) {
  'use strict'

  var STATE_RESOLVED = 1,
    STATE_REJECTED = 2;

  function shouldBeTestedForThen (thingy) {
    var tot;
    if (!thingy) {
      return false;
    }
    tot = typeof thingy;
    if ('object' === tot) {
      return true;
    }
    if ('function' === tot) {
      return true;
    }
    return false;
  }
  function isPromise (thingy) {
    return thingy instanceof PromiseBase;
    //return isThenable(thingy) && isFunction(thingy.spread) && 'value' in thingy;
  }
  function isThenable (thingy) {
    return thingy && isFunction(thingy.then);
  }
  function rejectedValue (thingy) {
    var i;
    if (thingy && isFunction(thingy.describeSelf)) {
      i = thingy.describeSelf();
      if (i.state==='rejected') {
        return {value: i.reason};
      }
    }
    return null;
  }
  function evaluate(val) {
    if (isPromise(val)) {
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
    if (isArray(resultarry)) {
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
    this.value = evaluate(value);
  }
  inherit(ResolvedPromise, PromiseBase);
  ResolvedPromise.prototype.destroy = dummyFunc;
  ResolvedPromise.prototype.done = function(resolver, rejecter, notifier) {
    if (resolver) {
      runNext(resolver.bind(null, this.value));
    }
  };
  ResolvedPromise.prototype.describeSelf = function () {
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
    if (isFunction(rejecter)) {
      runNext(rejectionOnRejected.bind(null, this, rejecter));
    }
  };
  function rejectionOnRejected (rp, rejecter) {
    var rv;
    try {
      rv = rejecter(rp.value);
      rejectionSetter(rp, rv);
    }
    catch (e) {
      console.log(e);
      rp.value = e;
    }
    rp = null;
    rejecter = null;
  }
  function rejectionSetter (rp, rejval) {
    if (isThenable(rejval)) {
      rejval.then(rejectionSetter.bind(null, rp), rejectionSetter.bind(null, rp));
    }
    rp = null;
    rejval = null;
  }
  RejectedPromise.prototype.describeSelf = function () {
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
        postponeFifoDestruction(this.resolvers, evaluate(this.value));
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
  Promise.prototype.describeSelf = function () {
    if (this.state === STATE_RESOLVED) {
      return ResolvedPromise.prototype.describeSelf.call(this);
    }
    if (this.state === STATE_REJECTED) {
      return RejectedPromise.prototype.describeSelf.call(this);
    }
    return {state: 'pending'};
  };
  Promise.prototype.isPending = function () {
    return this.state === null;
  };
  Promise.prototype.done = function (resolver, rejecter, notifier) {
    if (!this.resolvers) {
      if (resolver && this.state === STATE_RESOLVED) {
        runNext(resolver.bind(null, evaluate(this.value)));
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
    }
    return new ResolvedPromise(v);
  };
  Promise.prototype.resolve = function (value) {
    var v, vthen, lpc;
    if (!this.resolvers) {
      /*
      console.trace();
      console.error('Who called me dead?');
      */
      return;
    }
    if (this.future) {
      return this.future;
    }
    if (isPromise(value)) {
      if (value.isPending()) {
        this.future = value;
        lpc = new LaterPromiseCaller(this);
        return lpc.callMethod(value);
      }
      v = value.describeSelf();
      if (v.state === 'rejected') {
        this.value = v.reason;
        this.state = STATE_REJECTED;
        this.destroy();
        return v.reason;
      }
      if (v.state === 'fulfilled') {
        return this.resolve(v.value);
      }
    }
    if (shouldBeTestedForThen(value)) {
      try {
        vthen = value.then;
        if (isFunction(vthen)) {
          this.future = value;
          runNext(vThenCaller.bind(null, this, value, vthen));
          return this;
        }
      }
      catch (e) {
        this.reject(e);
        return this;
      }
    }
    this.value = value;
    this.state = STATE_RESOLVED;
    this.destroy();
    return value;
  };
  function vThenCaller (p, v, vthen) {
    var lpc = new LaterPromiseCaller(p);
    try {
      lpc.callFunction(v, vthen);
    }
    catch (e) {
      lpc.onRejected(e);
    }
    p = null;
    v = null;
    vthen = null;
  }
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

  function LaterPromiseCaller (promise) {
    this.promise = promise;
  };
  LaterPromiseCaller.prototype.destroy = function () {
    this.promise = null;
  }
  LaterPromiseCaller.prototype.callMethod = function (thenable) {
    if (!this.promise) {
      return RejectedPromise(new Error('Destroyed'));
    }
    return thenable.then(
      this.onResolved.bind(this),
      this.onRejected.bind(this),
      this.promise.notify.bind(this.promise)
    );
  };
  LaterPromiseCaller.prototype.callFunction = function (obj, then) {
    then.call(obj, this.onResolved.bind(this), this.onRejected.bind(this));
  };
  LaterPromiseCaller.prototype.onResolved = function (result) {
    var p = this.promise, ret;
    this.promise = null;
    if (!p) {
      return;
    }
    ret = p.onFutureResolved(result);
    this.destroy();
    return ret;
  };
  LaterPromiseCaller.prototype.onRejected = function (reason) {
    var ret, p = this.promise;
    this.promise = null;
    if (!p) {
      return;
    }
    ret = p.onFutureRejected(reason);
    this.destroy();
    return ret;
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
    var r, rv;
    if (isPromise(value) && value.isPending()) {
      return Promise.prototype.resolve.call(this, value);
    }
    if (isFunction(this.resolver)) {
      try {
        r = this.resolver.call(void(0), evaluate(value));
        if (r === this) {
          throw new TypeError('Promises/A+ 2.3.1');
        }
        rv = rejectedValue(r);
        if (rv && rv.value) {
          return Promise.prototype.reject.call(this, rv.value);
        }
      }
      catch (e) {
        return Promise.prototype.reject.call(this, e);
      }
      this.resolver = r;
    } else {
      this.resolver = value;
    }
    return Promise.prototype.resolve.call(this, this.resolver);
  };
  FuturePromise.prototype.reject = function (value) {
    var r, rv;
    if (isFunction(this.rejecter)) {
      try {
        r = this.rejecter.call(void(0), value);
        this.rejecter = null;
        if (r === this) {
          throw new TypeError('Promises/A+ 2.3.1');
        }
        rv = rejectedValue(r);
        if (rv && rv.value) {
          return Promise.prototype.reject.call(this, rv.value);
        }
        return Promise.prototype.resolve.call(this, r);
      }
      catch (e) {
        return Promise.prototype.reject.call(this, e);
      }
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
    if (!(promise && promise.describeSelf)) {
      console.log('wut m8?', promisearry, 'at', promiseindex);
    }
    this.value[promiseindex] = promise.describeSelf();
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
    return promise.describeSelf();
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

  return {
    ResolvedPromise: ResolvedPromise,
    RejectedPromise: RejectedPromise,
    Promise: Promise,
    AllSettledMonitor: AllSettledMonitor,
    AllMonitor: AllMonitor,
    isPromise: isPromise,
    isThenable: isThenable
  };
}

module.exports = createPromises;
