import _ from 'underscore';
import ModelSchema from './model-schema.js';


const store = {
	schemas: {},
	getStoreName(arg){
		if(_.isString(arg) && arg !== '') {
			return arg;
		}

		if (_.isFunction(arg)) {
			let store = this.getStoreByCtor(arg);
			if (store) {
				return store.name;
			}
		}
		return _.uniqueId('modelSchema');		
	},
	getStoreByName(name){
		return this.schemas[name];
	},
	getStoreByCtor(ctor){
		let schema;
		if(ctor.__schemaName) {
			schema = this.getStoreByName(ctor.__schemaName);
			if(schema){ return schema; }
		}
		return _.find(this.schemas, f => f.ctor === ctor);		
	},
	getStore(arg){
		if (_.isString(arg)) {
			return this.getStoreByName(arg);
		} else if (_.isFunction(arg)) {
			return this.getStoreByCtor(arg);
		} else if(_.isObject(arg)) {
			return this.getStoreByCtor(arg.constructor);
		}
	},	
	isNotInitialized(arg){
		return !this.getStore(arg);
	},
	initialize(name, schema = {}, options) {
		if (!this.isNotInitialized(name)) {
			throw new Error('Schema already initialized');
		}
		let ctor = _.isFunction(name) && name || undefined;
		name = this.getStoreName(name);
		if (ctor) {
			ctor.__schemaName = name;
		}
		if(name in this.schemas) { return; }

		if(!(schema instanceof ModelSchema) && _.isObject(schema)){
			schema = new ModelSchema(schema, options);
		} else {
			schema = new ModelSchema({}, options);
		}
		this.schemas[name] = {
			name, ctor, schema
		};
		return schema;
	},

	get(arg) {
		let cache = this.getStore(arg);
		return cache && cache.schema || undefined;
	}
};


export default store;
