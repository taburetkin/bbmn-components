import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiJq from 'chai-jq';
import _ from 'underscore';
import Backbone from 'backbone';
import Mn from 'backbone.marionette';

chai.use(sinonChai);
chai.use(chaiJq);

global.chai = chai;
global.sinon = sinon;

if (!global.document || !global.window) {

	let jsdom = require('jsdom');
	const { JSDOM } = jsdom;
	let dom = new JSDOM('<html><head><script></script></head><body></body></html>', {
		FetchExternalResources: ['script'],
		ProcessExternalResources: ['script']
	});
	global.window = dom.window;
	global.document = dom.window.document;
	global.navigator = dom.window.navigator;	
}

const $ = require('jquery')(global.window);

Backbone.$ = $;
global.Backbone = Backbone;
global.Mn = Mn;
global._ = _;
global.$ = $;
global.expect = global.chai.expect;

beforeEach(function() {
	this.sinon = global.sinon.createSandbox();
});

afterEach(function() {
    this.sinon.restore();
});
