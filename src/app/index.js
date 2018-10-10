import _ from 'underscore';
import { BaseClass, Events, Region, isClass } from 'bbmn-core';
import { StartableMixin } from '../process/index.js';
import { mix, getOption, triggerMethod, buildViewByKey } from 'bbmn-utils';

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
	doOnResolve(promise, callback, ...args){
		return promise.then(() => {
			return callback.apply(this, args);
		});
	},
	renderLayout(options){
		if (!this.layoutView) {
			this.layoutView = this.buildLayout(options);
			if(!this.layoutView) { return; }
		}
		let region = this.getRegion();
		region.show(this.layoutView);
	},
	buildLayout(options){
		return buildViewByKey(this, 'layout', { options });
	},
	getRegion(){
		if (this._region) return this._region;
		this._region = this.buildRegion();
		return this._region;
	},
	buildRegion(){
		let region = this.getOption('region', { args: [this] }) || {};
		let el = this.getOption('appEl') || 'body';
		let replaceElement = true;
		let opts = { el, replaceElement };
		let RegionClass = Region;

		if (isClass(region, Region)) {
			RegionClass = region;
			region = {};
		} else if (_.isFunction(region)) {
			let runtime = region.call(this, this);
			if(isClass(runtime, Region)){
				RegionClass = runtime;
				region = {};
			} else {
				region = runtime;
			}
		}
		let options = _.pick(_.extend(opts, region), 'regionClass', 'el', 'replaceElement');

		if(isClass(options.regionClass, Region)){
			RegionClass = options.regionClass;
			delete options.regionClass;
		}

		return new RegionClass(options);
	},
});
