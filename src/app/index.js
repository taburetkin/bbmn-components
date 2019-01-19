import _ from 'underscore';
import { BaseClass, Events, Region, isClass } from 'bbmn-core';
import { startableMixin } from '../process/index.js';
import { mix, getOption, triggerMethod, buildViewByKey } from 'bbmn-utils';

const BaseApp = mix(BaseClass).with(Events, startableMixin);

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
				return item.call(this, this);
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
	isRendered(){
		return this.layoutView && this.layoutView.isRendered();
	},
	render(){
		this.triggerMethod('before:layout:ready');
		this.renderLayout();
		this.triggerMethod('layout:ready');
	},
	renderLayout(options){
		if (!this.layoutView) {
			let layout = this.buildLayout(options);
			if(!layout) { return; }
			let region = this.getRegion();
			region.show(layout);

			this.layoutView = layout;
		}
		return this.layoutView;
	},
	buildLayout(options){
		return buildViewByKey(this, 'layout', { options });
	},
	getRegion(){
		if (this._region) return this._region;
		this._region = this.buildRegion();
		return this._region;
	},
	_buildRegion(region, options){
		if (region == null) {
			return new Region(options);
		} else if (isClass(region, Region)) {
			return new region(options);
		} else if (_.isFunction(region)) {
			return this._buildRegion(region.call(this, this), options);
		} else if (_.isObject(region)) {
			let RegionClass = region.regionClass || Region;
			let newOptions = _.extend({}, _.omit(region, 'regionClass'));
			if(!newOptions.el) {
				newOptions.el = options.el;
			}
			if(newOptions.replaceElement == null) {
				newOptions.replaceElement = options.replaceElement;
			}
			return new RegionClass(newOptions);
		}
	},
	buildRegion(){
		let el = this.getOption('appEl') || 'body';
		let opts = { el, replaceElement: true };
		return this._buildRegion(this.getOption('region', { args: [this] }), opts);
	},
});
