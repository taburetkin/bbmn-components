import _ from 'underscore';
import { BaseClass } from 'bbmn-core';
import BaseAction from './action.js';
import ClassStore from '../class-store';

const BaseActionStore = BaseClass.extend({
	constructor(options = {}){
		_.extend(this, options);
		if(!_.isFunction(this.buildAction)){
			this.buildAction = i => i;
		}
		this.actions = [];
		this.actionsByNames = [];
	},
	buildAction: raw => raw,
	registerActions(raw){
		_.each(raw, item => this.registerAction(item));
	},
	registerAction(raw){
		let { actionsByNames, buildAction, Action } = this;
		let options = _.pick(this, 'name', 'ctor', 'Action');

		let action = this.buildAction(raw, options);
		if(_.isFunction(buildAction)){
			action = buildAction(action, options);
		}
		if (!action.name) return;
		if(!(action instanceof Action)){
			action = new Action(action);
		}

		if (!(action.name in actionsByNames)) {
			actionsByNames[action.name] = action;
			this.actions.push(action);
		}
	}
});


const store = new ClassStore({
	Action: BaseAction,
	ctorNameKey: '__actionsStoreName',
	instanceNameKey: '__actionsStoreName',
	onExists: () => false,
	buildStore(context, actions = [], { Action, buildAction } = {}) {
		Action || (Action = this.Action);
		let { ctor, name } = context;
		let store = new BaseActionStore({ name, ctor, buildAction, Action });
		store.registerActions(actions);		
		return store;
	},

	initialize(){
		let store = this.createStore(...arguments);
		return store.schema;
	},
	_preInit(arg, args){
		let store = this.getStore(arg);
		if(!store) {
			store = this.createStore(arg, [], ...args);
		}
		return store;
	},
	registerActions(arg, actions, ...createArguments){
		let store = this._preInit(arg, createArguments);
		store.registerActions(actions);
	},
	registerAction(arg, action, ...createArguments){
		let store = this._preInit(arg, createArguments);
		store.registerAction(action);
	},	

	getActions(arg, options = {}){
		let cache = this.getStore(arg);
		if(!cache) return [];
		var actions = _.filter(cache.actions, (action, index) => this.filter(action, index, options));
		let { asModels, instance } = options;
		if (asModels) {
			return _.map(actions, action => action.toModel(instance));
		}
		return actions;
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
