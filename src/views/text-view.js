import _ from 'underscore';
import { BackboneView } from 'bbmn-core';
import { triggerMethod, getOption } from 'bbmn-utils';


export const TextView = BackboneView.extend({
	displayInsteadGet: true,
	constructor(options = {}){
		this.options = options;
		let { text, isHtml = true, property, schema, customValue } = options;
		this.setValue({ text, isHtml, preventRender: true });

		
		BackboneView.apply(this, arguments);
		if (this.model && property) {
			this.customValue = customValue;
			this.schema = schema;
			this.property = property;
			this.applyPropertyValue();
			name && this.listenTo(this.model, 'change:' + name, this.applyPropertyValue);
		}
	},
	getOption(){
		return getOption(this, ...arguments);
	},
	render(){
		this.setNodeValue();
	},
	setValue(value, opts = {}){

		if(opts === true || opts == null) {
			opts = { isHtml: true };
		}
		if(_.isObject(value)) {
			opts = _.extend(opts, value);
		} else {
			opts.text = value;
		}
		let { preventRender } = opts;
		let newvalue = _.pick(opts, 'text', 'isHtml');
		_.extend(this, newvalue);

		if (!preventRender) {
			this.setNodeValue();
		}
	},
	getValue(){
		let text = this.text == null ? '' : this.text;
		if(!this.isHtml)
			text = _.escape(text);
		return text;
	},
	setNodeValue() {
		this.el.innerHTML = this.getValue();
	},
	applyPropertyValue(){
		let value = this.getPropertyValue();
		this.setValue(value);
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
	triggerMethod
});
