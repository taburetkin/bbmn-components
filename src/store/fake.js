import _ from 'underscore';
import { BaseClass } from 'bbmn-core';
const _disallowedKeys = ['setItem', 'key', 'getItem', 'removeItem', 'clear'];
const allowedKey = key => _disallowedKeys.indexOf(key) < 0;

const FakeStore = BaseClass.extend({
	constructor(){
		BaseClass.apply(this, arguments);
		this.store = {};
	},
	setItem(id, val) {
		if (!allowedKey(id)) return;
		return this.store[id] = String(val);
	},
	getItem(id) {
		if (!allowedKey(id)) return;
		return this.store[id];
	},
	removeItem(id) {
		if (!allowedKey(id)) return;
		delete this.store[id];
	},
	clear() {
		let keys = _(this).keys();
		_(keys).each(key => this.removeItem(key));
	}
});

export default FakeStore;
