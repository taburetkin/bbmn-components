import _ from 'underscore';
import rules from './rules.js';
import { isEmptyValue } from 'bbmn-utils';

function normalizeValidationContext(context){
	if (context === 'required') {
		return { required: true };
	} else if(_.isFunction(context)) {
		return { validate: context };
	} else if(_.isObject(context)) {
		return context;
	}
}

function getRuleContexts(rule = {}){
	let founded = _.reduce(rule, (taken, ruleValue, name) => {
		let found = _.findWhere(rules, { name });
		if(!found) return taken;

		let message = rule[name + 'Message'];
		taken.push({
			rule: found,
			ruleValue,
			message,
			index: found.index
		});

		return taken;

	}, []);
	founded.sort((a,b) => a.index - b.index);
	return founded;
}

function check(value, ruleContext = {}) {
	
	let { rule = {}, ruleValue, allValues, errors = [] } = ruleContext;
	if (rule.skipIfInvalid && errors.length) {
		return Promise.reject();
	}
	let message = ruleContext.message || rule.message;
	let buildMessage = _.isFunction(message) ? message : ({ error } = {}) => isEmptyValue(message) ? error : message;

	let validate = rule.validate;
	let validateOptions = {
		ruleName: rule.name,
		ruleValue,
		[rule.name]: ruleValue,
		allValues,
		message: buildMessage({ value, allValues, ruleValue }),
		errors,
	};
	if (!_.isFunction(validate)) return Promise.resolve(value);

	
	let result = validate(value, validateOptions);

	if (!result) {
		return Promise.resolve(value);
	} else if(result && _.isFunction(result.then)) {
		return result.then(
			() => Promise.resolve(value),
			(error) => Promise.reject(buildMessage({ error, value, allValues, ruleValue }))
		);
	} else {
		return Promise.reject(buildMessage({ error: result, value, allValues, ruleValue }));
	}
}



export default function validate(value, rule, { allValues = {} } = {}){
	rule = normalizeValidationContext(rule);
	let contexts = getRuleContexts(rule);
	

	return new Promise((resolve, reject) => {
		let errors = [];

		let rulesPromise = _.reduce(contexts, (promise, ruleContext) => {

			promise = promise.then(() => {
				return check(value, _.extend({}, ruleContext, { allValues, errors }));
			}).catch(error => {
				if(error != null)
					errors.push(error);
			});

			return promise;

		}, Promise.resolve(value));

		rulesPromise.then(() => {
			if(errors.length){
				reject(errors);
			} else {
				resolve(value);
			}
		});

	});
}



