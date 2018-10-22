import config from './config.js';
import _ from 'underscore';

function show(opts = {}, showOptions = {}){

	let modal = config.buildView(opts, showOptions);
	config.render(modal, config.getStack(), showOptions);

	if (showOptions.returnAsPromise && opts.promise) {
		return modal.promise;
	} else {
		return modal;
	}


}

function confirm(arg, showOptions = {}) {
	if (_.isString(arg)) {
		arg = {
			content: arg
		};
	}
	if(arg.text && !arg.content) {
		arg.content = arg.text;
	}
	arg.promise = true;
	if(showOptions.returnAsPromise == null) {
		showOptions.returnAsPromise = true;
	}
	return show(arg, showOptions);
}


export default {
	config,
	show,
	confirm
};
