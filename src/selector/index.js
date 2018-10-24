import _ from 'underscore';

import { BaseClass, Events, isCollection } from 'bbmn-core';
import { Collection } from 'backbone';
import { mix, mergeOptions } from 'bbmn-utils';

const trueFilter = () => true;

const BaseSelector = mix(BaseClass).with(Events);

const Selector = BaseSelector.extend({
	constructor(options = {}){
		this.options = _.clone(options);
		mergeOptions.call(this, options, 'source', 'extractValue', 'sourceFilter');
		this._isMultiple = options.multiple === true;
		BaseSelector.apply(this, arguments);
		this._initializeSource();
		this._createCollections();
	},
	sourceFilter: trueFilter,
	setSourceFilter(filter){
		if (!_.isFunction(filter)) {
			filter = trueFilter;
		}
		if(filter != this.sourceFilter){
			this.sourceFilter = filter;
			this._updateAll();
		}
	},
	setSourceModels(models){
		this._updateAll(models);
	},
	getSourceModels(){
		return this.source.filter(this.sourceFilter);
	},
	_initializeSource(){
		if (!_.isObject(this.source)) {
			this.source = new Collection();
			return;
		} else if(isCollection(this.source)) {
			return;
		}		
		let models = _.map(this.source, (value, id) => ({ id, value }));
		this.source = new Collection(models);
		this.extractValue = model => model.get('id');
	},
	_createCollections(){
		let initialSelected = this.options.value || [];
		if(!_.isArray(initialSelected)) {
			initialSelected = [initialSelected];
		}
		let models = this.getSourceModels();
		this.all = new Collection(models);
		this.listenTo(this.source, 'update reset', this._updateAll);

		let selected = _.reduce(initialSelected, (memo, initial) => {
			let found = this.all.get(initial);
			if(found) {
				memo.push(found);
			}
			return memo;
		}, []);
		this.selected = new Collection(selected);
	},
	_updateAll(models){
		if(models == null) {
			models = this.getSourceModels();
		}
		this.all.set(models, { remove: true, add: true, merge: true});
	},

	isSelected(arg){
		return this.selected.has(arg);
	},	
	isMultiple(){
		return this._isMultiple;
	},
	getCount(){
		return this.selected.length;
	},
	getCollection(){
		return this.all;
	},
	getCollections(){
		return {
			collection: this.all,
			selected: this.selected
		};
	},

	_trigger(event, model, { silent, silentChange, changes } = {}){
		if (silent) { return; }
		let value = this.extractValue(model);
		this.trigger(event, value);
		if (!silentChange) {
			let mass = {
				[event]: [model]
			};
			if (changes && changes.unselected) {
				mass.unselected || (mass.unselected = []);
				mass.unselected.push(...changes.unselected);
			}
			if (changes && changes.selected) {
				mass.selected || (mass.selected = []);
				mass.selected.push(...changes.selected);
			}
			this._triggerChange(mass);
		}
	},
	_triggerChange({ selected = [], unselected = [] } = {}){
		if (selected.length + unselected.length) {
			this.trigger('change', { selected, unselected }, this.getCount());
		}
	},
	unselect(arg){		
		let model = this.all.get(arg);
		if(!model) return;
		return this._unselect(model);
	},
	_unselect(model, options){
		let exist = this.selected.has(model);
		if (!exist) return;
		let affected = this.selected.remove(model);
		this._trigger('unselected', model, options);
		return affected;
	},

	select(arg){
		let model = this.all.get(arg);
		if(!model) return;
		return this._select(model);
	},
	_select(model, options = {}){
		let exist = this.selected.has(model);
		if (exist) return;
		
		let affected;

		if (this.isMultiple()) {
			affected = this.selected.add(model);
		} else {
			let current = this.selected.first();
			let unselected = [];
			if (current == exist) { return; }

			if (current) {
				let uns = this._unselect(current, _.extend({}, options, { silentChange: false }));
				unselected.push(uns);
			}

			affected = this.selected.set(model, { remove: true, merge:true, add:true });
			options.changes || (options.changes = {});
			options.changes.unselected || (options.changes.unselected = []);
			options.changes.unselected.push(...unselected);
		}
		this._trigger('selected', model, options);
		return affected;
	},

	toggle(arg){
		let model = this.all.get(arg);
		if(!model) return;
		return this._toggle(model);
	},
	_toggle(model, options){
		let affected;
		let key;
		let result = { selected: [], unselected: [] };
		if(this.selected.has(model)){
			affected = this._unselect(model, options);
			key = 'selected';
		} 
		else {
			affected = this._select(model, options);
			key = 'unselected';
		}
		result[key].push(affected);
		return result;
	},

	_processRange(from, to, takeAction){
		from = this.all.get(from);
		to = this.all.get(to);
		if(!from || !to) return;
		let _toIndex = this.all.indexOf(to);
		let indexes = [this.all.indexOf(from), _toIndex];
		let fromIndex = _.min(indexes);		
		let toIndex = _.max(indexes);
		let processed = [];
		for(let x = fromIndex; x <= toIndex; x++){
			if(x === _toIndex) continue;

			let model = this.all.models[x];
			if(!model) continue;
			let affected = takeAction(model);
			processed.push(affected);
		}
		return processed;
	},

	selectRange(from, to) {
		let result = { selected: [], unselected: [] };
		let actionOptions = { silent: true };
		let action = model => {
			let affected = this._select(model, actionOptions);
			if (affected) {
				result.selected.push(affected);
			}
			return affected;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	unselectRange(from, to) {
		let result = { selected: [], unselected: [] };
		let actionOptions = { silent: true };
		let action = model => {
			let affected = this._unselect(model, actionOptions);
			if (affected) {
				result.unselected.push(affected);
			}
			return affected;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	toggleRange(from, to) {
		let result = { selected: [], unselected: [] };
		let actionOptions = { silent: true };
		let action = model => {
			let toggled = this._toggle(model, actionOptions);
			result.selected.push(...toggled.selected);
			result.unselected.push(...toggled.unselected);
			return toggled;
		};
		this._processRange(from, to, action);
		this._triggerChange(result);
		return result;
	},
	clear(){
		let result = {
			unselected: _.clone(this.selected.models),
		};
		this.selected.reset();
		this._triggerChange(result);
	},

	getValue(){
		let results = this.selected.map(model => this.extractValue(model));
		if (this.isMultiple()){
			return results;
		} 
		else {
			return results[0];
		}
	},
	extractValue(model) {
		return model;
	}

});





export default Selector;
