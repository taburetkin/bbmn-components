import _ from 'underscore';
export default function registerProcess (Process, context, name, opts) {

	context[name] = function(...args){
		
		let process = new Process(context, name, _.extend({}, opts));
		let concurrent = process.concurrencyCheck();

		if (concurrent)
			return concurrent;
		else
			return process.run(...args);

	};

}
