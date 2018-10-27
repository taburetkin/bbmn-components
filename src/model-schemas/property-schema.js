import _ from 'underscore';
import { betterResult, clone, isEmptyValue, toBool } from 'bbmn-utils';
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
	getLabel(value, allValues){
		let label = this.getDisplay().label;
		return betterResult({ label },'label', { args: [value, allValues] });
	},
	getEdit(options = {}){
		let valueOptions = this.getType(options);
		let editOptions = this._getByKey('edit', options);
		let label = this.getLabel(options.value, options.allValue);
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
			} else if (type.type == 'boolean' && type.valueSource) {
				_.some(type.valueSource, (label, key) => {
					if(toBool(key) === val) {
						val = label;
						return true;
					}
				});
			}

			if(isEmptyValue(val) && display.ifEmpty) {
				val = display.ifEmpty;
			}
		}
		return val;
	}
});
