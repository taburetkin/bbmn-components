import ModelSchemas from './store.js';
export default Model => Model.extend({
	getSchema(){
		return ModelSchemas.get(this);
	},
	getPropertySchema(key){
		let schema = this.getSchema();
		if(schema) {
			return schema.getProperty(key);
		}
	},
	display(key, options = {}){
		let value = this.get(...arguments);
		let property = this.getPropertySchema(key);
		if (property) {			
			return property.getDisplayValue(value, this, options);
		}
		return value;
	},
	displayLabel(key){
		let property = this.getPropertySchema(key);
		if (property) {
			return property.getLabel(this);
		}
	}
});
