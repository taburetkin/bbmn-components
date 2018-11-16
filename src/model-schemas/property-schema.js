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
		let hash = betterResult(this.schema, key, { args: [options], default: {} });
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
		let display = this.getDisplay();
		let type = this.getType();
		options = _.extend({ model, display, type, property: this });
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
				let sourceValues = betterResult({ sourceValues }, 'sourceValues', { context: model, args:[ model ]});
				let result = getFlag(type.sourceValues, val);
				if(result)
					val = result;
			}

			if(isEmptyValue(val) && display.ifEmpty) {
				val = display.ifEmpty;
			}
		}
		return val;
	}
});
