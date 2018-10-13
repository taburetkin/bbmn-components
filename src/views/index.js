import { View, CollectionView } from 'backbone.marionette';
import { mix } from 'bbmn-utils';
import { cssClassModifiersMixin, customsMixin, nextCollectionViewMixin, emptyFetchMixin, improvedIndexesMixin } from 'bbmn-mixins';

const ExtView = mix(View).with(cssClassModifiersMixin);
const ExtCollectionVIew = mix(CollectionView).with(customsMixin, nextCollectionViewMixin, emptyFetchMixin, improvedIndexesMixin);
export {
	ExtView as View,
	ExtCollectionVIew as CollectionView
};
