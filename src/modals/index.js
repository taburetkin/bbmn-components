import config from './config.js';
import _ from 'underscore';
import { FooterView } from './views';
import { takeFirst } from 'bbmn-utils';

function show(opts = {}, showOptions = {}){

	if(!opts.attributes){
		opts.attributes = {
			'data-modal': opts.modalType || ''
		};
	}

	let modal = config.buildView(opts, showOptions);


	config.render(modal, config.getStack(), showOptions);

	if (showOptions.returnAsPromise && opts.promise) {
		return modal.promise;
	} else {
		return modal;
	}


}


function normalizeConfirmFooter(opts = {}){
	if (!opts.footer) {
		opts.footer = FooterView;
	}

	if(!opts.footerOptions) {
		opts.footerOptions = {};
	}

	let fopts = opts.footerOptions;
	fopts.resolveWith = takeFirst('resolveWith', fopts, opts);
	fopts.rejectWith = takeFirst('rejectWith', fopts, opts);
	fopts.resolveText = takeFirst('resolveText', fopts, opts) || config.confirmResolveText;
	fopts.rejectText = takeFirst('rejectText', fopts, opts) || config.confirmRejectText;	
	return opts;
}

function confirm(arg, showOptions = {}) {
	if (_.isString(arg)) {
		arg = {
			content: arg
		};
	} else if (!_.isObject(arg)) {
		arg = {};
	}
	if(arg.text && !arg.content) {
		arg.content = arg.text;
	}
	arg.promise = true;
	if(showOptions.returnAsPromise == null) {
		showOptions.returnAsPromise = true;
	}
	arg.modalType = 'confirm';
	arg = normalizeConfirmFooter(arg);

	return show(arg, showOptions);
}


export default {
	config,
	show,
	confirm
};
