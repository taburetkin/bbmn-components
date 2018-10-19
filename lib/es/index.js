import _ from 'underscore';
import { betterResult, buildViewByKey, camelCase, flat, getOption, isEmptyValue, mergeOptions, mix, triggerMethod, triggerMethodOn, unflat } from 'bbmn-utils';
import { BaseClass, Collection, Events, Model, Region, ajax, isClass } from 'bbmn-core';
import { CollectionView, View } from 'backbone.marionette';
import { cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin, nextCollectionViewMixin } from 'bbmn-mixins';
import Backbone from 'backbone';
import $ from 'jquery';

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

var Process = BaseClass.extend({
	constructor: function constructor(context, name, opts) {

		BaseClass.apply(this, arguments);

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

		var procMethod = camelCase('on:' + hookName);
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
		return camelCase('_process:' + this.name + ':executing');
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

		return triggerMethodOn.apply(undefined, [context, event, this].concat(toConsumableArray(this.args)));
	},
	invokeOnContext: function invokeOnContext(methodName) {
		var method = camelCase(methodName);
		var context = this.context;
		var args = this.args;
		return betterResult(context, method, { args: args });
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

			var startable = _.extend({}, defaultStartableOptions, getOption(this, 'startableOptions', { args: [this] }));

			var start = _.extend({}, startable, defaultStartOptions, getOption(this, 'startOptions', { args: [this] }));
			var stop = _.extend({}, startable, defaultStopOptions, getOption(this, 'stopOptions', { args: [this] }));

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

var BaseApp = mix(BaseClass).with(Events, startableMixin);

var App = BaseApp.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		this.options = _.clone(options);
		this._startPromises = [];
		BaseApp.apply(this, arguments);
		this.initialize(options);
		this.triggerMethod('initialize', options);
	},

	triggerMethod: triggerMethod,
	getOption: function getOption$$1() {
		return getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
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
		return buildViewByKey(this, 'layout', { options: options });
	},
	getRegion: function getRegion() {
		if (this._region) return this._region;
		this._region = this.buildRegion();
		return this._region;
	},
	_buildRegion: function _buildRegion(region, options) {
		if (region == null) {
			return new Region(options);
		} else if (isClass(region, Region)) {
			return new region(options);
		} else if (_.isFunction(region)) {
			return this._buildRegion(region.call(this, this), options);
		} else if (_.isObject(region)) {
			var RegionClass = region.regionClass || Region;
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

var Schema = BaseClass.extend({
	getOption: function getOption$$1() {
		return getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
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

		var hash = betterResult(this.schema, key, { args: [options], default: {} });
		return unflat(flat(hash));
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
		return betterResult({ label: label }, 'label', { args: [value, allValues] });
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
			if (isEmptyValue(propertyName)) {
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
		if (isEmptyValue(name)) {
			throw new Error('property has no name', property);
		}

		if (isEmptyValue(property.name)) {
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

var ExtView = mix(View).with(cssClassModifiersMixin);
var ExtCollectionVIew = mix(CollectionView).with(cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin);

var templates = {
	default: _.template('<span><%= _v.getText() %></span>'),
	small: _.template('<small><%= _v.getText() %></small>'),
	labeledText: _.template('<label><%= _v.getHeader() %></label><span><%= _v.getText() %></span><% if(_v.hasSmallText()){ %><small>_v.getSmallText()</small><% } %>'),
	full: _.template('<% if(_v.hasTopText()){ %><i>_v.getTopText()</i><% } %><span></span><% if(_v.hasSmallText()){ %><small>_v.getSmallText()</small><% } %><% if(_v.hasBottomText()){ %><b>_v.getBottomText()</b><% } %>')
};
var AtomText = ExtView.extend({
	autodetectTemplate: true,
	constructor: function constructor() {
		ExtView.apply(this, arguments);
		this.addCssClassModifier('atom-text', function (m, v) {
			return 'atom-' + v.getType();
		});
	},
	_hasAnyProperty: function _hasAnyProperty() {
		var _this = this;

		for (var _len = arguments.length, properties = Array(_len), _key = 0; _key < _len; _key++) {
			properties[_key] = arguments[_key];
		}

		return _.some(properties, function (prop) {
			return !!_this[prop] || _this.options[prop];
		});
	},
	isFull: function isFull() {
		return this.getOption('type') == 'full' || this._hasAnyProperty('topText', 'bottomText');
	},
	isSmall: function isSmall() {
		return this.getOption('type') == 'small';
	},
	isLabeledText: function isLabeledText() {
		return this.getOption('type') == 'labeledText' || this._hasAnyProperty('header');
	},
	getType: function getType() {
		var type = this.getOption('type') || 'default';
		if (type != 'default') {
			return type;
		}
		if (this.getOption('autodetectTemplate')) {
			if (this.isFull()) {
				return 'full';
			} else if (this.isLabeledText()) {
				return 'labeledText';
			}
		}
		return type;
	},
	getTemplate: function getTemplate() {
		var type = this.getType();
		return templates[type];
	},
	_getText: function _getText(key) {
		return this.getOption(key, { args: [this.model, this] });
	},
	hasHeader: function hasHeader() {
		return !isEmptyValue(this.getHeader());
	},
	getHeader: function getHeader() {
		return this._getText('header');
	},
	hasTopText: function hasTopText() {
		return !isEmptyValue(this.getTopText());
	},
	getTopText: function getTopText() {
		return this._getText('topText');
	},
	getText: function getText() {
		return this._getText('text');
	},
	hasSmallText: function hasSmallText() {
		return !isEmptyValue(this.getSmallText());
	},
	getSmallText: function getSmallText() {
		return this._getText('smallText');
	},
	hasBottomText: function hasBottomText() {
		return !isEmptyValue(this.getBottomText());
	},
	getBottomText: function getBottomText() {
		return this._getText('bottomText');
	},
	templateContext: function templateContext() {
		return {
			_v: this
		};
	}
}, {
	small: function small(arg1, arg2) {
		var defs = { type: 'small' };
		var uopts = {};
		if (_.isString(arg1) || !arg1) {
			defs.text = arg1;
			uopts = arg2;
		} else {
			uopts = arg1;
		}
		return new AtomText(_.extend({}, uopts, defs));
	},
	byModel: function byModel(model, options) {
		var keys = ['header', 'topText', 'text', 'smallText', 'bottomText'];
		var values = _.reduce(keys, function (memo, key) {
			if (model.has(key) && !isEmptyValue(model.get(key))) {
				memo[key] = model.get(key);
			}
			return memo;
		}, {});
		return new AtomText(_.extend({}, values, options));
	}
});

var rules = [{
	name: 'required',
	message: 'required',
	validate: function validate(value) {
		if (isEmptyValue(value)) {
			return 'required';
		}
	}
}, {
	name: 'email',
	message: 'not a email',
	validate: function validate(value) {

		if (isEmptyValue(value)) {
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
			if (isEmptyValue(numValue) || numValue < minValue) {
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
			if (isEmptyValue(numValue) || numValue > maxValue) {
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

		if (_.isString(pattern) && !isEmptyValue(pattern)) {
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

		return isEmptyValue(message) ? error : message;
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

		if (isEmptyValue(name)) {
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
		if (!_.isString(name) || isEmptyValue(name)) {
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

/*
By default expects token on initialize
new User({...}, { token });
you can use bbmn-components bearer-token for that
or something else
but token should have this defined properties:
	token.ready - promise
	token.hasToken() - should return true or flase
	token.update() - invokes on user change event, should receive refreshed token

*/
var User = Model.extend({

	shouldRequestOnInitialize: true,

	constructor: function constructor(hash, opts) {
		this._waitFor = [];
		this.initializeToken(opts);
		Model.apply(this, arguments);

		if (this.shouldRequestOnInitialize) {
			this.getReady();
		}
	},
	initializeToken: function initializeToken() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var token = opts.token;

		if (!token) return;
		this.listenTo(token, 'changed', this.refresh);
		this.token = token;
		token.ready && this._waitFor.push(token.ready);
	},
	getReady: function getReady() {
		var _this = this;

		if (this.ready) return this.ready;

		this.ready = new Promise(function (resolve) {
			_this.once('changed', function () {
				return resolve();
			});
			Promise.all(_this._waitFor).then(function () {
				return _this.refresh();
			}, function () {
				return _this.reflectChanges({ clear: true });
			});
		});

		return this.ready;
	},
	logoff: function logoff() {
		var _this2 = this;

		return new Promise(function (resolve) {
			_this2.once('changed', function () {
				return resolve();
			});
			if (_this2.token) {
				_this2.token.update();
			} else {
				_this2.reflectChanges({ clear: true });
			}
		});
	},

	//override this for getting auth status
	isLogged: function isLogged() {
		return this.get('authenticated') === true;
	},
	refresh: function refresh() {
		var _this3 = this;

		if (!this.token.hasToken()) {
			this.reflectChanges({ clear: true });
			return Promise.resolve();
		} else {
			return this.fetch().then(function () {
				_this3.reflectChanges();
			}, function () {
				_this3.reflectChanges({ store: false });
			});
		}
	},
	reflectChanges: function reflectChanges() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var silent = opts.silent,
		    clear = opts.clear,
		    _opts$store = opts.store,
		    store = _opts$store === undefined ? true : _opts$store;

		clear && this.clear();
		store && this.store(clear);
		!silent && this.trigger('changed', this);
	},
	isMe: function isMe(arg) {
		var me = this.get(this.idAttribute);
		return _.isEqual(me, arg);
	},

	// implement by your own
	store: function store() {}
});

var nativeAjax = ajax;

var tokenizedAjax = function tokenizedAjax() {
	var options = void 0;

	for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
		args[_key] = arguments[_key];
	}

	if (args && args.length == 1 && _.isObject(args[0])) {
		options = args[0];
	}
	if (args && args.length == 2 && !_.isObject(args[0]) && _.isObject(args[1])) {
		options = args[1];
	}

	options && (options.headers = _.extend({}, options.headers, this.getAjaxHeaders()));

	return nativeAjax.apply(null, args);
};

var Token = Model.extend({

	tokenAttribute: 'access_token',
	refreshTokenAttribute: 'refresh_token',
	endPoint: 'auth/token',
	secondsOffset: 0,

	shouldRequestOnInitialize: true,

	constructor: function constructor() {
		this.ajaxHeaders = {};
		this.flows = {};
		this.initializeFlows();
		this.setExpiration(null);

		Model.apply(this, arguments);

		if (this.shouldRequestOnInitialize) {
			this.getReady();
		}
	},
	getReady: function getReady() {
		var _this = this;

		if (this.ready) return this.ready;

		if (!this.hasToken()) {
			this.ready = Promise.resolve();
		} else {
			this.ready = this.refresh({ force: true }).catch(function () {
				_this.update(null);
			});
		}

		return this.ready;
	},
	initializeFlows: function initializeFlows() {

		this.setFlow('password', {
			url: this.endPoint,
			method: 'POST'
		});
		this.setFlow('refresh', {
			url: this.endPoint,
			method: 'POST'
		});
	},
	getFlow: function getFlow(key) {
		return _.clone(this.flows[key] || {});
	},
	setFlow: function setFlow(key, value) {
		this.flows[key] = value;
	},
	hasToken: function hasToken() {
		return this.getToken() != null;
	},
	getToken: function getToken() {
		return this.get(this.tokenAttribute);
	},
	getRefreshToken: function getRefreshToken() {
		return this.get(this.refreshTokenAttribute);
	},
	getAjaxHeaders: function getAjaxHeaders() {
		return this.ajaxHeaders;
	},
	parse: function parse(data) {
		return data;
	},
	fetch: function fetch() {
		var _this2 = this;

		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		if (this._fetching) return this._fetching;
		this._fetching = nativeAjax(options).then(function (json) {

			var parsed = _this2.parse(_.clone(json));
			_this2.update(parsed);
			delete _this2._fetching;
			return Promise.resolve(json);
		}, function (xhr) {

			delete _this2._fetching;

			options.clearOnFail !== false && _this2.update(null);

			var error = _this2.handleError(xhr);
			if (error) {

				return Promise.reject(error);
			} else {
				return Promise.reject(xhr);
			}
		});
		return this._fetching;
	},
	handleError: function handleError() {},
	update: function update(hash) {
		var _this3 = this;

		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var silent = opts.silent;

		if (hash == null) {

			this.clear(opts);
		} else {
			var fullhash = _.extend({}, this.attributes, hash);
			var unset = [];
			var shouldUnset = !!opts.unset;
			var setHash = _(fullhash).reduce(function (memo, value, key) {
				if (key in hash) {
					memo[key] = value;
				} else if (shouldUnset) {
					unset.push(key);
				} else {
					memo[key] = undefined;
				}
				return memo;
			}, {});

			setHash = this.parse(setHash);
			this.set(setHash, { silent: silent });
			_(unset).each(function (key) {
				return _this3.unset(key, { silent: silent });
			});
		}

		this.reflectTokenChanges();
	},
	replaceBackboneAjax: function replaceBackboneAjax() {
		var _this4 = this;

		if (!this.hasToken()) Backbone.ajax = nativeAjax;else Backbone.ajax = function () {
			return _this4.ajax.apply(_this4, arguments);
		};
	},
	updateAjaxHeaders: function updateAjaxHeaders(token) {
		token || (token = this.getToken());
		var headers = this.getAjaxHeaders();
		if (token) {
			headers.Authorization = 'Bearer ' + token;
			headers.Accept = 'application/json';
		} else {
			delete headers.Authorization;
		}
	},


	//implement by your own
	storeToken: function storeToken() {},
	reflectTokenChanges: function reflectTokenChanges() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var silent = opts.silent,
		    _opts$store = opts.store,
		    store = _opts$store === undefined ? true : _opts$store;

		this.updateAjaxHeaders();
		this.replaceBackboneAjax();
		if (store) this.storeToken();
		if (!silent) this.trigger('changed');
	},
	ajax: function ajax$$1() {
		var _this5 = this;

		for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
			args[_key2] = arguments[_key2];
		}

		return this.refresh().then(function () {
			return tokenizedAjax.apply(_this5, args);
		}, function (error) {
			return Promise.reject(error);
		});
	},
	refresh: function refresh() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};


		// if token is fresh enough and there is no force refresh
		// pass
		if (!this.isExpired() && !opts.force) {
			return Promise.resolve();
		}
		var options = this.getFlow('refresh');
		options.data = this.getRefreshTokenData();
		return this.fetch(options);
	},
	getRefreshTokenData: function getRefreshTokenData() {
		return {
			'grant_type': 'refresh_token',
			'refresh_token': this.getRefreshToken()
		};
	},
	setExpiration: function setExpiration(arg) {

		if (arg === null) {
			this.expiresAt = null;
		}

		var date = void 0;
		var now = new Date();

		if (_.isDate(arg)) {
			date = arg;
		} else if (_.isObject(arg)) {
			date = new Date();

			var seconds = arg.seconds,
			    minutes = arg.minutes,
			    hours = arg.hours,
			    days = arg.days;

			date.setDate(date.getDate() + (days || 0));
			date.setHours(date.getHours() + (hours || 0));
			date.setMinutes(date.getMinutes() + (minutes || 0));
			date.setSeconds(date.getSeconds() + (seconds || 0));
		}

		if (!_.isDate(date) || isNaN(date.valueOf()) || date < now) {
			date = new Date();
			date.setSeconds(now.getSeconds() + 90);
		}

		this.expiresAt = date;
	},
	getExpiration: function getExpiration() {
		return this.expiresAt;
	},
	isExpired: function isExpired() {
		var date = this.getExpiration();
		if (!_.isDate(date) || isNaN(date.valueOf())) return true;
		return date.valueOf() < Date.now() + this.secondsOffset * 1000;
	},
	login: function login(username, password) {

		var options = this.getFlow('password');
		options.data = { grant_type: 'password', username: username, password: password };
		options.clearOnFail = false;
		return this.fetch(options);
	}
});

Token.setNativeAjax = function (arg) {
	var old = nativeAjax;
	nativeAjax = arg;
	return old;
};

var Stack = mix(BaseClass).with(Events).extend({

	destroyOnRemove: true,
	removeOnOutsideClick: true,
	removeOnEsc: true,
	clearBeforeAdd: false,

	constructor: function constructor(options) {
		this.cid = _.uniqueId('stack');
		this.unremovableKey = '_' + this.cid + '_preventRemove';
		this.options = options;
		this.stack = [];
		BaseClass.apply(this, arguments);
	},
	add: function add(view, options) {
		if (!_.isObject(view)) {
			return;
		}
		if (this.getOption('clearBeforeAdd')) {
			this.removeAll();
		}
		this.triggerMethod('before:add');

		this.stack.push(view);
		this._setupView(view, options);

		this._stackChanged(1, view);
	},
	_setupView: function _setupView(view) {
		var _this = this;

		var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    preventRemove = _ref.preventRemove;

		if (preventRemove) {
			var key = this.getUnremovableKey();
			view[key] = true;
		}
		this.listenToOnce(view, 'destroy', function () {
			return _this._removeView(view, { selfDestroy: true });
		});
	},
	getLast: function getLast() {
		return _.last(this.stack);
	},
	removeLast: function removeLast() {
		var view = this.getLast();
		this.remove(view);
	},
	destroyLast: function destroyLast() {
		var view = this.getLast();
		this.remove(view, { destroy: true });
	},
	remove: function remove(view) {
		var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    destroy = _ref2.destroy;

		var destroyOnRemove = this.getOption('destroyOnRemove');
		var removed = this._removeView(view);
		if (removed && (destroy || destroyOnRemove)) {
			this._destroyView(view);
		}
	},
	_removeView: function _removeView(view) {
		var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    selfDestroy = _ref3.selfDestroy;

		if (!_.isObject(view)) {
			return;
		}

		if (this.isViewUnremovable(view, selfDestroy)) {
			return;
		}

		this._cleanUpView(view);

		var index = this.stack.indexOf(view);
		if (index === -1) return;

		if (index == this.stack.length - 1) this.stack.pop();else this.stack.splice(index, 1);

		this._stackChanged(-1);

		return view;
	},
	_cleanUpView: function _cleanUpView(view) {
		this.stopListening(view);
		delete view[this.getUnremovableKey()];
	},
	_destroyView: function _destroyView(view) {
		if (_.isObject(view) && _.isFunction(view.destroy)) {
			view.destroy();
		}
	},
	_stackChanged: function _stackChanged(change, view) {
		if (change > 0) {
			this._setDocumentListeners();
			this.triggerMethod('add', view);
		} else {
			this._unsetDocumentListeners();
			this.triggerMethod('remove', view);
		}
	},


	/*
 	Unremovable view methods
 	sometimes you want to prevent view to be removed from the stack		
 */
	getUnremovableKey: function getUnremovableKey() {
		return this.getOption('unremovableKey');
	},

	// options is for internal use only.
	// self destroy flag filled when a view destroyed outside the stack
	isViewUnremovable: function isViewUnremovable(view) {
		var _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
		    selfDestroy = _ref4.selfDestroy;

		if (selfDestroy) return false;
		var key = this.getUnremovableKey();
		return view[key];
	},


	/*
 	DOM listeners logic
 	- esc handler
 	- outside click handler
 */
	getViewDomElement: function getViewDomElement(view) {
		return view && view.el;
	},
	isElementOutsideOfView: function isElementOutsideOfView(eventElement, view) {
		var viewElement = this.getViewDomElement(view);
		if (!viewElement) return;
		return !$.contains(viewElement, eventElement);
	},
	getViewIfElementOutside: function getViewIfElementOutside(eventElement) {
		var view = this.getLast();
		if (!view) return;
		if (this.isElementOutsideOfView(eventElement, view)) {
			return view;
		}
	},
	outsideClickHandler: function outsideClickHandler(event) {
		if (!this.stack.length) {
			return;
		}

		var view = this.getViewIfElementOutside(event.target);
		if (!view) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		this.remove(view);
	},
	escapePressHandler: function escapePressHandler(event) {
		if (!this.stack.length || event.keyCode !== 27) return;

		event.preventDefault();
		event.stopPropagation();
		this.removeLast();
	},
	_setDocumentListeners: function _setDocumentListeners() {
		if (this._documentListeners || !this.stack.length) return;
		var $doc = this.getDocument();
		if (this._shouldRemoveOnEsc()) {
			this._escapePressHandler = _.bind(this.escapePressHandler, this);
			$doc.on('keyup', this._escapePressHandler);
			this.triggerMethod('dom:listeners:escape:on');
		}
		if (this._shouldRemoveOnOutsideClick()) {
			this._outsideClickHandler = _.bind(this.outsideClickHandler, this);
			$doc.on('click', this._outsideClickHandler);
			this.triggerMethod('dom:listeners:click:on');
		}
		this.triggerMethod('dom:listeners:on');
		this._documentListeners = true;
	},
	_unsetDocumentListeners: function _unsetDocumentListeners() {
		if (!(this._documentListeners && !this.stack.length)) return;
		var $doc = this.getDocument();
		if (this._escapePressHandler) {
			$doc.off('keyup', this._escapePressHandler);
			delete this._escapePressHandler;
			this.triggerMethod('dom:listeners:escape:off');
		}
		if (this._outsideClickHandler) {
			$doc.off('click', this._outsideClickHandler);
			delete this._outsideClickHandler;
			this.triggerMethod('dom:listeners:click:off');
		}
		this.triggerMethod('dom:listeners:off');
		this._documentListeners = false;
	},
	_shouldRemoveOnEsc: function _shouldRemoveOnEsc() {
		return this.getOption('removeOnEsc') === true;
	},
	_shouldRemoveOnOutsideClick: function _shouldRemoveOnOutsideClick() {
		return this.getOption('removeOnOutsideClick') === true;
	},


	/* helpers */

	mergeOptions: mergeOptions,
	triggerMethod: triggerMethod,
	getOption: function getOption$$1() {
		return getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	},
	getDocument: function getDocument() {
		return this.$doc || $(document);
	},
	isDestroyed: function isDestroyed() {
		return this._isDestroyed || this._isDestroying;
	},
	removeAll: function removeAll() {
		while (this.stack.length) {
			this.destroyLast();
		}
	},
	destroy: function destroy() {
		if (this._isDestroyed || this._isDestroying) {
			return;
		}
		this._isDestroying = true;

		this.triggerMethod('before:destroy');

		this.removeAll();

		var $doc = this.getDocument();
		$doc.off('keyup', this._onKeyUp);
		$doc.off('click', this._outsideClick);

		this._isDestroyed = true;
		this.triggerMethod('destroy');
	}
});

var _disallowedKeys = ['setItem', 'key', 'getItem', 'removeItem', 'clear'];
var allowedKey = function allowedKey(key) {
	return _disallowedKeys.indexOf(key) < 0;
};

var FakeStore = BaseClass.extend({
	constructor: function constructor() {
		BaseClass.apply(this, arguments);
		this.store = {};
	},
	setItem: function setItem(id, val) {
		if (!allowedKey(id)) return;
		return this.store[id] = String(val);
	},
	getItem: function getItem(id) {
		if (!allowedKey(id)) return;
		return this.store[id];
	},
	removeItem: function removeItem(id) {
		if (!allowedKey(id)) return;
		delete this.store[id];
	},
	clear: function clear() {
		var _this = this;

		var keys = _(this).keys();
		_(keys).each(function (key) {
			return _this.removeItem(key);
		});
	}
});

var session = typeof sessionStorage === 'undefined' ? new FakeStore() : sessionStorage;

var local = typeof localStorage === 'undefined' ? new FakeStore() : localStorage;

var getStore = function getStore() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	return opts.local === true ? local : session;
};

var SECONDS = 1000;
var MINUTES = SECONDS * 60;
var HOURS = MINUTES * 60;
var DAYS = HOURS * 24;

var store$1 = {
	_normalizeValue: function _normalizeValue(value) {
		var normValue = value;
		if (_.isObject(value) && _.isFunction(value.toJSON)) normValue = value.toJSON();
		if (_.isDate(value) && !_.isNaN(value.valueOf())) normValue = 'date(' + normValue + ')';
		return normValue;
	},
	_createItem: function _createItem(value, expireAt) {
		return { expireAt: expireAt, value: value };
	},
	jsonParse: function jsonParse(key, value) {
		var datePattern = /^date\((\d{4,4}-\d{2,2}-\d{2,2}([T\s]\d{2,2}:\d{2,2}:\d{2,2}(\.\d*)?Z?)?)\)$/;
		if (_.isString(value) && datePattern.test(value)) {
			var textDate = value.replace(datePattern, '$1');
			return new Date(textDate);
		}
		return value;
	},
	_jsonParse: function _jsonParse(key, value, context) {
		if (!key) return value;
		return this.jsonParse(key, value, context);
	},
	_parse: function _parse(raw) {
		var _this = this;
		var item = JSON.parse(raw, function (key, value) {
			return _this._jsonParse(key, value, this);
		});
		if ('expireAt' in item && 'value' in item) return item;else return this._createItem(item, 0);
	},
	_get: function _get(key, opts) {
		var raw = getStore(opts).getItem(key);
		if (raw == null) return;
		return this._parse(raw);
	},
	get: function get(key) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var _opts$checkExpire = opts.checkExpire,
		    checkExpire = _opts$checkExpire === undefined ? true : _opts$checkExpire;


		var item = this._get(key, opts);
		if (item == null) return;

		var expired = this._isExpired(item);
		if (!expired || !checkExpire) {

			return item.value;
		} else if (expired) {
			this.remove(key, opts);
		}
	},
	set: function set(key, value) {
		var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};


		var expireAt = Date.now() + this.getExpireAt(opts);
		var normValue = this._normalizeValue(value);
		var item = this._createItem(normValue, expireAt);
		this._set(key, item, opts);
	},
	remove: function remove(key, opts) {
		getStore(opts).removeItem(key);
	},
	expire: function expire(key, opts) {
		var item = this._get(key, opts);
		if (!item) return;
		item.expireAt = 0;
		this._set(key, item, opts);
	},
	getExpireAt: function getExpireAt(_ref) {
		var expireAt = _ref.expireAt,
		    seconds = _ref.seconds,
		    minutes = _ref.minutes,
		    hours = _ref.hours,
		    days = _ref.days;

		if (expireAt != null) return expireAt;

		var offset = 0;

		_.isNumber(seconds) && (offset += seconds * SECONDS);
		_.isNumber(minutes) && (offset += minutes * MINUTES);
		_.isNumber(hours) && (offset += hours * HOURS);
		_.isNumber(days) && (offset += days * DAYS);

		offset === 0 && (offset += 10 * MINUTES);

		return offset;
	},
	_set: function _set(key, item, opts) {
		var text = JSON.stringify(item);
		getStore(opts).setItem(key, text);
	},
	isExpired: function isExpired(key, opts) {
		var item = this._get(key, opts);
		if (item == null) return true;
		return this._isExpired(item);
	},
	_isExpired: function _isExpired(item) {
		return item.expireAt < Date.now();
	}
};

var NotifyModel = Model.extend({
	constructor: function constructor() {
		Model.apply(this, arguments);
		if (!_.isDate(this.get('date'))) this.set('date', new Date(), { silent: true });

		this._setupDelays();
	},
	_setupDelays: function _setupDelays() {
		var _this = this;

		this.on('change:viewedDelay', function () {
			return _this._setDelay('viewed');
		});
		this.on('change:removedDelay', function () {
			return _this._setDelay('removed');
		});
		this._setDelay('viewed');
		this._setDelay('removed');
		this.on('destroy', function () {
			_this._clearTimeout('viewed');
			_this._clearTimeout('removed');
		});
	},
	_clearTimeout: function _clearTimeout(name) {
		var timeoutKey = name + 'Timeout';
		clearTimeout(this[timeoutKey]);
	},
	_setTimeout: function _setTimeout(name) {
		var _this2 = this;

		var delay = this.get(name + 'Delay');
		if (!_.isNumber(delay)) {
			return;
		}
		var timeoutKey = name + 'Timeout';
		this[timeoutKey] = setTimeout(function () {
			_this2[name]();
		}, delay * 1000);
	},
	_setDelay: function _setDelay(name) {
		this._clearTimeout(name);
		this._setTimeout(name);
	},


	//we need to use id but there is no any endpoint behind
	isNew: function isNew() {
		return true;
	},
	isViewed: function isViewed() {
		return this.get('viewed') === true;
	},
	setViewed: function setViewed() {
		this.set({
			viewed: true,
			viewedDelay: undefined
		});
	},
	getDate: function getDate() {
		return this.get('date');
	},
	removed: function removed() {
		this.trigger('removed');
	},
	viewed: function viewed() {
		this.trigger('viewed');
	},
	getType: function getType() {
		return this.get('type');
	},
	getName: function getName() {
		return this.get('name');
	}
});

var Notifies = Collection.extend({
	model: NotifyModel,
	hasNotViewed: function hasNotViewed() {
		var counts = this.getCount();
		return !!counts.notViewed;
	},
	getCount: function getCount() {
		return this.reduce(function (memo, model) {
			memo.total++;
			if (model.isViewed()) memo.viewed++;else memo.notViewed++;

			return memo;
		}, { total: 0, viewed: 0, notViewed: 0 });
	},
	getCountAsText: function getCountAsText() {
		var counts = this.getCount();
		if (!counts.total) {
			return '';
		}
		return counts.notViewed + '/' + counts.total;
	},
	toggle: function toggle() {
		this.mode = this.mode != 'all' ? 'all' : 'notViewed';
		this.trigger('toggle', this.mode);
	}
});

var notifies = new Notifies([]);

function notify(hash) {
	var model = notifies.get(hash);
	if (model) {
		model.wasShown = false;
		hash.viewed = false;
	}
	return notifies.add(hash, { merge: true, update: true });
}

function normalizeOptions(arg1) {
	if (_.isString(arg1)) {
		return { text: arg1 };
	} else if (_.isObject(arg1)) {
		return arg1;
	}
}

notify.wait = function (arg) {
	var options = _.extend({
		type: 'wait', id: _.uniqueId('waitNotify')
	}, normalizeOptions(arg));
	return notify(options);
};

notify.error = function (arg) {
	var options = _.extend({
		type: 'error', id: _.uniqueId('waitNotify')
	}, normalizeOptions(arg));
	return notify(options);
};
notify.message = function (arg) {
	var options = _.extend({
		type: 'message',
		id: _.uniqueId('waitNotify'),
		viewedDelay: 3,
		removedDelay: 600
	}, normalizeOptions(arg));
	return notify(options);
};

var IconView = ExtView.extend({
	constructor: function constructor() {
		ExtView.apply(this, arguments);
		this.addCssClassModifier('icon');
	},

	template: _.template('<i></i>')
});

var IconButtonView = ExtView.extend({
	tagName: 'button',
	constructor: function constructor() {
		ExtView.apply(this, arguments);
		this.addCssClassModifier('icon-btn');
	},

	template: _.template('<i></i>')
});

var NotifyView = ExtCollectionVIew.extend({
	renderAllCustoms: true,
	cssClassModifiers: [function () {
		return 'notify';
	}, function (m) {
		return m.getType();
	}, function (m) {
		return m.getName();
	}, function (m) {
		return m.isViewed() ? 'viewed' : 'not-viewed';
	}, function (m) {
		return m.wasShown ? '' : 'accent';
	}],
	customs: [function (v) {
		return v.getTypeView();
	}, function (v) {
		return v.getMessageView();
	}, function (v) {
		return v.getStateView();
	}],
	events: {
		'click .state': 'changeModelState'
	},
	modelEvents: {
		'viewed': 'markAsViewed',
		'removed': 'destroyModel',
		'change:text': 'render'
	},
	changeModelState: function changeModelState() {
		if (this.model.isViewed()) {
			this.destroyModel();
		} else {
			this.markAsViewed();
		}
	},
	destroyModel: function destroyModel() {
		var _this = this;

		this.disappear().then(function () {
			return _this.model.destroy();
		});
	},
	markAsViewed: function markAsViewed() {
		var _this2 = this;

		if (this.getOption('mode') != 'all') {
			this.disappear().then(function () {
				return _this2.model.setViewed();
			});
		} else {
			this.model.setViewed();
		}
	},
	disappear: function disappear() {
		var _this3 = this;

		var promise = new Promise(function (resolve) {
			if (_this3.isAttached()) {
				_this3.$el.animate({
					height: 'toggle',
					width: 'toggle'
				}, 500, resolve);
			} else {
				resolve();
			}
		});
		return promise;
	},
	onBeforeAttach: function onBeforeAttach() {
		this.$el.attr('style', '');
	},
	onBeforeRender: function onBeforeRender() {
		this.dismissAccent = false;
	},
	onRender: function onRender() {
		var _this4 = this;

		if (!this.model.wasShown) {
			setTimeout(function () {
				_this4.model.wasShown = true;
				_this4.refreshCssClass();
			}, 2000);
		}
	},
	getTypeView: function getTypeView() {
		return new IconView({ className: 'type-icon' });
	},
	getMessageView: function getMessageView() {
		return AtomText.byModel(this.model, { className: 'message' });
	},
	getStateView: function getStateView() {
		return new IconButtonView({ className: 'state' });
	}
});

var Notifier = nextCollectionViewMixin(ExtCollectionVIew).extend({
	initialize: function initialize() {
		this.setFilter(this.unviewedFilter, { preventRender: true });
		this.listenTo(this.collection, 'change:viewed', this.sort);
	},

	childView: NotifyView,
	collection: notifies,
	collectionEvents: {
		toggle: function toggle() {
			var current = this.getFilter();
			if (current == this.allFilter) {
				this.setFilter(this.unviewedFilter, { preventRender: true });
			} else {
				this.setFilter(this.allFilter, { preventRender: true });
			}
			this.render();
		}
	},

	viewComparator: function viewComparator(v1, v2) {
		return v2.model.getDate() - v1.model.getDate();
	},
	allFilter: function allFilter() {
		return true;
	},
	unviewedFilter: function unviewedFilter(v) {
		return !v.model.isViewed();
	},
	childViewOptions: function childViewOptions() {
		return {
			mode: this.collection.mode
		};
	}
});

var index = {
	Process: Process, startableMixin: startableMixin,
	App: App,
	ModelSchemas: store, ModelSchema: ModelSchema, PropertySchema: PropertySchema,
	validator: validator,
	User: User, BearerToken: Token,
	ViewStack: Stack,
	store: store$1,
	View: ExtView, CollectionView: ExtCollectionVIew, AtomText: AtomText,
	notify: notify, notifies: notifies, Notifier: Notifier
};

export { Process, startableMixin, App, store as ModelSchemas, ModelSchema, PropertySchema, validator, User, Token as BearerToken, Stack as ViewStack, store$1 as store, ExtView as View, ExtCollectionVIew as CollectionView, AtomText, notify, notifies, Notifier };
export default index;

//# sourceMappingURL=index.js.map
