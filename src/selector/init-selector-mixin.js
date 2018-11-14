
import _ from 'underscore';
import { isView } from 'bbmn-utils';

export const initSelectorMixin = Base => Base.extend({
	constructor(){
		Base.apply(this, arguments);
		this._initializeSelector();
	},
	getSelector(){
		return this.getOption('selector');
	},	
	buildChildView(child, ChildViewClass, childViewOptions = {}){
		let selector = this.getSelector();
		if(selector) {
			_.extend(childViewOptions, {
				selectable: true,
				onCheckSelect(){
					return selector.isSelected(this.model);
				}
			});
		}
		let view = Base.prototype.buildChildView(child, ChildViewClass, childViewOptions);
		if (view.addCssClassModifier) {
			view.addCssClassModifier(m => selector.isSelected(m) ? 'selected' : '');
		}
		this.listenTo(view, 'toggle:select', this._handleChildviewToggleSelect);
		return view;
	},
	_initializeSelector(){
		if (this._selectorMixinInitialized) return;
		let selector = this.getSelector();
		if(selector){
			this.listenTo(selector, 'change', changes => {
				_.invoke(changes.selected, 'trigger', 'change');
				_.invoke(changes.unselected, 'trigger', 'change');
				this.triggerMethod('selector:change');
			});
		}
		this._selectorMixinInitialized = true;
	},
	_handleChildviewToggleSelect(arg1, arg2) {
		let event = isView(arg1) ? arg2 : arg1;
		let view = isView(arg1) ? arg1 : arg2;
		event.stopPropagation();
		
		let selector = this.getSelector();
		if (!selector.isMultiple() || !this.lastClickedModel || !event.shiftKey) {
			this.lastClickedModel = view.model;
			selector.toggle(view.model);
		} else {
			let lastclicked = this.lastClickedModel;
			delete this.lastClickedModel;
			selector.toggleRange(view.model, lastclicked);
		}
	}
});
