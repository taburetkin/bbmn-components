import _ from 'underscore';
import { renderInNode, takeFirst } from 'bbmn-utils';
import ViewStack from '../view-stack';
import { CloseButtonView, ModalView, TextView } from './views';


export default {
	
	template: _.template(`
<div data-modal-bg></div>
<% if(shouldWrapContent) {%><div data-modal-content-wrapper><%} %>
<section data-modal-content></section>
<% if(shouldWrapContent) {%></div><%} %>
`),

	TextView,
	ModalView,
	CloseButtonView,

	buildView(options, showOptions = {}){

		let ModalView = takeFirst('ModalView', options, showOptions, this);
		let TextView = takeFirst('TextView', options, showOptions, this);
		let CloseButtonView = takeFirst('CloseButtonView', options, showOptions, this);		
		
		options = _.extend({ 
			TextView, 
			CloseButtonView,
			template: this.template,
		}, options);

		return new ModalView(options);
	},

	render(view, stack, options = {}){

		let el = _.result(this, 'container');
		if(el && el.jquery){
			el = el.get(0);
		}
		options = _.extend({ 
			el, replaceElement: true, destroyOnEmpty: true,			
		}, options);

		renderInNode(view, options);

		if (stack) {
			let { preventRemove } = options;
			stack.add(view, { preventRemove });
		}
	},
	container: () => document.querySelector('body'),
	stackOptions: {
		removeOnEsc: true,
		removeOnOutsideClick: true,
	},
	getStack(options){
		if (!this.stack) {
			let stackOptions = this.stackOptions || options;
			this.stack = new ViewStack(stackOptions);
		}
		return this.stack;
	}
};

