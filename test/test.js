var chai = require('chai'),
  expect = chai.expect,
  Checks = require('allex_checkslowlevellib'),
  DListBase = require('allex_doublelinkedlistbaselowlevellib'),
  Inherit = require('allex_inheritlowlevellib')(Checks.isFunction,Checks.isString).inherit,
  EventEmitter = require('allex_eventemitterlowlevellib')(DListBase,Inherit,Checks.isFunction,Checks.isArrayOfFunctions),
  DummyFunc = require('allex_functionmanipulationlowlevellib').dummyFunc,
  Fifo = require('allex_fifolowlevellib')(DListBase,Inherit),
  Timeout = require('allex_timeoutlowlevellib')(Checks.isFunction,Fifo),
  q = require('..')(Timeout.runNext,Checks.isArray,Checks.isFunction,Inherit,DummyFunc,EventEmitter);

describe('\'q\' lib testing: Basic', function(){
  function onFullfilled(done,myObj){
    expect(myObj.value).to.be.equal(3);
    done();
  }
  function onRejected(done,myObj,reason){
    myObj.value = -myObj.value;
    expect(myObj.value).to.be.equal(-3);
    done(reason);
  }
  function onProgress(myObj){
    myObj.value++;
  }
  function onFinally(myObj){
    myObj.value *= myObj.value;
    expect(myObj.value).to.be.equal(9);
  }
  it('fulfill + notify', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 0};
    p.then(onFullfilled.bind(null,done),onRejected.bind(null,done),onProgress.bind(null));
    d.notify(myObj);
    d.notify(myObj);
    d.notify(myObj);
    d.resolve(myObj);
  });
  it('reject + notify', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 0};
    p.then(onFullfilled.bind(null,done),onRejected.bind(null,done),onProgress.bind(null));
    d.notify(myObj);
    d.notify(myObj);
    d.notify(myObj);
    d.reject(myObj,'You shall not pass!');
  });
  it('catch + finally', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 3};
    p.catch(onRejected.bind(null,done));
    d.reject(myObj,'You shall not pass!');
  });
  it('notify + reject + finally', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 3};
    p.catch(onRejected.bind(null,done));
    p.finally(onFinally.bind(null));
    d.notify(myObj);
    d.notify(myObj);
    d.notify(myObj);
    d.reject(myObj,'You shall not pass!');
  });
});

describe('\'q\' lib testing: Chaining', function(){
  function onFullfilled1(myObj){
    myObj.value++;
    return myObj; //!!! must return to chain
  }
  function onFullfilled2(myObj){
    myObj.value *= myObj.value; 
    return myObj;
  }
  function onFullfilled3(done,myObj){
    myObj.value = -myObj.value;
    expect(myObj.value).to.be.equal(-4);
    done();
  }
  function onFullfilled3Throw(myObj){
    throw new Error('Use done at the end!');
  }
  function onFullfilled3CreateRejected(myObj){
    return q.reject('Use done at the end!');
  }
  function onFullfilled3(done,myObj){
    myObj.value = -myObj.value;
    expect(myObj.value).to.be.equal(-4);
    done();
  }
  function onDoneRejected(done,rejectedPromise){
    done();
  }
  it('Successful chaining', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 1};
    p.then(onFullfilled1).
      then(onFullfilled2).
      then(onFullfilled3.bind(null,done));
    d.resolve(myObj);
  });
  it('How to create rejected promise (Error is not automatically converted into rejected promise, you must create it by yourself)', function(done){
    var d = q.defer();
    var p = d.promise;
    var myObj = {value : 1};
    p.then(onFullfilled1).
      then(onFullfilled2).
      //then(onFullfilled3Throw). Error is not converted to Rejected promise like in q lib
      then(onFullfilled3CreateRejected). //create Rejected promise like this
      done(null,onDoneRejected.bind(null,done));
    d.resolve(myObj);
  });
});

describe('\'q\' lib testing: Delay', function(){
  function onFullfilled(done,myObj){
    myObj.value++;
    expect(myObj.value).to.be.equal(2);
    done();
  }
  it('Basic (200ms)', function(done){
    var myObj = {value : 1};
    q.delay(200,myObj).then(onFullfilled.bind(null,done));
  });
});

