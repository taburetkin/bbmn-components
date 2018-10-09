
import { triggerMethodOn, camelCase, betterResult as result } from 'bbmn-utils';
import { isPromisable, race, asArray, valueToPromise } from './helpers.js';
import { BaseClass } from 'bbmn-core';

import register from './register.js';


const Process = BaseClass.extend({
	constructor(context, name, opts){
		
		BaseClass.apply(this, arguments);

		this._initDefaults(name, context);
		this._initCancelation();
		this._mergeOptions(opts);
	},


	// initialize methods

	_initDefaults(name, context){
		if(name == null || name === '')
			throw new Error('Process requires two arguments: name [string], context [object]. name missing');
		
		if(!_.isObject(context))
			throw new Error('Process requires two arguments: name [string], context [object]. context is not an object');

		this.cid = _.uniqueId('process');
		this.name = name;
		this.context = context;
		this.errors = [];
	},

	_initCancelation(){
		this.cancelPromise = new Promise((resolve, reject) => {
			this.cancel = () => reject('cancel'); 
		});
	},
	_mergeOptions(opts = {}){
		let options = _.omit(opts, 'cid', 'name', 'context', 'cancelPromise', 'cancel', 'errors');
		_(options).each((value, key) => this[key] = value);
	},

	
	concurrencyCheck(){

		let previous = this.getProcessFromContext();
		//console.log(previous, this.context);
		if(!previous) return;
	
		let concurrent = this.concurrent;	
		
		if (concurrent === false) {
	
			this.cancel();
	
		} else if (concurrent == 'first') {
	
			return previous.promise;
	
		} else if (concurrent == 'last') {
	
			previous.cancel();
	
		}		
	},


	// life cycle methods	

	run(...args){
		this.updateProcessInContext(this);
		this.args = args || [];
		this.promise = this._createLifeCyclePromise();
		return this.promise;
	},


	_createLifeCyclePromise(){


		return this._notCanceled()
			.then(() => this._begin())
			.then(() => this._beforeStart())
			.then(() => this._canBeStarted())
			.then(() => this._waitOtherPromises())
			.then(() => {
				this.triggerComplete();
				return Promise.resolve();
			})
			.catch(error => {
				this.triggerError(error);
				let jsError;
				if(error instanceof Error) {
					throw error;
				} else if ((jsError = this.getJsError())) {
					throw jsError;
				} else {
					return Promise.reject(this);
				}
			});		
	},




	_notCanceled() {
		return this._cancelationRace(Promise.resolve());
	},
	_begin(){
		return this._getHookResultAsPromise('begin');
	},
	_beforeStart(){
		return this._getHookResultAsPromise('before');
	},
	_canBeStarted(){
		let contextMethod = 'can:not:' + this.name;
		let promise = this.invokeOnContext(contextMethod);
		if(!isPromisable(promise)) {
			promise = (promise == null || promise === '') 
				? Promise.resolve()
				: Promise.reject(promise);
		}
		return this._cancelationRace(promise);
	},
	_waitOtherPromises(){
		let contextMethod = `get:${this.name}:promises`;
		
		let promises = asArray(this.invokeOnContext(contextMethod));

		return this._cancelationRace(Promise.all(promises));
	},

	_getHookResultAsPromise(hookName){
		let procMethod = camelCase('on:' + hookName);
		let procHook = _.isFunction(this[procMethod]) && this[procMethod](this.context, ...this.args) || undefined;
		let result = valueToPromise(procHook).then(() => {
			let cntxHook = this.triggerOnContext(hookName);
			return valueToPromise(cntxHook);
		});

		return this._cancelationRace(result);

	},

	// trigger methods

	triggerComplete() { 

		this.updateProcessInContext(null);

		if (_.isFunction(this.onComplete))
			this.onComplete(this.context, ...this.args);

		this.triggerOnContext();

		this.triggerEnd();
		
	
	},
	triggerError(errors){


		this.updateProcessInContext(null);		

		if(!_.isArray(errors))
			errors = [errors];

		this.errors.push(...errors);

		
		if (_.isFunction(this.onError))
			this.onError(this.context, ...this.errors);
		
		this.triggerOnContext('error', ...this.errors);
		
		this.triggerEnd();

		
	},
	triggerEnd(){
		this.triggerOnContext('end');
	},



	// helpers methods

	getJsError(context){
		!context && (context = this);
		if(context != this && (!_.isObject(context) || !_.isArray(context.errors)))
			return;

		return _(context.errors).filter(f => f instanceof Error)[0];
	},	

	_cancelationRace(promise){
		return race(this.cancelPromise, promise);
	},


	getContextProcessKey(){
		return camelCase(`_process:${this.name}:executing`);
	},
	getProcessFromContext(){
		let key = this.getContextProcessKey();
		return this.context[key];
	},
	updateProcessInContext(process){
		let key = this.getContextProcessKey();		
		this.context[key] = process;
	},



	triggerOnContext (eventName) {
	
		let context = this.context; 
		if(!_.isFunction(context.trigger))
			return;
		
		let event = (eventName ? eventName + ':' : '') + this.name;
		
		return triggerMethodOn(context, event, this, ...this.args);
	
	},

	invokeOnContext(methodName)
	{
		let method = camelCase(methodName);
		let context = this.context;
		let args = this.args;
		return result(context, method, { args });

	}

}, {
	register
});


// Process.register = function(context, name, opts) {
// 	return register(this, context, name, opts);
// };

export default Process;
