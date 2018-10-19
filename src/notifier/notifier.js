import { CollectionView } from '../views';
import { nextCollectionViewMixin } from 'bbmn-mixins';
import notifies from './notifies';
import childView from './notify-view';



const Notifier = nextCollectionViewMixin(CollectionView).extend({
	initialize(){
		this.setFilter(this.unviewedFilter, { preventRender: true });
		this.listenTo(this.collection, 'change:viewed', this.sort);
	},
	childView,
	collection: notifies,
	collectionEvents: {
		toggle() {
			let current = this.getFilter();
			if(current == this.allFilter) {
				this.setFilter(this.unviewedFilter, { preventRender: true });
			} else {
				this.setFilter(this.allFilter, { preventRender: true });
			}
			this.render();
		}
	},

	viewComparator(v1,v2){
		return v2.model.getDate() - v1.model.getDate();
	},
	allFilter(){
		return true;
	},
	unviewedFilter(v){
		return !v.model.isViewed();
	},
	childViewOptions(){
		return {
			mode: this.collection.mode
		};
	}
});


export default Notifier;
