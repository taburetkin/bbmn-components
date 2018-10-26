import _ from 'underscore';
import BaseClass from 'bbmn-core';
import BaseAction from './action.js';
import ClassStore from '../class-store';

const Store = BaseClass.extend({
	constructor(options = {}){
		_.extend(this, options);
		this.actions = [];
		this.actionsByNames = [];
	},
	buildActions(actions = []){
		let { actionsByNames, buildAction, name, ctor, Action } = this;

		let options = { name, ctor, Action };
		
		return _.reduce(actions, (passed, action) => {

			action = this.buildAction(action, options);
			if(_.isFunction(buildAction)){
				action = buildAction(action, options);
			}
			if(!(action instanceof Action)){
				action = new Action(action);
			}
			if (!(action.name in actionsByNames)) {
				passed.push(action);
				actionsByNames[action.name] = action;
			}
			return passed;
		}, []);
	},
	buildAction: raw => raw,
	registerActions(raw){
		let actions = this.buildAction(raw);
		this.actions.push(...actions);
	}
});


const store = new ClassStore({
	Action: BaseAction,
	ctorNameKey: '__actionsStoreName',
	instanceNameKey: '__actionsStoreName',
	onExists: () => false,
	buildStore(context, { actions, Action, buildAction } = {}) {
		Action || (Action = this.Action);
		let { ctor, name } = context;
		let store = new Store({ name, ctor, buildAction, Action });
		store.registerActions(actions);		
		return store;
	},

	initialize(){
		let store = this.createStore(...arguments);
		return store.schema;
	},

	registerActions(arg, actions){
		let store = this.getStore(arg);
		if(!store) return;
		store.registerActions(actions);
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
});


export default store;
