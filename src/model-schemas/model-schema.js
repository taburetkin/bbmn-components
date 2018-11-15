import _ from 'underscore';
import Schema from './schema.js';
import PropertySchema from './property-schema.js';
import { isEmptyValue } from 'bbmn-utils';

export default Schema.extend({
	constructor(properties = {}, options = {}){
		this.options = _.clone(options);
		this.properties = {};
		Schema.apply(this,arguments);
		this.setProperties(properties);
	},
	propertySchema: PropertySchema,
	_createProperty(property){
		let props = this.getProperties();
		let order = _.size(props);
		let Schema = this.getOption('propertySchema');
		let options = { name: property.name, property, modelSchema: this, order };
		return this.createProperty(Schema, options);
	},
	createProperty(Schema, options){
		return new Schema(options);
	},
	setProperties(properties){
		return _.map(properties, (property, name) => {
			if(!_.isObject(property)) { return; }

			let propertyName = _.isString(name) ? name : property.name;
			if (isEmptyValue(propertyName)) {
				throw new Error('property name missing: ' + name);
			}			
			return this.setProperty(propertyName, property);

		});
	},
	getProperties(){
		return this.properties;
	},
	getPropertiesArray(){
		let props = this.getProperties();
		return _.toArray(props)
			.sort((p1,p2) => p1.order - p2.order);		
	},
	getPropertiesNames(){
		let props = this.getPropertiesArray();
		return _.pluck(props, 'name');
	},
	getProperty(name, { create = false } = {}){
		let properties = this.getProperties() || {};
		let property = properties[name];
		if(property || !create) {
			
			return property;
		}
		property = this._createProperty(name);
		return this.setProperty(name, property);
	},
	_setProperty(name, property){
		if(!_.isObject(property)){
			throw new Error('property is not an object', property);
		}
		if(isEmptyValue(name)){
			throw new Error('property has no name', property);
		}

		if (isEmptyValue(property.name)) {
			property.name = name;
		}

		if(!(property instanceof PropertySchema)){
			property = this._createProperty(property);
		}

		let properties = this.getProperties();
		properties[property.name] = property;

		return property;
	},
	setProperty(name, property) {
		if(_.isObject(name)){
			property = name;
			name = property.name;
		}
		return this._setProperty(name, property);
	},
	getValidation(name) {
		let property = this.getProperty(name);
		return property && property.getValidation() || {};
	},
	getType(name) {
		let property = this.getProperty(name);
		return property && property.getType() || {};
	},
	getLabel(name){
		let property = this.getProperty(name);
		return property && property.getLabel() || '';
	}
});
