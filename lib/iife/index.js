this.bbmn = this.bbmn || {};
this.bbmn.components = (function (exports,_,bbmnUtils,bbmnCore,backbone_marionette,bbmnMixins) {
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

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};



































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

var startableMixin = (function (Base) {
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

var BaseApp = bbmnUtils.mix(bbmnCore.BaseClass).with(bbmnCore.Events, startableMixin);

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
			this.layoutView = layout;
		}
		var region = this.getRegion();
		region.show(this.layoutView);
		return this.layoutView;
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

var Schema = bbmnCore.BaseClass.extend({
	getOption: function getOption$$1() {
		return bbmnUtils.getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	}
});

var PropertySchema = Schema.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		Schema.apply(this, arguments);
		var name = options.name,
		    property = options.property,
		    modelSchema = options.modelSchema,
		    _options$order = options.order,
		    order = _options$order === undefined ? 0 : _options$order;

		this.name = name;
		this.schema = _.extend({}, property);
		this.modelSchema = modelSchema;
		if (this.schema.order != null) order = this.schema.order;
		this.order = order;
	},
	_getByKey: function _getByKey(key) {
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		var hash = bbmnUtils.betterResult(this.schema, key, { args: [options], default: {} });
		return bbmnUtils.unflat(bbmnUtils.flat(hash));
	},
	getValidation: function getValidation(options) {
		return this._getByKey('validation', options);
	},
	getType: function getType(options) {
		var type = this._getByKey('value', options);
		if (!('multiple' in type)) {
			type.multiple = false;
		}
		return type;
	},
	getDisplay: function getDisplay(options) {
		return this._getByKey('display', options);
	},
	getLabel: function getLabel(value, allValues) {
		var label = this.getDisplay().label;
		return bbmnUtils.betterResult({ label: label }, 'label', { args: [value, allValues] });
	},
	getEdit: function getEdit() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		var valueOptions = this.getType(options);
		var editOptions = this._getByKey('edit', options);
		var label = this.getLabel(options.value, options.allValue);
		var compiled = _.extend({ name: this.name, label: label }, options, { valueOptions: valueOptions, editOptions: editOptions });
		return compiled;
	}
});

var ModelSchema = Schema.extend({
	constructor: function constructor() {
		var properties = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		this.properties = {};
		Schema.apply(this, arguments);
		this.setProperties(properties);
	},

	propertySchema: PropertySchema,
	_createProperty: function _createProperty(property) {
		var props = this.getProperties();
		var order = _.size(props);
		var Schema$$1 = this.getOption('propertySchema');
		var options = { name: property.name, property: property, modelSchema: this, order: order };
		return this.createProperty(Schema$$1, options);
	},
	createProperty: function createProperty(Schema$$1, options) {
		return new Schema$$1(options);
	},
	setProperties: function setProperties(properties) {
		var _this = this;

		return _.map(properties, function (property, name) {
			if (!_.isObject(property)) {
				return;
			}

			var propertyName = _.isString(name) ? name : property.name;
			if (bbmnUtils.isEmptyValue(propertyName)) {
				throw new Error('property name missing: ' + name);
			}
			return _this.setProperty(propertyName, property);
		});
	},
	getProperties: function getProperties() {
		return this.properties;
	},
	getPropertiesArray: function getPropertiesArray() {
		var props = this.getProperties();
		return _.toArray(props).sort(function (p1, p2) {
			return p1.order - p2.order;
		});
	},
	getPropertiesNames: function getPropertiesNames() {
		var props = this.getPropertiesArray();
		return _.pluck(props, 'name');
	},
	getProperty: function getProperty(name) {
		var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    _ref$create = _ref.create,
		    create = _ref$create === undefined ? false : _ref$create;

		var properties = this.getProperties() || {};
		var property = properties[name];
		if (property || !create) {
			return property;
		}
		property = this._createProperty(name);
		return this.setProperty(name, property);
	},
	_setProperty: function _setProperty(name, property) {
		if (!_.isObject(property)) {
			throw new Error('property is not an object', property);
		}
		if (bbmnUtils.isEmptyValue(name)) {
			throw new Error('property has no name', property);
		}

		if (bbmnUtils.isEmptyValue(property.name)) {
			property.name = name;
		}

		if (!(property instanceof PropertySchema)) {
			property = this._createProperty(property);
		}

		var properties = this.getProperties();
		properties[property.name] = property;

		return property;
	},
	setProperty: function setProperty(name, property) {
		if (_.isObject(name)) {
			property = name;
			name = property.name;
		}
		return this._setProperty(name, property);
	},
	getValidation: function getValidation(name) {
		var property = this.getProperty(name);
		return property && property.getValidation() || {};
	},
	getType: function getType(name) {
		var property = this.getProperty(name);
		return property && property.getType() || {};
	},
	getLabel: function getLabel(name) {
		var property = this.getProperty(name);
		return property && property.getLabel() || '';
	}
});

