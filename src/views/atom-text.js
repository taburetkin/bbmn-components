import _ from 'underscore';
import { View } from './views';
import { isEmptyValue } from 'bbmn-utils';

const templates = {
	default: _.template('<span><%= _v.getText() %></span>'),
	small: _.template('<small><%= _v.getText() %></small>'),
	labeledText: _.template('<label><%= _v.getHeader() %></label><span><%= _v.getText() %></span><% if(_v.hasSmallText()){ %><small>_v.getSmallText()</small><% } %>'),
	full: _.template('<% if(_v.hasTopText()){ %><i><%= _v.getTopText() %></i><% } %><span><%= _v.getText() %></span><% if(_v.hasSmallText()){ %><small><%= _v.getSmallText() %></small><% } %><% if(_v.hasBottomText()){ %><b><%= _v.getBottomText() %></b><% } %>')
};
const AtomText = View.extend({
	autodetectTemplate: true,
	constructor(){
		View.apply(this, arguments);
		this.addCssClassModifier(
			'atom-text',
			(m,v) => 'atom-' + v.getType()
		);		
	},
	_hasAnyProperty(...properties){
		return _.some(properties, prop => {
			return (!!this[prop] || this.options[prop]);
		});
	},
	isFull(){
		return this.getOption('type') == 'full' || this._hasAnyProperty('topText','bottomText');
	},
	isSmall(){
		return this.getOption('type') == 'small';
	},
	isLabeledText(){
		return this.getOption('type') == 'labeledText' || this._hasAnyProperty('header');
	},
	getType(){
		let type = this.getOption('type') || 'default';
		if(type != 'default') { return type; }
		if(this.getOption('autodetectTemplate')) {
			if (this.isFull()) {
				return 'full';
			} else if (this.isLabeledText()){
				return 'labeledText';
			}
		}
		return type;
	},
	getTemplate(){
		let type = this.getType();
		return templates[type];
	},
	_getText(key){
		return this.getOption(key, { args: [ this.model, this ] });
	},

	hasHeader(){
		return !isEmptyValue(this.getHeader());
	},
	getHeader(){ return this._getText('header'); },

	hasTopText(){
		return !isEmptyValue(this.getTopText());
	},
	getTopText(){ return this._getText('topText'); },

	getText(){ return this._getText('text'); },

	hasSmallText(){
		return !isEmptyValue(this.getSmallText());
	},
	getSmallText(){ return this._getText('smallText'); },

	hasBottomText(){
		return !isEmptyValue(this.getBottomText());
	},	
	getBottomText(){ return this._getText('bottomText'); },

	templateContext(){
		return {
			_v: this,
		};
	}
}, {
	small(arg1, arg2){
		let defs = { type: 'small' };
		let uopts = {};
		if(_.isString(arg1) || !arg1) {
			defs.text = arg1;
			uopts = arg2;
		} else {
			uopts = arg1;
		}
		return new AtomText(_.extend({}, uopts, defs));
	},
	byModel(model, options){
		let keys =  ['header', 'topText', 'text', 'smallText', 'bottomText'];
		let values = _.reduce(keys,(memo, key) => {
			if(model.has(key) && !isEmptyValue(model.get(key))) {
				memo[key] = model.get(key);
			}
			return memo;
		}, {});
		return new AtomText(_.extend({}, values, options));
	}
});

export default AtomText;
