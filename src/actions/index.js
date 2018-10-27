import _ from 'underscore';

export { default as Action } from './action.js';
export { default as ActionStore } from './store.js';
export { default as actionableMixin } from './actionable-mixin.js';

export function action(name, label, action, options = {}){
	// args: {}
	if (!_.isFunction(name) && _.isObject(name)) {
		return name;
	} 
	// args: "", ()
	else if (_.isFunction(label)) {
		let o = { name, action: label };
		return _.extend(o, action);
	} 
	// args: (), {}
	else if (_.isFunction(name) && _.isObject(label)) {

		return _.extend({ action: name }, label);

	}
	// args: "", "", (), {}
	return _.extend({}, options, { name, label, action });
}
