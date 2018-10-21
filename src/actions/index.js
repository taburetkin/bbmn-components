import _ from 'underscore';

export { default as Action } from './action.js';
export { default as ActionStore } from './store.js';
export { default as actionableMixin } from './actionable-mixin.js';

export function action(name, label, action, options = {}){
	return _.extend({}, options, { name, label, action });
}
