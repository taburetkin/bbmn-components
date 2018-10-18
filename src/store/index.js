import _ from 'underscore';
import { session, local } from './store.js';

const getStore = (opts = {}) => opts.local === true ? local : session;

const SECONDS = 1000;
const MINUTES = SECONDS * 60;
const HOURS = MINUTES * 60;
const DAYS = HOURS * 24;

var store = {

	_normalizeValue(value) {
		var normValue = value;
		if (_.isObject(value) && _.isFunction(value.toJSON))
			normValue = value.toJSON();
		if (_.isDate(value) && !_.isNaN(value.valueOf()))
			normValue = 'date(' + normValue + ')';
		return normValue;
	},

	_createItem(value, expireAt) {
		return { expireAt: expireAt, value: value };
	},

	jsonParse(key, value) {
		var datePattern = /^date\((\d{4,4}-\d{2,2}-\d{2,2}([T\s]\d{2,2}:\d{2,2}:\d{2,2}(\.\d*)?Z?)?)\)$/;
		if (_.isString(value) && datePattern.test(value)) {
			var textDate = value.replace(datePattern, '$1');
			return new Date(textDate);
		}
		return value;
	},
	_jsonParse(key, value, context) {
		if (!key) return value;
		return this.jsonParse(key, value, context);
	},
	_parse(raw) {
		let _this = this;
		let item = JSON.parse(raw, function (key, value) { return _this._jsonParse(key, value, this); });
		if ('expireAt' in item && 'value' in item)
			return item;
		else
			return this._createItem(item, 0);
	},
	_get(key, opts) {
		let raw = getStore(opts).getItem(key);
		if (raw == null) return;
		return this._parse(raw);
	},
	get(key, opts = {}) {

		let { checkExpire = true } = opts;

		let item = this._get(key, opts);		
		if (item == null) return;

		let expired = this._isExpired(item);
		if (!expired || !checkExpire) {

			return item.value;
		}
		else if (expired) {
			this.remove(key, opts);
		}
	},
	set(key, value, opts = {}) {

		let expireAt = Date.now() + this.getExpireAt(opts);
		let normValue = this._normalizeValue(value);
		let item = this._createItem(normValue, expireAt);
		this._set(key, item, opts);
		
	},
	remove(key, opts) {
		getStore(opts).removeItem(key);
	},
	expire(key, opts) {
		let item = this._get(key, opts);
		if (!item) return;
		item.expireAt = 0;
		this._set(key, item, opts);
	},
	getExpireAt ({ expireAt, seconds, minutes, hours, days }) {
		if (expireAt != null)
			return expireAt;

		let offset = 0;

		_.isNumber(seconds) && (offset += seconds * SECONDS);
		_.isNumber(minutes) && (offset += minutes * MINUTES);
		_.isNumber(hours) && (offset += hours * HOURS);
		_.isNumber(days) && (offset += days * DAYS);

		offset === 0 && (offset += 10 * MINUTES);

		return offset;
	},
	_set(key, item, opts) {
		let text = JSON.stringify(item);
		getStore(opts).setItem(key, text);
	},
	isExpired(key, opts) {
		let item = this._get(key, opts);
		if (item == null) return true;
		return this._isExpired(item);
	},
	_isExpired(item) {
		return item.expireAt < Date.now();
	},
};

export default store;