var store = {
	schemas: {},
	getStoreName: function getStoreName(arg) {
		if (_.isString(arg) && arg !== '') {
			return arg;
		}

		if (_.isFunction(arg)) {
			var _store = this.getStoreByCtor(arg);
			if (_store) {
				return _store.name;
			}
		}
		return _.uniqueId('modelSchema');
	},
	getStoreByCtor: function getStoreByCtor(ctor) {
		return _.find(this.schemas, function (f) {
			return f.ctor === ctor;
		});
	},
	isNotInitialized: function isNotInitialized(arg) {
		return !this.getStore(arg);
	},
	initialize: function initialize(name) {
		var schema = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		if (!this.isNotInitialized(name)) {
			throw new Error('Schema already initialized');
		}
		var ctor = _.isFunction(name) && name || undefined;
		name = this.getStoreName(name);

		if (name in this.schemas) {
			return;
		}

		if (!(schema instanceof ModelSchema) && _.isObject(schema)) {
			schema = new ModelSchema(schema);
		} else {
			schema = new ModelSchema({});
		}
		this.schemas[name] = {
			name: name, ctor: ctor, schema: schema
		};
		return schema;
	},
	getStore: function getStore(arg) {
		if (_.isString(arg)) {
			return this.schemas[arg];
		} else if (_.isFunction(arg)) {
			return this.getStoreByCtor(arg);
		}
	},
	get: function get(arg) {
		var cache = this.getStore(arg);
		return cache && cache.schema || undefined;
	}
};

var ExtView = bbmnUtils.mix(backbone_marionette.View).with(bbmnMixins.cssClassModifiersMixin);
var ExtCollectionVIew = bbmnUtils.mix(backbone_marionette.CollectionView).with(bbmnMixins.customsMixin, bbmnMixins.nextCollectionViewMixin, bbmnMixins.emptyFetchMixin, bbmnMixins.improvedIndexesMixin);

