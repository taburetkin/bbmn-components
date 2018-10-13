import _ from 'underscore';
import { isEmptyValue as isEmpty } from 'bbmn-utils';

const rules = [
	{
		name: 'required',
		message: 'required',
		validate: (value) => {
			if (isEmpty(value)) {
				return 'required';
			}
		}
	},
	{
		name: 'email',
		message: 'not a email',
		validate: (value) => {
			
			if(isEmpty(value)) { return; }

			if (!_.isString(value)) {
				return 'type:mismatch';
			}

			let chunks = value.split('@');
			let left = chunks[0];
			let right = chunks[1];
		
			if(
				chunks.length != 2
				|| !/^[a-z0-9\-_.+]+$/gmi.test(left)
				|| !/^[a-z0-9\-_]+\.[a-z0-9\-_]+(\.[a-z0-9\-_]+)*$/gmi.test(right)
			) {
				return 'pattern:mismatch';
			} else {
				return;
			}
		}
	},
	{
		name:'valueIn',
		message: 'given value is not one of allowed values',
		validate: (value, { valueIn } = {}) => {
			if(_.isArray(valueIn) && valueIn.indexOf(value) === -1) {
				return 'value:not:in';
			}
		}
	},
	{
		name:'valueNotIn',
		message: 'given value is one of forbiden values',
		validate: (value, { valueNotIn } = {}) => {
			if(_.isArray(valueNotIn) && valueNotIn.indexOf(value) > -1) {
				return 'value:in';
			}
		}
	},
	{
		name:'shouldBeEqual',
		message: 'given value is not equal',
		validate: (value, { shouldBeEqual, allValues } = {}) => {
			
			let compare = _.isFunction(shouldBeEqual) 
				? shouldBeEqual(allValues) 
				: shouldBeEqual;

			if (value !== compare) {
				return 'value:not:equal';
			}
		}
	},	
	{
		name:'shouldNotBeEqual',
		message: 'given value is forbiden',
		validate: (value, { shouldNotBeEqual, allValues } = {}) => {

			let compare = _.isFunction(shouldNotBeEqual) 
				? shouldNotBeEqual(allValues) 
				: shouldNotBeEqual;

			if (value !== compare) {
				return 'value:equal';
			}


			if(_.isFunction(shouldNotBeEqual)) {
				return value !== shouldNotBeEqual(allValues);
			} else {
				return value !== shouldNotBeEqual;
			}
		}
	},
	{
		name:'minLength',
		message: ({ ruleValue } = {}) => 'length is less than ' + ruleValue,
		validate: (value, { minLength } = {}) => {
			if (_.isNumber(minLength) && (value || '').toString().length < minLength) {
				return 'min:length';
			}
		}
	},
	{
		name:'maxLength',
		message: ({ ruleValue } = {}) => 'length is greater than ' + ruleValue,
		validate: (value, { maxLength } = {}) => {
			if (_.isNumber(maxLength) && (value || '').toString().length > maxLength) {
				return 'max:length';
			}
		}
	},
	{
		name:'minValue',
		message: ({ ruleValue } = {}) => 'value is less than ' + ruleValue,
		validate: (value, { minValue } = {}) => {
			if (_.isNumber(minValue)) {
				let numValue = parseFloat(value, 10);
				if (isEmpty(numValue) || numValue < minValue) {
					return 'min:value';
				}
			}
		}
	},
	{
		name:'maxValue',
		message: ({ ruleValue } = {}) => 'value is greater than ' + ruleValue,
		validate: (value, { maxValue } = {}) => {
			if (_.isNumber(maxValue)) {
				let numValue = parseFloat(value, 10);
				if (isEmpty(numValue) || numValue > maxValue) {
					return 'max:value';
				}
			}			
		}
	},
	{
		name:'pattern',
		message: 'value is not in pattern',
		validate: (value, { pattern } = {}) => {
			value = (value || '').toString();

			if(_.isString(pattern) && !isEmpty(pattern)) {
				pattern = new RegExp(pattern);
			}
			if(!_.isRegExp(pattern)) { return; }

			if (!pattern.test(value)) {
				return 'pattern';
			}
		}
	},
	{
		name: 'validate',
		validate: (value, options = {}) => {
			let { ruleValue } = options;
			if(!_.isFunction(ruleValue)) return;
			return ruleValue(value, options);
		},
	},	
];

reIndex(false);

export function reIndex(sortBefore = true) {
	if (sortBefore) {
		rules.sort((a,b) => a.index - b.index);
	}
	_.each(rules, (rule, index) => {
		rule.index = index;
	});
}

export default rules;
