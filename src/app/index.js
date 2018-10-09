import _ from 'underscore';
import { BaseClass, Events } from 'bbmn-core';
import { StartableMixin } from '../process/index.js';
import { mix, getOption, triggerMethod } from 'bbmn-utils';

const BaseApp = mix(BaseClass).with(Events, StartableMixin);

export default BaseApp.extend({
	constructor(options = {}){
		this.options = _.clone(options);
		this._startPromises = [];
		BaseApp.apply(this, arguments);
		this.initialize(options);
		this.triggerMethod('initialize', options);	
	},
	triggerMethod,
	getOption(){
		return getOption(this, ...arguments);
	},
	getStartPromises(){
		
		if(!this._startPromises) {
			return;
		}

		return _.map(this._startPromises, item =>{
			if (_.isFunction(item)) {
				return item.call(this);
			} else {
				return item;
			}
		});
	},
	addStartPromise(...args){
		this._startPromises.push(...args);
	},
	initialize:() => {},
});
