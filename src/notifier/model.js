import _ from 'underscore';
import { Model } from 'bbmn-core';

const NotifyModel = Model.extend({
	constructor(){
		Model.apply(this, arguments);
		if(!_.isDate(this.get('date')))
			this.set('date', new Date(), { silent: true });	

		this._setupDelays();		
	},
	_setupDelays(){
		this.on('change:viewedDelay', () => this._setDelay('viewed'));
		this.on('change:removedDelay', () => this._setDelay('removed'));
		this._setDelay('viewed');
		this._setDelay('removed');
		this.on('destroy', () => {
			this._clearTimeout('viewed');
			this._clearTimeout('removed');
		});
	},
	_clearTimeout(name){
		let timeoutKey = name + 'Timeout';
		clearTimeout(this[timeoutKey]);
	},
	_setTimeout(name){
		let delay = this.get(name + 'Delay');
		if (!_.isNumber(delay)) { return; }
		let timeoutKey = name + 'Timeout';
		this[timeoutKey] = setTimeout(() => {
			this[name]();
		}, delay * 1000);
	},
	_setDelay(name){
		this._clearTimeout(name);
		this._setTimeout(name);
	},


	//we need to use id but there is no any endpoint behind
	isNew(){
		return true;
	},
	isViewed(){
		return this.get('viewed') === true;
	},
	setViewed(){
		if (this.get('store') === false) {
			this.removed();
		} else {
			this.set({
				viewed:true,
				viewedDelay: undefined
			});
		}
	},	
	getDate(){
		return this.get('date');
	},
	removed(){
		this.trigger('removed');
	},
	viewed(){
		this.trigger('viewed');
	},
	getType(){
		return this.get('type');
	},
	getName(){
		return this.get('name');
	}
});

export default NotifyModel;
