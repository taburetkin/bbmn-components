import _ from 'underscore';
import { BaseClass, Model } from 'bbmn-core';
import { getByPath } from 'bbmn-utils';

function createExec(actionInstance, actionMethod){
	return function exec(instance, ...args){
		let decline = actionInstance.isNotAllowed(instance, args);
		if (decline) {
			return actionInstance.onExecuteNotAllowed(instance, decline, args);
		}
		
		if (_.isFunction(actionMethod)) {
			return instance ? actionMethod.apply(instance, args) : actionMethod(...args);
		}
		else {
			return actionInstance.onActionMissing(instance);
		}
	};
}


const ActionModel = Model.extend({
	constructor(attrs, options = {}){
		_.extend(this, _.pick(options, 'action','instance', 'order'));
		Model.apply(this, arguments);
	},
	defaults: {
		name: undefined,
		label: undefined,
		order: 0,
	},
	exec(){
		if (!this.action) {
			throw new Error('no action under the hood');			
		}
		if(!this.instance) {
			throw new Error('no instance defined');
		}
		return this.action.exec(this.instance, ...arguments);
	}
});


const instanceProperties = ['name', 'label', 'order', 'hidden'];

const Action = BaseClass.extend({
	constructor(options = {}){
		let { action } = options;
		delete options.action;

		_.extend(this, _.pick(options, ...instanceProperties));

		this.options = _.omit(options, ...instanceProperties);

		this.exec = createExec(this, action);
	},

	getOption(key){
		return getByPath(this.options, key);
	},

	getLabel(){ return this.label || this.name; },

	is (arg) { return this == arg || this.name == arg; },
	isVisible () { return this.hidden !== true; },
	isHidden () { return this.hidden == true; },
	
	isNotAllowed () { },
	onExecuteNotAllowed () { },
	onActionMissing () { },

	toModel(instance, attrs) {
		// if (instance == null)  {
		// 	throw new Error('instance undefined and action model must have one');
		// }
		let hash = _.extend({
			id: this.name, 
			label: this.getLabel(), 
			order: this.order 
		}, attrs);

		let options =  { 
			action: this, 
			order: this.order,
			instance
		};

		return new ActionModel(hash, options);
	}
});

export default Action;