var rules = [{
	name: 'required',
	message: 'required',
	validate: function validate(value) {
		if (bbmnUtils.isEmptyValue(value)) {
			return 'required';
		}
	}
}, {
	name: 'email',
	message: 'not a email',
	validate: function validate(value) {

		if (bbmnUtils.isEmptyValue(value)) {
			return;
		}

		if (!_.isString(value)) {
			return 'type:mismatch';
		}

		var chunks = value.split('@');
		var left = chunks[0];
		var right = chunks[1];

		if (chunks.length != 2 || !/^[a-z0-9\-_.+]+$/gmi.test(left) || !/^[a-z0-9\-_]+\.[a-z0-9\-_]+(\.[a-z0-9\-_]+)*$/gmi.test(right)) {
			return 'pattern:mismatch';
		} else {
			return;
		}
	}
}, {
	name: 'valueIn',
	message: 'given value is not one of allowed values',
	validate: function validate(value) {
		var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    valueIn = _ref.valueIn;

		if (_.isArray(valueIn) && valueIn.indexOf(value) === -1) {
			return 'value:not:in';
		}
	}
}, {
	name: 'valueNotIn',
	message: 'given value is one of forbiden values',
	validate: function validate(value) {
		var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    valueNotIn = _ref2.valueNotIn;

		if (_.isArray(valueNotIn) && valueNotIn.indexOf(value) > -1) {
			return 'value:in';
		}
	}
}, {
	name: 'shouldBeEqual',
	message: 'given value is not equal',
	validate: function validate(value) {
		var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    shouldBeEqual = _ref3.shouldBeEqual,
		    allValues = _ref3.allValues;

		var compare = _.isFunction(shouldBeEqual) ? shouldBeEqual(allValues) : shouldBeEqual;

		if (value !== compare) {
			return 'value:not:equal';
		}
	}
}, {
	name: 'shouldNotBeEqual',
	message: 'given value is forbiden',
	validate: function validate(value) {
		var _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    shouldNotBeEqual = _ref4.shouldNotBeEqual,
		    allValues = _ref4.allValues;

		var compare = _.isFunction(shouldNotBeEqual) ? shouldNotBeEqual(allValues) : shouldNotBeEqual;

		if (value !== compare) {
			return 'value:equal';
		}

		if (_.isFunction(shouldNotBeEqual)) {
			return value !== shouldNotBeEqual(allValues);
		} else {
			return value !== shouldNotBeEqual;
		}
	}
}, {
	name: 'minLength',
	message: function message() {
		var _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    ruleValue = _ref5.ruleValue;

		return 'length is less than ' + ruleValue;
	},
	validate: function validate(value) {
		var _ref6 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    minLength = _ref6.minLength;

		if (_.isNumber(minLength) && (value || '').toString().length < minLength) {
			return 'min:length';
		}
	}
}, {
	name: 'maxLength',
	message: function message() {
		var _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    ruleValue = _ref7.ruleValue;

		return 'length is greater than ' + ruleValue;
	},
	validate: function validate(value) {
		var _ref8 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    maxLength = _ref8.maxLength;

		if (_.isNumber(maxLength) && (value || '').toString().length > maxLength) {
			return 'max:length';
		}
	}
}, {
	name: 'minValue',
	message: function message() {
		var _ref9 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    ruleValue = _ref9.ruleValue;

		return 'value is less than ' + ruleValue;
	},
	validate: function validate(value) {
		var _ref10 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    minValue = _ref10.minValue;

		if (_.isNumber(minValue)) {
			var numValue = parseFloat(value, 10);
			if (bbmnUtils.isEmptyValue(numValue) || numValue < minValue) {
				return 'min:value';
			}
		}
	}
}, {
	name: 'maxValue',
	message: function message() {
		var _ref11 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    ruleValue = _ref11.ruleValue;

		return 'value is greater than ' + ruleValue;
	},
	validate: function validate(value) {
		var _ref12 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    maxValue = _ref12.maxValue;

		if (_.isNumber(maxValue)) {
			var numValue = parseFloat(value, 10);
			if (bbmnUtils.isEmptyValue(numValue) || numValue > maxValue) {
				return 'max:value';
			}
		}
	}
}, {
	name: 'pattern',
	message: 'value is not in pattern',
	validate: function validate(value) {
		var _ref13 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    pattern = _ref13.pattern;

		value = (value || '').toString();

		if (_.isString(pattern) && !bbmnUtils.isEmptyValue(pattern)) {
			pattern = new RegExp(pattern);
		}
		if (!_.isRegExp(pattern)) {
			return;
		}

		if (!pattern.test(value)) {
			return 'pattern';
		}
	}
}, {
	name: 'validate',
	validate: function validate(value) {
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var ruleValue = options.ruleValue;

		if (!_.isFunction(ruleValue)) return;
		return ruleValue(value, options);
	}
}];

reIndex(false);

function reIndex() {
	var sortBefore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

	if (sortBefore) {
		rules.sort(function (a, b) {
			return a.index - b.index;
		});
	}
	_.each(rules, function (rule, index) {
		rule.index = index;
	});
}

function normalizeValidationContext(context) {
	if (context === 'required') {
		return { required: true };
	} else if (_.isFunction(context)) {
		return { validate: context };
	} else if (_.isObject(context)) {
		return context;
	}
}

function getRuleContexts() {
	var rule = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	var founded = _.reduce(rule, function (taken, ruleValue, name) {
		var found = _.findWhere(rules, { name: name });
		if (!found) return taken;

		var message = rule[name + 'Message'];
		taken.push({
			rule: found,
			ruleValue: ruleValue,
			message: message,
			index: found.index
		});

		return taken;
	}, []);
	founded.sort(function (a, b) {
		return a.index - b.index;
	});
	return founded;
}

