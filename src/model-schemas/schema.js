import { BaseClass } from 'bbmn-core';
import { getOption } from 'bbmn-utils';

const Schema = BaseClass.extend({
	getOption: function(){
		return getOption(this, ...arguments);
	}
});
export default Schema;
