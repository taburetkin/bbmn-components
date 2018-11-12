
import _ from 'underscore';
import { isView, takeFirst } from 'bbmn-utils';

export const initSelectorMixin = Base => Base.extend({
	constructor(){
		Base.apply(this, arguments);
		this._initializeSelector();
	},
	getSelector(){
		return this.getOption('selector');
	},
	_initializeSelector(){
		if (this._selectorMixinInitialized) return;
		let selector = this.getSelector();
		if(selector){
			this._setupSelectorListeners(selector);
			this._setupChildViewOptions(selector);
		}
		this._selectorMixinInitialized = true;
	},
	_setupSelectorListeners(selector){
		this.listenTo(selector, 'change', changes => {
			_.invoke(changes.selected, 'trigger', 'change');
			_.invoke(changes.unselected, 'trigger', 'change');
		});

		this.on('before:add:child', (colV, view) => {
			this.listenTo(view, 'toggle:select', this._handleChildviewToggleSelect);
		});
	},
	_setupChildViewOptions(selector, addOptions){
		if(!selector) return;

		let opts = takeFirst('childViewOptions', this.options, this);
		let selectorOptions = {
			selectable: true,
			onCheckSelect(){
				return selector.isSelected(this.model);
			}
		};
		let options;
		if(_.isFunction(opts)) {
			options = (...args) => {
				let compiled = opts.call(this, ...args);
				return _.extend({}, compiled, selectorOptions, addOptions);
			};
		} else {
			options = _.extend({}, opts, selectorOptions, addOptions);
		}
		this.childViewOptions = options;
	},
	_handleChildviewToggleSelect(arg1, arg2) {
		let event = isView(arg1) ? arg2 : arg1;
		let view = isView(arg1) ? arg1 : arg2;
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