function check(value) {
	var _validateOptions;

	var ruleContext = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	var _ruleContext$rule = ruleContext.rule,
	    rule = _ruleContext$rule === undefined ? {} : _ruleContext$rule,
	    ruleValue = ruleContext.ruleValue,
	    allValues = ruleContext.allValues,
	    _ruleContext$errors = ruleContext.errors,
	    errors = _ruleContext$errors === undefined ? [] : _ruleContext$errors;

	if (rule.skipIfInvalid && errors.length) {
		return Promise.reject();
	}
	var message = ruleContext.message || rule.message;
	var buildMessage = _.isFunction(message) ? message : function () {
		var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    error = _ref.error;

		return bbmnUtils.isEmptyValue(message) ? error : message;
	};

	var validate = rule.validate;
	var validateOptions = (_validateOptions = {
		ruleName: rule.name,
		ruleValue: ruleValue
	}, defineProperty(_validateOptions, rule.name, ruleValue), defineProperty(_validateOptions, 'allValues', allValues), defineProperty(_validateOptions, 'message', buildMessage({ value: value, allValues: allValues, ruleValue: ruleValue })), defineProperty(_validateOptions, 'errors', errors), _validateOptions);
	if (!_.isFunction(validate)) return Promise.resolve(value);

	var result = validate(value, validateOptions);

	if (!result) {
		return Promise.resolve(value);
	} else if (result && _.isFunction(result.then)) {
		return result.then(function () {
			return Promise.resolve(value);
		}, function (error) {
			return Promise.reject(buildMessage({ error: error, value: value, allValues: allValues, ruleValue: ruleValue }));
		});
	} else {
		return Promise.reject(buildMessage({ error: result, value: value, allValues: allValues, ruleValue: ruleValue }));
	}
}

function validate(value, rule) {
	var _ref2 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
	    _ref2$allValues = _ref2.allValues,
	    allValues = _ref2$allValues === undefined ? {} : _ref2$allValues;

	rule = normalizeValidationContext(rule);
	var contexts = getRuleContexts(rule);

	return new Promise(function (resolve, reject) {
		var errors = [];

		var rulesPromise = _.reduce(contexts, function (promise, ruleContext) {

			promise = promise.then(function () {
				return check(value, _.extend({}, ruleContext, { allValues: allValues, errors: errors }));
			}).catch(function (error) {
				if (error != null) errors.push(error);
			});

			return promise;
		}, Promise.resolve(value));

		rulesPromise.then(function () {
			if (errors.length) {
				reject(errors);
			} else {
				resolve(value);
			}
		});
	});
}

function _removeRule(name) {
	var found = _.findIndex(rules, { name: name });
	if (found === -1) return;
	var removed = rules.splice(found, 1);
	reIndex();
	return removed;
}

function _setRule(rule) {
	if (rule.index == null) {
		rule.index = rules.length;
	}
	rules.push(rule);
	reIndex();
	return rule;
}

var validator = {
	setRule: function setRule(name) {
		var rule = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		if (_.isObject(name)) {
			rule = name;
			name = rule.name;
		}

		if (bbmnUtils.isEmptyValue(name)) {
			throw new Error('rule name not specified');
		}

		if (rule == null) {
			return _removeRule(name);
		} else if (!_.isObject(rule)) {
			throw new Error('validation rule must be an object');
		} else {
			if (rule.name != name) {
				rule.name = name;
			}
			return _setRule(rule);
		}
	},
	removeRule: function removeRule(name) {
		return _removeRule(name);
	},
	getRule: function getRule(name) {
		return _.findWhere(rules, { name: name });
	},
	setMessage: function setMessage(name, message) {
		if (!_.isString(name) || bbmnUtils.isEmptyValue(name)) {
			throw new Error('name must be not empty string');
		}
		if (!(_.isString(message) || _.isFunction(message))) {
			throw new Error('message must be not empty string or a function returning a string');
		}
		var rule = _.findWhere(rules, { name: name });
		if (!rule) {
			return;
		}
		rule.message = message;
	},
	setMessages: function setMessages() {
		var _this = this;

		var hash = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_.each(hash, function (message, name) {
			return _this.setMessage(name, message);
		});
	},

	validate: validate,
	_rules: rules
};

var index = {
	Process: Process, startableMixin: startableMixin,
	App: App,
	ModelSchemas: store, ModelSchema: ModelSchema, PropertySchema: PropertySchema,
	validator: validator,
	View: ExtView, CollectionView: ExtCollectionVIew
};

exports.Process = Process;
exports.startableMixin = startableMixin;
exports.App = App;
exports.ModelSchemas = store;
exports.ModelSchema = ModelSchema;
exports.PropertySchema = PropertySchema;
exports.validator = validator;
exports.View = ExtView;
exports.CollectionView = ExtCollectionVIew;
exports['default'] = index;

return exports;

}({},_,bbmn.utils,bbmn,Mn,bbmn.mixins));

//# sourceMappingURL=index.js.map
