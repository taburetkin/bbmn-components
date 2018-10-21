import _ from 'underscore';
import BaseAction from './action.js';

const store = {
	Action: BaseAction,
	names:{},
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
		return _.uniqueId('actionStore');		
	},
	getStoreByCtor(ctor){
		return _.find(this.names, f => f.ctor === ctor);		
	},
	isNotInitialized(arg){
		return !this.getStore(arg);
	},
	initialize({ name, actions, Action, buildAction } = {}) {
		let ActionClass = Action || this.Action;
		let ctor = _.isFunction(name) && name || undefined;
		name = this.getStoreName(name);

		if(name in this.names) { return; }

		let options = { name, ctor, Action: ActionClass };
		let actionsByNames = {};
		let builded = _.reduce(actions, (passed, action) => {

			action = this.buildAction(action, options);
			if(_.isFunction(buildAction)){
				action = buildAction(action, options);
			}
			if(!(action instanceof ActionClass)){
				action = new ActionClass(action);
			}
			if (!(action.name in actionsByNames)) {
				passed.push(action);
				actionsByNames[action.name] = action;
			}
			return passed;
		}, []);

		this.names[name] = {
			name, ctor, actions: builded, actionsByNames
		};
	},
	getStore(arg){
		if (_.isString(arg)) {
			return this.names[name];
		} else if (_.isFunction(arg)) {
			return this.getStoreByCtor(arg);
		}
	},
	getActions(arg, options){
		let cache = this.getStore(arg);
		if(!cache) return [];
		return _.filter(cache.actions, (action, index) => this.filter(action, index, options));
	},
	getAction(store, action){
		let cache = this.getStore(store);
		if (!cache) return;
		let name = _.isString(action) ? action : action.name;
		return cache.actionsByNames[name];
	},
	exec(store, action, instance, ...args) {
		let found = this.getAction(store, action);
		if (!found) {
			throw new Error('action not found:' + action);
		} else {
			return found.exec(instance, ...args);
		}
	},
	filter: () => true,
	buildAction: raw => raw,
};


export default store;
