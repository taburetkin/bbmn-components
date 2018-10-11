this.bbmn = this.bbmn || {};
this.bbmn.components = (function (exports,_,bbmnUtils,bbmnCore) {
'use strict';

_ = _ && _.hasOwnProperty('default') ? _['default'] : _;

function isPromisable(arg) {
	return arg instanceof Promise || _.isFunction(arg && arg.then);
}

function asArray(arg) {
	if (_.isArray(arg)) return arg;else if (arg == null || arg === '') return [];else return [arg];
}

function race() {
	for (var _len = arguments.length, promises = Array(_len), _key = 0; _key < _len; _key++) {
		promises[_key] = arguments[_key];
	}

	return Promise.race(promises);
}

function valueToPromise(arg) {
	if (!isPromisable(arg)) {
		var result = arg;
		arg = arg == null || arg === '' ? Promise.resolve() : Promise.reject(result);
	}
	return arg;
}

function registerProcess(Process, context, name, opts) {

	context[name] = function () {

		var process = new Process(context, name, _.extend({}, opts));
		var concurrent = process.concurrencyCheck();

		if (concurrent) return concurrent;else return process.run.apply(process, arguments);
	};
}

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

var Process = bbmnCore.BaseClass.extend({
	constructor: function constructor(context, name, opts) {

		bbmnCore.BaseClass.apply(this, arguments);

		this._initDefaults(name, context);
		this._initCancelation();
		this._mergeOptions(opts);
	},


	// initialize methods

	_initDefaults: function _initDefaults(name, context) {
		if (name == null || name === '') throw new Error('Process requires two arguments: name [string], context [object]. name missing');

		if (!_.isObject(context)) throw new Error('Process requires two arguments: name [string], context [object]. context is not an object');

		this.cid = _.uniqueId('process');
		this.name = name;
		this.context = context;
		this.errors = [];
	},
	_initCancelation: function _initCancelation() {
		var _this = this;

		this.cancelPromise = new Promise(function (resolve, reject) {
			_this.cancel = function () {
				return reject('cancel');
			};
		});
	},
	_mergeOptions: function _mergeOptions() {
		var _this2 = this;

		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		var options = _.omit(opts, 'cid', 'name', 'context', 'cancelPromise', 'cancel', 'errors');
		_(options).each(function (value, key) {
			return _this2[key] = value;
		});
	},
	concurrencyCheck: function concurrencyCheck() {

		var previous = this.getProcessFromContext();
		//console.log(previous, this.context);
		if (!previous) return;

		var concurrent = this.concurrent;

		if (concurrent === false) {

			this.cancel();
		} else if (concurrent == 'first') {

			return previous.promise;
		} else if (concurrent == 'last') {

			previous.cancel();
		}
	},


	// life cycle methods	

	run: function run() {
		this.updateProcessInContext(this);

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		this.args = args || [];
		this.promise = this._createLifeCyclePromise();
		return this.promise;
	},
	_createLifeCyclePromise: function _createLifeCyclePromise() {
		var _this3 = this;

		return this._notCanceled().then(function () {
			return _this3._begin();
		}).then(function () {
			return _this3._beforeStart();
		}).then(function () {
			return _this3._canBeStarted();
		}).then(function () {
			return _this3._waitOtherPromises();
		}).then(function () {
			_this3.triggerComplete();
			return Promise.resolve();
		}).catch(function (error) {
			_this3.triggerError(error);
			var jsError = void 0;
			if (error instanceof Error) {
				throw error;
			} else if (jsError = _this3.getJsError()) {
				throw jsError;
			} else {
				return Promise.reject(_this3);
			}
		});
	},
	_notCanceled: function _notCanceled() {
		return this._cancelationRace(Promise.resolve());
	},
	_begin: function _begin() {
		return this._getHookResultAsPromise('begin');
	},
	_beforeStart: function _beforeStart() {
		return this._getHookResultAsPromise('before');
	},
	_canBeStarted: function _canBeStarted() {
		var contextMethod = 'can:not:' + this.name;
		var promise = this.invokeOnContext(contextMethod);
		if (!isPromisable(promise)) {
			promise = promise == null || promise === '' ? Promise.resolve() : Promise.reject(promise);
		}
		return this._cancelationRace(promise);
	},
	_waitOtherPromises: function _waitOtherPromises() {
		var contextMethod = 'get:' + this.name + ':promises';

		var promises = asArray(this.invokeOnContext(contextMethod));

		return this._cancelationRace(Promise.all(promises));
	},
	_getHookResultAsPromise: function _getHookResultAsPromise(hookName) {
		var _this4 = this;

		var procMethod = bbmnUtils.camelCase('on:' + hookName);
		var procHook = _.isFunction(this[procMethod]) && this[procMethod].apply(this, [this.context].concat(toConsumableArray(this.args))) || undefined;
		var result = valueToPromise(procHook).then(function () {
			var cntxHook = _this4.triggerOnContext(hookName);
			return valueToPromise(cntxHook);
		});

		return this._cancelationRace(result);
	},


	// trigger methods

	triggerComplete: function triggerComplete() {

		this.updateProcessInContext(null);

		if (_.isFunction(this.onComplete)) this.onComplete.apply(this, [this.context].concat(toConsumableArray(this.args)));

		this.triggerOnContext();

		this.triggerEnd();
	},
	triggerError: function triggerError(errors) {
		var _errors;

		this.updateProcessInContext(null);

		if (!_.isArray(errors)) errors = [errors];

		(_errors = this.errors).push.apply(_errors, toConsumableArray(errors));

		if (_.isFunction(this.onError)) this.onError.apply(this, [this.context].concat(toConsumableArray(this.errors)));

		this.triggerOnContext.apply(this, ['error'].concat(toConsumableArray(this.errors)));

		this.triggerEnd();
	},
	triggerEnd: function triggerEnd() {
		this.triggerOnContext('end');
	},


	// helpers methods

	getJsError: function getJsError(context) {
		!context && (context = this);
		if (context != this && (!_.isObject(context) || !_.isArray(context.errors))) return;

		return _(context.errors).filter(function (f) {
			return f instanceof Error;
		})[0];
	},
	_cancelationRace: function _cancelationRace(promise) {
		return race(this.cancelPromise, promise);
	},
	getContextProcessKey: function getContextProcessKey() {
		return bbmnUtils.camelCase('_process:' + this.name + ':executing');
	},
	getProcessFromContext: function getProcessFromContext() {
		var key = this.getContextProcessKey();
		return this.context[key];
	},
	updateProcessInContext: function updateProcessInContext(process) {
		var key = this.getContextProcessKey();
		this.context[key] = process;
	},
	triggerOnContext: function triggerOnContext(eventName) {

		var context = this.context;
		if (!_.isFunction(context.trigger)) return;

		var event = (eventName ? eventName + ':' : '') + this.name;

		return bbmnUtils.triggerMethodOn.apply(undefined, [context, event, this].concat(toConsumableArray(this.args)));
	},
	invokeOnContext: function invokeOnContext(methodName) {
		var method = bbmnUtils.camelCase(methodName);
		var context = this.context;
		var args = this.args;
		return bbmnUtils.betterResult(context, method, { args: args });
	}
}, {
	register: function register(context, name, opts) {
		return registerProcess(this, context, name, opts);
	}
});

var defaultStartableOptions = {
	concurrent: false,

	//good place to supply own state collecting logic
	storeState: function storeState() {

		this.contextState = [{
			key: 'startable.status',
			value: this.context['startable.status']
		}];

		/*
  		for example: take all simple values from context
  		for(var key in this.context){
  	let value = this.context[key];
  	if (value == null || !_.isObject(value.valueOf()))
  		this.contextState.push({ key, value });
  }
  		*/
	},
	restoreState: function restoreState() {
		var _this = this;

		_(this.contextState || []).each(function (keyValue) {
			_this.context[keyValue.key] = keyValue.value;
		});
	},
	onBefore: function onBefore() {
		this.storeState();
		this.ensureState();
		this.context['startable.status'] = this.processingName;

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		this.context['startable.start.lastArguments'] = args;
	},
	onComplete: function onComplete() {
		this.context['startable.status'] = this.processedName;
	},
	onError: function onError() {
		this.restoreState();
	},
	ensureState: function ensureState() {
		var shouldThrow = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

		var other = this.name == 'start' ? 'stop' : 'start';
		var error = this.name == 'start' ? 'not:stopped' : 'not:started';
		var status = this.context['startable.status'];
		switch (status) {
			case 'stopping':
			case 'starting':
				if (shouldThrow) throw new Error('not:iddle');else return 'not:iddle';
			case 'iddle':
				if (this.name == 'start') return;else if (shouldThrow) throw new Error(error);else return error;
			case other:
				if (shouldThrow) throw new Error(error);else return error;
		}
	}
};

var defaultStartOptions = {
	processingName: 'starting',
	processedName: 'started'
};
var defaultStopOptions = {
	processingName: 'stopping',
	processedName: 'stopped'
};

var StartableMixin = (function (Base) {
	return Base.extend({
		constructor: function constructor() {
			Base.apply(this, arguments);
			this._initializeStartable();
		},
		_initializeStartable: function _initializeStartable() {
			if (this._startableInitialized) return;

			var startable = _.extend({}, defaultStartableOptions, bbmnUtils.getOption(this, 'startableOptions', { args: [this] }));

			var start = _.extend({}, startable, defaultStartOptions, bbmnUtils.getOption(this, 'startOptions', { args: [this] }));
			var stop = _.extend({}, startable, defaultStopOptions, bbmnUtils.getOption(this, 'stopOptions', { args: [this] }));

			Process.register(this, 'start', start);
			Process.register(this, 'stop', stop);

			this._startableInitialized = true;
		},
		isStarted: function isStarted() {
			return this['startable.status'] === 'started';
		},
		isStopped: function isStopped() {
			return this['startable.status'] === 'stopped' || this['startable.status'] === 'iddle';
		},
		isNotIddle: function isNotIddle() {
			return this['startable.status'] === 'stopping' || this['startable.status'] === 'starting';
		},
		restart: function restart() {
			var _this2 = this;

			if (this.isNotIddle()) throw new Error('Restart not allowed while startable instance is not iddle: ', this['startable.status']);
			var stop = this.isStarted() ? this.stop() : Promise.resolve();
			var args = this['startable.start.lastArguments'] || [];
			return stop.then(function () {
				return _this2.start.apply(_this2, toConsumableArray(args));
			});
		}
	}, { StartableMixin: true });
});

var BaseApp = bbmnUtils.mix(bbmnCore.BaseClass).with(bbmnCore.Events, StartableMixin);

var App = BaseApp.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		this.options = _.clone(options);
		this._startPromises = [];
		BaseApp.apply(this, arguments);
		this.initialize(options);
		this.triggerMethod('initialize', options);
	},

	triggerMethod: bbmnUtils.triggerMethod,
	getOption: function getOption$$1() {
		return bbmnUtils.getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	},
	getStartPromises: function getStartPromises() {
		var _this = this;

		if (!this._startPromises) {
			return;
		}

		return _.map(this._startPromises, function (item) {
			if (_.isFunction(item)) {
				return item.call(_this);
			} else {
				return item;
			}
		});
	},
	addStartPromise: function addStartPromise() {
		var _startPromises;

		(_startPromises = this._startPromises).push.apply(_startPromises, arguments);
	},

	initialize: function initialize() {},
	doOnResolve: function doOnResolve(promise, callback) {
		for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
			args[_key - 2] = arguments[_key];
		}

		var _this2 = this;

		return promise.then(function () {
			return callback.apply(_this2, args);
		});
	},
	renderLayout: function renderLayout(options) {
		if (!this.layoutView) {
			var layout = this.buildLayout(options);
			if (!layout) {
				return;
			}

			//Mn v4 has this little bug, if layout is pointed to exist element and its equal reqion el render will not happens
			if (layout._isRendered && _.isFunction(layout.template)) {
				layout._isRendered = false;
			}

			this.layoutView = layout;
		}
		var region = this.getRegion();
		region.show(this.layoutView);
	},
	buildLayout: function buildLayout(options) {
		return bbmnUtils.buildViewByKey(this, 'layout', { options: options });
	},
	getRegion: function getRegion() {
		if (this._region) return this._region;
		this._region = this.buildRegion();
		return this._region;
	},
	_buildRegion: function _buildRegion(region, options) {
		if (region == null) {
			return new bbmnCore.Region(options);
		} else if (bbmnCore.isClass(region, bbmnCore.Region)) {
			return new region(options);
		} else if (_.isFunction(region)) {
			return this._buildRegion(region.call(this, this), options);
		} else if (_.isObject(region)) {
			var RegionClass = region.regionClass || bbmnCore.Region;
			var newOptions = _.extend({}, _.omit(region, 'regionClass'));
			if (!newOptions.el) {
				newOptions.el = options.el;
			}
			if (newOptions.replaceElement == null) {
				newOptions.replaceElement = options.replaceElement;
			}
			return new RegionClass(newOptions);
		}
	},
	buildRegion: function buildRegion() {
		var el = this.getOption('appEl') || 'body';
		var opts = { el: el, replaceElement: true };
		return this._buildRegion(this.getOption('region', { args: [this] }), opts);
	}
});

var index = {
	Process: Process,
	StartableMixin: StartableMixin,
	App: App
};

exports.Process = Process;
exports.StartableMixin = StartableMixin;
exports.App = App;
exports['default'] = index;

return exports;

}({},_,bbmnUtils,bbmnCore));

//# sourceMappingURL=index.js.map
