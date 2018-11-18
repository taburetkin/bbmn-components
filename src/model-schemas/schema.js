import { BaseClass, Events } from 'bbmn-core';
import { getOption, triggerMethod, mix } from 'bbmn-utils';

const Schema = mix(BaseClass).with(Events).extend({
	getOption: function(){
		return getOption(this, ...arguments);
	},
	triggerMethod
});

export default Schema;
