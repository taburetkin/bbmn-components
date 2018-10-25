import _ from 'underscore';
import { ModelSchemas } from '../model-schemas';
import notify from './notify';

function convertOptionsToNotify(opts = {}){
	let defs =_.pick(opts, 'notifyId', 'notifyStore');
	defs = {
		id: defs.notifyId,
		store: defs.notifyStore
	};
	let raw = _.pick(opts, 'notifyWait', 'notifyError', 'notifySuccess');
	let result = _.reduce(raw, (memo, val, key) => {
		let parsedKey = key.replace(/^notify(\w)/, (match, letter) => { return letter.toLowerCase(); });
		if(_.isString(val)){
			val = {
				text: val
			};
		}
		memo[parsedKey] = val;
	}, {});
	if (!_.size(result)) {
		return;
	}
	return _.extend(defs, result);
}

export default Base => Base.extend({
	getNotifyOptions(method, opts = {}){
		let notify = convertOptionsToNotify(opts);
		let schema = ModelSchemas.get(this);
		if (schema) {
			let notifies = schema.getOption('notifies') || {};
			let byMethod = notifies[method];
			notify = _.extend({}, byMethod, notify);
		}

		if(!_.size(notify)) {
			return;
		} else {
			return notify;
		}


	},
	sync(method, model, options){
		let notifyOptions = this.getNotifyOptions(method, options);
		let note;
		if(notifyOptions && notifyOptions.wait){
			note = notify.wait(notifyOptions.wait);
		}
		let xhr = Base.prototype.sync.apply(this, arguments);
		if (!notifyOptions) {
			return xhr;
		}
		xhr.then(
			() => {
				if (!notifyOptions.success) {
					if (note) {
						note.removed();
					}
					return;
				}
				if (note) {
					notifyOptions.success.id = note.id;
				}
				notify.success(notifyOptions.success);
			},
			xhr => {
				if (!notify.error) {
					if (note) {
						note.removed();
					}
					return;
				}
				if (note) {
					notifyOptions.error.id = note.id;
					notifyOptions.error.xhr = xhr;
				}				
				notify.error(notifyOptions.error);				
			}
		);
		return xhr;
	}
});
