import _ from 'underscore';
import { BaseClass } from 'bbmn-core';

const ClassStore = BaseClass.extend({	
	constructor(options = {}){
		_.extend(this, _.omit(options, 'createStore'));
		this._createStore = options.createStore;
		this.instanceNameKey = options.instanceNameKey;
		this.ctorNameKey = options.ctorNameKey;
		this.items = {};
	},
	onExists: () => false,
	createStore(arg, ...rest){
		if (this.isExists(arg)) {
			return this.onExists();
		}
		let context = this.getCreateStoreContext(arg);	
		let store = this.buildStore(context, ...rest);		
		this.setStore(context, store);
		return store;
	},
	getStoreName(arg, generate){
		if(_.isString(arg) && arg !== '') {
			return arg;
		}
		let store;
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
	isExists(arg){
		return this.getStore(arg) != null;
	},
	getStoreByName(name){
		return this.items[name];
	},	
	getStoreByInstance(instance){
		let item;
		let name = instance[this.instanceNameKey];
		if(name) {
			item = this.getStoreByName(name);
			if(item){ return item; }
		}
		return this.getStoreByCtor(instance.constructor);
	},
	getStoreByCtor(ctor){
		let item;
		let name = ctor[this.ctoreNameKey];
		if(name) {
			item = this.getStoreByName(name);
			if(item){ return item; }
		}
		return _.find(this.item, f => f.ctor === ctor);
	},
	getStore(arg){
		if (_.isString(arg)) {
			return this.getStoreByName(arg);
		} else if (_.isFunction(arg)) {
			return this.getStoreByCtor(arg);
		} else if(_.isObject(arg)) {
			return this.getStoreByInstance(arg);
		}
	},
	setStore({ name, ctor, instance } = {}, store){
		this.items[name] = store;
		this.setStoreNameOn(instance || ctor, name);
	},
	setStoreNameOn(arg, name){
		if(_.isFunction(arg)) {
			arg[this.ctorNameKey] = name;
			return;
		} else if(_.isObject(arg)) {
			arg[this.instanceNameKey] = name;
			return this.setStoreNameOn(arg.constructor, name);
		}
	},
	getCreateStoreContext(arg){
		let ctor = _.isFunction(arg) 
			? arg 
			: _.isObject(arg) ? arg.constructor
				: undefined;
				
		let instance = !_.isFunction(arg) && _.isObject(arg) && arg || undefined;

		let name = this.getStoreName(arg, true);
		
		return { instance, ctor, name };
	},
});

export default ClassStore;
