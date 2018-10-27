import ModelSchemas from './store.js';
export default Model => Model.extebd({
	getSchema(){
		return ModelSchemas.get(this);
	},
	display(key, options){
		let schema = this.getSchema();
		let value = this.get(...arguments);
		if (schema) {
			let property = schema.getProperty(key);
			if (property) {
				return property.getDisplayValue(value, this, options);
			}
		}
		return value;
	}
});
