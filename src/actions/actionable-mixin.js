import _ from 'underscore';

import { betterResult } from 'bbmn-utils';
import Action from './action.js';
import ActionStore from './store.js';


function getFromPrototypes(instance, property, { exclude, process } = {}) {
	if(exclude && !_.isArray(exclude)) {
		exclude = [exclude];
	}
	if(!_.isFunction(process)) {
		process = value => value;
	}
	let prototype = instance.__proto__;
	let result = [];
	while(prototype){
		let value = prototype[property];
		prototype = prototype.__proto__;

		if (value == null) { continue; }

		if(exclude && exclude.indexOf(value) > -1) { continue; }
		
		value = process(value);
		if(value != null) {
			result.push(value);
		}
	}
	return result;
}



export default Base => Base.extend({
	_actionableMixin: true,
	inheritActions: false,
	ActionClass: Action,

	constructor(){
		Base.apply(this, arguments);
	},
	_initializeActionableActions(){
		if (this._actionableActionsInitialized) return;

		if (!ActionStore.isExists(this)) {
			let instance = betterResult(this, 'actions', { args: [this], default: [] });
			let inherited = [];
			let waiting = this._actionsWaitingForRegister || [];
			if (this.inheritActions) {
				let protoActions = getFromPrototypes(this, 'actions', {
					exclude: this.actions,
					process: actions => betterResult({ actions }, 'actions', { args: [this], default: [] })
				});
				inherited.push(..._.flatten(protoActions));
				inherited = _.filter(inherited, f => f != null);
			}

			let rawactions = [...inherited, ...instance, ...waiting];

			ActionStore.initialize(this, {
				actions: rawactions, 
				Action: this.ActionClass,
				buildAction: raw => this.buildStoreAction(raw),				
			});
		}
		this._actionableActionsInitialized = true;

	},

	buildStoreAction: action => action,
	getActions(options = {}){
		this._initializeActionableActions();
		return ActionStore.getActions(this, options);
	},
	registerActions(...actions){
		if(this._actionableActionsInitialized) {
			ActionStore.registerActions(this, actions);
		} else {
			this._actionsWaitingForRegister || (this._actionsWaitingForRegister = []);
			this._actionsWaitingForRegister.push(...actions);
		}
	},
	hasAction(arg, options){
		let action = this.getAction(arg, options);
		return !!action;
	},
	getAction(arg, options){
		let actions = this.getActions(options);
		let iteratee = _.isString(arg) ? { name: arg } : { name: arg.name };
		return _.findWhere(actions, iteratee);
	},
	executeAction(action, ...rest){
		this._initializeActionableActions();
		return ActionStore.exec(this.actionsStoreName || this, action, this,  ...rest);
	},
}, { ActionableMixin: true });
