import Fake from './fake.js';

let session = (typeof sessionStorage === 'undefined') 
	? new Fake() : sessionStorage;

let local = (typeof localStorage === 'undefined') 
	? new Fake() : localStorage;

export {
	session,
	local
};
