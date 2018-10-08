import { BaseClass, Events } from 'bbmn-core';
import { StartableMixin } from '../process/index.js';
import { mix } from 'bbmn-utils';

const BaseApp = mix(BaseClass).with(Events, StartableMixin);

export default BaseApp.extend({
	constructor(){
		BaseApp.apply(this, arguments);
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
	}
});
