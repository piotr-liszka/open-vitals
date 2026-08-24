// in dev, this makes Vite inject its client as this module's first dependency,
// so that global constant replacements are installed before any other module
// (including user hooks) evaluates. In build it's inert.
import.meta.hot;




export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21')
];

export const server_loads = [0,2];

export const dictionary = {
		"/": [~3],
		"/activities": [~4],
		"/activities/mapa": [~6],
		"/activities/[id]": [~5],
		"/dashboard/new": [~8],
		"/dashboard/[id]": [~7],
		"/data": [~9],
		"/insights": [~10],
		"/login": [11],
		"/settings": [~12],
		"/settings/integrations": [~13],
		"/styleguide": [14],
		"/training": [~15,[2]],
		"/training/bieg": [~16,[2]],
		"/training/cele": [~17,[2]],
		"/training/marsz": [~18,[2]],
		"/training/objetosc": [~19,[2]],
		"/training/plan": [~20,[2]],
		"/training/rower": [~21,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';

export const get_error_template = () => import('../shared/error-template.js').then(m => m.default);