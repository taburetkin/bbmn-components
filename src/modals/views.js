import _ from 'underscore';
import $ from 'jquery';

import { View, CollectionView } from '../views';
import { isViewClass, buildViewByKey, mix } from 'bbmn-utils';
import { destroyViewMixin } from 'bbmn-mixins';

export const CloseButtonView = View.extend({
	tagName: 'button',
	template: () => '<i></i>',
});

const ButtonView = View.extend({
	tagName:'button',
	template: _.template('<i></i><span><%= text %></span><i></i>'),
	triggers:{
		'click':'click'
	},
	templateContext(){
		return {
			text: this.getOption('text')
		};
	}
});


export const TextView = View.extend({
	template: _.template('<%= text %>'),
	templateContext(){
		return {
			text: this.getOption('text', { args: [ this ]})
		};
	}
});

const BaseModalView = mix(CollectionView).with(destroyViewMixin);

export const ModalView = BaseModalView.extend({
	constructor({ promise } = {}){
		BaseModalView.apply(this, arguments);
		if (promise) {
			this._isPromise = true;
			this.promise = new Promise((resolve, reject) => {
				this._resolve = resolve;
				this._reject = reject;
			});
		}
	},
	wrapContent: true,
	
	childViewContainer: '[data-modal-content]',
	renderAllCustoms: true,
	
	renderCollection: false,
	viewComparator: false,

	templateContext(){
		return {
			shouldWrapContent: this.getOption('wrapContent') === true,
		};
	},

	events:{
		'click'(event){
			if(this.getOption('preventRemove')) {
				return;
			}
			let $el = $(event.target);
			event.stopPropagation();
			if ($el.closest('[data-modal-content]').length) {
				return;
			}
			this.destroy();
		},
		'click [data-modal-close]'(event){
			event.stopPropagation();
			event.preventDefault();
			this.destroy();
		}
	},
	customs:[
		(v) => v.createCloseButton(),
		(v) => v.takeOptionsView('header'),
		(v) => v.takeOptionsView('content'),
		(v) => v.takeOptionsView('footer'),
	],
	createCloseButton(){
		if (this.getOption('closeButton') === false || this.getOption('preventRemove')) {
			return;
		}

		let Button = this.getOption('CloseButtonView');

		if (!isViewClass(Button)) {
			throw new Error('closeButtonView not defined, use `closeButton: false` or pass button view in options');
		}

		return new Button({ attributes: { 'data-modal-close':'' } });
	},
	defsOptionsForView(name, opts){
		let defs = {};
		if (name == 'footer' && this._isPromise) {
			defs = {
				resolve: this.getOption('confirmLabel'),
				rejectSoft: this.getOption('cancelLabel'),
			};
		}
		return _.extend({}, opts, defs);
	},
	takeOptionsView(key){
		let tagName = ['header','footer'].indexOf(key) > -1 ? key : 'div';
		let TextView = this.getOption('TextView');
		let options = this.defsOptionsForView(key,{ tagName });
		let view = buildViewByKey(this, key, { TextView, options });

		if(!view){
			if (this.getOption('promiseBar')) {
				view = new FooterView(options);
			}
		}

		!this.modalChildren && (this.modalChildren = {});
		this.modalChildren[key] = view;
		if (key === 'content') {
			this._initContentListeners(view);
		}
		if (this._isPromise && (key === 'footer' || key == 'content')) {
			this._initPromiseListeners(view);
		}
		return view;
	},
	_initPromiseListeners(view){
		this.listenTo(view, {
			'resolve': arg => this.resolve(arg),
			'reject': arg => this.reject(arg),			
		});
	},
	_initContentListeners(content){
		this.listenTo(content, {
			'destroy': () => this.destroy(),
			'done': () => this.destroy(),
		});
	},
	resolve(arg){
		this._resolve(arg);
		this.promiseState = 'fulfilled';
		if (!this._isDestroying && !this._isDestroyed){
			this.destroy();
		}
	},
	reject(arg){
		this._reject(arg);
		this.promiseState = 'rejected';
		if (!this._isDestroying && !this._isDestroyed){
			this.destroy();
		}
	},
	onDestroy(){
		if(this._isPromise && !this.promiseState) {
			this.reject();
		}
	},
	attributes:{
		'data-modal': ''
	},
});


export const FooterView = CollectionView.extend({
	renderAllCustoms: true,
	tagName:'footer',
	attributes:{
		'data-modal-content-footer':'confirm'
	},
	customs:[
		v => v.getResolveView(),
		v => v.getRejectView(),
	],
	getResolveView(){
		let text = this.getOption('resolveText');
		let view = new ButtonView({
			text,
			onClick: () => this.triggerClick(true)
		});
		return view;
	},
	getRejectView(){
		let text = this.getOption('rejectText');
		let view = new ButtonView({
			text,
			onClick: () => this.triggerClick(false)
		});
		return view;
	},
	triggerClick(resolve){
		let event = resolve ? 'resolve' : 'reject';
		let arg = this.getOption(event + 'With');
		this.trigger(event, arg);
	}
});
