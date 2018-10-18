import { View, CollectionView } from 'backbone.marionette';
import { mix } from 'bbmn-utils';
import { cssClassModifiersMixin, customsMixin, nextCollectionViewMixin, emptyFetchMixin, improvedIndexesMixin, destroyViewMixin } from 'bbmn-mixins';

const ExtView = mix(View).with(cssClassModifiersMixin, destroyViewMixin);
const ExtCollectionVIew = mix(CollectionView).with(customsMixin, nextCollectionViewMixin, emptyFetchMixin, improvedIndexesMixin, destroyViewMixin);
export {
	ExtView as View,
	ExtCollectionVIew as CollectionView
};
