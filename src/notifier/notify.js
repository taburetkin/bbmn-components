import _ from 'underscore';
import notifies from './notifies';


export default function notify(hash){
	let model = notifies.get(hash);
	if(model) {
		model.wasShown = false;
		hash.viewed = false;
	}
	return notifies.add(hash, { merge: true, update: true});
}


function normalizeOptions(arg1){
	if(_.isString(arg1)) {
		return { text: arg1 };
	} else if(_.isObject(arg1)) {
		return arg1;
	}
}

notify.wait = function(arg){
	let options = _.extend({ 
		type: 'wait', id: _.uniqueId('waitNotify') 
	}, 
	normalizeOptions(arg));
	return notify(options);
};

notify.error = function(arg){
	let options = _.extend({ 
		type: 'error', id: _.uniqueId('waitNotify') 
	}, 
	normalizeOptions(arg));
	return notify(options);
};
notify.success = function(arg){
	let options = _.extend({ 
		type: 'success', id: _.uniqueId('waitNotify') 
	}, 
	normalizeOptions(arg));
	return notify(options);
};
notify.message = function(arg){
	let options = _.extend({ 
		type: 'message', 		
		id: _.uniqueId('waitNotify'),
		viewedDelay: 3,
		removedDelay: 600
	}, 
	normalizeOptions(arg));
	return notify(options);
};
