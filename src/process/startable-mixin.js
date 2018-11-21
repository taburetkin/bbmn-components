import _ from 'underscore';
import Process from './process.js';
import { getOption } from 'bbmn-utils';

const defaultStartableOptions  = {
	concurrent: false,
	exposeSelf: true,
	//good place to supply own state collecting logic
	storeState(){

		this.contextState = [{
			key: 'startable.status',
			value: this.context['startable.status']
		}];


		/*

		for example: take all simple values from context

		for(var key in this.context){
			let value = this.context[key];
			if (value == null || !_.isObject(value.valueOf()))
				this.contextState.push({ key, value });
		}

		*/

	},
	restoreState(){
		_(this.contextState || []).each(keyValue => {
			this.context[keyValue.key] = keyValue.value;
		});
	},
	onBefore(...args){
		this.storeState();
		this.ensureState();
		this.context['startable.status'] = this.processingName;
		this.context['startable.start.lastArguments'] = args;
	},
	onComplete(){
		this.context['startable.status'] = this.processedName;
	},	
	onError(){
		this.restoreState();
	},
	ensureState(shouldThrow = true){
		let other = this.name == 'start' ? 'stop' : 'start';
		let error = this.name == 'start' ? 'not:stopped' : 'not:started';
		let status = this.context['startable.status'];
		switch(status){
		case 'stopping':
		case 'starting':
			if(shouldThrow) throw new Error('not:iddle');
			else return 'not:iddle';
		case 'iddle':
			if(this.name == 'start') return;
			else if(shouldThrow) throw new Error(error);
			else return error;
		case other:
			if(shouldThrow) throw new Error(error);
			else return error;			
		}
	}
};

const defaultStartOptions  = {
	processingName: 'starting',
	processedName: 'started'
};
const defaultStopOptions  = {
	processingName: 'stopping',
	processedName: 'stopped'
};



export default Base => Base.extend({
	constructor(){
		Base.apply(this, arguments);
		this._initializeStartable();
	},
	_initializeStartable(){
		if (this._startableInitialized) return;

		let startable = _.extend({}, defaultStartableOptions, getOption(this, 'startableOptions', {args:[this]}));

		let start = _.extend({}, startable, defaultStartOptions, getOption(this, 'startOptions', {args:[this]}));
		let stop = _.extend({}, startable, defaultStopOptions, getOption(this, 'stopOptions', {args:[this]}));

		Process.register(this, 'start', start);
		Process.register(this, 'stop', stop);
		
		this._startableInitialized = true;
	},
	isStarted(){
		return this['startable.status'] === 'started';
	},
	isStopped(){
		return this['startable.status'] == null || this['startable.status'] === 'stopped' || this['startable.status'] === 'iddle';
	},
	isNotIddle(){
		return this['startable.status'] === 'stopping' || this['startable.status'] === 'starting';
	},
	restart(){
		if(this.isNotIddle())
			throw new Error('Restart not allowed while startable instance is not iddle: ', this['startable.status']);
		let stop = this.isStarted() ? this.stop() : Promise.resolve();
		let args = this['startable.start.lastArguments'] || [];
		return stop.then(() => this.start(...args));
	}	
},{ StartableMixin: true });
