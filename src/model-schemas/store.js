import _ from 'underscore';
import ModelSchema from './model-schema.js';
import ClassStore from '../class-store';

const store = new ClassStore({
	ctorNameKey: '__schemaName',
	instanceNameKey: '__schemaName',
	onExists: () => { throw new Error('Schema already exists'); },
	buildStore(context, schema = {}, options) {
		let { name, ctor } = context;
		if(!(schema instanceof ModelSchema) && _.isObject(schema)){
			schema = new ModelSchema(schema, options);
		} else {
			schema = new ModelSchema({}, options);
		}
		return {
			name, ctor, schema
		};
	},
	get(arg) {
		let cache = this.getStore(arg);
		return cache && cache.schema || undefined;
	},
	initialize(){
		let store = this.createStore(...arguments);
		return store.schema;
	}
});


export default store;
