import { View, CollectionView } from 'backbone.marionette';
import { mix, getOption, mergeOptions } from 'bbmn-utils';
import { cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin } from 'bbmn-mixins';

const common = {
	getOption(){
		return getOption(this, ...arguments);
	},
	mergeOptions,
};

const ExtView = mix(View).with(cssClassModifiersMixin, common);

const ExtCollectionVIew = mix(CollectionView).with(cssClassModifiersMixin, customsMixin, emptyFetchMixin, improvedIndexesMixin, common);

export {
	ExtView as View,
	ExtCollectionVIew as CollectionView
};
