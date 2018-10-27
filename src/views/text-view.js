import _ from 'underscore';
import { BackboneView } from 'bbmn-core';
import { triggerMethod } from 'bbmn-utils';
import { PropertySchema } from '../model-schemas';

export const TextView = BackboneView.extend({
	constructor(options = {}){
		this.options = options;
		let { text, isHtml = true, property } = options;
		this.setValue({ text, isHtml, preventRender: true });		
		BackboneView.apply(this, arguments);
		if (this.model && property) {
			let name;
			if(_.isString(property)) {
				name = property;
			} else if (property instanceof PropertySchema) {
				this.schema = property;
				name = property.name;
			}
			this.property = name;
			name && this.listenTo(this.model, 'change:' + name, this.onPropertyChange);
		}
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
		let text = this.text;
		if(!this.isHtml)
			text = _.escape(text);
		return text;
	},
	setNodeValue() {
		this.el.innerHTML = this.getValue();
	},
	onPropertyChange(){
		let value = this.getPropertyValue();
		this.setValue(value);
	},
	getPropertyValue(){
		let val = this.model.get(this.property);
		if (this.schema) {
			return this.schema.getDisplayValue(val, this.model);
		} else {
			return val;
		}
	},
	triggerMethod
});
