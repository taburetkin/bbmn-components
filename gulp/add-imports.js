import { createFilter } from 'rollup-pluginutils';



const DEFAULT_HEADER = `
import _ from \'underscore\';
`;

export default (opts = {}) => {
  //opts = assign({}, opts || {})
  if (!opts.include) {
	opts.include = 'src/**/*.js';
    //throw Error('include option should be specified')
  }
  let filter = createFilter(opts.include, opts.exclude)
  let header = opts.header !== undefined ? opts.header : DEFAULT_HEADER

  return {
    name: 'add-import',
    transform (code, id) {
	  if (!filter(id)) return;
      return {
        code: header + '\n' + code,
        map: { mappings: '' }
      }
    }
  }
}
