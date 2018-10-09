import _ from 'underscore';

export function isPromisable(arg){
	return arg instanceof Promise || _.isFunction(arg && arg.then);
}

export function asArray(arg) {
	if(_.isArray(arg))
		return arg;
	else if(arg == null || arg === '')
		return [];
	else
		return [arg];
}

export function race(...promises){
	return Promise.race(promises);
}

export function valueToPromise(arg){
	if(!isPromisable(arg)) {
		let result = arg;
		arg = arg == null || arg === '' ? Promise.resolve() : Promise.reject(result);
	}
	return arg;		
}
