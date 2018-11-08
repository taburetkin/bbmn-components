import _ from 'underscore';
import { BackboneView } from 'bbmn-core';
import { triggerMethod, getOption } from 'bbmn-utils';


export const TextView = BackboneView.extend({
	displayInsteadGet: true,
	shouldEscapeValue: true,
	constructor(options = {}){
		this.options = options;
		let { text, value, shouldEscapeValue, property, schema, customValue } = options;
		if (!property && schema) {
			property = schema.name;
		}
		this.setValue(text || value, { shouldEscapeValue, preventRender: true });

		
		BackboneView.apply(this, arguments);
		if (this.model && property) {
			this.customValue = customValue;
			this.schema = schema;
			this.property = property;
			this.applyPropertyValue({ preventRender: true });
			property && this.listenTo(this.model, 'change:' + property, this.applyPropertyValue);
		}
	},
	getOption(){
		return getOption(this, ...arguments);
	},
	render(){
		this.setNodeValue();
	},
	setValue(value, opts = {}){
		
		this.value = value;
		let { preventRender, shouldEscapeValue } = opts;

		if(shouldEscapeValue != null){
			this.shouldEscapeValue = shouldEscapeValue;
		}

		if (!preventRender) {
			this.setNodeValue();
		}
	},
	getValue({ asIs, shouldEscapeValue } = {}){
		let value = this.value;
		if (asIs){
			return value;
		}
		
		if(!_.isString(value)) {
			value = value == null ? '' : value.toString();
		}

		if (shouldEscapeValue == null) {
			shouldEscapeValue = this.shouldEscapeValue;
		}

		if (shouldEscapeValue) {
			value = _.escape(value);
		}
		return value;
	},
	setNodeValue() {
		this.el.innerHTML = this.getValue();
	},
	applyPropertyValue(opts){
		let value = this.getPropertyValue();
		this.setValue(value, opts);
	},
	getPropertyValue(){
		
		if (_.isFunction(this.customValue)) {
			return this.customValue.call(this, this.property, this.model, this);
		}

		let val = this.model.get(this.property);
		let useDisplay = this.getOption('displayInsteadGet');
		if (useDisplay && this.schema) {
			return this.schema.getDisplayValue(val, this.model);
		} else {
			return val;
		}
	},
	triggerMethod,
	destroy(){
		this.off();
		this.stopListening();
		let keys = _.keys(this);
		_.each(keys, key => delete this[key]);
	}
});
