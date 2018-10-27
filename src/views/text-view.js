import { BackboneView } from 'bbmn-core';
import _ from 'underscore';
import { triggerMethod } from 'bbmn-utils';
export const TextView = BackboneView.extend({
	constructor(options = {}){
		this.options = options;
		let { text, isHtml = true, property } = options;
		this.setValue({ text, isHtml, preventRender: true });		
		BackboneView.apply(this, arguments);
		if (this.model && property) {
			this.property = property;
			this.listenTo(this.model, 'change:' + property, this.onPropertyChange);
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
		return this.model.get(this.property);
	},
	triggerMethod
});
