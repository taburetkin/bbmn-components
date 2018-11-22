import _ from 'underscore';
import { betterResult, buildViewByKey, camelCase, clone, getByPath, getFlag, getOption, isEmptyValue, isView, isViewClass, mergeOptions, mix, renderInNode, takeFirst, toBool, triggerMethod, triggerMethodOn } from 'bbmn-utils';
import BaseClass, { BackboneView, BaseClass as BaseClass$1, Collection, Events, Model, Region, ajax, isClass, isCollection } from 'bbmn-core';
import { CollectionView, View } from 'backbone.marionette';
import { cssClassModifiersMixin, customsMixin, destroyViewMixin, emptyFetchMixin, improvedIndexesMixin, nextCollectionViewMixin, optionsMixin } from 'bbmn-mixins';
import Backbone, { Collection as Collection$1, Model as Model$1 } from 'backbone';
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

var Process = BaseClass$1.extend({
	constructor: function constructor(context, name, opts) {

		BaseClass$1.apply(this, arguments);

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
		if (this.exposeSelf == null) {
			this.exposeSelf = true;
		}
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
		var triggerArgs = [context, event];
		if (this.exposeSelf) {
			triggerArgs.push(this);
		}
		triggerArgs.push.apply(triggerArgs, toConsumableArray(this.args));
		return triggerMethodOn.apply(undefined, triggerArgs);
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
	exposeSelf: true,
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
			return this['startable.status'] == null || this['startable.status'] === 'stopped' || this['startable.status'] === 'iddle';
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

var BaseApp = mix(BaseClass$1).with(Events, startableMixin);

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
				return item.call(_this, _this);
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

var Schema = mix(BaseClass$1).with(Events).extend({
	getOption: function getOption$$1() {
		return getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	},
	triggerMethod: triggerMethod
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

		var hash = betterResult(this.schema, key, { args: [options, { property: this, model: this.modelSchema }], default: {} });
		return clone(hash, { functions: true });
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
	getLabel: function getLabel(model) {
		var label = this.getDisplay().label;
		return betterResult({ label: label }, 'label', { context: model || this, args: [model] });
	},
	getEdit: function getEdit() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		var editOptions = this._getByKey('edit', options);
		if (editOptions === false) return false;
		var valueOptions = this.getType(options);
		var label = this.getLabel(options.model);
		var compiled = _.extend({ name: this.name, label: label, schema: this }, options, editOptions, { valueOptions: valueOptions });
		return compiled;
	},

	// accepts: value, model, options
	getDisplayValue: function getDisplayValue(val, model) {
		var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

		_.defaults(options, { value: val, allValues: model && model.toJSON && model.toJSON(), model: model });
		var display = this.getDisplay(options);
		var type = this.getType(options);

		options = _.extend(options, { display: display, type: type, property: this });
		if (display) {
			if (_.isFunction(display.transform)) {
				val = display.transform.call(model, val, options);
			} else if (type.type == 'boolean' && type.sourceValues) {
				_.some(type.sourceValues, function (label, key) {
					if (toBool(key) === val) {
						val = label;
						return true;
					}
				});
			} else if (type.type == 'enum' && type.sourceValues) {
				var sourceValues = betterResult({ sourceValues: type.sourceValues }, 'sourceValues', { context: model, args: [model] });
				var result = getFlag(sourceValues, val);
				if (result) val = result;
			}

			if (isEmptyValue(val) && display.ifEmpty) {
				val = display.ifEmpty;
			}
		}
		return val;
	},
	onPropertyChange: function onPropertyChange(property) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		if (this.modelSchema) {
			this.modelSchema.triggerMethod('property:change', property, opts);
		}
	},
	getDependedOn: function getDependedOn(name) {
		var depended = this.schema.dependOn;
		if (!depended) {
			depended = [];
		} else if (_.isString(depended)) {
			depended = depended.split(/\s*,\s*/g).map(function (name) {
				return { name: name };
			});
		} else if (!_.isArray(depended) && _.isObject(depended)) {
			depended = _.map(depended, function (value, name) {
				value.name = name;
				return value;
			});
		} else {
			depended = [];
		}
		if (!name) return depended;else return _.findWhere(depended, { name: name });
	},
	isDependedOn: function isDependedOn(name) {
		var depended = this.getDependedOn(name);
		return !!depended;
	},
	resetValues: function resetValues() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var depended = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var model = opts.model,
		    allValues = opts.allValues,
		    silent = opts.silent;

		var dependedValue = allValues[depended.name];
		var value = betterResult(depended, 'value', { args: [dependedValue, this.modelSchema && this.modelSchema.getProperty(depended.name)] });
		if (model) {
			model.set(this.name, value, { silent: silent });
		} else if (allValues) {
			allValues[this.name] = value;
		}
	}
});

var ModelSchema = Schema.extend({
	constructor: function constructor() {
		var properties = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		this.options = _.clone(options);
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
	},
	onPropertyChange: function onPropertyChange(property) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		var arr = this.getPropertiesArray();
		_.each(arr, function (prop) {
			var depended = prop.getDependedOn(property);
			if (!depended) return;
			prop.resetValues(opts, depended);
		});
	}
});

