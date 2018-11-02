import { View, CollectionView } from 'backbone.marionette';
import { mix } from 'bbmn-utils';
import { cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin, optionsMixin } from 'bbmn-mixins';

const ExtView = mix(View)
	.with(
		optionsMixin, 
		cssClassModifiersMixin
	);

const ExtCollectionVIew = mix(CollectionView)
	.with(
		optionsMixin, 
		cssClassModifiersMixin, 
		customsMixin, 
		emptyFetchMixin, 
		improvedIndexesMixin
	);

export {
	ExtView as View,
	ExtCollectionVIew as CollectionView
};
