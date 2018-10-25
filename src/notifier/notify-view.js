import _ from 'underscore';
import { CollectionView, View, AtomTextView } from '../views';


const IconView = View.extend({
	constructor(){
		View.apply(this, arguments);
		this.addCssClassModifier('icon');
	},
	template: _.template('<i></i>'),	
});

const IconButtonView = View.extend({
	tagName: 'button',
	constructor(){
		View.apply(this, arguments);
		this.addCssClassModifier('icon-btn');
	},
	template: _.template('<i></i>'),	
});


const NotifyView = CollectionView.extend({
	renderAllCustoms: true,
	cssClassModifiers:[
		() => 'notify',
		m => m.getType(),		
		m => m.getName(),
		m => m.isViewed() ? 'viewed' : 'not-viewed',
		m => m.wasShown ? '' : 'accent'
	],
	customs:[
		(v) => v.getTypeView(),
		(v) => v.getMessageView(),
		(v) => v.getStateView()
	],
	events:{
		'click .state':'changeModelState'
	},
	modelEvents:{
		'viewed': 'markAsViewed',
		'removed': 'destroyModel',
		'change:text': 'render',
	},
	changeModelState(){
		if(this.model.isViewed()) {
			this.destroyModel();
		} else {
			this.markAsViewed();
		}
	},
	destroyModel(){
		this.disappear().then(() => this.model.destroy());
	},
	markAsViewed(){
		if (this.getOption('mode') != 'all') {
			this.disappear().then(() => this.model.setViewed());
		} else {
			this.model.setViewed();
		}
	},
	disappear() {
		let promise = new Promise((resolve) => {
			if(this.isAttached()) {
				this.$el.animate({
					height: 'toggle',
					width: 'toggle',
				}, 500, resolve);
			} else {
				resolve();
			}
		});
		return promise;		
	},	
	onBeforeAttach(){
		this.$el.attr('style','');
	},
	onBeforeRender(){
		this.dismissAccent = false;
	},
	onRender(){
		if(!this.model.wasShown) {
			setTimeout(() => {
				this.model.wasShown = true;
				this.refreshCssClass();
			}, 2000);
		}
	},

	getTypeView(){
		return new IconView({ className: 'type-icon' });
	},
	getMessageView(){
		return AtomTextView.byModel(this.model, { className: 'message' });
	},
	getStateView(){
		return new IconButtonView({ className: 'state' });
	},



});

export default NotifyView;