describe('\'q\' lib testing: all/allSettled/spread', function(){
  function fn1(myObj){
    myObj.value++;
    return q(myObj);
  }
  function fn2(myObj){
    myObj.value += 2;
    return q(myObj);
  }
  function fn3(myObj){
    myObj.value += 3;
    return q.reject(myObj);
  }
  function executeAll(done,promiseArry,cb){
    var promise = cb();
    if (!!promise){
      promiseArry.push(promise);
    }
    if (promiseArry.length === 2){
      q.all(promiseArry).done(onFullfilled.bind(null,done),onRejected.bind(null,done));
    }
  }
  function executeAllSettled(done,promiseArry,cb,orderNumber){
    var promise = cb();
    if (!!promise){
      promiseArry[orderNumber] = promise;
    }
    if (promiseArry.length === 3){
      q.allSettled(promiseArry).done(onAllSettled.bind(null,done));
    }
  }
  function executeAllSettledSpread(done,promiseArry,cb,orderNumber){
    var promise = cb();
    if (!!promise){
      promiseArry[orderNumber] = promise;
    }
    if (promiseArry.length === 3){
      q.allSettled(promiseArry).spread(onAllSettledSpread.bind(null,done));
    }
  }
  function onFullfilled(done,values){
    expect(values[0].value).to.be.equal(values[1].value);
    expect(values[0].value).to.be.equal(3);
    done();
  }
  function onAllSettled(done,values){
    expect(values[0].state).to.be.equal('fulfilled');
    expect(values[1].state).to.be.equal('fulfilled');
    expect(values[2].state).to.be.equal('rejected');
    expect(values[0].value.value).to.be.equal(values[1].value.value);
    expect(values[0].value.value).to.be.equal(values[2].reason.value);
    expect(values[1].value.value).to.be.equal(values[2].reason.value);
    expect(values[0].value.value).to.be.equal(6);
    done();
  }
  function onAllSettledSpread(done,promise1,promise2,promise3){
    expect(promise1.state).to.be.equal('fulfilled');
    expect(promise2.state).to.be.equal('fulfilled');
    expect(promise3.state).to.be.equal('rejected');
    expect(promise1.value.value).to.be.equal(promise2.value.value);
    expect(promise1.value.value).to.be.equal(promise3.reason.value);
    expect(promise2.value.value).to.be.equal(promise3.reason.value);
    expect(promise1.value.value).to.be.equal(6);
    done();
  }
  function onRejected(done,values){
    expect(values[0].value).to.be.equal(values[1].value);
    expect(values[0].value).to.be.equal(4);
    done();
  }
  it('Basic (all): immediate. Fulfilled', function(done){
    var myObj = {value : 0};
    q.all([fn1(myObj),fn2(myObj)]).done(onFullfilled.bind(null,done),onRejected.bind(null,done));
  });
  it('Basic (all): delayed. Fulfilled', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn1.bind(null,myObj)),50);
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn2.bind(null,myObj)),100);
  });
  it('Basic (all): immediate. Rejected', function(done){
    var myObj = {value : 0};
    q.all([fn1(myObj),fn3(myObj)]).done(onFullfilled.bind(null,done),onRejected.bind(null,done));
  });
  it('Basic (all): delayed (1st order). Rejected', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn1.bind(null,myObj)),50);
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn3.bind(null,myObj)),100);
  });
  it('Basic (all): delayed (2nd order). Rejected', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn3.bind(null,myObj)),50);
    Timeout.runNext(executeAll.bind(null,done,promiseArry,fn1.bind(null,myObj)),100);
  });
  it('Basic (allSettled): immediate', function(done){
    var myObj = {value : 0};
    q.allSettled([fn1(myObj),fn2(myObj),fn3(myObj)]).done(onAllSettled.bind(null,done));
  });
  it('Basic (allSettled): delayed (1st order)', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    //order is very important
    //so i am binding order number
    //and completition order doesnt matter in that case
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn1.bind(null,myObj),0),50);
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn2.bind(null,myObj),1),100);
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn3.bind(null,myObj),2),75);
  });
  it('Basic (allSettled): delayed (2nd order)', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    //order is very important
    //so i am binding order number
    //and completition order doesnt matter in that case
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn1.bind(null,myObj),0),125);
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn2.bind(null,myObj),1),50);
    Timeout.runNext(executeAllSettled.bind(null,done,promiseArry,fn3.bind(null,myObj),2),100);
  });
  it('Basic (allSettled/spread): immediate', function(done){
    var myObj = {value : 0};
    q.allSettled([fn1(myObj),fn2(myObj),fn3(myObj)]).spread(onAllSettledSpread.bind(null,done));
  });
  it('Basic (allSettled/spread): delayed', function(done){
    var myObj = {value : 0};
    var promiseArry = [];
    //order is very important
    //so i am binding order number
    //and completition order doesnt matter in that case
    Timeout.runNext(executeAllSettledSpread.bind(null,done,promiseArry,fn1.bind(null,myObj),0),50);
    Timeout.runNext(executeAllSettledSpread.bind(null,done,promiseArry,fn2.bind(null,myObj),1),100);
    Timeout.runNext(executeAllSettledSpread.bind(null,done,promiseArry,fn3.bind(null,myObj),2),75);
  });
});

describe('\'q\' lib testing: nfbind', function(){
  function onFullfilled(done,myObj){
    myObj.value++;
    expect(myObj.value).to.be.equal(7);
    done();
  }
  function nodeFn(myObj,cb){
    myObj.value += 5;
    cb(null,myObj);
  }
  it('Basic: function', function(done){
    var myObj = {value : 1};
    var nfn = q.nfbind(nodeFn);
    nfn(myObj).done(onFullfilled.bind(null,done));
  });
});

