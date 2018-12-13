import _ from 'underscore';
import { betterResult, clone, isEmptyValue, toBool, getFlag } from 'bbmn-utils';
import Schema from './schema.js';


export default Schema.extend({
	constructor(options = {}){
		Schema.apply(this, arguments);
		let { name, property, modelSchema, order = 0 } = options;
		this.name = name;
		this.schema = _.extend({}, property);	
		this.modelSchema = modelSchema;
		if (this.schema.order != null)
			order = this.schema.order;
		this.order = order;
	},
	_getByKey(key, options = {}){
		let hash = betterResult(this.schema, key, { args: [options, {property:this,model:this.modelSchema}], default: {} });
		return clone(hash, { functions: true });
	},
	getValidation(options) {
		return this._getByKey('validation', options);
	},
	getType(options) {
		let type = this._getByKey('value', options);
		if(!('multiple' in type)) {
			type.multiple = false;
		}
		return type;
	},
	getDisplay(options){
		return this._getByKey('display', options);
	},
	getLabel(model){
		let label = this.getDisplay().label;
		return betterResult({ label },'label', { context: model || this, args: [model] });
	},
	getEdit(options = {}){
		let editOptions = this._getByKey('edit', options);
		if (editOptions === false) return false;
		let valueOptions = this.getType(options);
		let label = this.getLabel(options.model);
		let compiled = _.extend({ name: this.name, label, schema: this }, options, editOptions, { valueOptions });
		return compiled;
	},
	// accepts: value, model, options
	getDisplayValue(val, model, options = {}){

		_.defaults(options, { value: val, allValues: model && model.toJSON && model.toJSON(), model });
		let display = this.getDisplay(options);
		let type = this.getType(options);

		options = _.extend(options, { display, type, property: this });
		if (display) {
			
			if (_.isFunction(display.transform)) {
				val = display.transform.call(model, val, options);
			} else if (type.type == 'boolean' && type.sourceValues) {
				_.some(type.sourceValues, (label, key) => {
					if(toBool(key) === val) {
						val = label;
						return true;
					}
				});
			} else if (type.type == 'enum' && type.sourceValues) {
				let sourceValues = betterResult({ sourceValues: type.sourceValues }, 'sourceValues', { context: model, args:[ model ]});
				let result = getFlag(sourceValues, val);
				if(result)
					val = result;
			}

			if (isEmptyValue(val) && display.ifEmpty) {
				val = betterResult(display, 'ifEmpty', { context: model, args: [model, options] });
			} else if (!isEmptyValue(val) && display.ifNotEmpty) {
				val = display.ifNotEmpty;
			}
		}
		return val;
	},
	onPropertyChange(property, opts = {}){
		if (this.modelSchema) {
			this.modelSchema.triggerMethod('property:change', property, opts);
		}
	},
	getDependedOn(name){
		let depended = this.schema.dependOn;
		if (!depended) {
			depended = [];
		} else if (_.isString(depended)) {
			depended = depended.split(/\s*,\s*/g).map(name => ({ name }));
		} else if (!_.isArray(depended) && _.isObject(depended)) {
			depended = _.map(depended, (value, name) => {
				value.name = name;
				return value;
			});
		} else {
			depended = [];
		}
		if(!name)
			return depended;
		else 
			return _.findWhere(depended, { name });
	},
	isDependedOn(name){
		let depended = this.getDependedOn(name);
		return !!depended;
	},
	resetValues(opts = {}, depended = {}){
		let { model, allValues, silent } = opts;
		let dependedValue = allValues[depended.name];
		let value = betterResult(depended, 'value', { args:[ dependedValue, this.modelSchema && this.modelSchema.getProperty(depended.name) ]});
		if (model) {
			model.set(this.name, value, { silent });
		} else if(allValues) {
			allValues[this.name] = value;
		}
	}
});
