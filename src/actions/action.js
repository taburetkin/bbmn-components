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
			return actionMethod.apply(instance, args);
		}
		else {
			return actionInstance.onActionMissing(instance);
		}
	};
}


const Action = BaseClass.extend({
	constructor(options = {}){
		let { name, action } = options;
		this.options = _.omit(options, 'name', 'callback');
		this.name = name;
		this.exec = createExec(this, action);
	},
	getOption(key){
		return getByPath(this.options, key);
	},
	getLabel(){ return this.label || this.name; },
	getAction() {
		return this._action;
	},

	is (arg) { return this == arg || this.name == arg; },
	isVisible () { return this.hidden !== true; },
	isNotAllowed () { },
	onExecuteNotAllowed () { },
	onActionMissing () { },
	toModel(){
		return new Model({ id: this.name, label: this.getLabel() }, { action: this });
	}
});

export default Action;