var ClassStore = BaseClass$1.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_.extend(this, _.omit(options, 'createStore'));
		var key = _.uniqueId('__classstore');
		this._createStore = options.createStore;
		this.instanceNameKey = options.instanceNameKey || key;
		this.ctorNameKey = options.ctorNameKey || key;
		this.items = {};
	},

	onExists: function onExists() {
		return false;
	},
	createStore: function createStore(arg) {
		if (this.isExists(arg)) {
			return this.onExists();
		}
		var context = this.getCreateStoreContext(arg);

		for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
			rest[_key - 1] = arguments[_key];
		}

		var store = this.buildStore.apply(this, [context].concat(toConsumableArray(rest)));
		this.setStore(context, store);
		return store;
	},
	getStoreName: function getStoreName(arg, generate) {
		if (_.isString(arg) && arg !== '') {
			return arg;
		}
		var store = void 0;
		if (_.isFunction(arg)) {
			store = this.getStoreByCtor(arg);
		} else if (_.isObject(arg)) {
			store = this.getStoreByInstance(arg);
		}
		if (store) {
			return store.name;
		}
		if (generate) {
			return _.uniqueId('modelSchema');
		}
	},
	isExists: function isExists(arg) {
		return this.getStore(arg) != null;
	},
	getStoreByName: function getStoreByName(name) {
		return this.items[name];
	},
	getStoreByInstance: function getStoreByInstance(instance) {
		var item = void 0;
		var name = instance[this.instanceNameKey];
		if (name) {
			item = this.getStoreByName(name);
			if (item) {
				return item;
			}
		}
		return this.getStoreByCtor(instance.constructor);
	},
	getStoreByCtor: function getStoreByCtor(ctor) {
		var item = void 0;
		var name = ctor[this.ctorNameKey];
		if (name) {
			item = this.getStoreByName(name);
			if (item) {
				return item;
			}
		}
		return _.find(this.items, function (f) {
			return f.ctor === ctor;
		});
	},
	getStore: function getStore(arg) {
		if (_.isString(arg)) {
			return this.getStoreByName(arg);
		} else if (_.isFunction(arg)) {
			return this.getStoreByCtor(arg);
		} else if (_.isObject(arg)) {
			return this.getStoreByInstance(arg);
		}
	},
	setStore: function setStore() {
		var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    name = _ref.name,
		    ctor = _ref.ctor,
		    instance = _ref.instance;

		var store = arguments[1];

		this.items[name] = store;
		this.setStoreNameOn(instance || ctor, name);
	},
	setStoreNameOn: function setStoreNameOn(arg, name) {
		if (_.isFunction(arg)) {
			arg[this.ctorNameKey] = name;
			return;
		} else if (_.isObject(arg)) {
			arg[this.instanceNameKey] = name;
			return this.setStoreNameOn(arg.constructor, name);
		}
	},
	getCreateStoreContext: function getCreateStoreContext(arg) {
		var ctor = _.isFunction(arg) ? arg : _.isObject(arg) ? arg.constructor : undefined;

		var instance = !_.isFunction(arg) && _.isObject(arg) && arg || undefined;

		var name = this.getStoreName(arg, true);

		return { instance: instance, ctor: ctor, name: name };
	}
});

var store = new ClassStore({
	ctorNameKey: '__schemaName',
	instanceNameKey: '__schemaName',
	onExists: function onExists() {
		throw new Error('Schema already exists');
	},
	buildStore: function buildStore(context) {
		var schema = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
		var options = arguments[2];
		var name = context.name,
		    ctor = context.ctor;

		if (!(schema instanceof ModelSchema) && _.isObject(schema)) {
			schema = new ModelSchema(schema, options);
		} else {
			schema = new ModelSchema({}, options);
		}
		return {
			name: name, ctor: ctor, schema: schema
		};
	},
	get: function get(arg) {
		var cache = this.getStore(arg);
		return cache && cache.schema || undefined;
	},
	initialize: function initialize() {
		var store = this.createStore.apply(this, arguments);
		return store.schema;
	}
});

var modelSchemaMixin = (function (Model$$1) {
	return Model$$1.extend({
		getSchema: function getSchema() {
			return store.get(this);
		},
		getPropertySchema: function getPropertySchema(key) {
			var schema = this.getSchema();
			if (schema) {
				return schema.getProperty(key);
			}
		},
		display: function display(key) {
			var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

			var value = this.get.apply(this, arguments);
			var property = this.getPropertySchema(key);
			if (property) {
				return property.getDisplayValue(value, this, options);
			}
			return value;
		},
		displayLabel: function displayLabel(key) {
			var property = this.getPropertySchema(key);
			if (property) {
				return property.getLabel(this);
			}
		}
	});
});

function _initializeRenderOnModelChange() {
	var _this = this;

	var romc = this.getOption('renderOnModelChange', { args: [this.model, this] });
	if (romc && this.model) {
		this.listenTo(this.model, 'change', function () {
			return _this.render();
		});
	}
}

var BaseView = mix(View).with(optionsMixin, cssClassModifiersMixin, {
	_initializeRenderOnModelChange: _initializeRenderOnModelChange
});

var ExtView = BaseView.extend({
	constructor: function constructor() {
		BaseView.apply(this, arguments);
		this._initializeRenderOnModelChange();
	}
});

var BaseCollectionVIew = mix(CollectionView).with(optionsMixin, cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin, {
	_initializeRenderOnModelChange: _initializeRenderOnModelChange
});

var ExtCollectionVIew = BaseCollectionVIew.extend({
	constructor: function constructor() {
		BaseCollectionVIew.apply(this, arguments);
		this._initializeRenderOnModelChange();
	}
});

