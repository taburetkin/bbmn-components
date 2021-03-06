import { Model } from 'bbmn-core';
import _ from 'underscore';

/*
By default expects token on initialize
new User({...}, { token });
you can use bbmn-components bearer-token for that
or something else
but token should have this defined properties:
	token.ready - promise
	token.hasToken() - should return true or flase
	token.update() - invokes on user change event, should receive refreshed token

*/
export default Model.extend({
	
	shouldRequestOnInitialize: true,

	constructor(hash, opts){
		this._waitFor = [];
		this.initializeToken(opts);
		Model.apply(this, arguments);

		if (this.shouldRequestOnInitialize) {
			this.getReady();
		}
	},
	initializeToken(opts = {}){
		let { token } = opts;
		if (!token) {
			token = this.token;
		}
		if (!token) return;
		this.listenTo(token, 'changed', this.refresh);
		this.token = token;
		token.ready && this._waitFor.push(token.ready);
	},
	getReady(){
		if(this.ready) return this.ready;
		

		this.ready = new Promise((resolve) => {
			this.once('changed', () => resolve());
			Promise.all(this._waitFor).then(
				() => this.refresh(),
				() => this.reflectChanges({ clear: true })
			);
		});

		return this.ready;
	},
	logoff(options){
		return new Promise((resolve) => {
			this.once('changed', () => resolve());
			if (this.token) {
				this.token.update(undefined, options);
			} else {
				this.reflectChanges(_.extend({}, options, { clear: true }));
			}
		});
	},
	//override this for getting auth status
	getState(){
		return this.isLogged() ? 'auth' : 'anonym';
	},
	isLogged(){
		return this.get('authenticated') === true;
	},
	hasToken(){
		return this.token && this.token.hasToken();
	},
	refresh(tokenOptions){		
		if (this._refreshing) { return this._refreshing; }
		let promise = this._refreshing = new Promise((resolve) => {
			
			let currentAttrs = _.clone(this.attributes);

			if (!this.hasToken()) {
				this.reflectChanges(_.extend({}, tokenOptions, { clear: true }), currentAttrs);
				resolve();
			} else {
				
				this.fetch().then(() => {
					this.reflectChanges(tokenOptions, currentAttrs);
					resolve();
				}, () => {				
					this.reflectChanges(_.extend({}, tokenOptions, { store: false }), currentAttrs);
					resolve();
				});
			}
		});		
		promise.then(() => {
			delete this._refreshing;
		});
		return promise;
	},
	reflectChanges(opts = {}, prevAttrs){
		let { silent, clear, store = true } = opts;
		clear && this.clear();
		store && this.store(clear);
		let options = _.omit(opts, 'clear', 'store');
		!silent && this.trigger('changed', this, options);
		this.afterReflectChanges(prevAttrs, opts);
	},
	afterReflectChanges(prevAttrs, opts) {},
	isMe(arg){
		let me = this.get(this.idAttribute);
		return _.isEqual(me, arg);
	},
	// implement by your own
	store(){},
});
