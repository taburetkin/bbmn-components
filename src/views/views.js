import { View, CollectionView } from 'backbone.marionette';
import { mix } from 'bbmn-utils';
import { cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin, optionsMixin } from 'bbmn-mixins';


function _initializeRenderOnModelChange(){
	let romc = this.getOption('renderOnModelChange', { args: [this.model, this]});
	if (romc && this.model) {
		this.listenTo(this.model, 'change', () => this.render());
	}
}


const BaseView = mix(View)
	.with(
		optionsMixin, 
		cssClassModifiersMixin,
		{
			_initializeRenderOnModelChange
		}		
	);



const ExtView = BaseView.extend({
	constructor(){
		BaseView.apply(this, arguments);
		this._initializeRenderOnModelChange();
	},
});

const BaseCollectionVIew = mix(CollectionView)
	.with(
		optionsMixin, 
		cssClassModifiersMixin, 
		customsMixin, 
		emptyFetchMixin, 
		improvedIndexesMixin,
		{
			_initializeRenderOnModelChange
		}
	);

const ExtCollectionVIew = BaseCollectionVIew.extend({
	constructor(){
		BaseCollectionVIew.apply(this, arguments);
		this._initializeRenderOnModelChange();
	},
});

export {
	ExtView as View,
	ExtCollectionVIew as CollectionView
};
