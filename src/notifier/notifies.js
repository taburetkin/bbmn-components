
import { Collection } from 'bbmn-core';
import Model from './model';

const Notifies = Collection.extend({
	model: Model,
	hasNotViewed(){
		let counts = this.getCount();
		return !!counts.notViewed;
	},
	getCount(){
		return this.reduce((memo, model) => {
			memo.total++;
			if(model.isViewed())
				memo.viewed++;
			else
				memo.notViewed++;

			return memo;
		}, { total: 0, viewed: 0, notViewed: 0});
	},
	getCountAsText(){
		let counts = this.getCount();
		if(!counts.total) {
			return '';
		}
		return counts.notViewed + '/' + counts.total;
	},
	toggle(){
		this.mode = this.mode != 'all' ? 'all' : 'notViewed';
		this.trigger('toggle', this.mode);
	}

});

export default new Notifies([]);