var templates = {
	default: _.template('<span><%= _v.getText() %></span>'),
	small: _.template('<small><%= _v.getText() %></small>'),
	labeledText: _.template('<label><%= _v.getHeader() %></label><span><%= _v.getText() %></span><% if(_v.hasSmallText()){ %><small>_v.getSmallText()</small><% } %>'),
	full: _.template('<% if(_v.hasTopText()){ %><i><%= _v.getTopText() %></i><% } %><span><%= _v.getText() %></span><% if(_v.hasSmallText()){ %><small><%= _v.getSmallText() %></small><% } %><% if(_v.hasBottomText()){ %><b><%= _v.getBottomText() %></b><% } %>')
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

var TextView = BackboneView.extend({
	displayInsteadGet: true,
	shouldEscapeValue: true,
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		this.options = options;
		var text = options.text,
		    value = options.value,
		    shouldEscapeValue = options.shouldEscapeValue,
		    property = options.property,
		    schema = options.schema,
		    customValue = options.customValue;

		if (!property && schema) {
			property = schema.name;
		}
		this.setValue(text || value, { shouldEscapeValue: shouldEscapeValue, preventRender: true });

		BackboneView.apply(this, arguments);
		if (this.model && property) {
			this.customValue = customValue;
			this.schema = schema;
			this.property = property;
			this.applyPropertyValue({ preventRender: true });
			property && this.listenTo(this.model, 'change:' + property, this.applyPropertyValue);
		}
	},
	getOption: function getOption$$1() {
		return getOption.apply(undefined, [this].concat(Array.prototype.slice.call(arguments)));
	},
	render: function render() {
		this.setNodeValue();
	},
	setValue: function setValue(value) {
		var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


		this.value = value;
		var preventRender = opts.preventRender,
		    shouldEscapeValue = opts.shouldEscapeValue;


		if (shouldEscapeValue != null) {
			this.shouldEscapeValue = shouldEscapeValue;
		}

		if (!preventRender) {
			this.setNodeValue();
		}
	},
	getValue: function getValue() {
		var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    asIs = _ref.asIs,
		    shouldEscapeValue = _ref.shouldEscapeValue;

		var value = this.value;
		if (asIs) {
			return value;
		}

		if (!_.isString(value)) {
			value = value == null ? '' : value.toString();
		}

		if (shouldEscapeValue == null) {
			shouldEscapeValue = this.shouldEscapeValue;
		}

		if (shouldEscapeValue) {
			value = _.escape(value);
		}
		return value;
	},
	setNodeValue: function setNodeValue() {
		this.el.innerHTML = this.getValue();
	},
	applyPropertyValue: function applyPropertyValue(opts) {
		var value = this.getPropertyValue();
		this.setValue(value, opts);
	},
	getPropertyValue: function getPropertyValue() {

		if (_.isFunction(this.customValue)) {
			return this.customValue.call(this, this.property, this.model, this);
		}

		var val = this.model.get(this.property);
		var useDisplay = this.getOption('displayInsteadGet');
		if (useDisplay && this.schema) {
			return this.schema.getDisplayValue(val, this.model, { allValues: this.getOption('allValues') });
		} else {
			return val;
		}
	},

	triggerMethod: triggerMethod,
	destroy: function destroy() {
		if (this._isDestroyed || this._isDestroying) {
			return this;
		}
		this._isDestroying = true;

		this.off();

		this.remove();

		this._isDestroyed = true;

		return this;
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
	logoff: function logoff(options) {
		var _this2 = this;

		return new Promise(function (resolve) {
			_this2.once('changed', function () {
				return resolve();
			});
			if (_this2.token) {
				_this2.token.update(undefined, options);
			} else {
				_this2.reflectChanges(_.extend({}, options, { clear: true }));
			}
		});
	},

	//override this for getting auth status
	getState: function getState() {
		return this.isLogged() ? 'auth' : 'anonym';
	},
	isLogged: function isLogged() {
		return this.get('authenticated') === true;
	},
	refresh: function refresh(tokenOptions) {
		var _this3 = this;

		if (this._refreshing) {
			return this._refreshing;
		}
		var promise = this._refreshing = new Promise(function (resolve) {
			if (!_this3.token.hasToken()) {
				_this3.reflectChanges(_.extend({}, tokenOptions, { clear: true }));
				resolve();
			} else {
				_this3.fetch().then(function () {
					_this3.reflectChanges(tokenOptions);
					resolve();
				}, function () {
					_this3.reflectChanges(_.extend({}, tokenOptions, { store: false }));
					resolve();
				});
			}
		});
		promise.then(function () {
			delete _this3._refreshing;
		});
		return promise;
	},
	reflectChanges: function reflectChanges() {
		var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var silent = opts.silent,
		    clear = opts.clear,
		    _opts$store = opts.store,
		    store = _opts$store === undefined ? true : _opts$store;

		clear && this.clear();
		store && this.store(clear);
		var options = _.omit(opts, 'clear', 'store');
		!silent && this.trigger('changed', this, options);
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
		var userOptions = arguments[1];

		if (this._fetching) return this._fetching;
		this._fetching = nativeAjax(options).then(function (json) {

			var parsed = _this2.parse(_.clone(json));
			_this2.update(parsed, userOptions);
			delete _this2._fetching;
			return Promise.resolve(json);
		}, function (xhr) {

			delete _this2._fetching;

			options.clearOnFail !== false && _this2.update(null, userOptions);

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

		var reflectOptions = _.extend({}, _.omit(opts, 'silent', 'store'));
		this.reflectTokenChanges(reflectOptions);
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
		if (!silent) {
			var options = _.omit(opts, 'silent', 'store');
			this.trigger('changed', options);
		}
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
	login: function login(username, password, opts) {

		var options = this.getFlow('password');
		options.data = { grant_type: 'password', username: username, password: password };
		options.clearOnFail = false;
		return this.fetch(options, opts);
	}
});

Token.setNativeAjax = function (arg) {
	var old = nativeAjax;
	nativeAjax = arg;
	return old;
};

var Stack = mix(BaseClass$1).with(Events).extend({

	destroyOnRemove: true,
	removeOnOutsideClick: true,
	removeOnEsc: true,
	clearBeforeAdd: false,

	constructor: function constructor(options) {
		this.cid = _.uniqueId('stack');
		this.unremovableKey = '_' + this.cid + '_preventRemove';
		this.options = options;
		this.stack = [];
		BaseClass$1.apply(this, arguments);
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

var FakeStore = BaseClass$1.extend({
	constructor: function constructor() {
		BaseClass$1.apply(this, arguments);
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
		if (this.get('store') === false) {
			this.destroy();
		}
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
notify.success = function (arg) {
	var options = _.extend({
		type: 'success', id: _.uniqueId('waitNotify')
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

function convertOptionsToNotify() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	var defs = _.pick(opts, 'notifyId', 'notifyStore');
	defs = {
		id: defs.notifyId,
		store: defs.notifyStore
	};
	var raw = _.pick(opts, 'notifyWait', 'notifyError', 'notifySuccess');
	var result = _.reduce(raw, function (memo, val, key) {
		var parsedKey = key.replace(/^notify(\w)/, function (match, letter) {
			return letter.toLowerCase();
		});
		if (_.isString(val)) {
			val = {
				text: val
			};
		}
		memo[parsedKey] = val;
	}, {});
	if (!_.size(result)) {
		return;
	}
	return _.extend(defs, result);
}

var syncWithNotifyMixin = (function (Base) {
	return Base.extend({
		getNotifyOptions: function getNotifyOptions(method) {
			var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

			var notify$$1 = convertOptionsToNotify(opts);
			var schema = store.get(this);
			if (schema) {
				var notifies = schema.getOption('notifies') || {};
				var byMethod = notifies[method];
				notify$$1 = _.extend({}, byMethod, notify$$1);
			}

			if (!_.size(notify$$1)) {
				return;
			} else {
				return notify$$1;
			}
		},
		sync: function sync(method, model, options) {
			var notifyOptions = this.getNotifyOptions(method, options);
			var note = void 0;
			if (notifyOptions && notifyOptions.wait) {
				note = notify.wait(notifyOptions.wait);
			}
			var xhr = Base.prototype.sync.apply(this, arguments);
			if (!notifyOptions) {
				return xhr;
			}
			xhr.then(function () {
				if (!notifyOptions.success) {
					if (note) {
						note.removed();
					}
					return;
				}
				if (note) {
					notifyOptions.success.id = note.id;
				}
				notify.success(notifyOptions.success);
			}, function (xhr) {
				if (!notify.error) {
					if (note) {
						note.removed();
					}
					return;
				}
				if (note) {
					notifyOptions.error.id = note.id;
					notifyOptions.error.xhr = xhr;
				}
				notify.error(notifyOptions.error);
			});
			return xhr;
		}
	});
});

function createExec(actionInstance, actionMethod) {
	return function exec(instance) {
		for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
			args[_key - 1] = arguments[_key];
		}

		var decline = actionInstance.isNotAllowed(instance, args);
		if (decline) {
			return actionInstance.onExecuteNotAllowed(instance, decline, args);
		}

		if (_.isFunction(actionMethod)) {
			return instance ? actionMethod.apply(instance, args) : actionMethod.apply(undefined, args);
		} else {
			return actionInstance.onActionMissing(instance);
		}
	};
}

var ActionModel = Model.extend({
	constructor: function constructor(attrs) {
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		_.extend(this, _.pick(options, 'action', 'instance', 'order'));
		Model.apply(this, arguments);
	},

	defaults: {
		name: undefined,
		label: undefined,
		order: 0
	},
	exec: function exec() {
		var _action;

		if (!this.action) {
			throw new Error('no action under the hood');
		}
		// if(!this.instance) {
		// 	throw new Error('no instance defined');
		// }
		return (_action = this.action).exec.apply(_action, [this.instance].concat(Array.prototype.slice.call(arguments)));
	}
});

var instanceProperties = ['name', 'label', 'order', 'hidden'];

var Action = BaseClass$1.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
		var action = options.action;

		delete options.action;

		_.extend(this, _.pick.apply(_, [options].concat(instanceProperties)));

		this.options = _.omit.apply(_, [options].concat(instanceProperties));

		this.exec = createExec(this, action);
	},
	getOption: function getOption$$1(key) {
		return getByPath(this.options, key);
	},
	getLabel: function getLabel() {
		return this.label || this.name;
	},
	is: function is(arg) {
		return this == arg || this.name == arg;
	},
	isVisible: function isVisible() {
		return this.hidden !== true;
	},
	isHidden: function isHidden() {
		return this.hidden == true;
	},
	isNotAllowed: function isNotAllowed() {},
	onExecuteNotAllowed: function onExecuteNotAllowed() {},
	onActionMissing: function onActionMissing() {},
	toModel: function toModel(instance, attrs) {
		// if (instance == null)  {
		// 	throw new Error('instance undefined and action model must have one');
		// }
		var hash = _.extend({
			id: this.name,
			label: this.getLabel(),
			order: this.order
		}, attrs);

		var options = {
			action: this,
			order: this.order,
			instance: instance
		};

		return new ActionModel(hash, options);
	}
});

var Store = BaseClass.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		_.extend(this, options);
		if (!_.isFunction(this.buildAction)) {
			this.buildAction = function (i) {
				return i;
			};
		}
		this.actions = [];
		this.actionsByNames = [];
	},

	// buildActions(actions = []){
	// 	let { actionsByNames, buildAction, name, ctor, Action } = this;

	// 	let options = { name, ctor, Action };

	// 	return _.reduce(actions, (passed, action) => {

	// 		action = this.buildAction(action, options);
	// 		if(_.isFunction(buildAction)){
	// 			action = buildAction(action, options);
	// 		}
	// 		if(!(action instanceof Action)){
	// 			action = new Action(action);
	// 		}
	// 		if (!(action.name in actionsByNames)) {
	// 			passed.push(action);
	// 			actionsByNames[action.name] = action;
	// 		}
	// 		return passed;
	// 	}, []);
	// },
	buildAction: function buildAction(raw) {
		return raw;
	},
	registerActions: function registerActions(raw) {
		var _this = this;

		_.each(raw, function (item) {
			return _this.registerAction(item);
		});
	},
	registerAction: function registerAction(raw) {
		var actionsByNames = this.actionsByNames,
		    buildAction = this.buildAction,
		    Action$$1 = this.Action;

		var options = _.pick(this, 'name', 'ctor', 'Action');

		var action = this.buildAction(raw, options);
		if (_.isFunction(buildAction)) {
			action = buildAction(action, options);
		}
		if (!action.name) return;
		if (!(action instanceof Action$$1)) {
			action = new Action$$1(action);
		}

		if (!(action.name in actionsByNames)) {
			actionsByNames[action.name] = action;
			this.actions.push(action);
		}
	}
});

var store$3 = new ClassStore({
	Action: Action,
	ctorNameKey: '__actionsStoreName',
	instanceNameKey: '__actionsStoreName',
	onExists: function onExists() {
		return false;
	},
	buildStore: function buildStore(context) {
		var actions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

		var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
		    Action$$1 = _ref.Action,
		    buildAction = _ref.buildAction;

		Action$$1 || (Action$$1 = this.Action);
		var ctor = context.ctor,
		    name = context.name;

		var store = new Store({ name: name, ctor: ctor, buildAction: buildAction, Action: Action$$1 });
		store.registerActions(actions);
		return store;
	},
	initialize: function initialize() {
		var store = this.createStore.apply(this, arguments);
		return store.schema;
	},
	_preInit: function _preInit(arg, args) {
		var store = this.getStore(arg);
		if (!store) {
			store = this.createStore.apply(this, [arg, []].concat(toConsumableArray(args)));
		}
		return store;
	},
	registerActions: function registerActions(arg, actions) {
		for (var _len = arguments.length, createArguments = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
			createArguments[_key - 2] = arguments[_key];
		}

		var store = this._preInit(arg, createArguments);
		store.registerActions(actions);
	},
	registerAction: function registerAction(arg, action) {
		for (var _len2 = arguments.length, createArguments = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
			createArguments[_key2 - 2] = arguments[_key2];
		}

		var store = this._preInit(arg, createArguments);
		store.registerAction(action);
	},
	getActions: function getActions(arg) {
		var _this2 = this;

		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		var cache = this.getStore(arg);
		if (!cache) return [];
		var actions = _.filter(cache.actions, function (action, index) {
			return _this2.filter(action, index, options);
		});
		var asModels = options.asModels,
		    instance = options.instance;

		if (asModels) {
			return _.map(actions, function (action) {
				return action.toModel(instance);
			});
		}
		return actions;
	},
	getAction: function getAction(store, action) {
		var cache = this.getStore(store);
		if (!cache) return;
		var name = _.isString(action) ? action : action.name;
		return cache.actionsByNames[name];
	},
	exec: function exec(store, action, instance) {
		var found = this.getAction(store, action);
		if (!found) {
			throw new Error('action not found:' + action);
		} else {
			for (var _len3 = arguments.length, args = Array(_len3 > 3 ? _len3 - 3 : 0), _key3 = 3; _key3 < _len3; _key3++) {
				args[_key3 - 3] = arguments[_key3];
			}

			return found.exec.apply(found, [instance].concat(toConsumableArray(args)));
		}
	},

	filter: function filter() {
		return true;
	}
});

function getFromPrototypes(instance, property) {
	var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
	    exclude = _ref.exclude,
	    process = _ref.process;

	if (exclude && !_.isArray(exclude)) {
		exclude = [exclude];
	}
	if (!_.isFunction(process)) {
		process = function process(value) {
			return value;
		};
	}
	var prototype = instance.__proto__;
	var result = [];
	while (prototype) {
		var value = prototype[property];
		prototype = prototype.__proto__;

		if (value == null) {
			continue;
		}

		if (exclude && exclude.indexOf(value) > -1) {
			continue;
		}

		value = process(value);
		if (value != null) {
			result.push(value);
		}
	}
	return result;
}

function isProtoActionsRegistered(instance) {
	return instance.constructor.__protoActionsTaked == true;
}
function setProtoActionsAsRegistered(instance) {
	instance.constructor.__protoActionsTaked = true;
}

var actionableMixin = (function (Base) {
	return Base.extend({
		_actionableMixin: true,
		inheritActions: false,
		ActionClass: undefined,

		_initializeActionableActions: function _initializeActionableActions() {
			var _this = this;

			var protoActionsTaked = isProtoActionsRegistered(this);
			if (protoActionsTaked) return;

			var instance = betterResult(this, 'actions', { args: [this], default: [] });
			var inherited = [];
			if (this.inheritActions) {
				var _inherited;

				var protoActions = getFromPrototypes(this, 'actions', {
					exclude: this.actions,
					process: function process(actions) {
						return betterResult({ actions: actions }, 'actions', { args: [_this], default: [] });
					}
				});
				(_inherited = inherited).push.apply(_inherited, toConsumableArray(_.flatten(protoActions)));
				inherited = _.filter(inherited, function (f) {
					return f != null;
				});
			}
			var rawactions = [].concat(toConsumableArray(inherited), toConsumableArray(instance));

			this.registerActions(rawactions);
			setProtoActionsAsRegistered(this);
		},


		buildStoreAction: function buildStoreAction(action) {
			return action;
		},
		getActions: function getActions() {
			var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

			this._initializeActionableActions();
			var actions = store$3.getActions(this, _.extend({ instance: this }, options));
			return actions;
		},
		registerActions: function registerActions(actions) {
			var _this2 = this;

			store$3.registerActions(this, actions, {
				Action: this.ActionClass,
				buildAction: function buildAction(raw) {
					return _this2.buildStoreAction(raw);
				}
			});
			// if(this._actionableActionsInitialized || this._isActionsRegistered()) {
			// 	ActionStore.registerActions(this, actions);
			// } else {
			// 	this._actionsWaitingForRegister || (this._actionsWaitingForRegister = []);
			// 	this._actionsWaitingForRegister.push(...actions);
			// }
		},
		registerAction: function registerAction() {
			for (var _len = arguments.length, action = Array(_len), _key = 0; _key < _len; _key++) {
				action[_key] = arguments[_key];
			}

			if (!action) return;
			return this.registerActions(action);
		},
		hasAction: function hasAction(arg, options) {
			var action = this.getAction(arg, options);
			return !!action;
		},
		getAction: function getAction(arg, options) {
			var actions = this.getActions(options);
			var iteratee = _.isString(arg) ? { name: arg } : { name: arg.name };
			return _.findWhere(actions, iteratee);
		},
		executeAction: function executeAction(action) {
			this._initializeActionableActions();

			for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
				rest[_key2 - 1] = arguments[_key2];
			}

			return store$3.exec.apply(store$3, [this.actionsStoreName || this, action, this].concat(toConsumableArray(rest)));
		}
	}, { ActionableMixin: true });
});

function action(name, label, action) {
	var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

	// args: {}
	if (!_.isFunction(name) && _.isObject(name)) {
		return name;
	}
	// args: "", ()
	else if (_.isFunction(label)) {
			var o = { name: name, action: label };
			return _.extend(o, action);
		}
		// args: (), {}
		else if (_.isFunction(name) && _.isObject(label)) {

				return _.extend({ action: name }, label);
			}
	// args: "", "", (), {}
	return _.extend({}, options, { name: name, label: label, action: action });
}

var CloseButtonView = ExtView.extend({
	tagName: 'button',
	template: function template() {
		return '<i></i>';
	}
});

var ButtonView = ExtView.extend({
	tagName: 'button',
	template: _.template('<i></i><span><%= text %></span><i></i>'),
	triggers: {
		'click': 'click'
	},
	templateContext: function templateContext() {
		return {
			text: this.getOption('text')
		};
	}
});

var TextView$1 = ExtView.extend({
	template: _.template('<%= text %>'),
	templateContext: function templateContext() {
		return {
			text: this.getOption('text', { args: [this] })
		};
	}
});

var BaseModalView = mix(ExtCollectionVIew).with(destroyViewMixin);

var ModalView = BaseModalView.extend({
	constructor: function constructor() {
		var _this = this;

		var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    promise = _ref.promise;

		BaseModalView.apply(this, arguments);
		if (promise) {
			this._isPromise = true;
			this.promise = new Promise(function (resolve, reject) {
				_this._resolve = resolve;
				_this._reject = reject;
			});
		}
	},

	wrapContent: true,

	childViewContainer: '[data-modal-content]',
	renderAllCustoms: true,

	renderCollection: false,
	viewComparator: false,

	templateContext: function templateContext() {
		return {
			shouldWrapContent: this.getOption('wrapContent') === true
		};
	},


	events: {
		'click': function click(event) {
			if (this.getOption('preventRemove')) {
				return;
			}
			var $el = $(event.target);
			event.stopPropagation();
			if ($el.closest('[data-modal-content]').length) {
				return;
			}
			this.destroy();
		},
		'click [data-modal-close]': function clickDataModalClose(event) {
			event.stopPropagation();
			event.preventDefault();
			this.destroy();
		}
	},
	customs: [function (v) {
		return v.createCloseButton();
	}, function (v) {
		return v.takeOptionsView('header');
	}, function (v) {
		return v.takeOptionsView('content');
	}, function (v) {
		return v.takeOptionsView('footer');
	}],
	createCloseButton: function createCloseButton() {
		if (this.getOption('closeButton') === false || this.getOption('preventRemove')) {
			return;
		}

		var Button = this.getOption('CloseButtonView');

		if (!isViewClass(Button)) {
			throw new Error('closeButtonView not defined, use `closeButton: false` or pass button view in options');
		}

		return new Button({ attributes: { 'data-modal-close': '' } });
	},
	defsOptionsForView: function defsOptionsForView(name, opts) {
		var defs = {};
		if (name == 'footer' && this._isPromise) {
			defs = {
				resolve: this.getOption('confirmLabel'),
				rejectSoft: this.getOption('cancelLabel')
			};
		}
		return _.extend({}, opts, defs);
	},
	takeOptionsView: function takeOptionsView(key) {
		var _this2 = this;

		var tagName = ['header', 'footer'].indexOf(key) > -1 ? key : 'div';
		var TextView = this.getOption('TextView');
		var options = this.defsOptionsForView(key, { tagName: tagName });
		var view = buildViewByKey(this, key, { TextView: TextView, options: options });

		if (key === 'footer' && !view) {
			if (this.getOption('promiseBar')) {
				view = new FooterView(options);
				this.listenTo(view, {
					'resolve': function resolve() {
						_this2.triggerMethod('resolve', _this2.modalChildren.content);
						_this2.destroy();
					},
					'reject': function reject() {
						_this2.triggerMethod('reject', _this2.modalChildren.content);
						_this2.destroy();
					}
				});
			}
		}

		!this.modalChildren && (this.modalChildren = {});
		this.modalChildren[key] = view;
		if (key === 'content') {
			this._initContentListeners(view);
		}
		if (this._isPromise && (key === 'footer' || key == 'content')) {
			this._initPromiseListeners(view);
		}
		return view;
	},
	_initPromiseListeners: function _initPromiseListeners(view) {
		var _this3 = this;

		this.listenTo(view, {
			'resolve': function resolve(arg) {
				return _this3.resolve(arg);
			},
			'reject': function reject(arg) {
				return _this3.reject(arg);
			}
		});
	},
	_initContentListeners: function _initContentListeners(content) {
		var _this4 = this;

		this.listenTo(content, {
			'destroy': function destroy() {
				return _this4.destroy();
			},
			'done': function done() {
				return _this4.destroy();
			}
		});
	},
	resolve: function resolve(arg) {
		this._resolve(arg);
		this.promiseState = 'fulfilled';
		if (!this._isDestroying && !this._isDestroyed) {
			this.destroy();
		}
	},
	reject: function reject(arg) {
		this._reject(arg);
		this.promiseState = 'rejected';
		if (!this._isDestroying && !this._isDestroyed) {
			this.destroy();
		}
	},
	onDestroy: function onDestroy() {
		if (this._isPromise && !this.promiseState) {
			this.reject();
		}
	},

	attributes: {
		'data-modal': ''
	}
});

var FooterView = ExtCollectionVIew.extend({
	renderAllCustoms: true,
	tagName: 'footer',
	attributes: {
		'data-modal-content-footer': 'confirm'
	},
	customs: [function (v) {
		return v.getResolveView();
	}, function (v) {
		return v.getRejectView();
	}],
	getResolveView: function getResolveView() {
		var _this5 = this;

		var text = this.getOption('resolveText');
		var view = new ButtonView({
			text: text,
			onClick: function onClick() {
				return _this5.triggerClick(true);
			}
		});
		return view;
	},
	getRejectView: function getRejectView() {
		var _this6 = this;

		var text = this.getOption('rejectText');
		var view = new ButtonView({
			text: text,
			onClick: function onClick() {
				return _this6.triggerClick(false);
			}
		});
		return view;
	},
	triggerClick: function triggerClick(resolve) {
		var event = resolve ? 'resolve' : 'reject';
		var arg = this.getOption(event + 'With');
		this.trigger(event, arg);
	}
});

var config = {

	template: _.template('\n<div data-modal-bg></div>\n<% if(shouldWrapContent) {%><div data-modal-content-wrapper><%} %>\n<section data-modal-content></section>\n<% if(shouldWrapContent) {%></div><%} %>\n'),

	confirmResolveText: 'confirm',
	confirmRejectText: 'cancel',
	TextView: TextView$1,
	ModalView: ModalView,
	CloseButtonView: CloseButtonView,

	buildView: function buildView(options) {
		var showOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


		var ModalView$$1 = takeFirst('ModalView', options, showOptions, this);
		var TextView = takeFirst('TextView', options, showOptions, this);
		var CloseButtonView$$1 = takeFirst('CloseButtonView', options, showOptions, this);

		options = _.extend({
			TextView: TextView,
			CloseButtonView: CloseButtonView$$1,
			template: this.template
		}, options);

		return new ModalView$$1(options);
	},
	render: function render(view, stack) {
		var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};


		var el = _.result(this, 'container');
		if (el && el.jquery) {
			el = el.get(0);
		}
		options = _.extend({
			el: el, replaceElement: true, destroyOnEmpty: true
		}, options);

		renderInNode(view, options);

		if (stack) {
			var _options = options,
			    preventRemove = _options.preventRemove;

			_.defer(function () {
				return stack.add(view, { preventRemove: preventRemove });
			});
		}
	},

	container: function container() {
		return document.querySelector('body');
	},
	stackOptions: {
		removeOnEsc: true,
		removeOnOutsideClick: true
	},
	getStack: function getStack(options) {
		if (!this.stack) {
			var stackOptions = this.stackOptions || options;
			this.stack = new Stack(stackOptions);
		}
		return this.stack;
	}
};

function show() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
	var showOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	if (isView(opts)) {
		opts = {
			content: opts
		};
	}
	if (!opts.attributes) {
		opts.attributes = {
			'data-modal': opts.modalType || ''
		};
	}

	var modal = config.buildView(opts, showOptions);

	config.render(modal, config.getStack(), showOptions);

	if (showOptions.returnAsPromise && opts.promise) {
		return modal.promise;
	} else {
		return modal;
	}
}

function normalizeConfirmFooter() {
	var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	if (!opts.footer) {
		opts.footer = FooterView;
	}

	if (!opts.footerOptions) {
		opts.footerOptions = {};
	}

	var fopts = opts.footerOptions;
	fopts.resolveWith = takeFirst('resolveWith', fopts, opts);
	fopts.rejectWith = takeFirst('rejectWith', fopts, opts);
	fopts.resolveText = takeFirst('resolveText', fopts, opts) || config.confirmResolveText;
	fopts.rejectText = takeFirst('rejectText', fopts, opts) || config.confirmRejectText;
	return opts;
}

function confirm(arg) {
	var showOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	if (_.isString(arg)) {
		arg = {
			content: arg
		};
	} else if (!_.isObject(arg)) {
		arg = {};
	}
	if (arg.text && !arg.content) {
		arg.content = arg.text;
	}
	arg.promise = true;
	if (showOptions.returnAsPromise == null) {
		showOptions.returnAsPromise = true;
	}
	arg.modalType = 'confirm';
	arg = normalizeConfirmFooter(arg);

	return show(arg, showOptions);
}

var modals = {
	config: config,
	show: show,
	confirm: confirm
};

var initSelectorMixin = function initSelectorMixin(Base) {
	return Base.extend({
		constructor: function constructor() {
			Base.apply(this, arguments);
			this._initializeSelector();
		},
		getSelector: function getSelector() {
			return this.getOption('selector');
		},
		buildChildView: function buildChildView(child, ChildViewClass) {
			var childViewOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

			var selector = this.getSelector();
			if (selector) {
				_.extend(childViewOptions, {
					selectable: true
				});
			}
			var view = Base.prototype.buildChildView(child, ChildViewClass, childViewOptions);
			if (selector) {
				if (view.addCssClassModifier) {
					view.addCssClassModifier(function (m) {
						return selector.isSelected(m) ? 'selected' : '';
					});
				}
				this.listenTo(view, 'toggle:select', this._handleChildviewToggleSelect);
			}
			return view;
		},
		_initializeSelector: function _initializeSelector() {
			var _this = this;

			if (this._selectorMixinInitialized) return;
			var selector = this.getSelector();
			if (selector) {
				this.listenTo(selector, 'change', function (changes) {
					_.invoke(changes.selected, 'trigger', 'change');
					_.invoke(changes.unselected, 'trigger', 'change');
					_this.triggerMethod('selector:change');
				});
			}
			this._selectorMixinInitialized = true;
		},
		_handleChildviewToggleSelect: function _handleChildviewToggleSelect(arg1, arg2) {
			var view = isView(arg1) ? arg1 : arg2;
			var event = isView(arg1) ? arg2 : arg1;

			event && event.stopPropagation && event.stopPropagation();

			var selector = this.getSelector();
			if (!selector.isMultiple() || !this.lastClickedModel || !event.shiftKey) {
				this.lastClickedModel = view.model;
				selector.toggle(view.model);
			} else {
				var lastclicked = this.lastClickedModel;
				delete this.lastClickedModel;
				selector.toggleRange(view.model, lastclicked);
			}
		}
	});
};

var trueFilter = function trueFilter() {
	return true;
};

var BaseSelector = mix(BaseClass$1).with(Events);

var Selector = BaseSelector.extend({
	constructor: function constructor() {
		var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

		this.options = _.clone(options);
		mergeOptions.call(this, options, 'source', 'extractValue', 'sourceFilter');
		this._isMultiple = options.multiple === true;
		BaseSelector.apply(this, arguments);
		this._initializeSource();
		this._createCollections();
		this._setupModel();
	},

	sourceFilter: trueFilter,
	setSourceFilter: function setSourceFilter(filter) {
		if (!_.isFunction(filter)) {
			filter = trueFilter;
		}
		if (filter != this.sourceFilter) {
			this.sourceFilter = filter;
			this._updateAll();
		}
	},
	setSourceModels: function setSourceModels(models) {
		this._updateAll(models);
	},
	getSourceModels: function getSourceModels() {
		return this.source.filter(this.sourceFilter);
	},
	_initializeSource: function _initializeSource() {
		if (!_.isObject(this.source)) {
			this.source = new Collection$1();
			return;
		} else if (isCollection(this.source)) {
			return;
		}

		var models = _.map(this.source, function (value, ind) {
			if (_.isObject(value)) {
				return value;
			} else {
				return { id: ind, value: value };
			}
		});
		this.source = new Collection$1(models);
		if (this.options.extractValue == null) {
			this.extractValue = function (model) {
				return model.id;
			};
		}
	},
	_createCollections: function _createCollections() {
		var _this = this;

		var initialSelected = this.options.value == null ? [] : this.options.value;
		if (!_.isArray(initialSelected)) {
			initialSelected = [initialSelected];
		}
		var models = this.getSourceModels();
		this.all = new Collection$1(models);
		this.listenTo(this.source, 'update reset', this._updateAll);

		var selected = _.reduce(initialSelected, function (memo, initial) {
			var found = _this.all.get(initial);
			if (found) {
				memo.push(found);
			}
			return memo;
		}, []);
		this.selected = new Collection$1(selected);
	},
	_updateAll: function _updateAll(col) {
		var models = col && col.models;
		if (!models) {
			models = this.getSourceModels();
		}
		this.all.set(models, { remove: true, add: true, merge: true });
	},
	_setupModel: function _setupModel() {
		var _this2 = this;

		this.model = new Model$1();
		this.model.clear = function () {
			return _this2.clear();
		};
		this.on('change', function () {
			_this2.model.set('count', _this2.getCount());
		});
	},
	isSelected: function isSelected(arg) {
		return this.selected.has(arg);
	},
	isMultiple: function isMultiple() {
		return this._isMultiple;
	},
	getCount: function getCount() {
		return this.selected.length;
	},
	getCollection: function getCollection() {
		return this.all;
	},
	getCollections: function getCollections() {
		return {
			collection: this.all,
			selected: this.selected
		};
	},
	_trigger: function _trigger(event, model) {
		var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
		    silent = _ref.silent,
		    silentChange = _ref.silentChange,
		    changes = _ref.changes;

		if (silent) {
			return;
		}
		var value = this.extractValue(model);
		this.trigger(event, value);
		if (!silentChange) {
			var mass = defineProperty({}, event, [model]);
			if (changes && changes.unselected) {
				var _mass$unselected;

				mass.unselected || (mass.unselected = []);
				(_mass$unselected = mass.unselected).push.apply(_mass$unselected, toConsumableArray(changes.unselected));
			}
			if (changes && changes.selected) {
				var _mass$selected;

				mass.selected || (mass.selected = []);
				(_mass$selected = mass.selected).push.apply(_mass$selected, toConsumableArray(changes.selected));
			}
			this._triggerChange(mass);
		}
	},
	_triggerChange: function _triggerChange() {
		var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
		    _ref2$selected = _ref2.selected,
		    selected = _ref2$selected === undefined ? [] : _ref2$selected,
		    _ref2$unselected = _ref2.unselected,
		    unselected = _ref2$unselected === undefined ? [] : _ref2$unselected;

		if (selected.length + unselected.length) {
			this.trigger('change', { selected: selected, unselected: unselected }, this.getCount());
		}
	},
	unselect: function unselect(arg) {
		var model = this.all.get(arg);
		if (!model) return;
		return this._unselect(model);
	},
	_unselect: function _unselect(model, options) {
		var exist = this.selected.has(model);
		if (!exist) return;
		var affected = this.selected.remove(model);
		this._trigger('unselected', model, options);
		return affected;
	},
	select: function select(arg) {
		var model = this.all.get(arg);
		if (!model) return;
		return this._select(model);
	},
	_select: function _select(model) {
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		var exist = this.selected.has(model);
		if (exist) return;

		var affected = void 0;

		if (this.isMultiple()) {
			affected = this.selected.add(model);
		} else {
			var _options$changes$unse;

			var current = this.selected.first();
			var unselected = [];
			if (current == exist) {
				return;
			}

			if (current) {
				var uns = this._unselect(current, _.extend({}, options, { silentChange: false }));
				unselected.push(uns);
			}

			affected = this.selected.set(model, { remove: true, merge: true, add: true });
			options.changes || (options.changes = {});
			options.changes.unselected || (options.changes.unselected = []);
			(_options$changes$unse = options.changes.unselected).push.apply(_options$changes$unse, unselected);
		}
		this._trigger('selected', model, options);
		return affected;
	},
	toggle: function toggle(arg) {
		var model = this.all.get(arg);
		if (!model) return;
		return this._toggle(model);
	},
	_toggle: function _toggle(model, options) {
		var affected = void 0;
		var key = void 0;
		var result = { selected: [], unselected: [] };
		if (this.selected.has(model)) {
			affected = this._unselect(model, options);
			key = 'unselected';
		} else {
			affected = this._select(model, options);
			key = 'selected';
		}
		result[key].push(affected);
		return result;
	},
	_processRange: function _processRange(from, to, takeAction) {
		from = this.all.get(from);
		to = this.all.get(to);
		if (!from || !to) return;
		var _toIndex = this.all.indexOf(to);
		var indexes = [this.all.indexOf(from), _toIndex];
		var fromIndex = _.min(indexes);
		var toIndex = _.max(indexes);
		var processed = [];
		for (var x = fromIndex; x <= toIndex; x++) {
			if (x === _toIndex) continue;

			var model = this.all.models[x];
			if (!model) continue;
			var affected = takeAction(model);
			processed.push(affected);
		}
		return processed;
	},
	selectRange: function selectRange(from, to) {
		var _this3 = this;

		var result = { selected: [], unselected: [] };
		var actionOptions = { silent: true };
		var action = function action(model) {
			var affected = _this3._select(model, actionOptions);
			if (affected) {
				result.selected.push(affected);
			}
			return affected;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	unselectRange: function unselectRange(from, to) {
		var _this4 = this;

		var result = { selected: [], unselected: [] };
		var actionOptions = { silent: true };
		var action = function action(model) {
			var affected = _this4._unselect(model, actionOptions);
			if (affected) {
				result.unselected.push(affected);
			}
			return affected;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	toggleRange: function toggleRange(from, to) {
		var _this5 = this;

		var result = { selected: [], unselected: [] };
		var actionOptions = { silent: true };
		var action = function action(model) {
			var _result$selected, _result$unselected;

			var toggled = _this5._toggle(model, actionOptions);
			(_result$selected = result.selected).push.apply(_result$selected, toConsumableArray(toggled.selected));
			(_result$unselected = result.unselected).push.apply(_result$unselected, toConsumableArray(toggled.unselected));
			return toggled;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	clear: function clear() {
		var result = {
			unselected: _.clone(this.selected.models)
		};
		this.selected.reset();
		this._triggerChange(result);
	},
	getValue: function getValue() {
		var _this6 = this;

		var results = this.selected.map(function (model) {
			return _this6.extractValue(model);
		});
		if (this.isMultiple()) {
			return results;
		} else {
			return results[0];
		}
	},
	extractValue: function extractValue(model) {
		return model;
	}
});

var index = {
	Process: Process, startableMixin: startableMixin,
	App: App,
	ModelSchemas: store, ModelSchema: ModelSchema, PropertySchema: PropertySchema, modelSchemaMixin: modelSchemaMixin,
	validator: validator,
	User: User, BearerToken: Token,
	ViewStack: Stack,
	store: store$1,
	View: ExtView, CollectionView: ExtCollectionVIew, AtomTextView: AtomText, TextView: TextView,
	notify: notify, notifies: notifies, Notifier: Notifier, syncWithNotifyMixin: syncWithNotifyMixin,
	Action: Action, ActionStore: store$3, actionableMixin: actionableMixin, action: action,
	modals: modals,
	Selector: Selector, initSelectorMixin: initSelectorMixin
};

export { Process, startableMixin, App, store as ModelSchemas, ModelSchema, PropertySchema, modelSchemaMixin, validator, User, Token as BearerToken, Stack as ViewStack, store$1 as store, ExtView as View, ExtCollectionVIew as CollectionView, AtomText as AtomTextView, TextView, notify, notifies, Notifier, syncWithNotifyMixin, Action, store$3 as ActionStore, actionableMixin, action, modals, Selector, initSelectorMixin };
export default index;

//# sourceMappingURL=index.js.map
